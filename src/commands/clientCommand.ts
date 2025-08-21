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

import crypto from "crypto";
import {
  EndOfLine,
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
import { executeActiveEditorQuery } from "./executionCommand";
import { getTargetForUri } from "./workspaceCommand";
import { ExecutionTypes } from "../models/execution";
import { getBasename } from "../utils/core";

async function executeBlock(client: LanguageClient) {
  if (ext.activeTextEditor) {
    const isPython = getBasename(ext.activeTextEditor.document.uri).endsWith(
      ".py",
    );
    const target = getTargetForUri(ext.activeTextEditor.document.uri);
    const isDataQuery = target && target !== "scratchpad";
    const range = await client.sendRequest<Range>("kdb.qls.expressionRange", {
      textDocument: { uri: `${ext.activeTextEditor.document.uri}` },
      position: ext.activeTextEditor.selection.active,
    });
    if (range) {
      ext.activeTextEditor.selection = new Selection(
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character,
      );

      const executionTypes = {
        python_data: ExecutionTypes.PythonDataQuerySelection,
        python_query: ExecutionTypes.PythonQuerySelection,
        qsql_data: ExecutionTypes.DataQuerySelection,
        qsql_query: ExecutionTypes.QuerySelection,
      };

      const key = `${isPython ? "python" : "qsql"}_${isDataQuery ? "data" : "query"}`;
      const executionType = executionTypes[key as keyof typeof executionTypes];

      await executeActiveEditorQuery(executionType);
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
        /\s*\.axdebug\.temp([A-F0-9]{6}).*?\.axdebug\.temp\1\s*;/s.exec(text);
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
        const expr1 = `.axdebug.temp${hash}: ${res.params.length === 1 ? res.params[0] : `(${res.params.join(";")})`};`;
        const expr2 = `${res.params.map((param) => `\`${param}`).join("")} set${res.params.length === 1 ? "" : "'"} .axdebug.temp${hash};`;

        if (start.line === end.line) {
          edit.insert(doc.uri, start, " ");
          edit.insert(doc.uri, start, expr1);
          edit.insert(doc.uri, start, expr2);
        } else {
          const line = doc.getText(
            new Range(end.line, 0, end.line, end.character),
          );
          const match = /^[ \t]*/.exec(line);
          if (match) {
            const eol = doc.eol === EndOfLine.CRLF ? "\r\n" : "\n";
            edit.insert(doc.uri, start, eol);
            edit.insert(doc.uri, start, match[0]);
            edit.insert(doc.uri, start, expr1);
            edit.insert(doc.uri, start, eol);
            edit.insert(doc.uri, start, match[0]);
            edit.insert(doc.uri, start, expr2);
          }
        }
      }
      await workspace.applyEdit(edit);
    }
  }
}

export function connectClientCommands(
  context: ExtensionContext,
  client: LanguageClient,
) {
  let mutex = false;

  context.subscriptions.push(
    commands.registerCommand("kdb.execute.block", async () => {
      if (!mutex) {
        mutex = true;
        try {
          await executeBlock(client);
        } finally {
          mutex = false;
        }
      }
    }),
    commands.registerCommand("kdb.toggleParameterCache", async () => {
      if (!mutex) {
        mutex = true;
        try {
          await toggleParameterCache(client);
        } finally {
          mutex = false;
        }
      }
    }),
  );
}
