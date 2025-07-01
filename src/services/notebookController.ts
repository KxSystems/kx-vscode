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

import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import {
  getQsqlDatasourceFile,
  populateScratchpad,
  runDataSource,
} from "../commands/dataSourceCommand";
import { executeQuery } from "../commands/serverCommand";
import {
  getConnectionForServer,
  getServerForUri,
} from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";
import { ConnectionManagementService } from "./connectionManagerService";
import { getBasename, offerConnectAction } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { resultToBase64 } from "../utils/queryUtils";
import { convertToGrid, formatResult } from "../utils/resultsRenderer";

const logger = "notebookController";

export class KxNotebookController {
  readonly controllerId = "kx-notebook-1";
  readonly notebookType = "kx-notebook";
  readonly label = "KX Notebook";
  readonly supportedLanguages = ["q", "python"];

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

  async execute(
    cells: vscode.NotebookCell[],
    notebook: vscode.NotebookDocument,
    _controller: vscode.NotebookController,
  ): Promise<void> {
    const manager = new ConnectionManagementService();
    const server = getServerForUri(notebook.uri);

    let conn: LocalConnection | InsightsConnection | undefined;
    if (server) {
      const node = await getConnectionForServer(server);
      if (node) {
        conn = manager.retrieveConnectedConnection(node.label);
      }
    } else {
      conn = ext.activeConnection;
    }

    if (conn === undefined) {
      offerConnectAction(server);
      return;
    }

    let isInsights = false;
    let connVersion = 0;
    if (conn instanceof InsightsConnection) {
      isInsights = true;
      connVersion = conn.insightsVersion ?? 0;
    }

    for (const cell of cells) {
      const isPython = cell.document.languageId === "python";
      const execution = this.controller.createNotebookCellExecution(cell);

      execution.executionOrder = ++this.order;
      execution.start(Date.now());

      const executorName = getBasename(notebook.uri);
      let executor = Promise.reject<any>();

      const target = cell.metadata?.target;
      if (target) {
        const params = getQsqlDatasourceFile(cell.document.getText(), target);
        const variable = cell.metadata?.variable;
        executor = variable
          ? populateScratchpad(params, conn.connLabel, variable)
          : runDataSource(params, conn.connLabel, executorName);
      } else {
        executor = executeQuery(
          cell.document.getText(),
          conn.connLabel,
          executorName,
          ".",
          isPython,
          false,
          false,
          execution.token,
        );
      }

      try {
        const results = await Promise.race([
          executor,
          new Promise((_, reject) => {
            const updateCancelled = () => {
              if (execution.token.isCancellationRequested) {
                reject(new vscode.CancellationError());
              }
            };
            updateCancelled();
            execution.token.onCancellationRequested(updateCancelled);
          }),
        ]);

        const rendered = target
          ? // TODO When connVersion is passed for datasource queries it fails.
            render(results, isPython, isInsights)
          : render(results, isPython, isInsights, connVersion);

        execution.replaceOutput([
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.text(rendered.text, rendered.mime),
          ]),
        ]);
      } catch (error) {
        if (error instanceof vscode.CancellationError) {
          notify(
            `Executing ${executorName} on ${conn.connLabel} cancelled.`,
            MessageKind.DEBUG,
            {
              logger,
              params: error,
            },
          );
        } else {
          notify(
            `Executing ${executorName} on ${conn.connLabel} failed.`,
            MessageKind.ERROR,
            {
              logger,
              params: error,
            },
          );
        }
        break;
      } finally {
        execution.end(true, Date.now());
      }
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
