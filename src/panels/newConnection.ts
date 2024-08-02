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

import * as vscode from "vscode";
import { getUri } from "../utils/getUri";
import { getNonce } from "../utils/getNonce";
import { ext } from "../extensionVariables";
import { InsightsNode, KdbNode } from "../services/kdbTreeProvider";
import { ConnectionType, EditConnectionMessage } from "../models/messages";
import { getWorkspaceLabels } from "../utils/connLabel";

export class NewConnectionPannel {
  public static currentPanel: NewConnectionPannel | undefined;
  private readonly _extensionUri: vscode.Uri;
  public readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static render(extensionUri: vscode.Uri, conn?: any) {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.dispose();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "kdbNewConnection",
      conn ? "Edit Connection" : "New Connection",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      },
    );

    NewConnectionPannel.currentPanel = new NewConnectionPannel(
      panel,
      extensionUri,
    );

    if (conn) {
      const connType = this.getConnectionType(conn);
      const editConnData = this.createEditConnectionMessage(conn, connType);
      panel.webview.postMessage({
        command: "editConnection",
        data: editConnData,
      });
    }
    panel.webview.postMessage({
      command: "refreshLabels",
      data: ext.connLabelList,
    });
  }

  public static close() {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.dispose();
      return;
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      this._extensionUri,
    );
    /* istanbul ignore next */
    this._panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "kdb.newConnection.createNewBundledConnection") {
        if (ext.isBundleQCreated) {
          vscode.window.showErrorMessage(
            "Bundled Q is already created, please remove it first",
          );
        } else {
          vscode.commands.executeCommand(
            "kdb.newConnection.createNewBundledConnection",
            message.data,
          );
        }
      }
      if (message.command === "kdb.newConnection.createNewInsightConnection") {
        vscode.commands.executeCommand(
          "kdb.newConnection.createNewInsightConnection",
          message.data,
        );
      }
      if (message.command === "kdb.newConnection.createNewConnection") {
        vscode.commands.executeCommand(
          "kdb.newConnection.createNewConnection",
          message.data,
        );
      }
      if (message.command === "kdb.newConnection.editInsightsConnection") {
        vscode.commands.executeCommand(
          "kdb.newConnection.editInsightsConnection",
          message.data,
          message.oldAlias,
        );
      }
      if (message.command === "kdb.newConnection.editMyQConnection") {
        vscode.commands.executeCommand(
          "kdb.newConnection.editMyQConnection",
          message.data,
          message.oldAlias,
          message.editAuth,
        );
      }
      if (message.command === "kdb.newConnection.editBundledConnection") {
        vscode.commands.executeCommand(
          "kdb.newConnection.editBundledConnection",
          message.data,
          message.oldAlias,
        );
      }
      if (message.command === "kdb.labels.create") {
        vscode.commands.executeCommand(
          "kdb.labels.create",
          message.data.name,
          message.data.colorName,
        );
        setTimeout(() => {
          this._panel.webview.postMessage({
            command: "refreshLabels",
            data: ext.connLabelList,
          });
        }, 500);
      }
    });
  }

  public dispose() {
    NewConnectionPannel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ) {
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();

    return /* html */ `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Connection</title>
            <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </head>
        <body>
            <kdb-new-connection-view/>
        </body>
        </html>
        `;
  }

  private static getConnectionType(
    conn: KdbNode | InsightsNode,
  ): ConnectionType {
    if (conn instanceof InsightsNode) {
      return ConnectionType.Insights;
    } else {
      return conn.details.managed
        ? ConnectionType.BundledQ
        : ConnectionType.Kdb;
    }
  }

  private static createEditConnectionMessage(
    conn: KdbNode | InsightsNode,
    connType: ConnectionType,
  ): EditConnectionMessage {
    return {
      connType,
      serverName:
        conn instanceof InsightsNode
          ? conn.details.alias
          : conn.details.serverAlias,
      serverAddress:
        conn instanceof InsightsNode
          ? conn.details.server
          : conn.details.serverName,
      realm: conn instanceof InsightsNode ? conn.details.realm : undefined,
      port: conn instanceof KdbNode ? conn.details.serverPort : undefined,
      auth: conn.details.auth,
      tls: conn instanceof KdbNode ? conn.details.tls : undefined,
      insecure:
        conn instanceof InsightsNode ? conn.details.insecure : undefined,
    };
  }
}
