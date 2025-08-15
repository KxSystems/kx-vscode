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

import { env } from "node:process";
import path from "path";
import * as vscode from "vscode";
import { Uri, window, workspace } from "vscode";

import { ext } from "../extensionVariables";
import { getAutoFocusOutputOnEntrySetting } from "./core";
import { MessageKind, notify } from "./notifications";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { CellKind } from "../models/notebook";
import { QueryResultType } from "../models/queryResult";

const logger = "execution";

interface tblHeader {
  label: string;
  count: number;
}

export function runQFileTerminal(filename?: string): void {
  let terminalName = "REPL: kdb q";
  let command = "q";
  if (filename) {
    filename = filename.replace(/\\/g, "/");
    terminalName = path.parse(filename).base;
    command = `q ${filename}`;
  }
  window.terminals.forEach((terminal) => {
    if (terminal.name === terminalName) terminal.dispose();
  });
  const terminal = window.createTerminal(terminalName);
  if (env.QHOME) {
    if (getAutoFocusOutputOnEntrySetting()) {
      terminal.show(true);
    }
    terminal.sendText(command);
  }
}

export function handleQueryResults(
  results: any,
  type: QueryResultType,
): string {
  let handledResult: string;
  switch (type) {
    // TODO: Refactor this for queries when receive console/table views
    // case QueryResultType.Text:
    //   if (Array.isArray(JSON.parse(results))) {
    //     handledResult = JSON.parse(results).join(" ");
    //   } else {
    //     handledResult = results;
    //   }
    //   break;
    // case QueryResultType.JSON:
    //   handledResult = new TableGenerator({ spacer: " " })
    //     .fromJson(JSON.parse(results))
    //     .toString();
    //   break;
    case QueryResultType.Error:
    default:
      handledResult = results;
      break;
  }
  return handledResult;
}

export function convertArrayStringInVector(resultRows: any[]): any[] {
  const resultHeader: tblHeader[] = [];
  let auxHeader = resultRows[0];
  const headerLabels = resultRows[0].replace(/\s+/g, " ").trim().split(" ");
  for (let i = 0; headerLabels.length > i; i++) {
    const headerCell: tblHeader = { label: headerLabels[i], count: 0 };
    const endIndex = auxHeader.indexOf(headerLabels[i + 1]);
    const auxFullLbl = auxHeader.substring(0, endIndex);
    auxHeader = auxHeader.replace(auxFullLbl, "");
    headerCell.count = auxFullLbl.length;
    resultHeader.push(headerCell);
  }
  resultRows.shift();
  if (resultRows[0].includes("---")) {
    resultRows.splice(0, 1);
  }
  const resultVector = resultRows.map((row: string) => {
    const rowArray: string[] = [];
    for (let i = 0; resultHeader.length > i; i++) {
      if (resultHeader[i].count !== 0) {
        const cell = row.substring(0, resultHeader[i].count);
        rowArray.push(cell.trim());
        row = row.replace(cell, "");
      } else {
        rowArray.push(row.trim());
      }
    }
    return rowArray;
  });
  resultVector.unshift(headerLabels);
  return resultVector;
}

export function convertArrayInVector(resultRows: any[]): any[] {
  const resultVector = resultRows.map((row) => {
    return row.split(",");
  });
  return resultVector;
}

export function selectNotebookExecutionType(
  hasVariable: boolean,
  hasTarget: boolean,
  notebookType: CellKind,
): ExecutionTypes {
  const isPython = notebookType === CellKind.PYTHON;
  const isSQL = notebookType === CellKind.SQL;
  if (isSQL && hasVariable) {
    return ExecutionTypes.PopulateScratchpad;
  }
  if (isSQL) {
    return ExecutionTypes.NotebookDataQuerySQL;
  }
  if (hasVariable && hasTarget) {
    return isPython
      ? ExecutionTypes.PopulateScratchpadPython
      : ExecutionTypes.PopulateScratchpad;
  }
  if (hasTarget && isPython) {
    return ExecutionTypes.NotebookDataQueryPython;
  }
  if (hasTarget) {
    return ExecutionTypes.NotebookDataQueryQSQL;
  }
  if (isPython) {
    return ExecutionTypes.NotebookQueryPython;
  }
  return ExecutionTypes.NotebookQueryQSQL;
}

export function convertResultStringToVector(result: any): any[] {
  const resultRows =
    typeof result === "string"
      ? result.split("\n").filter((row) => row.length > 0)
      : result;
  if (resultRows.length === 1) return resultRows;
  return convertArrayStringInVector(resultRows);
}

export function convertResultToVector(result: any): any[] {
  if (result.length === 1) return result;
  return convertArrayInVector(result);
}

export async function exportToCsv(workspaceUri: Uri): Promise<void> {
  const timestamp = Date.now();
  const fileName = `results-${timestamp}.csv`;
  const filePath = Uri.file(path.join(workspaceUri.fsPath, fileName));

  try {
    await workspace.fs.writeFile(filePath, Buffer.from(ext.resultPanelCSV));
    notify("file located at: " + filePath.fsPath, MessageKind.DEBUG, {
      logger,
    });
    window.showTextDocument(filePath, { preview: false });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    notify(`Failed to write file: ${errorMessage}`, MessageKind.ERROR, {
      logger,
    });
  }
}

export function convertArrayOfArraysToObjects(arr: any): any[] {
  if (!Array.isArray(arr) || arr.length === 0) {
    return arr;
  }

  const firstRow = arr[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) {
    return arr;
  }

  const numColumns = firstRow.length;
  const result: any[] = [];

  for (let i = 0; i < numColumns; i++) {
    const obj: any = {};
    for (const row of arr) {
      if (!Array.isArray(row) || row.length !== numColumns) {
        return [];
      }
      const key = Object.keys(row[i])[0];
      obj[key] = row[i][key];
    }
    result.push(obj);
  }

  return result;
}

function processLineWithSeparator(line: string, index: number): object {
  const parts = line.split("|").map((part) => part.trim());
  return { Index: index + 1, Key: parts[0], Value: parts[1] };
}

function processLineWithoutSeparator(line: string, index: number): object[] {
  if (!line.startsWith('"') && line.includes(" ")) {
    // Split the line into parts by spaces and map each part to an object
    return line.split(" ").map((part, i) => {
      return { Index: index + i + 1, Value: part };
    });
  } else {
    return [{ Index: index + 1, Value: line.trim() }];
  }
}

function processLine(
  line: string,
  index: number,
  fieldLengths: number[],
  fieldNames: string[],
): object {
  let start = 0;
  const obj: { [key: string]: any } = { Index: index + 1 };
  fieldLengths.forEach((length, i) => {
    obj[fieldNames[i]] = line.substring(start, start + length).trim();
    start += length;
  });
  return obj;
}

export function convertStringToArray(str: string): any[] {
  const lines = str.split("\n").filter((line) => line.trim() !== "");
  if (lines.length > 2 && lines[1].startsWith("---")) {
    const fieldNames = lines[0].split(" ").filter((part) => part !== "");
    lines.splice(1, 1);
    let total = 0;
    const fieldLengths = fieldNames.map((name, i) => {
      if (i === fieldNames.length - 1) {
        return lines[0].length - total;
      }
      const elementLength =
        lines[0].indexOf(fieldNames[i + 1] ?? "") - lines[0].indexOf(name);
      total += elementLength;
      return elementLength;
    });
    lines.shift();
    return lines.flatMap((line, index) =>
      fieldLengths.length > 0
        ? processLine(line, index, fieldLengths, fieldNames)
        : [],
    );
  }

  if (lines.length === 2 && lines[1].startsWith("---")) {
    lines.splice(1, 1);
    return lines[0].split(" ").filter((part) => part !== "");
  }

  return lines
    .flatMap((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      return parts.length === 2
        ? processLineWithSeparator(line, index)
        : processLineWithoutSeparator(line, index);
    })
    .filter(
      (obj) => !("Value" in obj && (obj.Value as string).startsWith("-")),
    );
}

export function isExecutionPython(type: ExecutionTypes): boolean {
  const name = ExecutionTypes[type];
  return typeof name === "string" && name.includes("Python");
}

export function isExecutionNotebook(type: ExecutionTypes): boolean | undefined {
  const name = ExecutionTypes[type];
  return typeof name === "string" && name.includes("Notebook")
    ? true
    : undefined;
}

export function retrieveEditorSelectionToExecute(): string | undefined {
  const editor = ext.activeTextEditor;
  let query: string | undefined;
  if (editor) {
    const selection = editor.selection;
    query = selection.isEmpty
      ? editor.document.lineAt(selection.active.line).text
      : editor.document.getText(selection);
  }
  return query;
}

export function retrieveEditorText(): string | undefined {
  const editor = ext.activeTextEditor;
  let query: string | undefined;
  if (editor) {
    query = editor.document.getText();
  }
  return query;
}

export function getQuery(
  querySubject?: DataSourceFiles,
): string | DataSourceFiles | undefined {
  if (querySubject) {
    if (querySubject.dataSource.selectedType === DataSourceTypes.QSQL) {
      return querySubject.dataSource.qsql.query;
    }
    if (querySubject.dataSource.selectedType === DataSourceTypes.SQL) {
      return querySubject.dataSource.sql.query;
    }
    return querySubject;
  } else {
    const editor = ext.activeTextEditor;
    if (editor) {
      return editor.document.getText();
    }
    return;
  }
}

export function getDSExecutionType(
  querySubject?: DataSourceFiles,
): DataSourceTypes {
  if (querySubject) {
    return querySubject.dataSource.selectedType;
  } else {
    return DataSourceTypes.QSQL;
  }
}

export function getExecutionQueryContext(): string {
  let context = ".";
  const editor = ext.activeTextEditor;

  if (editor) {
    const selection = editor.selection;
    const lineNum = selection.end.line;
    const fullText = typeof lineNum !== "number";
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

    const pattern = /^(system\s*"d|\\d)\s+([^\s"]+)/gm;

    const matches = [...text.matchAll(pattern)];
    if (matches.length) {
      context = fullText ? matches[0][2] : matches[matches.length - 1][2];
    }
  }

  return context;
}
