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
  window,
} from "vscode";

import { QueryEditorProvider } from "./queryEditorProvider";
import { convertDataSource } from "../commands/queryCommand";
import { ext } from "../extensionVariables";
import { getBasename } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { openWith } from "../utils/workspace";

const logger = "dataSourceConverterProvider";

/**
 * Stands in for the datasource editor, which is gone. Opening a `.kdb.json`
 * converts it to a `.kxquery`, opens what came out, and closes itself. The
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
    return uri.path.endsWith(".kdb.json");
  }

  async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: false };
    webviewPanel.webview.html = this.getWebviewContent(document);

    const conversion = await convertDataSource(document.uri);

    if (!conversion) {
      notify(
        `${getBasename(document.uri)} could not be converted. Open it as text to see what it holds.`,
        MessageKind.WARNING,
        { logger },
      );
      return;
    }

    const { target, written } = conversion;

    notify(
      written
        ? `${getBasename(document.uri)} was converted to ${getBasename(target)}.`
        : `${getBasename(document.uri)} was already converted, opening ${getBasename(target)}.`,
      MessageKind.INFO,
      { logger },
    );

    if (written) {
      ext.queryTreeProvider.reload();
      ext.scratchpadTreeProvider.reload();
    }

    await openWith(target, QueryEditorProvider.viewType);

    webviewPanel.dispose();
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
