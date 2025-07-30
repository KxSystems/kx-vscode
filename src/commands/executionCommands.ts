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
import { ExecutionTypes } from "../models/execution";
import { inputVariable } from "../services/notebookProviders";
import { MessageKind, Runner, notify } from "../utils/notifications";
import { DataSourceFiles } from "../models/dataSource";

export function getQueryContext(lineNum?: number): string {
  let context = ".";
  const editor = ext.activeTextEditor;
  const fullText = typeof lineNum !== "number";

  if (editor) {
    const document = editor.document;
    let text;

    if (fullText) {
      text = editor.document.getText();
    } else {
      const line = document.lineAt(lineNum);
      text = editor.document.getText(
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(lineNum, line.range.end.character),
        ),
      );
    }

    // matches '\d .foo' or 'system "d .foo"'
    const pattern = /^(system\s*"d|\\d)\s+([^\s"]+)/gm;

    const matches = [...text.matchAll(pattern)];
    if (matches.length) {
      // fullText should use first defined context
      // a selection should use the last defined context
      context = fullText ? matches[0][2] : matches[matches.length - 1][2];
    }
  }

  return context;
}

export async function runQuery(
  type: ExecutionTypes,
  connLabel: string,
  executorName: string,
  isWorkbook: boolean,
  rerunQuery?: string,
  target?: string,
  isSql?: boolean,
  isInsights?: boolean,
) {
  const editor = ext.activeTextEditor;
  if (!editor) {
    return false;
  }

  let context;
  let query;
  let isPython = false;
  let variable: string | undefined;

  switch (type) {
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection: {
      const selection = editor.selection;
      query = selection.isEmpty
        ? editor.document.lineAt(selection.active.line).text
        : editor.document.getText(selection);
      context = getQueryContext(selection.end.line);
      if (type === ExecutionTypes.PythonQuerySelection) {
        isPython = true;
      }
      break;
    }

    case ExecutionTypes.QueryFile:
    case ExecutionTypes.ReRunQuery:
    case ExecutionTypes.PythonQueryFile:
    default: {
      query = rerunQuery || editor.document.getText();
      context = getQueryContext();

      if (type === ExecutionTypes.PythonQueryFile) {
        isPython = true;
      }
      break;
    }
  }

  if (type === ExecutionTypes.PopulateScratchpad) {
    if (executorName.endsWith(".py")) {
      isPython = true;
    }
    variable = await inputVariable();
  }

  const runner = Runner.create((_, token) => {
    return target || isSql
      ? variable
        ? populateScratchpad(
            connLabel,
            getPartialDatasourceFile(query, target, isSql, isPython),
            variable,
          )
        : runDataSource(
            connLabel,
            getPartialDatasourceFile(query, target, isSql, isPython),
            executorName,
          )
      : executeQuery(
          query,
          connLabel,
          executorName,
          context,
          isPython,
          isWorkbook,
          false,
          token,
        );
  });

  if (isInsights) {
    runner.location = ProgressLocation.Notification;
  }
  runner.title = `Executing ${executorName} on ${connLabel || "active connection"}.`;

  return (target || isSql) && !variable
    ? runner.execute()
    : needsScratchpad(connLabel, runner.execute());
}
