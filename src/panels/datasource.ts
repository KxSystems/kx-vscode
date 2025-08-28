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

import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import { DataSourceFiles } from "../models/dataSource";
import { DataSourceMessage } from "../models/messages";
import { UDA } from "../models/uda";
import { InsightsNode } from "../services/kdbTreeProvider";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/uriUtils";

let running = false;

export class DataSourcesPanel {
  public static currentPanel: DataSourcesPanel | undefined;
  private uri;
  public readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private dataSourceFile: DataSourceFiles;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    dataSourceFile: DataSourceFiles,
  ) {
    this.uri = extensionUri;
    this.dataSourceFile = dataSourceFile;
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getWebviewContent(
      this._panel.webview,
      extensionUri,
    );
    this._panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "kdb.dataSource.saveDataSource") {
        this._panel.title = message.data.name;
        vscode.commands.executeCommand(
          "kdb.dataSource.saveDataSource",
          message.data,
        );
      } else if (message.command === "kdb.dataSource.runDataSource") {
        vscode.commands.executeCommand(
          "kdb.dataSource.runDataSource",
          message.data,
        );
      } else if (message.command === "kdb.dataSource.populateScratchpad") {
        vscode.commands.executeCommand(
          "kdb.dataSource.populateScratchpad",
          message.data,
        );
      }
    });
  }

  public static render(
    extensionUri: vscode.Uri,
    dataSourceFile: DataSourceFiles,
  ) {
    if (DataSourcesPanel.currentPanel) {
      DataSourcesPanel.currentPanel.dispose();
    }
    const panel = vscode.window.createWebviewPanel(
      "dataSource",
      dataSourceFile.name ? dataSourceFile.name : "DataSource",
      vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // Keep content even when the webview no longer in the foreground
        retainContextWhenHidden: true,
        // Restrict the webview to only load resources from the `out` directory
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "out")],
      },
    );

    DataSourcesPanel.currentPanel = new DataSourcesPanel(
      panel,
      extensionUri,
      dataSourceFile,
    );

    DataSourcesPanel.currentPanel.update();
  }

  public static close() {
    if (DataSourcesPanel.currentPanel) {
      DataSourcesPanel.currentPanel.dispose();
    }
  }

  public static set running(flag: boolean) {
    running = flag;
    const panel = DataSourcesPanel.currentPanel;

    if (panel) {
      panel.status();
    }
  }

  public static get running() {
    return running;
  }

  public status() {
    this._panel.webview.postMessage({ running });
  }

  public refresh() {
    DataSourcesPanel.render(this.uri, this.dataSourceFile);
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

  private update() {
    const dataSourceFile = this.dataSourceFile;
    const dataSourceName = dataSourceFile.name || "";
    const insightsMeta = ext.insightsMeta;
    const isInsights = ext.connectionNode instanceof InsightsNode;
    const insightsUDAs: UDA[] = [];
    const message: DataSourceMessage = {
      isInsights,
      insightsMeta,
      insightsUDAs,
      dataSourceName,
      dataSourceFile,
    };

    this._panel.webview.postMessage(message);
  }

  public reload(dataSourceFile: DataSourceFiles) {
    this.dataSourceFile = dataSourceFile;
    this.update();
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ) {
    const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DataSource</title>
      </head>
      <body>
        <kdb-data-source-view></kdb-data-source-view>
        <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
      </body>
      </html>
    `;
  }
}
