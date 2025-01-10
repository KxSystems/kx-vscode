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
import { compareVersions, kdbOutputLog } from "../utils/core";
import { StructuredTextResults } from "../models/queryResult";
import { GridOptions } from "ag-grid-community";
import { decodeQUTF } from "../utils/decode";

export class KdbResultsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "kdb-results";
  public isInsights = false;
  public isPython = false;
  public _colorTheme: any;
  private _view?: WebviewView;
  private _results: string | string[] = "";

  constructor(private readonly _extensionUri: Uri) {
    this._colorTheme = window.activeColorTheme;
    window.onDidChangeActiveColorTheme(() => {
      this._colorTheme = window.activeColorTheme;
      this.updateResults(this._results);
    });
    ext.isResultsTabVisible = true;
  }

  public kdbToAgGridCellType(kdbType: string): string {
    const typeMapping: { [key: string]: string } = {
      boolean: "boolean",
      guid: "text",
      byte: "number",
      short: "number",
      int: "number",
      long: "number",
      real: "number",
      float: "number",
      char: "text",
      symbol: "text",
      string: "text",
      date: "text",
      time: "time",
      timestamp: "datetime",
      timespan: "text",
      minute: "text",
      second: "text",
      month: "text",
    };

    return typeMapping[kdbType.toLowerCase()] || "text";
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

  convertToCsv(data: any[]): string[] {
    const keys = Object.keys(data[0]);
    const header = keys.join(",");
    const rows = data.map((obj) => {
      return keys
        .map((key) => {
          return obj[key];
        })
        .join(",");
    });
    return [header, ...rows];
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

  generateCoumnDefs(results: any, isInsights: boolean): any {
    if (isInsights) {
      if (results.rows.length === 0) {
        return Object.keys(results.meta).map((key: string) => {
          const sanitizedKey = this.sanitizeString(key);
          const type = results.meta[key];
          const headerName = type ? `${sanitizedKey} [${type}]` : sanitizedKey;
          const cellDataType = this.kdbToAgGridCellType(type);
          return {
            field: sanitizedKey,
            headerName,
            cellDataType,
          };
        });
      } else {
        return Object.keys(results.rows[0]).map((key: string) => {
          const sanitizedKey = this.sanitizeString(key);
          const type = results.meta[key];
          const headerName = type ? `${sanitizedKey} [${type}]` : sanitizedKey;
          const cellDataType =
            type != undefined ? this.kdbToAgGridCellType(type) : undefined;
          return {
            field: sanitizedKey,
            headerName,
            cellDataType,
          };
        });
      }
    } else {
      if (typeof results[0] === "string") {
        return results.map((key: string) => {
          const sanitizedKey = this.sanitizeString(key);
          const cellDataType = "text";
          return {
            field: sanitizedKey,
            headerName: sanitizedKey,
            cellDataType,
          };
        });
      }
      return Object.keys(results[0]).map((key: string) => {
        const sanitizedKey = this.sanitizeString(key);
        const cellDataType = "text";
        return { field: sanitizedKey, headerName: sanitizedKey, cellDataType };
      });
    }
  }

  updatedExtractRowData(results: StructuredTextResults) {
    const { columns, count } = results;
    const rowData: { [key: string]: any }[] = Array.from(
      { length: count },
      () => ({}),
    );

    columns.forEach((column) => {
      const { name, values } = column;
      values.forEach((value, index) => {
        rowData[index][name] = decodeQUTF(value);
      });
    });

    return rowData;
  }

  updatedExtractColumnDefs(results: StructuredTextResults) {
    const { columns } = results;

    const columnDefs = columns.map((column) => {
      const sanitizedKey = this.sanitizeString(column.name);
      const cellDataType = this.kdbToAgGridCellType(column.type);
      const headerName = column.type
        ? `${sanitizedKey} [${column.type}]`
        : sanitizedKey;

      return {
        field: column.name,
        headerName: headerName,
        cellDataType: cellDataType,
        cellRendererParams: { disabled: cellDataType === "boolean" },
      };
    });

    return columnDefs;
  }

  convertToGrid(
    results: any,
    isInsights: boolean,
    connVersion?: number,
    isPython?: boolean,
  ): GridOptions {
    let rowData = [];
    let columnDefs = [];

    if (
      (!isInsights && !isPython) ||
      /* TODO: Workaround for Python structuredText bug */
      (!isPython && connVersion && compareVersions(connVersion, 1.12))
    ) {
      rowData = this.updatedExtractRowData(results);
      columnDefs = this.updatedExtractColumnDefs(results);
    } else {
      results = isInsights ? (results.data ?? results) : results;
      const queryResult = isInsights ? results.rows : results;
      if (Array.isArray(queryResult[0])) {
        if (typeof queryResult[0][0] === "object") {
          rowData = queryResult[0].map((_, index) => {
            const row: any = {};
            queryResult.forEach((subArray: any[]) => {
              Object.assign(row, subArray[index]);
            });
            return row;
          });
        } else {
          rowData = queryResult.map((element: any) => ({ value: element }));
        }
      } else {
        rowData = queryResult;
      }

      rowData = rowData.map((row: any) => {
        const newRow = { ...row };
        Object.keys(newRow).forEach((key) => {
          if (typeof newRow[key] === "object" && newRow[key] !== null) {
            newRow[key] = newRow[key].toString();
          }
        });
        return newRow;
      });

      if (isInsights) {
        results.rows = rowData;
      }

      columnDefs = this.generateCoumnDefs(results, isInsights);
    }

    if (
      !columnDefs.some(
        (col: any) => col.field.toString().toLowerCase() === "index",
      )
    ) {
      rowData = rowData.map((row: any, index: any) => ({
        index: index + 1,
        ...row,
      }));
      columnDefs.unshift({
        field: "index",
        headerName: "Index",
        cellDataType: "number",
      });
    }

    if (rowData.length > 0) {
      ext.resultPanelCSV = this.convertToCsv(rowData).join("\n");
    }

    const gridOptions: GridOptions = {
      defaultColDef: {
        sortable: true,
        resizable: true,
        filter: true,
        flex: 1,
        minWidth: 100,
      },
      rowData: rowData,
      columnDefs: columnDefs,
      domLayout: "autoHeight",
      pagination: true,
      paginationPageSize: 100,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      suppressContextMenu: true,
      suppressDragLeaveHidesColumns: true,
      tooltipShowDelay: 200,
      loading: true,
    };

    return gridOptions;
  }

  isVisible(): boolean {
    return !!this._view?.visible;
  }

  sanitizeString(value: any): any {
    if (value instanceof Array) {
      value = value.join(" ");
    }
    if (!isNaN(value)) {
      return value;
    }
    value = value.toString();
    value = value.trim();
    value = value.replace(/['"`]/g, "");
    value = value.replace(/\$\{/g, "");
    return value;
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
    if (typeof queryResult === "string" || typeof queryResult === "number") {
      result =
        queryResult !== ""
          ? `<p class="results-txt">${queryResult
              .toString()
              .replace(/\n/g, "<br/>")}</p>`
          : "<p>No results to show</p>";
    } else if (queryResult) {
      gridOptions = this.convertToGrid(
        queryResult,
        this.isInsights,
        connVersion,
        this.isPython,
      );
    }
    if (gridOptions) {
      this._view.webview.postMessage({
        command: "setGridOptions",
        gridOptions: gridOptions,
      });
    } else {
      this._view.webview.postMessage({
        command: "setResultsContent",
        results: result,
      });
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
            <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
            <div id="grid" style="height: 100%;  width:100%;" class="${agGridTheme}"></div>
            <script nonce="${nonce}" >          
              const vscode = acquireVsCodeApi();
              let gridApi;

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
                console.log(event)
                if (message.command === 'setGridOptions') {
                  const columnWidths = saveColumnWidths();
                  const gridOptions = message.gridOptions;
                  const gridDiv = document.getElementById('grid');
                  const resultsDiv = document.querySelector('#results .content-wrapper');
                  resultsDiv.innerHTML = ''; 
                  gridDiv.innerHTML = ''; 
                  const rowData = gridOptions.rowData;
                  gridOptions.rowData = [];
                  gridApi = agGrid.createGrid(gridDiv, gridOptions);
                  restoreColumnWidths(columnWidths);
                  setTimeout(() => {
                    gridApi.setGridOption("rowData", rowData);
                    gridApi.setGridOption("loading", false);
                  }, 500);
                  document.getElementById("results").scrollIntoView();
                } else if (message.command === 'setResultsContent') {
                  const resultsContent = message.results;
                  const resultsDiv = document.querySelector('#results .content-wrapper');
                  const gridDiv = document.getElementById('grid');
                  gridDiv.innerHTML = ''; 
                  resultsDiv.innerHTML = ''; 
                  resultsDiv.innerHTML = resultsContent;
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
