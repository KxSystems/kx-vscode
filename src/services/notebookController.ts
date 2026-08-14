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

import { getCellKind } from "./notebookProviders";
import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import { ReplConnection } from "../classes/replConnection";
import {
  getPartialDatasourceFile,
  populateScratchpad,
  runDataSource,
} from "../commands/dataSourceCommand";
import { executeQuery } from "../commands/serverCommand";
import {
  getTimeoutForUri,
  resolveRunTarget,
} from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";
import { CellKind } from "../models/notebook";
import { getBasename, isQuickAlias } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import {
  resultToBase64,
  needsScratchpad,
  getPythonWrapper,
  getSQLWrapper,
  notifyExecution,
  RunFlag,
} from "../utils/queryUtils";
import { convertToGrid, formatResult } from "../utils/resultsRenderer";

const logger = "notebookController";

export class KxNotebookController {
  readonly controllerId = "kx-notebook-1";
  readonly notebookType = "kx-notebook";
  readonly label = "KX Notebook";
  readonly supportedLanguages = ["q", "python", "sql"];

  protected readonly controller: vscode.NotebookController;
  protected order = 0;

  constructor() {
    this.controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label,
    );
    this.controller.supportedLanguages = this.supportedLanguages;
    this.controller.supportsExecutionOrder = true;
    this.controller.executeHandler = this.execute.bind(this);
  }

  dispose(): void {
    this.controller.dispose();
  }

  async executeRepl(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController,
  ) {
    const repl = await ReplConnection.getOrCreateInstance(notebook.uri);

    for (const cell of cells) {
      const execution = controller.createNotebookCellExecution(cell);

      execution.executionOrder = ++this.order;
      execution.start(Date.now());

      let success = false;
      const cancellation = execution.token.onCancellationRequested(() =>
        repl.cancel(),
      );

      try {
        const kind = getCellKind(cell);
        const text = cell.document.getText();
        if (!text.trim()) {
          // Nothing to run. Checked before wrapping, because the SQL and
          // Python wrappers turn an empty cell into a statement the REPL
          // would send.
          this.replaceOutput(execution, { text: "", mime: "text/plain" });
          success = true;
          continue;
        }
        const result = await repl.executeQuery(
          kind === CellKind.PYTHON
            ? getPythonWrapper(text, "serialized")
            : kind === CellKind.SQL
              ? getSQLWrapper(text)
              : text,
        );
        this.replaceOutput(execution, {
          text: result.output || "",
          mime: "text/plain",
        });
        if (result.cancelled) break;
        else success = true;
      } catch (error) {
        this.replaceOutput(execution, { text: `${error}`, mime: "text/plain" });
        break;
      } finally {
        cancellation.dispose();
        execution.end(success, Date.now());
      }
    }
  }

  async execute(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController,
  ): Promise<void> {
    // Same precedence as a q/Python/SQL file: an explicit assignment first,
    // then the active target, then the REPL.
    const runTarget = await resolveRunTarget(notebook.uri);
    if (!runTarget) {
      return;
    }
    if (runTarget.kind === "repl") {
      return this.executeRepl(cells, notebook, controller);
    }

    const conn = runTarget.conn;
    const { isInsights, connVersion } = this.getInsightProps(conn);

    for (const cell of cells) {
      const execution = controller.createNotebookCellExecution(cell);

      execution.executionOrder = ++this.order;
      execution.start(Date.now());

      // Lets images the process writes to stdout during this cell's run be
      // rendered in it, instead of falling back to a .plot file.
      const cellTarget: ext.CellExecutionTarget = {
        execution,
        cell,
        plotted: false,
      };
      ext.activeCellExecutions.set(conn.connLabel, cellTarget);

      let success = false;
      let cancellationDisposable: vscode.Disposable | undefined;

      try {
        const kind = getCellKind(cell);

        if (!cell.document.getText().trim()) {
          this.replaceOutput(execution, { text: "", mime: "text/plain" });
          success = true;
          continue;
        }

        const { target, variable } = this.getCellMetadata(
          cell,
          kind,
          isInsights,
          conn,
        );

        const executor = this.getQueryExecutor(
          conn,
          execution,
          cell,
          kind,
          target,
          variable,
        );

        let results = await Promise.race([
          !isInsights || ((target || kind === CellKind.SQL) && !variable)
            ? executor
            : needsScratchpad(conn.connLabel, executor),
          new Promise((_, reject) => {
            const updateCancelled = () => {
              if (execution.token.isCancellationRequested) {
                reject(new vscode.CancellationError());
              }
            };
            updateCancelled();
            cancellationDisposable =
              execution.token.onCancellationRequested(updateCancelled);
          }),
        ]);

        notifyExecution(
          RunFlag.Notebook |
            (variable ? 0 : RunFlag.Run) |
            (isInsights ? RunFlag.Insights : 0) |
            (target ? RunFlag.Dap : 0) |
            (isQuickAlias(conn.connLabel) ? RunFlag.Quick : 0) |
            (kind === CellKind.PYTHON ? RunFlag.Python : 0) |
            (kind === CellKind.SQL ? RunFlag.Sql : 0),
        );

        if (variable) {
          results = `Scratchpad variable (${variable}) populated.`;
        }

        const rendered =
          target || kind === CellKind.SQL
            ? render(results, kind === CellKind.PYTHON, isInsights)
            : render(
                results,
                kind === CellKind.PYTHON,
                isInsights,
                connVersion,
              );

        this.replaceOutput(execution, rendered, cellTarget);
        success = true;
      } catch (error) {
        notify(`Execution on ${conn.connLabel} stopped.`, MessageKind.DEBUG, {
          logger,
          params: error,
        });
        this.replaceOutput(execution, {
          text: `<p>Execution stopped.</p><p>${error instanceof Error ? error.message : error}</p>`,
          mime: "text/html",
        });
        break;
      } finally {
        // Kept rather than dropped: stdout for this cell often arrives after it
        // has ended, and the entry is what lets that output still find the
        // cell. Marked before end(), since appending through the execution
        // stops working once it has ended.
        if (ext.activeCellExecutions.get(conn.connLabel) === cellTarget) {
          cellTarget.endedAt = Date.now();
        }
        cancellationDisposable?.dispose();
        execution.end(success, Date.now());
      }
    }
  }

  getInsightProps(conn: LocalConnection | InsightsConnection) {
    let isInsights = false;
    let connVersion = "0";

    if (conn instanceof InsightsConnection) {
      isInsights = true;
      connVersion = conn.insightsVersion ?? "0";
    }

    return { isInsights, connVersion };
  }

  getCellMetadata(
    cell: vscode.NotebookCell,
    kind: CellKind,
    isInsights: boolean,
    conn: InsightsConnection | LocalConnection,
  ): { target?: string; variable?: string } {
    const target = cell.metadata?.target;
    const variable = cell.metadata?.variable;

    if (!isInsights) {
      if (target) {
        throw new Error(
          `Setting execution target (${target}) is not supported on ${conn.connLabel}.`,
        );
      }
      if (variable) {
        throw new Error(
          `Setting output variable ${variable} is not supported on ${conn.connLabel}.`,
        );
      }
    }

    return { target, variable };
  }

  getQueryExecutor(
    conn: LocalConnection | InsightsConnection,
    execution: vscode.NotebookCellExecution,
    cell: vscode.NotebookCell,
    kind: CellKind,
    target?: string,
    variable?: string,
  ): Promise<any> {
    const uri = cell.notebook.uri;
    const executorName = getBasename(uri);

    const timeout =
      conn instanceof InsightsConnection
        ? getTimeoutForUri(uri).value
        : undefined;

    if (
      target ||
      (kind === CellKind.SQL && conn instanceof InsightsConnection)
    ) {
      const params = getPartialDatasourceFile(
        cell.document.getText(),
        target,
        kind === CellKind.SQL,
        kind === CellKind.PYTHON,
      );

      return variable
        ? populateScratchpad(
            params,
            conn.connLabel,
            variable,
            true,
            execution.token,
            timeout,
          )
        : runDataSource(
            params,
            conn.connLabel,
            executorName,
            execution.token,
            timeout,
          );
    } else {
      return executeQuery(
        kind === CellKind.SQL
          ? getSQLWrapper(cell.document.getText())
          : cell.document.getText(),
        conn.connLabel,
        executorName,
        ".",
        kind === CellKind.PYTHON,
        false,
        false,
        execution.token,
        timeout,
      );
    }
  }

  replaceOutput(
    execution: vscode.NotebookCellExecution,
    rendered: Rendered,
    target?: ext.CellExecutionTarget,
  ): void {
    const output = new vscode.NotebookCellOutput([
      vscode.NotebookCellOutputItem.text(rendered.text, rendered.mime),
    ]);

    // Images written to stdout were appended while the cell ran, so replacing
    // here would discard them. The flag has to come from this execution's own
    // target: another notebook running on the same connection takes over the
    // map entry, and reading that would apply an unrelated cell's flag.
    if (target?.execution === execution && target.plotted) {
      execution.appendOutput(output);
    } else {
      execution.replaceOutput([output]);
    }
  }
}

interface Rendered {
  text: string;
  mime: string;
}

function render(
  results: any,
  isPython: boolean,
  isInsights: boolean,
  connVersion?: string,
): Rendered {
  let text = "No results.";
  let mime = "text/plain";

  const plot = resultToBase64(results);

  if (plot) {
    text = `<img src="${plot}"/>`;
    mime = "text/html";
  } else {
    if (typeof results === "string" || typeof results === "number") {
      text = formatResult(results);
      mime = "text/html";
    } else if (results) {
      const rows: string[] = [];
      const table = convertToGrid(results, isInsights, connVersion, isPython);
      if (table.columnDefs) {
        rows.push("<table>");

        rows.push("<thead>");
        rows.push("<tr>");
        const fields: string[] = [];
        for (const def of table.columnDefs) {
          rows.push(`<th>${def.headerName}</th>`);
          if ("field" in def) {
            fields.push(def.field || "");
          } else {
            fields.push("");
          }
        }
        rows.push("</tr>");
        rows.push("</thead>");

        rows.push("<tbody>");
        if (table.rowData) {
          for (const row of table.rowData) {
            rows.push("<tr>");
            for (const field of fields) {
              rows.push(`<td>${field ? row[field] : "n/a"}</td>`);
            }
            rows.push("</tr>");
          }
        }
        rows.push("</tbody>");

        rows.push("</table>");
        text = rows.join("\n");
        mime = "text/html";
      }
    }
  }
  return { text, mime };
}
