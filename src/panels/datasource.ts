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
import { ext } from "../extensionVariables";
import { DataSourceFiles } from "../models/dataSource";
import { InsightsNode } from "../services/kdbTreeProvider";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class DataSourcesPanel {
  public static currentPanel: DataSourcesPanel | undefined;
  private uri;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  public static dataSourceFile: DataSourceFiles;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    this.uri = extensionUri;
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri,
      datasourceFile
    );
    this._panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "kdb.dataSource.saveDataSource") {
        this._panel.title = message.data.name;
        vscode.commands.executeCommand(
          "kdb.dataSource.saveDataSource",
          message.data
        );
      } else if (message.command === "kdb.dataSource.runDataSource") {
        vscode.commands.executeCommand(
          "kdb.dataSource.runDataSource",
          message.data
        );
      } else if (message.command === "kdb.dataSource.populateScratchpad") {
        vscode.commands.executeCommand(
          "kdb.dataSource.populateScratchpad",
          message.data
        );
      }
    });
  }

  public static render(
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    this.dataSourceFile = datasourceFile;
    if (DataSourcesPanel.currentPanel) {
      DataSourcesPanel.currentPanel.dispose();
    }
    const panel = vscode.window.createWebviewPanel(
      "dataSource",
      datasourceFile.name,
      vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `out` directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      }
    );

    DataSourcesPanel.currentPanel = new DataSourcesPanel(
      panel,
      extensionUri,
      datasourceFile
    );
  }

  public refresh() {
    DataSourcesPanel.render(this.uri, DataSourcesPanel.dataSourceFile);
  }

  public dispose() {
    DataSourcesPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private generateTarget(
    isInsights: boolean,
    isMetaLoaded: boolean,
    targetApi: string
  ) {
    if (isInsights && isMetaLoaded) {
      const auxOptions = ext.insightsMeta.dap
        .map((dap) => {
          const generatedValue = `${dap.assembly}-qe ${dap.instance}`;
          const option = `<vscode-option value="${generatedValue}" ${
            generatedValue === targetApi ? "selected" : ""
          }>${generatedValue}</vscode-option>`;
          return option;
        })
        .join("");
      return /* html*/ `<vscode-dropdown id="selectedTarget" name="selectedTarget" value="${targetApi}" class="dropdown">
          ${auxOptions}
        </vscode-dropdown>`;
    }
    return /* html*/ `<vscode-dropdown id="selectedTarget" name="selectedTarget" class="dropdown">
          <vscode-option>Not connected to Insights</vscode-option>
        </vscode-dropdown>`;
  }

  private generateTables(
    isInsights: boolean,
    isMetaLoaded: boolean,
    targetTable: string
  ) {
    if (isInsights && isMetaLoaded) {
      const auxOptions = ext.insightsMeta.assembly
        .flatMap((assembly) => {
          return assembly.tbls.map((tbl) => {
            const generatedValue = tbl;
            const option = `<vscode-option value="${generatedValue}" ${
              generatedValue === targetTable ? "selected" : ""
            }>${generatedValue}</vscode-option>`;
            return option;
          });
        })
        .join("");
      return /* html*/ `<vscode-dropdown id="selectedTable" name="selectedTable" value="${targetTable}" class="dropdown">
          ${auxOptions}
        </vscode-dropdown>`;
    }
    return /* html*/ `<vscode-dropdown id="selectedTable" name="selectedTable" class="dropdown">
          <vscode-option>Not connected to Insights</vscode-option>
        </vscode-dropdown>`;
  }

  private generateApiTarget(
    isInsights: boolean,
    isMetaLoaded: boolean,
    target: string
  ) {
    return isInsights && isMetaLoaded
      ? /* html*/ `<vscode-dropdown id="selectedApi" name="selectedApi" value="${target}" class="dropdown">
          ${ext.insightsMeta.api
            .filter(
              (api) =>
                api.api === ".kxi.getData" || !api.api.startsWith(".kxi.")
            )
            .map((api) => {
              const generatedValue =
                api.api === ".kxi.getData"
                  ? api.api.replace(".kxi.", "")
                  : api.api;
              return `<vscode-option value="${generatedValue}" ${
                generatedValue === target ? "selected" : ""
              }>${generatedValue}</vscode-option>`;
            })
            .join("")}
        </vscode-dropdown>`
      : /* html*/ `<vscode-dropdown id="selectedApi" name="selectedApi" class="dropdown">
          <vscode-option>Not connected to Insights</vscode-option>
        </vscode-dropdown>`;
  }

  private generateAPIListParams(
    listParamType: string,
    actualParamArray: string[]
  ): string {
    let params = "";
    if (actualParamArray.length > 0) {
      params = actualParamArray
        .map((param, i) => {
          return /* html */ `<div class="field-row ${listParamType}-row">
            <vscode-text-field size="100" id="${listParamType}-${
            i + 1
          }" name="${listParamType}-${i + 1}" placeholder="${listParamType} ${
            i + 1
          }" value="${param}" class="text-input ${listParamType}-input"></vscode-text-field>
          </div>`;
        })
        .join("");
    } else {
      params = /* html */ `<div class="field-row ${listParamType}-row">
        <vscode-text-field size="100" id="${listParamType}-1" name="${listParamType}-1" placeholder="${listParamType} 1" class="text-input ${listParamType}-input"></vscode-text-field>
      </div>`;
    }
    return params;
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    const isMetaLoaded = ext.insightsMeta.dap ? true : false;
    const isInsights = ext.connectionNode instanceof InsightsNode;
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();
    const styleUri = getUri(webview, extensionUri, [
      "out",
      "dataSourcesPanel.css",
    ]);
    const resetStyleUri = getUri(webview, extensionUri, ["out", "reset.css"]);
    const vscodeStyleUri = getUri(webview, extensionUri, ["out", "vscode.css"]);

    const tabSelected =
      datasourceFile.dataSource.selectedType.toString() === "API"
        ? "tab-1"
        : datasourceFile.dataSource.selectedType.toString() === "QSQL"
        ? "tab-2"
        : "tab-3";
    const loadedSelectedType =
      datasourceFile.dataSource.selectedType.toString() === "API"
        ? "API"
        : datasourceFile.dataSource.selectedType.toString() === "QSQL"
        ? "QSQL"
        : "SQL";
    const filterParams = this.generateAPIListParams(
      "filter",
      datasourceFile.dataSource.api.filter
    );
    const groupByParams = this.generateAPIListParams(
      "groupBy",
      datasourceFile.dataSource.api.groupBy
    );
    const aggParams = this.generateAPIListParams(
      "agg",
      datasourceFile.dataSource.api.agg
    );
    const sortColsParams = this.generateAPIListParams(
      "sortCols",
      datasourceFile.dataSource.api.sortCols
    );
    const sliceParams = this.generateAPIListParams(
      "slice",
      datasourceFile.dataSource.api.slice
    );
    const labelsParams = this.generateAPIListParams(
      "labels",
      datasourceFile.dataSource.api.labels
    );

    const apiSelected = datasourceFile.dataSource.api.selectedApi;
    const tableSelected = datasourceFile.dataSource.api.table;
    const startTS = datasourceFile.dataSource.api.startTS;
    const endTS = datasourceFile.dataSource.api.endTS;
    const fill = datasourceFile.dataSource.api.fill;
    const temporary = datasourceFile.dataSource.api.temporary;
    const qsql = datasourceFile.dataSource.qsql.query;
    const qsqlTarget = datasourceFile.dataSource.qsql.selectedTarget;
    const sql = datasourceFile.dataSource.sql.query;
    const name = datasourceFile.name;

    const targetHtml = this.generateTarget(
      isInsights,
      isMetaLoaded,
      qsqlTarget
    );

    const apiHtml = this.generateApiTarget(
      isInsights,
      isMetaLoaded,
      apiSelected
    );

    const tableHtml = this.generateTables(
      isInsights,
      isMetaLoaded,
      tableSelected
    );

    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <link rel="stylesheet" href="${resetStyleUri}" />
        <link rel="stylesheet" href="${vscodeStyleUri}" />
        <link rel="stylesheet" href="${styleUri}" />
        <title>DataSource</title>
      </head>
      <body>
      <form id="dataSourceForm">
        <div class="datasource-view-container">
          <div class="content-wrapper">
            <div class="field-row name-row">
              <label for="name">DataSource Name</label>
              <vscode-text-field size="100" id="name" name="name" placeholder="DataSource Name" value="${name}" class="text-input name-input"></vscode-text-field>
              <input type="hidden" name="originalName" value="${name}" />
            </div>
              <div  class="form-wrapper">
                <vscode-panels activeid="${tabSelected}">
                  <vscode-panel-tab id="tab-1" class="type-tab">API</vscode-panel-tab>
                  <vscode-panel-tab id="tab-2" class="type-tab">QSQL</vscode-panel-tab>
                  <vscode-panel-tab id="tab-3" class="type-tab">SQL</vscode-panel-tab>
                  <input type="hidden" name="selectedType" value="${loadedSelectedType}" />
                  <vscode-panel-view id="view-1">
                    <div class="editor-panel">
                      <div class="field-row">
                        <div class="dropdown-container">
                          <label for="selectedApi">Select API</label>
                          ${apiHtml}
                        </div>
                      </div>
                      <div class="field-row">
                        <div class="dropdown-container">
                          <label for="selectedTable">Table</label>
                          ${tableHtml}
                        </div>
                      </div>
                      <div class="field-row">
                        <vscode-text-field type="datetime-local" size="100" id="startTS" name="startTS" placeholder="startTS" value="${startTS}">startTS</vscode-text-field>
                      </div>
                      <div class="field-row">
                        <vscode-text-field type="datetime-local" size="100" id="endTS" name="endTS" placeholder="endTS" value="${endTS}">endTS</vscode-text-field>
                      </div>
                      <div class="field-row">
                        <vscode-text-field size="100" id="fill" name="fill" placeholder="fill" value="${fill}">fill</vscode-text-field>
                      </div>
                      <div class="field-row">
                        <vscode-text-field size="100" id="temporary" name="temporary" placeholder="temporary" value="${temporary}">temporary</vscode-text-field>
                      </div>
                      <div class="params-wrapper" id="filter-wrapper">
                        <label>filter</label>
                          ${filterParams}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addFilter" appearance="secondary" class="btn-add-param">ADD FILTER</vscode-button>
                        <vscode-button id="removeFilter" appearance="secondary" class="btn-remove-param">REMOVE FILTER</vscode-button>
                      </div>
                      <div class="params-wrapper" id="groupBy-wrapper">
                        <label>groupBy</label>
                          ${groupByParams}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addGroupBy" appearance="secondary" class="btn-add-param">ADD GROUP BY</vscode-button>
                        <vscode-button id="removeGroupBy" appearance="secondary" class="btn-remove-param">REMOVE GROUP BY</vscode-button>
                      </div>
                      <div class="params-wrapper" id="agg-wrapper">
                        <label>agg</label>
                          ${aggParams}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addAgg" appearance="secondary" class="btn-add-param">ADD AGG</vscode-button>
                        <vscode-button id="removeAgg" appearance="secondary" class="btn-remove-param">REMOVE AGG</vscode-button>
                      </div>
                      <div class="params-wrapper" id="sortCols-wrapper">
                        <label>sortCols</label>
                          ${sortColsParams}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addSortCols" appearance="secondary" class="btn-add-param">ADD SORT COLS</vscode-button>
                        <vscode-button id="removeSortCols" appearance="secondary" class="btn-remove-param">REMOVE SORT COLS</vscode-button>
                      </div>
                      <div class="params-wrapper" id="slice-wrapper">
                        <label>slice</label>
                          ${sliceParams}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addSlice" appearance="secondary" class="btn-add-param">ADD SLICE</vscode-button>
                        <vscode-button id="removeSlice" appearance="secondary" class="btn-remove-param">REMOVE SLICE</vscode-button>
                      </div>
                      <div class="params-wrapper" id="labels-wrapper">
                        <label>labels</label>
                          ${labelsParams}
                      </div>
                      <div class="field-row">
                        <vscode-button id="addLabels" appearance="secondary" class="btn-add-param">ADD LABEL</vscode-button>
                        <vscode-button id="removeLabels" appearance="secondary" class="btn-remove-param">REMOVE LABEL</vscode-button>
                      </div>
                    </div>
                  </vscode-panel-view>
                  <vscode-panel-view id="view-2">
                    <div class="editor-panel">
                    <div class="field-row">
                        <div class="dropdown-container">
                          <label for="selectedTarget">Target</label>
                          ${targetHtml}
                        </div>
                      </div>
                      <div class="field-row">
                        <vscode-text-area
                          class="text-area"
                          id="qsql"
                          name="qsql"
                          value="${qsql}"
                          rows="20">Query</vscode-text-area>
                      </div>
                      
                    </div>
                  </vscode-panel-view>
                  <vscode-panel-view id="view-3">
                    <div class="editor-panel">
                      <div class="field-row">
                        <vscode-text-area
                          class="text-area"
                          id="sql"
                          value="${sql}"
                          name="sql"
                          rows="20">Query</vscode-text-area>
                      </div>
                    </div>
                  </vscode-panel-view>
                </vscode-panels>
              </div>
              <div class="actions-wrapper">
                <div class="btn-actions-group">
                  <div class="btn-action">
                    <vscode-button id="save" appearance="primary" class="btn-save">SAVE</vscode-button>
                  </div>
                  <div class="btn-action">
                    <vscode-button id="run" appearance="secondary" class="btn-run">RUN</vscode-button>
                  </div>
                  <div class="btn-action">
                    <vscode-button id="populateScratchpad" appearance="secondary" class="btn-scracthpad">POPULATE SCRATCHPAD</vscode-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const populateScratchpadButton = document.getElementById('populateScratchpad');
          const saveButton = document.getElementById('save');
          const runButton = document.getElementById('run');
          const addFilterButton = document.getElementById('addFilter');
          const removeFilterButton = document.getElementById('removeFilter');
          const addGroupByButton = document.getElementById('addGroupBy');
          const removeGroupByButton = document.getElementById('removeGroupBy');
          const addAggButton = document.getElementById('addAgg');
          const removeAggButton = document.getElementById('removeAgg');
          const addSortColsButton = document.getElementById('addSortCols');
          const removeSortColsButton = document.getElementById('removeSortCols');
          const addSliceButton = document.getElementById('addSlice');
          const removeSliceButton = document.getElementById('removeSlice');
          const addLabelsButton = document.getElementById('addLabels');
          const removeLabelsButton = document.getElementById('removeLabels');
          const tabs = document.querySelectorAll('.type-tab');

          tabs.forEach((tab) => {
            tab.addEventListener('click', (event) => {
              const tabId = event.target.id;
              const form = document.getElementById('dataSourceForm');
              let type = '';
              switch (tabId) {
                case 'tab-1':
                  type = 'API';
                  break;
                case 'tab-2':
                  type = 'QSQL';
                  break;
                case 'tab-3':
                default:
                  type = 'SQL';
                  break;
              };
              form.elements['selectedType'].value = type;
            });
          });

          populateScratchpadButton.addEventListener('click', (event) => {
            event.preventDefault();
            const form = document.getElementById('dataSourceForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            vscode.postMessage({
              command: 'kdb.dataSource.populateScratchpad',
              data
            });
          });

          saveButton.addEventListener('click', (event) => {
            event.preventDefault();
            const form = document.getElementById('dataSourceForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            vscode.postMessage({
              command: 'kdb.dataSource.saveDataSource',
              data
            });
          });

          runButton.addEventListener('click', (event) => {
            event.preventDefault();
            const form = document.getElementById('dataSourceForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            vscode.postMessage({
              command: 'kdb.dataSource.runDataSource',
              data
            });
          });

          // add params
          addFilterButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('filter-wrapper');
            const paramsFields = document.querySelectorAll('.filter-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'filter-' + (count + 1));
            newParam.setAttribute('class', 'text-input filter-input');
            newParam.setAttribute('name', 'filter-' + (count + 1));
            newParam.setAttribute('placeholder', 'filter ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row filter-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          addGroupByButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('groupBy-wrapper');
            const paramsFields = document.querySelectorAll('.groupBy-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'groupBy-' + (count + 1));
            newParam.setAttribute('class', 'text-input groupBy-input');
            newParam.setAttribute('name', 'groupBy-' + (count + 1));
            newParam.setAttribute('placeholder', 'groupBy ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row groupBy-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          addAggButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('agg-wrapper');
            const paramsFields = document.querySelectorAll('.agg-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'agg-' + (count + 1));
            newParam.setAttribute('class', 'text-input agg-input');
            newParam.setAttribute('name', 'agg-' + (count + 1));
            newParam.setAttribute('placeholder', 'agg ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row agg-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          addSortColsButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('sortCols-wrapper');
            const paramsFields = document.querySelectorAll('.sortCols-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'sortCols-' + (count + 1));
            newParam.setAttribute('class', 'text-input sortCols-input');
            newParam.setAttribute('name', 'sortCols-' + (count + 1));
            newParam.setAttribute('placeholder', 'sortCols ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row sortCols-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          addSliceButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('slice-wrapper');
            const paramsFields = document.querySelectorAll('.slice-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'slice-' + (count + 1));
            newParam.setAttribute('class', 'text-input slice-input');
            newParam.setAttribute('name', 'slice-' + (count + 1));
            newParam.setAttribute('placeholder', 'slice ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row slice-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          addLabelsButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('labels-wrapper');
            const paramsFields = document.querySelectorAll('.labels-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'labels-' + (count + 1));
            newParam.setAttribute('class', 'text-input labels-input');
            newParam.setAttribute('name', 'labels-' + (count + 1));
            newParam.setAttribute('placeholder', 'labels ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row labels-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          //remove params
          removeFilterButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.filter-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });

          removeGroupByButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.groupBy-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });

          removeAggButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.agg-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });

          removeSortColsButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.sorCols-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });

          removeSliceButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.slice-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });

          removeLabelsButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.labels-row');
            const count = paramsFields.length;
            if (count > 1) {
              const lastParam = paramsFields[count - 1];
              lastParam.remove();
            }            
          });
        </script>
      </body>
    </html>
    `;
  }
}
