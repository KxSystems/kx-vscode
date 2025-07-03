/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import { InsightsNode } from "./kdbTreeProvider";
import {
  getConnectionForServer,
  getServerForUri,
} from "../commands/workspaceCommand";

export class KxNotebookTargetActionProvider
  implements vscode.NotebookCellStatusBarItemProvider
{
  private readonly _onDidChangeCellStatusBarItems =
    new vscode.EventEmitter<void>();
  readonly onDidChangeCellStatusBarItems =
    this._onDidChangeCellStatusBarItems.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.connectionMap")) {
        this._onDidChangeCellStatusBarItems.fire();
      }
    });
  }

  async provideCellStatusBarItems(
    cell: vscode.NotebookCell,
    _token: vscode.CancellationToken,
  ) {
    const server = getServerForUri(cell.notebook.uri);
    if (!server) {
      return [];
    }

    const conn = await getConnectionForServer(server);
    const isInsights = conn instanceof InsightsNode;
    if (!isInsights) {
      return [];
    }

    const actions: vscode.NotebookCellStatusBarItem[] = [];
    const languageId = cell.document.languageId;
    const target = cell.metadata?.target;

    if (languageId === "q") {
      const targetItem = new vscode.NotebookCellStatusBarItem(
        target || "scratchpad",
        vscode.NotebookCellStatusBarAlignment.Right,
      );

      targetItem.command = {
        title: "Choose Target",
        command: "kdb.file.pickTarget",
        arguments: [cell],
      };

      targetItem.tooltip = "Execution Target";

      actions.push(targetItem);
    }

    if (target || languageId === "sql") {
      const variableNameItem = new vscode.NotebookCellStatusBarItem(
        `(${cell.metadata?.variable || "none"})`,
        vscode.NotebookCellStatusBarAlignment.Right,
      );

      variableNameItem.tooltip = "Output Variable Name";

      variableNameItem.command = {
        title: "Input Variable Name",
        command: "kdb.file.inputVariable",
        arguments: [cell],
      };

      actions.push(variableNameItem);
    }

    return actions;
  }
}

export async function inputVariable(cell?: vscode.NotebookCell) {
  const variable = await vscode.window.showInputBox({
    title: "Enter output variable name for scratchpad:",
    value: cell?.metadata?.variable,
    validateInput,
  });
  if (variable !== undefined) {
    if (cell) {
      await updateCellMetadata(cell, {
        target: cell.metadata?.target,
        variable: variable || undefined,
      });
    }
    return variable;
  }
}

function validateInput(value?: string) {
  if (value === undefined) {
    return undefined;
  }
  if (value.length > 32) {
    return "Variable name should be less than or equal to 32 characters.";
  }
  if (value.match(/^[_0-9]/gs)) {
    return "Variable name can't start with a number or underscore.";
  }
  if (value.match(/[^a-zA-Z_0-9.]/gs)) {
    return "Variable name contains invalid characters.";
  }
  return undefined;
}

export async function updateCellMetadata(
  cell: vscode.NotebookCell,
  metadata: { target?: string; variable?: string },
) {
  const edit = new vscode.WorkspaceEdit();
  edit.set(cell.notebook.uri, [
    vscode.NotebookEdit.updateCellMetadata(cell.index, {
      target: metadata.target || undefined,
      variable: metadata.variable || undefined,
    }),
  ]);
  await vscode.workspace.applyEdit(edit);
}
