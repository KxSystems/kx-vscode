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
  window,
  workspace,
} from "vscode";
import { getUri } from "../utils/getUri";
import { getNonce } from "../utils/getNonce";

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

  resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
  ): void | Thenable<void> {
    const webview = webviewPanel.webview;
    webview.options = { enableScripts: true };
    webview.html = this.getWebviewContent(webview);

    function updateWebview() {
      webview.postMessage({
        type: "update",
        text: document.getText(),
      });
    }

    const changeDocumentSubscription = workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      },
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    webview.onDidReceiveMessage((event) => {
      switch (event.type) {
        case "add":
          break;

        case "delete":
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
