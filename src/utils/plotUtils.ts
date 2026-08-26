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
  NotebookCellExecution,
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

const LATE_OUTPUT_MS = 30000;
const MAX_PENDING = 100;

/**
 * Registers a cell execution as the destination for any image the query it is
 * running emits, and retires entries that can no longer receive one.
 * @param requestID The id sent with the query, which the image is tagged with
 * @param execution The running execution
 * @param cell The cell being executed
 * @returns The registered target, which the caller marks as ended
 */
export function registerImageTarget(
  requestID: string,
  execution: NotebookCellExecution,
  cell: NotebookCell,
): ext.CellExecutionTarget {
  const now = Date.now();
  for (const [id, target] of ext.pendingImageTargets) {
    if (
      target.endedAt !== undefined &&
      now - target.endedAt >= LATE_OUTPUT_MS
    ) {
      ext.pendingImageTargets.delete(id);
    } else if (
      target.index === cell.index &&
      target.cell.notebook.uri.toString() === cell.notebook.uri.toString()
    ) {
      // A new run of the same cell owns its outputs from here on. An image
      // still in flight from the run being replaced can no longer be written
      // without restoring the outputs it was sent alongside.
      target.superseded = true;
    }
  }
  while (ext.pendingImageTargets.size >= MAX_PENDING) {
    const oldest = ext.pendingImageTargets.keys().next();
    if (oldest.done) {
      break;
    }
    ext.pendingImageTargets.delete(oldest.value);
  }

  const target: ext.CellExecutionTarget = {
    execution,
    cell,
    // Captured now: once an image has been written the cell is replaced, and
    // the object left behind reports an index of -1.
    index: cell.index,
    outputs: [],
  };
  ext.pendingImageTargets.set(requestID, target);
  return target;
}

/**
 * Writes outputs to a cell that is no longer executing, which has to go through
 * the document rather than the finished execution. There is no edit for outputs
 * alone, so the cell is rewritten with its content, metadata and execution
 * summary preserved.
 * @param cell The cell to write to
 * @param outputs The outputs the cell ends up with
 * @returns Whether the edit was applied
 */
async function writeToCell(
  cell: NotebookCell,
  outputs: NotebookCellOutput[],
): Promise<boolean> {
  const replacement = new NotebookCellData(
    cell.kind,
    cell.document.getText(),
    cell.document.languageId,
  );
  replacement.metadata = cell.metadata;
  replacement.executionSummary = cell.executionSummary;
  // Fresh instances: replaceCells destroys and recreates the cell, and outputs
  // carried over from the cell being replaced keep the identity the renderer
  // has already retired, so they end up in the document without ever being
  // drawn.
  replacement.outputs = outputs.map(
    (output) =>
      new NotebookCellOutput(
        output.items.map(
          (item) => new NotebookCellOutputItem(item.data, item.mime),
        ),
        output.metadata,
      ),
  );

  const edit = new WorkspaceEdit();
  edit.set(cell.notebook.uri, [
    NotebookEdit.replaceCells(new NotebookRange(cell.index, cell.index + 1), [
      replacement,
    ]),
  ]);
  return workspace.applyEdit(edit);
}

/**
 * Renders an image that arrived out of band, on the scratchpad log websocket
 * rather than as a query result. The notebook cell that produced it gets it
 * inline, whether or not that cell is still executing; anything else — a
 * workbook, or a cell whose entry has already been retired — falls back to a
 * file.
 * @param requestID The id the image was tagged with, "" when the process had
 * none to echo back
 * @param data The image as a data URI
 */
export async function renderImage(
  requestID: string,
  data: string,
): Promise<void> {
  const target = requestID ? ext.pendingImageTargets.get(requestID) : undefined;
  const output = new NotebookCellOutput([
    NotebookCellOutputItem.text(`<img src="${data}"/>`, "text/html"),
  ]);

  if (target?.superseded) {
    // Falling back to a file would open a chart for an image the cell it
    // belongs to has already been rerun past.
    notify(`Discarded an image from a superseded run.`, MessageKind.DEBUG, {
      logger,
    });
    return;
  }

  if (target) {
    try {
      if (target.endedAt === undefined) {
        target.execution.appendOutput(output);
        target.outputs.push(output);
        return;
      }
      if (Date.now() - target.endedAt < LATE_OUTPUT_MS) {
        await target.applied;
        if (await writeToCell(target.cell, [...target.outputs, output])) {
          target.outputs.push(output);
          return;
        }
      }
    } catch (error) {
      notify(`Unable to render plot in notebook.`, MessageKind.DEBUG, {
        logger,
        params: error,
      });
    }
  }
  await writePlotToFile(data);
}
