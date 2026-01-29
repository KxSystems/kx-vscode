/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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
  Webview,
  WebviewView,
  WebviewViewProvider,
  window,
  workspace,
} from "vscode";

import { ext } from "../extensionVariables";
import * as utils from "../utils/execution";
import { getNonce } from "../utils/getNonce";
import { MessageKind, notify } from "../utils/notifications";
import { convertToGrid, formatResult } from "../utils/resultsRenderer";
import { getUri } from "../utils/uriUtils";

const logger = "resultsPanelProvider";

export class KdbResultsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "kdb-results";
  public isInsights = false;
  public isPython = false;
  public _colorTheme: any;
  private _view?: WebviewView;
  private savedParamStates: any = {};
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
  }

  public resolveWebviewView(webviewView: WebviewView) {
    /* c8 ignore start */
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this._extensionUri, "out")],
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    ext.isResultsTabVisible = this._view?.visible || false;

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
    /* c8 ignore stop */
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
      notify("No results to export", MessageKind.ERROR, { logger });
      return;
    }
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
      notify("Open a folder to export results", MessageKind.ERROR, {
        logger,
      });
      return;
    }
    const workspaceUri = workspaceFolders[0].uri;
    utils.exportToCsv(workspaceUri);
    notify("CSV exported.", MessageKind.DEBUG, {
      logger,
      telemetry: "Results.Export.csv",
    });
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
      notify("No view to update", MessageKind.ERROR, {
        logger,
      });
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

  private postMessageToWebview(gridOptions: any | undefined, result: string) {
    if (this._view) {
      if (gridOptions) {
        this._view.webview.postMessage({
          command: "setGridDatasource",
          results: gridOptions.rowData,
          columnDefs: gridOptions.columnDefs,
          theme: "legacy",
          themeColor: this.defineAgGridTheme(),
        });
        notify("Table displayed.", MessageKind.DEBUG, {
          logger,
          telemetry: "Results.Table.Displayed",
        });
      } else {
        this._view.webview.postMessage({
          command: "setResultsContent",
          results: result,
        });
      }
    }
  }

  private getWebviewContent(webview: Webview) {
    /* c8 ignore start */
    const getResource = (resource: string) =>
      getUri(webview, ext.context.extensionUri, resource.split("/"));

    const getTheme = () =>
      window.activeColorTheme.kind === ColorThemeKind.Light ||
      window.activeColorTheme.kind === ColorThemeKind.HighContrastLight
        ? "sl-theme-light"
        : "sl-theme-dark";

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en" class="${getTheme()}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="${getResource("out/light.css")}" />
        <link rel="stylesheet" href="${getResource("out/style.css")}" />
        <script type="module" nonce="${getNonce()}" src="${getResource("out/webview.js")}"></script>
        <title>KDB Results</title>
      </head>
      <body>
        <kdb-results-view size="100"></kdb-results-view>
      </body>
      </html>
    `;
    /* c8 ignore stop */
  }
}
