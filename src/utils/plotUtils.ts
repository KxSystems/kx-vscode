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
  NotebookCell,
  NotebookCellData,
  NotebookCellOutput,
  NotebookCellOutputItem,
  NotebookEdit,
  NotebookRange,
  ViewColumn,
  WorkspaceEdit,
  workspace,
} from "vscode";

import { MessageKind, notify } from "./notifications";
import {
  addWorkspaceFile,
  openWith,
  setUriContent,
  workspaceHas,
} from "./workspace";
import { ext } from "../extensionVariables";
import { Plot } from "../models/plot";
import { ChartEditorProvider } from "../services/chartEditorProvider";

const logger = "plotUtils";

/**
 * Writes a plot to its own .plot file and opens it in the chart editor, so a
 * process emitting several images produces one chart view apiece.
 * @param data The image as a data URI
 */
export async function writePlotToFile(data: string): Promise<void> {
  // Deliberately not gated on there being an active editor: a notebook only
  // session has none, and bailing here dropped the image with no trace.
  // addWorkspaceFile falls back to the first workspace folder without a uri.
  const uri = await addWorkspaceFile(
    ext.activeTextEditor?.document.uri,
    "plot",
    ".plot",
  );
  if (!workspaceHas(uri)) {
    await workspace.openTextDocument(uri);
    await openWith(uri, ChartEditorProvider.viewType, ViewColumn.Beside);
  }
  await setUriContent(uri, JSON.stringify(<Plot>{ charts: [{ data }] }));
}

// How long after a cell ends its stdout is still treated as belonging to it.
// Generous, because the log websocket lags the query response by an unspecified
// amount, but bounded so unrelated output much later does not land in a stale
// cell.
const LATE_OUTPUT_MS = 30000;

/**
 * Appends an output to a cell that is no longer executing, which has to go
 * through the document rather than the finished execution. There is no edit for
 * outputs alone, so the cell is rewritten with its content, metadata and
 * execution summary preserved.
 * @param cell The cell to append to
 * @param output The output to append
 * @returns Whether the edit was applied
 */
async function appendToCell(
  cell: NotebookCell,
  output: NotebookCellOutput,
): Promise<boolean> {
  const replacement = new NotebookCellData(
    cell.kind,
    cell.document.getText(),
    cell.document.languageId,
  );
  replacement.metadata = cell.metadata;
  replacement.executionSummary = cell.executionSummary;
  replacement.outputs = [...cell.outputs, output];

  const edit = new WorkspaceEdit();
  edit.set(cell.notebook.uri, [
    NotebookEdit.replaceCells(new NotebookRange(cell.index, cell.index + 1), [
      replacement,
    ]),
  ]);
  return workspace.applyEdit(edit);
}

/**
 * Renders a plot that arrived out of band (on a connection's stdout rather than
 * as a query result). The notebook cell that produced it gets it inline,
 * whether or not that cell is still executing; anything else falls back to a
 * .plot file.
 * @param data The image as a data URI
 * @param connLabel The connection the image came from
 */
export async function renderPlot(
  data: string,
  connLabel: string,
): Promise<void> {
  const target = ext.activeCellExecutions.get(connLabel);
  const output = new NotebookCellOutput([
    NotebookCellOutputItem.text(`<img src="${data}"/>`, "text/html"),
  ]);

  if (target) {
    try {
      if (target.endedAt === undefined) {
        target.execution.appendOutput(output);
        // Tells the controller to append its result instead of replacing the
        // cell's outputs, which would discard the image.
        target.plotted = true;
        return;
      }
      if (Date.now() - target.endedAt < LATE_OUTPUT_MS) {
        if (await appendToCell(target.cell, output)) {
          return;
        }
      }
    } catch (error) {
      // Fall through to the file rather than lose the image.
      notify(`Unable to render plot in notebook.`, MessageKind.DEBUG, {
        logger,
        params: error,
      });
    }
  }
  await writePlotToFile(data);
}
