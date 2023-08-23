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

import { GridOptions } from "ag-grid-community";
import {
  ColorThemeKind,
  Uri,
  WebviewView,
  WebviewViewProvider,
  window,
} from "vscode";
import * as utils from "../utils/execution";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class KdbResultsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "kdb-results";
  private _view?: WebviewView;
  private _colorTheme: any;
  private _results: string | string[] = "";

  constructor(private readonly _extensionUri: Uri) {
    this._colorTheme = window.activeColorTheme;
    window.onDidChangeActiveColorTheme(() => {
      this._colorTheme = window.activeColorTheme;
      this.updateResults(this._results);
    });
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

  public updateResults(
    queryResults: string | string[],
    dataSourceType?: string
  ) {
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage(queryResults);
      this._view.webview.html = this._getWebviewContent(
        queryResults,
        dataSourceType
      );
    }
  }

  // this is deprecated and will be dropped in the next update
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
    let results = "";
    results = `<vscode-data-grid class="results-datagrid" aria-label="Basic">`;
    let headers = `<vscode-data-grid-row class="results-header-datagrid" row-type="header">`;
    let rows = ``;
    let countHeader = 1;
    let indexColumn = 1;
    const headersArray = queryResult[0].split(",");
    for (const column in headersArray) {
      headers += `<vscode-data-grid-cell  cell-type="columnheader" grid-column="${countHeader}"><b>${headersArray[
        column
      ].toUpperCase()}</b></vscode-data-grid-cell>`;
      countHeader++;
    }
    const resRows = queryResult.slice(1).map((str) => str.split(","));

    headers += `</vscode-data-grid-row>`;
    resRows.forEach((row: string[]) => {
      rows += `<vscode-data-grid-row>`;
      for (const value in row) {
        rows += `<vscode-data-grid-cell grid-column="${indexColumn}">${row[value]}</vscode-data-grid-cell>`;
        indexColumn++;
      }
      rows += `</vscode-data-grid-row>`;
      indexColumn = 1;
    });
    results += headers + rows + `</vscode-data-grid>`;
    return results;
  }

  convertToGrid(queryResult: any): string | GridOptions {
    if (queryResult === "") {
      return `<p>No results to show</p>`;
    }

    const vectorRes =
      typeof queryResult === "string"
        ? utils.convertResultStringToVector(queryResult)
        : utils.convertResultToVector(queryResult);
    if (vectorRes.length === 1) {
      return `<p>${vectorRes[0]}</p>`;
    }
    const keys = vectorRes[0];
    const value = vectorRes.slice(1);
    const rowData = value.map((row) =>
      keys.reduce((obj: any, key: any, index: number) => {
        obj[key] = row[index];
        return obj;
      }, {})
    );
    const columnDefs = keys.map((str: string) => ({ field: str }));
    return {
      defaultColDef: {
        enableRowGroup: true,
        enablePivot: true,
        enableValue: true,
        sortable: true,
        resizable: true,
        filter: true,
        flex: 1,
        minWidth: 100,
      },
      rowData,
      columnDefs,
    };
  }

  defineAgGridTheme(): string {
    if (this._colorTheme.kind === ColorThemeKind.Dark) {
      return "ag-theme-alpine-dark";
    }
    return "ag-theme-alpine";
  }

  private _getWebviewContent(
    queryResult: string | string[],
    _dataSourceType?: string
  ) {
    this._results = queryResult;
    const agGridTheme = this.defineAgGridTheme();
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
      const agGridJS = getUri(this._view.webview, this._extensionUri, [
        "out",
        "ag-grid-community.min.js",
      ]);
      const agGridStyle = getUri(this._view.webview, this._extensionUri, [
        "out",
        "ag-grid.min.css",
      ]);
      const agGridThemeStyle = getUri(this._view.webview, this._extensionUri, [
        "out",
        "ag-theme-alpine.min.css",
      ]);
      let result: any = "";
      let gridOptionsString = "";
      if (queryResult !== "") {
        const convertedGrid = this.convertToGrid(queryResult);
        if (typeof convertedGrid === "string") {
          result = convertedGrid;
        } else {
          gridOptionsString = JSON.stringify(convertedGrid);
        }
      }

      result =
        gridOptionsString === ""
          ? result !== ""
            ? result
            : "<p>No results to show</p>"
          : "";
      return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <link rel="stylesheet" href="${resetStyleUri}" />
        <link rel="stylesheet" href="${vscodeStyleUri}" />
        <link rel="stylesheet" href="${styleUri}" />
        <link rel="stylesheet" href="${agGridStyle}" />
        <link rel="stylesheet" href="${agGridThemeStyle}" />
        <title>Q Results</title>
        <script nonce="${nonce}" src="${agGridJS}"></script>
      </head>
      <body>      
        <div class="results-view-container">
          <div class="content-wrapper">
              ${result}
            </div>
          </div>      
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        <div id="grid" style="height: 300px; width:100%;" class="${agGridTheme}"></div>
        <script nonce="${nonce}" >          
          document.addEventListener('DOMContentLoaded', () => {

            if('${gridOptionsString}' !== '<p>No results to show</p>' && '${gridOptionsString}' !== ''){
              const gridOptions = JSON.parse('${gridOptionsString}');
              const gridDiv = document.getElementById('grid');
              const gridApi = new agGrid.Grid(gridDiv, gridOptions);
            }
          });
        </script>
      </body>
    </html>
    `;
    } else {
      return "";
    }
  }
}
