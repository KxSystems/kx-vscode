/*
 * Copyright (c) 1998-2026 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import { isDeepStrictEqual } from "util";
import {
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  ProgressLocation,
  Range,
  TextDocument,
  Webview,
  WebviewPanel,
  WorkspaceEdit,
  commands,
  window,
  workspace,
} from "vscode";

import { ConnectionManagementService } from "./connectionManagerService";
import { InsightsConnection } from "../classes/insightsConnection";
import {
  populateScratchpad,
  runDataSource,
} from "../commands/dataSourceCommand";
import {
  getConnectionForServer,
  getServerForUri,
  getTimeoutForUri,
  pickConnection,
} from "../commands/workspaceCommand";
import { QueryCommand, QueryMessage } from "../models/messages";
import { MetaObjectPayload } from "../models/meta";
import { QueryFile, createDefaultQueryFile } from "../models/query";
import { UDA } from "../models/uda";
import { getBasename, offerConnectAction } from "../utils/core";
import { getNonce } from "../utils/getNonce";
import { MessageKind, Runner, notify } from "../utils/notifications";
import {
  parseQueryList,
  parseTables,
  parseTargets,
  queryType,
  toDataSourceFile,
} from "../utils/query";
import { RunFlag, notifyExecution } from "../utils/queryUtils";
import { getUri } from "../utils/uriUtils";
import { webviewReset } from "../utils/webviewPage";

const logger = "queryEditorProvider";

export class QueryEditorProvider implements CustomTextEditorProvider {
  static readonly viewType = "kdb.queryEditor";

  public static register(context: ExtensionContext): Disposable {
    const provider = new QueryEditorProvider(context);
    return window.registerCustomEditorProvider(
      QueryEditorProvider.viewType,
      provider,
    );
  }

  private cache = new Map<string, UDA[]>();
  private tables = new Map<string, { [table: string]: string[] }>();
  private targets = new Map<string, string[]>();

  constructor(private readonly context: ExtensionContext) {}

  async getQueries(connLabel: string): Promise<UDA[]> {
    const cached = this.cache.get(connLabel);
    if (cached) {
      return cached;
    }

    const connMngService = new ConnectionManagementService();
    if (!connMngService.isConnected(connLabel)) {
      return parseQueryList(<MetaObjectPayload>{});
    }

    const connection = connMngService.retrieveConnectedConnection(connLabel);
    if (
      !(connection instanceof InsightsConnection) ||
      !connection.meta ||
      connection.meta.payload.assembly.length === 0
    ) {
      notify(
        "No database running in this Insights connection.",
        MessageKind.WARNING,
        { logger },
      );
      return parseQueryList(<MetaObjectPayload>{});
    }

    const queries = parseQueryList(connection.meta.payload);
    this.cache.set(connLabel, queries);
    this.tables.set(connLabel, parseTables(connection.meta.payload));
    this.targets.set(
      connLabel,
      parseTargets(connection.meta.payload, connection.insightsVersion),
    );
    return queries;
  }

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = { enableScripts: true };
    webview.html = this.getWebviewContent(webview);
    let changing = 0;
    const connMngService = new ConnectionManagementService();

    const updateWebview = async () => {
      if (changing === 0) {
        const selectedServer = getServerForUri(document.uri) || "";
        await getConnectionForServer(selectedServer);
        const queries = await this.getQueries(selectedServer);
        webview.postMessage(<QueryMessage>{
          command: QueryCommand.Update,
          file: this.getDocumentAsJson(document),
          queries,
          tables: this.tables.get(selectedServer) || {},
          targets: this.targets.get(selectedServer) || [],
          isMetaLoaded: connMngService.isConnected(selectedServer),
          selectedServer,
        });
      }
    };

    workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.connectionMap")) {
        updateWebview();
      }
    });

    const changeDocumentSubscription = workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      },
    );

    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        updateWebview();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webview.onDidReceiveMessage(async (msg: QueryMessage) => {
      const selectedServer = getServerForUri(document.uri) || "";
      const connected = connMngService.isConnected(selectedServer);
      let runner: any;

      // Runner.execute rejects, and this handler is the end of the chain: a
      // rejection nothing catches is an error the user never sees (KXI-69283).
      const execute = async (pending: Runner<unknown>) => {
        try {
          if (connected) await pending.execute();
          else if (await offerConnectAction(selectedServer))
            await pending.execute();
        } catch (error) {
          if (pending.cancelled) {
            return;
          }
          const what = pending.title.replace(/\.$/, "") || "The query";
          notify(`${what} failed.`, MessageKind.ERROR, {
            logger,
            params: error,
          });
        }
      };

      switch (msg.command) {
        case QueryCommand.Connection: {
          await pickConnection(document.uri);
          updateWebview();
          break;
        }
        case QueryCommand.Change: {
          const changed = msg.file;
          const current = this.getDocumentAsJson(document);
          if (!isDeepStrictEqual(current, changed)) {
            changing++;
            try {
              await this.updateTextDocument(document, changed);
            } finally {
              changing--;
            }
          }
          break;
        }
        case QueryCommand.Save: {
          await commands.executeCommand(
            "workbench.action.files.save",
            document,
          );
          break;
        }
        case QueryCommand.Refresh: {
          runner = Runner.create(async () => {
            await connMngService.refreshGetMeta(selectedServer);
            this.cache.delete(selectedServer);
            this.tables.delete(selectedServer);
            this.targets.delete(selectedServer);
            updateWebview();
          });
          runner.location = ProgressLocation.Notification;
          runner.title = `Refreshing meta data for ${selectedServer}.`;
          await execute(runner);
          break;
        }
        case QueryCommand.Run: {
          runner = Runner.create(async (_, token) => {
            const cancellation = new Promise((_, reject) => {
              token.onCancellationRequested(() =>
                reject(new Error("Cancelled")),
              );
            });

            try {
              return await Promise.race([
                runDataSource(
                  toDataSourceFile(msg.file),
                  msg.selectedServer,
                  getBasename(document.uri),
                  token,
                  getTimeoutForUri(document.uri).value,
                ),
                cancellation,
              ]);
            } catch (err) {
              if (err instanceof Error && err.message === "Cancelled") {
                notify(
                  `Cancel request sent for ${msg.selectedServer}, however, the query will continue running on the database until it finishes or times out`,
                  MessageKind.INFO,
                  { logger },
                );
                return;
              }

              throw err;
            }
          });
          runner.location = ProgressLocation.Notification;
          runner.title = `Running ${getBasename(document.uri)} on ${msg.selectedServer}.`;
          await execute(runner);
          notifyExecution(RunFlag.Run, queryType(msg.file));
          break;
        }
        case QueryCommand.Populate: {
          runner = Runner.create(async (_, token) => {
            const cancellation = new Promise((_, reject) => {
              token.onCancellationRequested(() =>
                reject(new Error("Cancelled")),
              );
            });

            try {
              return await Promise.race([
                populateScratchpad(
                  toDataSourceFile(msg.file),
                  msg.selectedServer,
                  undefined,
                  undefined,
                  token,
                  getTimeoutForUri(document.uri).value,
                ),
                cancellation,
              ]);
            } catch (err) {
              if (err instanceof Error && err.message === "Cancelled") {
                notify(
                  `Scratchpad cancel request sent for ${msg.selectedServer}`,
                  MessageKind.INFO,
                  { logger, telemetry: "Connection.Cancel.ie.sp" },
                );
                return;
              }

              throw err;
            }
          });
          runner.location = ProgressLocation.Notification;
          runner.title = `Populating scratchpad on ${msg.selectedServer}.`;
          await execute(runner);
          notifyExecution(0, queryType(msg.file));
          break;
        }
      }
    });

    updateWebview();
  }

  private getDocumentAsJson(document: TextDocument): QueryFile {
    const text = document.getText();
    if (text.trim().length === 0) {
      return createDefaultQueryFile();
    }
    return JSON.parse(text);
  }

  private updateTextDocument(document: TextDocument, json: unknown) {
    const edit = new WorkspaceEdit();

    edit.replace(
      document.uri,
      new Range(0, 0, document.lineCount, 0),
      JSON.stringify(json, null, 2),
    );

    return workspace.applyEdit(edit, { isRefactoring: true });
  }

  private getWebviewContent(webview: Webview) {
    const getResource = (resource: string) =>
      getUri(webview, this.context.extensionUri, ["out", resource]);

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${webviewReset(getNonce())}
        <style nonce="${getNonce()}">
          @font-face {
            font-family: "codicon";
            font-display: block;
            src: url("${getResource("codicon.ttf")}") format("truetype");
          }
        </style>
        <script type="module" nonce="${getNonce()}" src="${getResource("query.js")}"></script>
        <title>Query</title>
      </head>
      <body>
        <kdb-query-view></kdb-query-view>
      </body>
      </html>
    `;
  }
}
