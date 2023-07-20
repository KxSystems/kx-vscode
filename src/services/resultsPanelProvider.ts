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

import { Uri, WebviewView, WebviewViewProvider } from "vscode";
import * as utils from "../utils/execution";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class KdbResultsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "kdb-results";
  private _view?: WebviewView;

  constructor(private readonly _extensionUri: Uri) {
    // this.resolveWebviewView(webviewView);
  }

  public resolveWebviewView(webviewView: WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this._extensionUri, "out")],
    };

    webviewView.webview.html = this._getWebviewContent("");

    webviewView.webview.onDidReceiveMessage((data) => {
      webviewView.webview.html = this._getWebviewContent(data);
    });
  }

  public updateResults(queryResults: string, dataSourceType?: string) {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage(queryResults);
      this._view.webview.html = this._getWebviewContent(
        queryResults,
        dataSourceType
      );
    }
  }

  handleQueryResultsString(queryResult: string) {
    if (queryResult === "") {
      return `<p>No results to show</p>`;
    }
    const vectorRes = utils.convertResultStringToVector(queryResult);
    if (vectorRes.length === 1) {
      return `<p>${vectorRes[0]}</p>`;
    }
    const headers = vectorRes[0]
      .map((header: string, index: number) => {
        return `<vscode-data-grid-cell cell-type="columnheader" grid-column="${
          index + 1
        }"><b>${header.toUpperCase()}</b></vscode-data-grid-cell>`;
      })
      .join("");

    const rows = vectorRes
      .slice(1)
      .map((row) => {
        return `<vscode-data-grid-row>${row
          .map((cell: string, index: number) => {
            return `<vscode-data-grid-cell grid-column="${
              index + 1
            }">${cell}</vscode-data-grid-cell>`;
          })
          .join("")}</vscode-data-grid-row>`;
      })
      .join("");

    return /*html*/ `<vscode-data-grid class="results-datagrid" aria-label="Basic">
              <vscode-data-grid-row class="results-header-datagrid" row-type="header">
                ${headers}
              </vscode-data-grid-row>
              ${rows}
            </vscode-data-grid>`;
  }

  handleQueryResultsArray(queryResult: any[]): string {
    if (queryResult.length === 0) {
      return `<p>No results to show</p>`;
    }
    const headers = Object.keys(queryResult[0])
      .map((key) => {
        return `<vscode-data-grid-cell cell-type="columnheader" grid-column="${key}"><b>${key.toUpperCase()}</b></vscode-data-grid-cell>`;
      })
      .join("");

    const rows = queryResult
      .map((row) => {
        return `<vscode-data-grid-row>${Object.values(row)
          .map((value) => {
            return `<vscode-data-grid-cell grid-column="${value}">${value}</vscode-data-grid-cell>`;
          })
          .join("")}</vscode-data-grid-row>`;
      })
      .join("");

    return /*html*/ `<vscode-data-grid class="results-datagrid" aria-label="Basic">
              <vscode-data-grid-row class="results-header-datagrid" row-type="header">
                ${headers}
              </vscode-data-grid-row>
              ${rows}
            </vscode-data-grid>`;
  }

  private _getWebviewContent(
    queryResult: string | string[],
    dataSourceType?: string
  ) {
    if (this._view) {
      const webviewUri = getUri(this._view.webview, this._extensionUri, [
        "out",
        "webview.js",
      ]);
      const nonce = getNonce();
      const styleUri = getUri(this._view.webview, this._extensionUri, [
        "out",
        "resultsPanel.css",
      ]);
      const resetStyleUri = getUri(this._view.webview, this._extensionUri, [
        "out",
        "reset.css",
      ]);
      const vscodeStyleUri = getUri(this._view.webview, this._extensionUri, [
        "out",
        "vscode.css",
      ]);
      let result = "";
      if (dataSourceType) {
        queryResult = JSON.parse(queryResult as string);
      }
      if (typeof queryResult === "string") {
        result = this.handleQueryResultsString(queryResult);
      } else if (Array.isArray(queryResult)) {
        result = this.handleQueryResultsArray(queryResult);
      } else if (typeof queryResult === "object") {
        result =
          queryResult === null
            ? `<p>No results to show</p>`
            : this.handleQueryResultsString(JSON.stringify(queryResult));
      }

      return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${this._view.webview.cspSource}; font-src ${this._view.webview.cspSource}; img-src ${this._view.webview.cspSource} https:; script-src 'nonce-${nonce}';" />
        <link rel="stylesheet" href="${resetStyleUri}" />
        <link rel="stylesheet" href="${vscodeStyleUri}" />
        <link rel="stylesheet" href="${styleUri}" />
        <title>Q Results</title>
      </head>
      <body>      
        <div class="results-view-container">
          <div class="content-wrapper">
              ${result}
            </div>
          </div>      
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
      </body>
    </html>
    `;
    } else {
      return "";
    }
  }
}
