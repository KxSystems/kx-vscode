import * as vscode from "vscode";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class DataSourcesPanel {
  public static currentPanel: DataSourcesPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private type: DataSourceTypes = DataSourceTypes.API;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    // this._panel.webview.html = this._getWebviewContent();
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri
    );
  }

  public static render(
    extensionUri: vscode.Uri,
    datasourceFile: DataSourceFiles
  ) {
    console.log(datasourceFile);
    if (DataSourcesPanel.currentPanel) {
      DataSourcesPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        "dataSource",
        "DataSource",
        vscode.ViewColumn.One,
        {
          // Enable javascript in the webview
          enableScripts: true,
          // Restrict the webview to only load resources from the `out` directory
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
        }
      );

      DataSourcesPanel.currentPanel = new DataSourcesPanel(panel, extensionUri);
    }
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

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ) {
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();
    const styleUri = getUri(webview, extensionUri, [
      "out",
      "dataSourcesPanel.css",
    ]);
    const resetStyleUri = getUri(webview, extensionUri, ["out", "reset.css"]);
    const vscodeStyleUri = getUri(webview, extensionUri, ["out", "vscode.css"]);
    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';" />
        <link rel="stylesheet" href="${resetStyleUri}" />
        <link rel="stylesheet" href="${vscodeStyleUri}" />
        <link rel="stylesheet" href="${styleUri}" />
        <title>DataSource</title>
      </head>
      <body>
        <div class="datasource-view-container">
          <div class="content-wrapper">
            <form id="dataSourceForm">
              <div  class="form-wrapper">
                <vscode-panels activeid="tab-1">
                  <vscode-panel-tab id="tab-1">API</vscode-panel-tab>
                  <vscode-panel-tab id="tab-2">QSQL</vscode-panel-tab>
                  <vscode-panel-tab id="tab-3">SQL</vscode-panel-tab>
                  <input type="hidden" name="selectedType" value="API" />
                  <vscode-panel-view id="view-1">
                    <div class="editor-panel">
                      <div class="field-row">
                        <div class="dropdown-container">
                          <label for="select-api">Select API</label>
                          <vscode-dropdown id="select-api" name="select-api" class="dropdown">
                            <vscode-option>Option Label #1</vscode-option>
                            <vscode-option>Option Label #2</vscode-option>
                            <vscode-option>Option Label #3</vscode-option>
                          </vscode-dropdown>
                        </div>
                      </div>
                      <div id="params-wrapper">
                      <label>Params</label>
                        <div class="field-row  param-row">
                          <vscode-text-field size="100" id="param-1" name="param-1" placeholder="Param 1" class="text-input param-input"></vscode-text-field>
                        </div>
                      </div>
                      <div class="field-row">
                        <vscode-button id="addParam" appearance="secondary" class="btn-add-param">ADD PARAM</vscode-button>
                        <vscode-button id="removeParam" appearance="secondary" class="btn-remove-param">REMOVE PARAM</vscode-button>
                      </div>
                    </div>
                  </vscode-panel-view>
                  <vscode-panel-view id="view-2">
                    <div class="editor-panel">
                      <div class="field-row">
                        <vscode-text-area
                          class="text-area"
                          id="qsql"
                          name="qsql"
                          rows="20">Query</vscode-text-area>
                      </div>
                      <div class="field-row">
                        <div class="dropdown-container">
                          <label for="select-target">Target</label>
                          <vscode-dropdown id="select-target" name="select-target" class="dropdown">
                            <vscode-option>Option Label #1</vscode-option>
                            <vscode-option>Option Label #2</vscode-option>
                            <vscode-option>Option Label #3</vscode-option>
                          </vscode-dropdown>
                        </div>
                      </div>
                    </div>
                  </vscode-panel-view>
                  <vscode-panel-view id="view-3">
                    <div class="editor-panel">
                      <div class="field-row">
                        <vscode-text-area
                          class="text-area"
                          id="sql"
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
                </div>
              </div>
            </form>
          </div>
        </div>
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const saveButton = document.getElementById('save');
          const addButton = document.getElementById('addParam');
          const removeButton = document.getElementById('removeParam');

          saveButton.addEventListener('click', (event) => {
            event.preventDefault();
            const form = document.getElementById('dataSourceForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            console.log(data);
          });

          addButton.addEventListener('click', () => {
            const paramWrapper = document.getElementById('params-wrapper');
            const paramsFields = document.querySelectorAll('.param-input');
            const count = paramsFields.length;
            const newParam = document.createElement('vscode-text-field');
            newParam.setAttribute('size', '100');
            newParam.setAttribute('id', 'param-' + (count + 1));
            newParam.setAttribute('class', 'text-input param-input');
            newParam.setAttribute('name', 'param-' + (count + 1));
            newParam.setAttribute('placeholder', 'Param ' + (count + 1));
            const newParamRow = document.createElement('div');
            newParamRow.setAttribute('class', 'field-row param-row');
            newParamRow.appendChild(newParam);
            paramWrapper.appendChild(newParamRow);
          });

          removeButton.addEventListener('click', () => {
            const paramsFields = document.querySelectorAll('.param-row');
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
