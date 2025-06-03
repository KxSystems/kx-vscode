/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import { convertToGrid, formatResult } from "./resultsRenderer";
import { kdbOutputLog } from "../utils/core";
import * as utils from "../utils/execution";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class KdbResultsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "kdb-results";
  public isInsights = false;
  public isPython = false;
  public _colorTheme: any;
  private _view?: WebviewView;
  private savedParamStates: any;
  private _results: string | string[] = "";

  constructor(private readonly _extensionUri: Uri) {
    this._colorTheme = window.activeColorTheme;
    window.onDidChangeActiveColorTheme(() => {
      this._colorTheme = window.activeColorTheme;
      this.updateResults(
        this.savedParamStates.queryResults,
        this.savedParamStates.isInsights,
        this.savedParamStates.connVersion,
        this.savedParamStates.isPython,
      );
    });
    ext.isResultsTabVisible = true;
  }

  /* istanbul ignore next */
  public resolveWebviewView(webviewView: WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this._extensionUri, "out")],
    };

    webviewView.webview.html = this._getWebviewContent();
    this.updateWebView("");

    webviewView.webview.onDidReceiveMessage((data) => {
      this.updateWebView(data);
    });
    webviewView.onDidChangeVisibility(() => {
      ext.isResultsTabVisible = webviewView.visible;
    });

    webviewView.onDidDispose(() => {
      ext.isResultsTabVisible = false;
    });
  }

  public updateResults(
    queryResults: any,
    isInsights?: boolean,
    connVersion?: number,
    isPython?: boolean,
  ) {
    this.savedParamStates = { queryResults, isInsights, connVersion, isPython };
    if (this._view) {
      this._view.show?.(true);
      this.isInsights = !!isInsights;
      this.isPython = !!isPython;
      this.updateWebView(queryResults, connVersion);
    }
  }

  public removeEndCommaFromStrings(data: string[]): string[] {
    return data.map((element) => {
      if (element.endsWith(",")) {
        return element.slice(0, -1);
      }
      return element;
    });
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

  isVisible(): boolean {
    return !!this._view?.visible;
  }

  defineAgGridTheme(): string {
    if (this._colorTheme.kind === ColorThemeKind.Dark) {
      return "ag-theme-alpine-dark";
    }
    return "ag-theme-alpine";
  }

  private _getLibUri(path: string) {
    return this._view
      ? getUri(this._view.webview, this._extensionUri, ["out", path])
      : "";
  }

  public updateWebView(queryResult: any, connVersion?: number) {
    ext.resultPanelCSV = "";
    this._results = queryResult;
    let result = "";
    let gridOptions = undefined;

    if (!this._view) {
      kdbOutputLog("[Results Tab] No view to update", "ERROR");
      return;
    }

    this._view.webview.postMessage({ command: "loading" });

    if (typeof queryResult === "string" || typeof queryResult === "number") {
      result = formatResult(queryResult);
    } else if (queryResult) {
      gridOptions = convertToGrid(
        queryResult,
        this.isInsights,
        connVersion,
        this.isPython,
      );
    }

    this.postMessageToWebview(gridOptions, result);
  }

  private postMessageToWebview(
    gridOptions: GridOptions | undefined,
    result: string,
  ) {
    if (this._view) {
      if (gridOptions) {
        this._view.webview.postMessage({
          command: "setGridDatasource",
          results: gridOptions.rowData,
          columnDefs: gridOptions.columnDefs,
          theme: "legacy",
          themeColor: this.defineAgGridTheme(),
        });
      } else {
        this._view.webview.postMessage({
          command: "setResultsContent",
          results: result,
        });
      }
    }
  }

  private _getWebviewContent() {
    const agGridTheme = this.defineAgGridTheme();
    if (this._view) {
      const webviewUri = getUri(this._view.webview, this._extensionUri, [
        "out",
        "webview.js",
      ]);
      const nonce = getNonce();
      return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1.0" />
            <link rel="stylesheet" href="${this._getLibUri("reset.css")}" />
            <link rel="stylesheet" href="${this._getLibUri("vscode.css")}" />
            <link rel="stylesheet" href="${this._getLibUri("resultsPanel.css")}" />
            <link rel="stylesheet" href="${this._getLibUri("ag-grid.min.css")}" />
            <link rel="stylesheet" href="${this._getLibUri(
              "ag-theme-alpine.min.css",
            )}" />
            <title>Q Results</title>
            <script nonce="${nonce}" src="${this._getLibUri(
              "ag-grid-community.min.js",
            )}"></script>
          </head>
          <body>
            <div id="results" class="results-view-container">
              <div class="content-wrapper"></div>
            </div>
            <div id="overlay" class="overlay">
            <div class="loading-box">
              <div class="spinner"></div>
              <div class="loading-text">Loading data...</div>
            </div>
          </div>
            <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
            <div id="grid" style="height: 100%;  width:100%;" class="${agGridTheme}"></div>
            <script nonce="${nonce}" >
              const vscode = acquireVsCodeApi();
              const gridDiv = document.getElementById('grid');
              const resultsDiv = document.querySelector('#results .content-wrapper');
              const overlay = document.getElementById('overlay');
              let gridApi;

              function showOverlay() {
              overlay.style.display = 'flex';
            }

            function hideOverlay() {
              overlay.style.display = 'none';
            }

              function saveColumnWidths() {
                if (!gridApi) {return null};
                return gridApi.getColumnState();
              }

              function restoreColumnWidths(columnWidths) {
                if (!gridApi || !columnWidths) return;
                gridApi.applyColumnState({state: columnWidths, });
              }

              window.addEventListener('message', event => {
                const message = event.data;
                gridDiv.className = "";
                gridDiv.classList.add(message.themeColor); 
                showOverlay();

                const handleSetGridDatasource = () => {
                  const columnWidths = saveColumnWidths();
                  const gridOptions = {
                    defaultColDef: {
                      sortable: true,
                      resizable: true,
                      filter: true,
                      flex: 1,
                      minWidth: 100,
                      editable: false,
                    },
                    theme: message.theme,
                    columnDefs: message.columnDefs,
                    domLayout: "autoHeight",
                    pagination: true,
                    enableCellTextSelection: true,
                    ensureDomOrder: true,
                    suppressContextMenu: true,
                    suppressDragLeaveHidesColumns: true,
                    tooltipShowDelay: 200,
                    rowBuffer: 0,
                    rowModelType: "infinite",
                    cacheBlockSize: 100,
                    cacheOverflowSize: 2,
                    maxConcurrentDatasourceRequests: 1,
                    infiniteInitialRowCount: 10000,
                    maxBlocksInCache: 10,
                    overlayNoRowsTemplate: '<span class="ag-overlay-loading-center">No results to show</span>',
                    datasource: {
                      rowCount: undefined,
                      getRows: function(params) {
                        showOverlay();
                        const results = message.results;
                        setTimeout(() => {
                          const lastRow = results.length;
                          if (lastRow === 0) {
                            gridApi.showNoRowsOverlay();
                          } else {
                            gridApi.hideOverlay();
                          }
                          const rowsThisPage = results.slice(params.startRow, params.endRow);
                          params.successCallback(rowsThisPage, lastRow);
                          hideOverlay();
                        }, 500);
                      }
                    }
                  };
                  resultsDiv.innerHTML = '';
                  gridDiv.innerHTML = '';
                  gridApi = agGrid.createGrid(gridDiv, gridOptions);
                  restoreColumnWidths(columnWidths);
                  document.getElementById("results").scrollIntoView();
                };

                const handleSetResultsContent = () => {
                  const resultsContent = message.results;
                  gridDiv.innerHTML = '';
                  resultsDiv.innerHTML = '';
                  resultsDiv.innerHTML = resultsContent;
                  hideOverlay();
                };

                const handleLoading = () => {
                  gridDiv.innerHTML = '';
                  resultsDiv.innerHTML = '';
                };

                switch (message.command) {
                  case 'setGridDatasource':
                    handleSetGridDatasource();
                    break;
                  case 'setResultsContent':
                    handleSetResultsContent();
                    break;
                  default:
                  case 'loading':
                    handleLoading();
                    break;
                }
              });
              document.addEventListener('contextmenu', (e) => {
                e.stopImmediatePropagation();
              }, true);
            </script>
          </body>
        </html>
      `;
    } else {
      return "";
    }
  }
}
