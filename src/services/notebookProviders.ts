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

import * as vscode from "vscode";

import { InsightsNode } from "./kdbTreeProvider";
import { onDidChangeActiveTarget } from "../classes/activeTarget";
import {
  getConnectionForServer,
  getServerForUri,
  onDidChangeSessionMaps,
  runsOnRepl,
} from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";
import { CellKind, RowLimit, RowLimitFrom } from "../models/notebook";

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
    onDidChangeSessionMaps(() => this._onDidChangeCellStatusBarItems.fire());
  }

  async provideCellStatusBarItems(
    cell: vscode.NotebookCell,
    _token: vscode.CancellationToken,
  ) {
    const server = getServerForUri(cell.notebook.uri);
    const conn = server ? await getConnectionForServer(server) : undefined;
    const isInsights = conn instanceof InsightsNode;

    const actions: vscode.NotebookCellStatusBarItem[] = [];
    const kind = getCellKind(cell);
    const target = cell.metadata?.target;

    if (kind === CellKind.Q || kind === CellKind.PYTHON) {
      const targetItem = new vscode.NotebookCellStatusBarItem(
        target || (isInsights ? "scratchpad" : "default"),
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

    if (target || kind === CellKind.SQL) {
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
    title: "Enter Output Variable Name",
    value: cell?.metadata?.variable,
    validateInput,
  });
  if (variable !== undefined) {
    if (cell) {
      await updateCellMetadata(cell, {
        target: cell.metadata?.target,
        variable: variable,
      });
    }
    return variable;
  }
}

export function validateInput(value?: string) {
  if (value === undefined) {
    return undefined;
  }
  if (value.length > 32) {
    return "Variable name should be less than or equal to 32 characters.";
  }
  if (/^[_0-9]/s.test(value)) {
    return "Variable name can't start with a number or underscore.";
  }
  if (/[^a-zA-Z_0-9.]/s.test(value)) {
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

export function getCellKind(cell: vscode.NotebookCell) {
  switch (cell.document.languageId) {
    case "q":
      return CellKind.Q;
    case "python":
      return CellKind.PYTHON;
    case "sql":
      return CellKind.SQL;
    default:
      return CellKind.MARKDOWN;
  }
}

// Must match the kdb.notebook.rowLimit.<n> commands and menus in package.json.
export const ROW_LIMIT_PRESETS = [10, 100, 1000, 10000, 100000, 1000000];

const ROW_LIMIT_MAX = 1000000;

const ROW_LIMIT_DEFAULT = 100;

// A notebook keeps its own row limit in its metadata; the settings are the
// defaults for notebooks that have none.
export function getRowLimit(notebook?: vscode.NotebookDocument): RowLimit {
  const config = vscode.workspace.getConfiguration("kdb");
  const saved = notebook?.metadata?.rowLimit;
  const limit = isValidRowLimit(saved)
    ? saved
    : config.get<number>("notebookRowLimit", ROW_LIMIT_DEFAULT);
  const from = notebook?.metadata?.rowLimitFrom
    ? notebook.metadata.rowLimitFrom
    : config.get<string>("notebookRowLimitFrom");
  return {
    limit:
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, ROW_LIMIT_MAX)
        : ROW_LIMIT_DEFAULT,
    from: from === "last" ? "last" : "first",
  };
}

function isValidRowLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

async function updateRowLimitMetadata(
  notebook: vscode.NotebookDocument,
  metadata: { rowLimit?: number; rowLimitFrom?: RowLimitFrom },
) {
  const edit = new vscode.WorkspaceEdit();
  edit.set(notebook.uri, [
    vscode.NotebookEdit.updateNotebookMetadata({
      ...notebook.metadata,
      ...metadata,
    }),
  ]);
  await vscode.workspace.applyEdit(edit);
}

function activeKxNotebook() {
  const notebook = vscode.window.activeNotebookEditor?.notebook;
  return notebook?.notebookType === "kx-notebook" ? notebook : undefined;
}

export function parseRowLimit(value: string): number | undefined {
  const trimmed = value.trim().replace(/,/g, "");
  if (!/^\d+$/.test(trimmed)) return undefined;
  const limit = Number(trimmed);
  return Number.isSafeInteger(limit) && limit > 0 && limit <= ROW_LIMIT_MAX
    ? limit
    : undefined;
}

export async function pickRowLimitFrom() {
  const notebook = activeKxNotebook();
  if (!notebook) return;
  const current = getRowLimit(notebook).from;
  const options: { label: string; detail: string; from: RowLimitFrom }[] = [
    {
      label: "$(arrow-up) First",
      detail: "Show the first rows",
      from: "first",
    },
    { label: "$(arrow-down) Last", detail: "Show the last rows", from: "last" },
  ];
  const items = options.map((item) => ({
    ...item,
    description: item.from === current ? "current" : undefined,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: "Notebook Rows",
    placeHolder: "Show the first or the last rows of a table",
  });
  if (picked && picked.from !== current) {
    await updateRowLimitMetadata(notebook, { rowLimitFrom: picked.from });
  }
}

export async function pickRowLimit() {
  const notebook = activeKxNotebook();
  if (!notebook) return;
  const current = getRowLimit(notebook).limit;
  const custom = !ROW_LIMIT_PRESETS.includes(current);
  const items: (vscode.QuickPickItem & { limit?: number })[] = [
    ...ROW_LIMIT_PRESETS.map((limit) => ({
      label: `${limit.toLocaleString("en-US")} Rows`,
      description: limit === current ? "current" : undefined,
      limit,
    })),
    { label: "", kind: vscode.QuickPickItemKind.Separator },
    {
      label: "$(edit) Custom...",
      description: custom
        ? `current: ${current.toLocaleString("en-US")}`
        : undefined,
    },
  ];
  const picked = await vscode.window.showQuickPick(items, {
    title: "Notebook Row Limit",
    placeHolder: "Maximum number of table rows shown in a cell output",
  });
  if (!picked) return;
  const limit = picked.limit ?? (await inputRowLimit(current));
  if (limit !== undefined && limit !== current) {
    await updateRowLimitMetadata(notebook, { rowLimit: limit });
  }
}

async function inputRowLimit(current: number) {
  const value = await vscode.window.showInputBox({
    title: "Notebook Row Limit",
    prompt: "Maximum number of table rows shown in a cell output",
    value: `${current}`,
    validateInput: (value) =>
      parseRowLimit(value) === undefined
        ? `Enter a whole number from 1 to ${ROW_LIMIT_MAX.toLocaleString("en-US")}.`
        : undefined,
  });
  return value === undefined ? undefined : parseRowLimit(value);
}

// The REPL shows q's console output, which q already cuts to the console
// height, so the row limit buttons are disabled while the active notebook runs
// on it. Run targets change with the connection assigned to the notebook, the
// active target, and connections connecting or disconnecting.
export function trackNotebookOnRepl(): vscode.Disposable {
  const update = () => {
    const notebook = vscode.window.activeNotebookEditor?.notebook;
    vscode.commands.executeCommand(
      "setContext",
      "kdb.notebookOnRepl",
      notebook?.notebookType === "kx-notebook" && runsOnRepl(notebook.uri),
    );
  };
  update();
  return vscode.Disposable.from(
    vscode.window.onDidChangeActiveNotebookEditor(update),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.connectionMap")) update();
    }),
    onDidChangeSessionMaps(update),
    onDidChangeActiveTarget(update),
    vscode.window.onDidCloseTerminal(update),
    ext.serverProvider.onDidChangeTreeData(update),
  );
}

// The toolbar marks the current value through context keys, since a `when`
// clause cannot read the metadata of the active notebook.
export function trackNotebookRowLimit(): vscode.Disposable {
  const update = () => {
    const notebook = activeKxNotebook();
    const { limit, from } = notebook
      ? getRowLimit(notebook)
      : { limit: undefined, from: undefined };
    vscode.commands.executeCommand(
      "setContext",
      "kdb.notebookRowLimitValue",
      limit,
    );
    vscode.commands.executeCommand(
      "setContext",
      "kdb.notebookRowLimitFromValue",
      from,
    );
  };
  update();
  return vscode.Disposable.from(
    vscode.window.onDidChangeActiveNotebookEditor(update),
    vscode.workspace.onDidChangeNotebookDocument((event) => {
      if (event.notebook === activeKxNotebook() && event.metadata) update();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("kdb.notebookRowLimit")) update();
    }),
  );
}
