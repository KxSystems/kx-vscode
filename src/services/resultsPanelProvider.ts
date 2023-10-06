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
  workspace,
} from "vscode";
import { ext } from "../extensionVariables";
import * as utils from "../utils/execution";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class KdbResultsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "kdb-results";
  private _view?: WebviewView;
  public _colorTheme: any;
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

  exportToCsv() {
    if (ext.resultPanelCSV === "") {
      window.showErrorMessage("No results to export");
      return;
    }
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
      window.showErrorMessage("Open a folder to export results");
      return;
    }
    const workspaceUri = workspaceFolders[0].uri;
    utils.exportToCsv(workspaceUri);
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
    ext.resultPanelCSV = vectorRes.map((row) => row.join(",")).join("\n");
    const keys = vectorRes[0];
    const value = vectorRes.slice(1);
    const rowData = value.map((row) =>
      keys.reduce((obj: any, key: string, index: number) => {
        key = this.sanitizeString(key);
        obj[key] = this.sanitizeString(row[index]);
        return obj;
      }, {})
    );
    const columnDefs = keys.map((str: string) => ({
      field: this.sanitizeString(str),
    }));
    return {
      defaultColDef: {
        sortable: true,
        resizable: true,
        filter: true,
        flex: 1,
        minWidth: 100,
      },
      rowData,
      columnDefs,
      domLayout: "autoHeight",
      pagination: true,
      paginationPageSize: 100,
      cacheBlockSize: 100,
    };
  }

  sanitizeString(str: string): string {
    str = str.trim();
    str = str.replace(/['"`]/g, "");
    str = str.replace(/\$\{/g, "");
    return str;
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
    ext.resultPanelCSV = "";
    let rowsCount = 0;
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
      let result = "";
      let gridOptionsString = "";
      let rowsLimited = "";
      if (typeof queryResult === "string" && queryResult.endsWith("\n..\n")) {
        queryResult = queryResult.slice(0, -4);
        rowsLimited =
          "<p>Showing results returned from q instance, that is limited by your q settings";
      } else if (
        queryResult instanceof Array &&
        queryResult.length > 0 &&
        queryResult[queryResult.length - 1].endsWith("\n..\n")
      ) {
        queryResult[0] = queryResult[0].slice(0, -4);
        rowsLimited =
          "<p>Showing results returned from q instance, that is limited by your q settings";
      }
      if (queryResult !== "") {
        const convertedGrid = this.convertToGrid(queryResult);
        if (typeof convertedGrid === "string") {
          result = convertedGrid;
        } else {
          gridOptionsString = JSON.stringify(convertedGrid);
        }
      }
      const isGrid =
        gridOptionsString !== "" &&
        gridOptionsString !== "<p>No results to show</p>";

      const gridOptionsObj = isGrid ? JSON.parse(gridOptionsString) : "";
      const gridRows = isGrid ? [...gridOptionsObj.rowData] : "";
      if (isGrid) {
        const totalRowsLenght = JSON.stringify(gridRows).length;
        if (totalRowsLenght > ext.rowLimit) {
          const sampleRowLength = JSON.stringify(gridRows[0]).length;
          rowsCount = Math.round(ext.rowLimit / sampleRowLength);
          rowsLimited = `<p>Showing ${rowsCount} of ${gridRows.length} rows due high amount of data, to retrieve the entire data, export to CSV</p>`;
          const expectedRows = gridRows.slice(0, rowsCount);
          gridOptionsObj.rowData = expectedRows;
          gridOptionsString = JSON.stringify(gridOptionsObj);
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
              ${rowsLimited}
            </div>
          </div>      
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        <div id="grid" style="height: 100%;  width:100%;" class="${agGridTheme}"></div>
        <script nonce="${nonce}" >          
          document.addEventListener('DOMContentLoaded', () => {
            if(${isGrid}){
              const gridDiv = document.getElementById('grid');
              const obj = JSON.parse('${gridOptionsString}');
              const gridApi = new agGrid.Grid(gridDiv, obj);
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
