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
  ExtensionContext,
  Position,
  Range,
  Selection,
  WorkspaceEdit,
  commands,
  workspace,
} from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { ext } from "../extensionVariables";
import { runActiveEditor } from "./workspaceCommand";
import { ExecutionTypes } from "../models/execution";
import crypto from "crypto";

async function executeBlock(client: LanguageClient) {
  if (ext.activeTextEditor) {
    const range = await client.sendRequest<Range>("kdb.qls.expressionRange", {
      textDocument: { uri: `${ext.activeTextEditor.document.uri}` },
      position: ext.activeTextEditor.selection.active,
    });
    if (range) {
      ext.activeTextEditor.selection = new Selection(range.start, range.end);
      await runActiveEditor(ExecutionTypes.QuerySelection);
    }
  }
}

async function toggleParameterCache(client: LanguageClient) {
  if (ext.activeTextEditor) {
    const doc = ext.activeTextEditor.document;
    const res = await client.sendRequest<{
      params: string[];
      start: Position;
      end: Position;
    }>("kdb.qls.parameterCache", {
      textDocument: { uri: `${doc.uri}` },
      position: ext.activeTextEditor.selection.active,
    });
    if (res) {
      const edit = new WorkspaceEdit();
      const start = new Position(res.start.line, res.start.character);
      const end = new Position(res.end.line, res.end.character);
      const text = doc.getText(new Range(start, end));
      const match =
        /\.axdebug\.temp[A-F0-9]{6}.*?\.axdebug\.temp[A-F0-9]{6}\s*;\s*/s.exec(
          text,
        );
      if (match) {
        const offset = doc.offsetAt(start);
        edit.delete(
          doc.uri,
          new Range(
            doc.positionAt(offset + match.index),
            doc.positionAt(offset + match.index + match[0].length),
          ),
        );
      } else {
        const hash = crypto.randomBytes(3).toString("hex").toUpperCase();
        const expr1 = `.axdebug.temp${hash}: (${res.params.join(";")});`;
        const expr2 = `${res.params.map((param) => `\`${param}`).join("")} set' .axdebug.temp${hash};`;

        if (start.line === end.line) {
          edit.insert(doc.uri, start, " ");
          edit.insert(doc.uri, start, expr1);
          edit.insert(doc.uri, start, expr2);
        } else {
          const space = ext.activeTextEditor.options.insertSpaces;
          const count = ext.activeTextEditor.options.indentSize as number;
          edit.insert(doc.uri, start, "\n");
          edit.insert(doc.uri, start, space ? " ".repeat(count) : "\t");
          edit.insert(doc.uri, start, expr1);
          edit.insert(doc.uri, start, "\n");
          edit.insert(doc.uri, start, space ? " ".repeat(count) : "\t");
          edit.insert(doc.uri, start, expr2);
        }
      }
      await workspace.applyEdit(edit);
    }
  }
}

export function connectRequestCommands(
  context: ExtensionContext,
  client: LanguageClient,
) {
  context.subscriptions.push(
    commands.registerCommand("kdb.execute.block", () => executeBlock(client)),
    commands.registerCommand("kdb.toggleParameterCache", () =>
      toggleParameterCache(client),
    ),
  );
}
