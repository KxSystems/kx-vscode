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

export class NewConnectionPannel {
  public static currentPanel: NewConnectionPannel | undefined;
  private uri;
  public readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.uri = extensionUri;
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri,
    );
    /* istanbul ignore next */
    this._panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "kdb.newConnection.createNewBundledConnection") {
        if (ext.isBundleQCreated) {
          vscode.window.showErrorMessage(
            "Bundle Q is already created, please remove it first",
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
    });
  }

  public static render(extensionUri: vscode.Uri) {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.dispose();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "kdbNewConnection",
      "New Connection",
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
  }

  public static close() {
    if (NewConnectionPannel.currentPanel) {
      NewConnectionPannel.currentPanel._panel.dispose();
      return;
    }
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
        </head>
        <body>
            <kdb-new-connection-view/>
            <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        </body>
        </html>
        `;
  }
}
