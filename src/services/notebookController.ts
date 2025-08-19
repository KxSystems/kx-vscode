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

import { getCellKind } from "./notebookProviders";
import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import { ReplConnection } from "../classes/replConnection";
import { getPartialDatasourceFile } from "../commands/dataSourceCommand";
import {
  executeDataQuery,
  executeQuery,
  prepareToPopulateScratchpad,
  selectFileExecutionMethod,
} from "../commands/executionCommands";
import { findConnection, getServerForUri } from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";
import { ExecutionTypes } from "../models/execution";
import { CellKind } from "../models/notebook";
import { getBasename } from "../utils/core";
import { selectNotebookExecutionType } from "../utils/execution";
import { MessageKind, notify } from "../utils/notifications";
import {
  resultToBase64,
  needsScratchpad,
  getPythonWrapper,
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
      try {
        const kind = getCellKind(cell);
        if (kind === CellKind.SQL) {
          throw new Error("SQL is not supported on REPL.");
        }
        const text = cell.document.getText();
        const result = await repl.executeQuery(
          kind === CellKind.PYTHON ? getPythonWrapper(text) : text,
          execution.token,
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
        execution.end(success, Date.now());
      }
    }
  }

  async execute(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    controller: vscode.NotebookController,
  ): Promise<void> {
    if (getServerForUri(notebook.uri) === ext.REPL) {
      return this.executeRepl(cells, notebook, controller);
    }

    const conn = await findConnection(notebook.uri);
    if (!conn) {
      return;
    }
    const { isInsights, connVersion } = this.getInsightProps(conn);

    for (const cell of cells) {
      const execution = controller.createNotebookCellExecution(cell);

      execution.executionOrder = ++this.order;
      execution.start(Date.now());

      let success = false;
      let cancellationDisposable: vscode.Disposable | undefined;

      try {
        const kind = getCellKind(cell);

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
          (target || kind === CellKind.SQL) && !variable
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

        this.replaceOutput(execution, rendered);
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
        cancellationDisposable?.dispose();
        execution.end(success, Date.now());
      }
    }
  }

  getInsightProps(conn: LocalConnection | InsightsConnection) {
    let isInsights = false;
    let connVersion = 0;

    if (conn instanceof InsightsConnection) {
      isInsights = true;
      connVersion = conn.insightsVersion ?? 0;
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
      if (kind === CellKind.SQL) {
        throw new Error(`SQL is not supported on ${conn.connLabel}`);
      }
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

  async getQueryExecutor(
    conn: LocalConnection | InsightsConnection,
    execution: vscode.NotebookCellExecution,
    cell: vscode.NotebookCell,
    kind: CellKind,
    target?: string,
    variable?: string,
  ): Promise<any> {
    const executorName = getBasename(cell.notebook.uri);
    const executionType: ExecutionTypes = selectNotebookExecutionType(
      variable ? true : false,
      target ? true : false,
      kind,
    );

    if (target || kind === CellKind.SQL) {
      const partialDS = getPartialDatasourceFile(
        cell.document.getText(),
        target,
        kind === CellKind.SQL,
        kind === CellKind.PYTHON,
      );

      if (variable) {
        return await prepareToPopulateScratchpad(
          conn.connLabel,
          executionType,
          target,
          variable,
          partialDS,
        );
      }
      const res = await selectFileExecutionMethod(
        conn.connLabel,
        executionType,
        executorName,
        target,
        partialDS,
      );
      // const res = convertDSDataResponse(dataQueryRes);

      if (res) {
        const success = !res.error;
        if (!success) {
          notify("Query execution failed.", MessageKind.DEBUG, {
            logger,
            params: res.error,
            telemetry: "Notebook." + kind + ".Run.Error",
          });
          return;
        } else {
          return res;
        }
      }
    } else {
      return await executeQuery(
        conn.connLabel,
        executionType,
        cell.document.getText(),
      );
    }
  }

  replaceOutput(
    execution: vscode.NotebookCellExecution,
    rendered: Rendered,
  ): void {
    execution.replaceOutput([
      new vscode.NotebookCellOutput([
        vscode.NotebookCellOutputItem.text(rendered.text, rendered.mime),
      ]),
    ]);
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
  connVersion?: number,
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
