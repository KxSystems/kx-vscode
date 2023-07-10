import * as vscode from "vscode";
import * as utils from "../utils/execution";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";

export class ResultsPanel {
  public static currentResPanel: ResultsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    queryResult: string | string[]
  ) {
    this._panel = panel;

    this.update(extensionUri, queryResult);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this.update(extensionUri, queryResult);
        }
      },
      null,
      this._disposables
    );
  }

  public static render(
    extensionUri: vscode.Uri,
    queryResult: string | string[]
  ) {
    if (ResultsPanel.currentResPanel) {
      ResultsPanel.currentResPanel.update(extensionUri, queryResult);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "results",
      "Q Results",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      }
    );

    ResultsPanel.currentResPanel = new ResultsPanel(
      panel,
      extensionUri,
      queryResult
    );
  }

  public dispose() {
    ResultsPanel.currentResPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  public update(extensionUri: vscode.Uri, queryResult: string | string[]) {
    const html = this._getWebviewContent(
      this._panel.webview,
      extensionUri,
      queryResult
    );
    console.log(html);
    console.log(this._panel.webview);
    this._panel.webview.html = html;
  }

  handleQueryResultsString(queryResult: string) {
    const vectorRes = utils.convertResultStringToVector(queryResult);
    console.log(vectorRes);
    let results = ``;
    if (vectorRes.length > 1) {
      results = `<vscode-data-grid class="results-datagrid" aria-label="Basic">`;
      let headers = `<vscode-data-grid-row class="results-header-datagrid" row-type="header">`;
      let rows = ``;
      vectorRes[0].forEach((header: string, index: number) => {
        headers += `<vscode-data-grid-cell  cell-type="columnheader" grid-column="${
          index + 1
        }"><b>${header.toUpperCase()}</b></vscode-data-grid-cell>`;
      });
      headers += `</vscode-data-grid-row>`;
      vectorRes.slice(1).forEach((row: string[]) => {
        rows += `<vscode-data-grid-row>`;
        row.forEach((cell: string, index: number) => {
          rows += `<vscode-data-grid-cell grid-column="${
            index + 1
          }">${cell}</vscode-data-grid-cell>`;
        });
        rows += `</vscode-data-grid-row>`;
      });

      results += headers + rows + `</vscode-data-grid>`;
    } else {
      results = `<p>${vectorRes[0]}</p>`;
    }
    return results;
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    queryResult: string | string[]
  ) {
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();
    const styleUri = getUri(webview, extensionUri, ["out", "resultsPanel.css"]);
    const resetStyleUri = getUri(webview, extensionUri, ["out", "reset.css"]);
    const vscodeStyleUri = getUri(webview, extensionUri, ["out", "vscode.css"]);
    let result = "";
    if (typeof queryResult === "string") {
      result = this.handleQueryResultsString(queryResult);
    }

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
  }
}
