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
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  TextDocument,
  Uri,
  WebviewPanel,
  commands,
  window,
  workspace,
} from "vscode";

import { QueryEditorProvider } from "./queryEditorProvider";
import { convertDataSource } from "../commands/queryCommand";
import { ext } from "../extensionVariables";
import { getBasename } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { openWith } from "../utils/workspace";

const logger = "dataSourceConverterProvider";

/**
 * Stands in for the datasource editor, which is gone. Opening a `.kdb.json` or
 * a `.kxuda` converts it — to a `.kxquery` for getData and UDA datasources, to
 * a workbook for QSQL and SQL — opens what came out, and closes itself. The
 * original file is left where it is.
 */
export class DataSourceConverterProvider implements CustomTextEditorProvider {
  static readonly viewType = "kdb.dataSourceConverter";

  public static register(context: ExtensionContext): Disposable {
    const provider = new DataSourceConverterProvider(context);
    return window.registerCustomEditorProvider(
      DataSourceConverterProvider.viewType,
      provider,
    );
  }

  constructor(private readonly context: ExtensionContext) {}

  static isConvertible(uri: Uri) {
    return uri.path.endsWith(".kdb.json") || uri.path.endsWith(".kxuda");
  }

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: false };
    webviewPanel.webview.html = this.getWebviewContent(document);

    const target = await convertDataSource(document.uri);

    if (!target) {
      notify(
        `${getBasename(document.uri)} could not be converted. Open it as text to see what it holds.`,
        MessageKind.WARNING,
        { logger },
      );
      return;
    }

    notify(
      `${getBasename(document.uri)} was converted to ${getBasename(target)}.`,
      MessageKind.INFO,
      { logger },
    );

    ext.queryTreeProvider.reload();
    ext.scratchpadTreeProvider.reload();

    if (target.path.endsWith(".kxquery")) {
      await openWith(target, QueryEditorProvider.viewType);
    } else {
      await window.showTextDocument(await workspace.openTextDocument(target));
    }

    await commands.executeCommand(
      "workbench.action.closeActiveEditor",
      webviewPanel,
    );
  }

  private getWebviewContent(document: TextDocument) {
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Converting</title>
      </head>
      <body>
        <p>Converting ${getBasename(document.uri)}…</p>
      </body>
      </html>
    `;
  }
}
