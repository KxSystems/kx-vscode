/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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
  ColorThemeKind,
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
import { runDataSource } from "../commands/dataSourceCommand";
import { prepareToPopulateScratchpad } from "../commands/executionCommand";
import {
  getConnectionForServer,
  getInsightsServers,
  getServerForUri,
  setServerForUri,
} from "../commands/workspaceCommand";
import { ExecutionTypes } from "../models/execution";
import { DataSourceCommand, DataSourceMessage2 } from "../models/messages";
import { MetaObjectPayload } from "../models/meta";
import { UDA } from "../models/uda";
import { getBasename, offerConnectAction } from "../utils/core";
import { getNonce } from "../utils/getNonce";
import { MessageKind, Runner, notify } from "../utils/notifications";
import { parseUDAList } from "../utils/uda";
import { getUri } from "../utils/uriUtils";

const logger = "dataSourceEditorProvider";

export class DataSourceEditorProvider implements CustomTextEditorProvider {
  public filenname = "";
  static readonly viewType = "kdb.dataSourceEditor";

  public static register(context: ExtensionContext): Disposable {
    const provider = new DataSourceEditorProvider(context);
    return window.registerCustomEditorProvider(
      DataSourceEditorProvider.viewType,
      provider,
    );
  }

  private cache = new Map<string, Promise<MetaObjectPayload | undefined>>();

  constructor(private readonly context: ExtensionContext) {}

  async getMeta(connLabel: string) {
    let meta = this.cache.get(connLabel);
    const connMngService = new ConnectionManagementService();
    const isConnected = connMngService.isConnected(connLabel);
    if (!isConnected) {
      this.cache.set(connLabel, Promise.resolve(<MetaObjectPayload>{}));
      return Promise.resolve(<MetaObjectPayload>{});
    }
    const selectedConnection =
      connMngService.retrieveConnectedConnection(connLabel);

    try {
      if (
        !(selectedConnection instanceof InsightsConnection) ||
        !selectedConnection
      ) {
        throw new Error("The connection selected is not Insights");
      }
      if (
        !selectedConnection.meta ||
        selectedConnection.meta.payload.assembly.length === 0
      ) {
        throw new Error();
      }
      meta = Promise.resolve(selectedConnection?.meta?.payload);

      this.cache.set(connLabel, meta);
    } catch {
      notify(
        "No database running in this Insights connection.",
        MessageKind.ERROR,
        { logger },
      );
      meta = Promise.resolve(<MetaObjectPayload>{});
      this.cache.set(connLabel, meta);
    }
    return (await meta) || Promise.resolve(<MetaObjectPayload>{});
  }

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
  ): Promise<void> {
    this.filenname = document.fileName.split("/").pop() || "";
    const webview = webviewPanel.webview;
    webview.options = { enableScripts: true };
    webview.html = this.getWebviewContent(webview);
    let changing = 0;
    const connMngService = new ConnectionManagementService();

    const updateWebview = async () => {
      if (changing === 0) {
        const selectedServer = getServerForUri(document.uri) || "";
        const selectedServerVersion =
          await connMngService.retrieveInsightsConnVersion(selectedServer);
        await getConnectionForServer(selectedServer);
        const insightsMeta = await this.getMeta(selectedServer);
        const UDAs: UDA[] = parseUDAList(insightsMeta);
        webview.postMessage(<DataSourceMessage2>{
          command: DataSourceCommand.Update,
          selectedServer,
          servers: getInsightsServers(),
          selectedServerVersion,
          dataSourceFile: this.getDocumentAsJson(document),
          insightsMeta,
          isInsights: true,
          UDAs,
        });
      }
    };

    /* c8 ignore next */
    workspace.onDidChangeConfiguration((event) => {
      if ((event.affectsConfiguration("kdb.connectionMap"), document)) {
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

    /* c8 ignore next */
    webview.onDidReceiveMessage(async (msg: DataSourceMessage2) => {
      const selectedServer = getServerForUri(document.uri) || "";
      const connected = connMngService.isConnected(selectedServer);

      /* c8 ignore next */
      switch (msg.command) {
        case DataSourceCommand.Server: {
          await setServerForUri(document.uri, msg.selectedServer);
          updateWebview();
          break;
        }
        case DataSourceCommand.Change: {
          const changed = msg.dataSourceFile;
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
        case DataSourceCommand.Save: {
          await commands.executeCommand(
            "workbench.action.files.save",
            document,
          );
          break;
        }
        case DataSourceCommand.Refresh: {
          if (connected) {
            const runner = Runner.create(async () => {
              await connMngService.refreshGetMeta(selectedServer);
              this.cache.delete(selectedServer);
              updateWebview();
            });
            runner.location = ProgressLocation.Notification;
            runner.title = `Refreshing meta data for ${selectedServer}.`;
            await runner.execute();
          } else {
            await offerConnectAction(selectedServer);
          }
          break;
        }
        case DataSourceCommand.Run:
          {
            if (!connected) {
              const connectedAfterOffering =
                await offerConnectAction(selectedServer);
              if (!connectedAfterOffering) {
                break;
              }
            }

            const runner = Runner.create(() =>
              runDataSource(
                msg.dataSourceFile,
                msg.selectedServer,
                this.filenname,
              ),
            );
            runner.location = ProgressLocation.Notification;
            runner.title = `Running ${getBasename(document.uri)} on ${msg.selectedServer}.`;
            await runner.execute();
          }
          break;

        case DataSourceCommand.Populate:
          {
            if (!connected) {
              const connectedAfterOffering =
                await offerConnectAction(selectedServer);
              if (!connectedAfterOffering) {
                break;
              }
            }

            const runner = Runner.create(() =>
              prepareToPopulateScratchpad(
                msg.selectedServer,
                ExecutionTypes.PopulateScratchpad,
                undefined,
                undefined,
                msg.dataSourceFile,
              ),
            );
            runner.title = "Populating scratchpad.";
            await runner.execute();
          }
          break;
      }
    });

    updateWebview();
  }

  private getDocumentAsJson(document: TextDocument) {
    const text = document.getText();
    if (text.trim().length === 0) {
      return {};
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
      <html lang="en" class="${
        window.activeColorTheme.kind === ColorThemeKind.Light ||
        window.activeColorTheme.kind === ColorThemeKind.HighContrastLight
          ? "sl-theme-light"
          : "sl-theme-dark"
      }">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="${getResource("light.css")}" />
        <link rel="stylesheet" href="${getResource("style.css")}" />
        <script type="module" nonce="${getNonce()}" src="${getResource("webview.js")}"></script>
        <title>DataSource</title>
      </head>
      <body>
        <kdb-data-source-view></kdb-data-source-view>
      </body>
      </html>
    `;
  }
}
