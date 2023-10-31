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

import { env } from "node:process";
import path from "path";
import { Uri, window, workspace } from "vscode";
import { ext } from "../extensionVariables";
import { QueryResultType } from "../models/queryResult";

interface tblHeader {
  label: string;
  count: number;
}

export function runQFileTerminal(filename: string): void {
  filename = filename.replace(/\\/g, "/");
  const terminalName = path.parse(filename).base;
  const command = `q ${filename}`;
  window.terminals.forEach((terminal) => {
    if (terminal.name === terminalName) terminal.dispose();
  });
  const terminal = window.createTerminal(terminalName);
  if (env.QHOME) {
    terminal.show();
    terminal.sendText(command);
  }
}

export function handleQueryResults(
  results: any,
  type: QueryResultType
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
  const filePath = Uri.parse(path.join(workspaceUri.fsPath, fileName));
  await workspace.fs.writeFile(filePath, Buffer.from(ext.resultPanelCSV));
  window.showTextDocument(filePath, { preview: false });
}

export function convertArrayOfArraysToObjects(arr: any[][]): any[] {
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
