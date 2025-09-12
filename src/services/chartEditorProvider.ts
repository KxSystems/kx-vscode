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

import {
  ColorThemeKind,
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  TextDocument,
  Webview,
  WebviewPanel,
  window,
  workspace,
} from "vscode";

import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/uriUtils";

export class ChartEditorProvider implements CustomTextEditorProvider {
  static readonly viewType = "kdb.chartEditor";

  public static register(context: ExtensionContext): Disposable {
    const provider = new ChartEditorProvider(context);
    return window.registerCustomEditorProvider(
      ChartEditorProvider.viewType,
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

    const updateWebview = () => {
      webview.postMessage(document.getText());
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

    webview.onDidReceiveMessage(async (_msg: any) => {});

    updateWebview();
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
          <title>GG PLOT</title>
        </head>
        <body>
          <kdb-chart-view></kdb-chart-view>
        </body>
        </html>
      `;
  }
}
