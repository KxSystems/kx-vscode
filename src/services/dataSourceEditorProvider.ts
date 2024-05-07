/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import {
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  Range,
  TextDocument,
  Webview,
  WebviewPanel,
  WorkspaceEdit,
  commands,
  window,
  workspace,
} from "vscode";
import { getUri } from "../utils/getUri";
import { getNonce } from "../utils/getNonce";
import { ext } from "../extensionVariables";
import { InsightsNode } from "./kdbTreeProvider";
import {
  activateConnectionForServer,
  getInsightsServers,
  getServerForUri,
  setServerForUri,
} from "../commands/workspaceCommand";
import { DataSourceCommand, DataSourceMessage2 } from "../models/messages";
import { isDeepStrictEqual } from "util";
import {
  populateScratchpad,
  runDataSource,
} from "../commands/dataSourceCommand";
import { LocalConnection } from "../classes/localConnection";
import { InsightsConnection } from "../classes/insightsConnection";

export class DataSourceEditorProvider implements CustomTextEditorProvider {
  static readonly viewType = "kdb.dataSourceEditor";

  public static register(context: ExtensionContext): Disposable {
    const provider = new DataSourceEditorProvider(context);
    return window.registerCustomEditorProvider(
      DataSourceEditorProvider.viewType,
      provider,
    );
  }

  constructor(private readonly context: ExtensionContext) {}

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
  ): Promise<void> {
    const webview = webviewPanel.webview;
    webview.options = { enableScripts: true };
    webview.html = this.getWebviewContent(webview);

    const refreshDataSource = async () => {
      // TODO ECMEL
      if (ext.activeConnection instanceof InsightsConnection) {
        Object.assign(ext.insightsMeta, await ext.activeConnection.getMeta());
      }
    };

    await refreshDataSource();

    const updateWebview = () => {
      webview.postMessage(<DataSourceMessage2>{
        command: DataSourceCommand.Update,
        servers: getInsightsServers(),
        selectedServer: getServerForUri(document.uri) || "",
        isInsights: ext.connectionNode instanceof InsightsNode,
        insightsMeta: ext.insightsMeta,
        dataSourceFile: this.getDocumentAsJson(document),
      });
    };

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

    webview.onDidReceiveMessage(async (msg: DataSourceMessage2) => {
      switch (msg.command) {
        case DataSourceCommand.Server:
          await setServerForUri(document.uri, msg.selectedServer);
          break;
        case DataSourceCommand.Change:
          const changed = msg.dataSourceFile;
          const current = this.getDocumentAsJson(document);
          if (isDeepStrictEqual(current, changed)) {
            break;
          }
          this.updateTextDocument(document, changed);
          break;
        case DataSourceCommand.Save:
          await commands.executeCommand(
            "workbench.action.files.save",
            document,
          );
          break;
        case DataSourceCommand.Refresh:
          await activateConnectionForServer(msg.selectedServer);
          await refreshDataSource();
          updateWebview();
          break;
        case DataSourceCommand.Run:
          await activateConnectionForServer(msg.selectedServer);
          await runDataSource(msg.dataSourceFile);
          updateWebview();
          break;
        case DataSourceCommand.Populate:
          await activateConnectionForServer(msg.selectedServer);
          await populateScratchpad(msg.dataSourceFile);
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

    try {
      return JSON.parse(text);
    } catch (error) {
      throw error;
    }
  }

  private updateTextDocument(document: TextDocument, json: unknown) {
    const edit = new WorkspaceEdit();

    edit.replace(
      document.uri,
      new Range(0, 0, document.lineCount, 0),
      JSON.stringify(json, null, 2),
    );

    return workspace.applyEdit(edit);
  }

  private getWebviewContent(webview: Webview) {
    const webviewUri = getUri(webview, this.context.extensionUri, [
      "out",
      "webview.js",
    ]);
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DataSource</title>
      </head>
      <body>
        <kdb-data-source-view></kdb-data-source-view>
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
      </body>
      </html>
    `;
  }
}
