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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { commands, workspace } from "vscode";
import { z } from "zod";

import { isMcpAllowed, isMcpEnabled } from "./mcpAccess";
import { LocalConnection } from "../../classes/localConnection";
import { ext } from "../../extensionVariables";
import { isErrorResult } from "../../models/queryResult";
import { MessageKind, notify } from "../../utils/notifications";
import { sanitizeQuery } from "../../utils/queryUtils";
import { InsightsNode } from "../kdbTreeProvider";

const logger = "mcp";

// A query still running after this is reported to the agent as timed out. The
// query isn't cancelled: local connections have no cancel.
const QUERY_TIMEOUT_MS = 60_000;

class QueryTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new QueryTimeout(
            `The query did not finish within ${ms / 1000} seconds. It may still be running in q, and this connection can't cancel it. Wait, or check the process before running more queries.`,
          ),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// A running q query can't be cancelled over the connection, and closing the
// connection may not stop it in q. So the user is told and chooses whether to
// disconnect; the agent is not disconnected on its own.
function offerDisconnect(connectionName: string): void {
  const disconnect = "Disconnect";
  void notify(
    `A q query from an agent on '${connectionName}' timed out after ${QUERY_TIMEOUT_MS / 1000} seconds and may still be running in q.`,
    MessageKind.WARNING,
    { logger },
    disconnect,
  ).then((picked) => {
    if (picked === disconnect) {
      void commands.executeCommand(
        "kdb.connections.disconnect",
        connectionName,
      );
    }
  });
}

function maxOutputChars(): number {
  return workspace
    .getConfiguration("kdb")
    .get<number>("mcp.maxOutputChars", 20000);
}

// The output cut to the limit, with a note telling the agent how to narrow it
function capOutput(output: string): string {
  const limit = maxOutputChars();
  if (output.length <= limit) {
    return output;
  }
  return (
    output.slice(0, limit) +
    `\n\n[Output cut short: the first ${limit} of ${output.length} characters are shown. Narrow the query, for example by selecting fewer columns or rows, counting first, or using a smaller sample.]`
  );
}

type McpResolution =
  | { kind: "ok"; connection: LocalConnection }
  | { kind: "refused"; message: string };

function refused(message: string): McpResolution {
  return { kind: "refused", message };
}

// Connected in this window and allowed for MCP
export function isAllowedAndConnected(conn: unknown): conn is LocalConnection {
  return (
    conn instanceof LocalConnection &&
    conn.connected &&
    isMcpAllowed(conn.connLabel)
  );
}

// A label shared with an Insights connection is never served through MCP
function sharesLabelWithInsights(label: string): boolean {
  return ext.connectionsList.some(
    (node) => node instanceof InsightsNode && node.label === label,
  );
}

// Both checks of the core rule, on every call, with an exact label match
// (never ConnectionManagementService's ip:port regex or its fallback to the
// active connection).
function resolveForMcp(connectionName: string): McpResolution {
  if (!isMcpEnabled()) {
    return refused("MCP access is turned off in the kdb extension settings.");
  }

  const nodes = ext.connectionsList.filter(
    (node) => node.label === connectionName,
  );
  if (nodes.length === 0) {
    return refused(`No connection named '${connectionName}'.`);
  }
  // A label shared by a kdb and an Insights connection is treated as Insights
  if (sharesLabelWithInsights(connectionName)) {
    return refused("Insights connections aren't supported through MCP yet.");
  }

  if (!isMcpAllowed(connectionName)) {
    return refused(
      `Connection '${connectionName}' is not allowed for MCP. Ask the user to enable 'Allow MCP access' on it.`,
    );
  }

  const connection = ext.connectedConnectionList.find(
    (conn): conn is LocalConnection =>
      conn instanceof LocalConnection && conn.connLabel === connectionName,
  );
  if (!connection?.connected) {
    return refused(
      `Connection '${connectionName}' is allowed but not connected. Ask the user to connect to it in the kdb explorer.`,
    );
  }

  return { kind: "ok", connection };
}

// Allowed and connected, which is what list_connections shows
function listUsableConnections() {
  return ext.connectedConnectionList
    .filter(isAllowedAndConnected)
    .filter((conn) => !sharesLabelWithInsights(conn.connLabel))
    .map((conn) => ({ name: conn.connLabel }));
}

function text(message: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: message }], isError };
}

function log(message: string) {
  notify(message, MessageKind.DEBUG, { logger });
}

async function runQ(
  connectionName: string,
  code: string,
): Promise<CallToolResult> {
  const started = Date.now();
  // The q text is left out: it can hold credentials typed or generated into it
  const outcome = (result: CallToolResult, summary: string) => {
    log(
      `run_q on '${connectionName}' ${summary} in ${Date.now() - started}ms (${code.length} characters)`,
    );
    return result;
  };

  const resolution = resolveForMcp(connectionName);
  if (resolution.kind === "refused") {
    return outcome(text(resolution.message, true), "refused");
  }

  let result: unknown;
  try {
    result = await withTimeout(
      resolution.connection.executeQuery(sanitizeQuery(code), ".", true, false),
      QUERY_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof QueryTimeout) {
      offerDisconnect(connectionName);
      return outcome(text(error.message, true), "timed out");
    }
    const message = error instanceof Error ? error.message : String(error);
    return outcome(text(message, true), "failed");
  }

  if (isErrorResult(result)) {
    return outcome(text(capOutput(result), true), "returned a q error");
  }

  const output =
    typeof result === "string" ? result : JSON.stringify(result ?? "");
  return outcome(text(capOutput(output)), "succeeded");
}

const RUN_Q_DESCRIPTION = `Run q code on a kdb connection the user has allowed and connected, and return the result as console text, or the q error.

The code runs in that q process, so it can change its data and files.
Output longer than the user's limit is cut short. Call list_connections first to find the connection names.`;

export function registerTools(server: McpServer, workspaceLabel: string): void {
  server.registerTool(
    "list_connections",
    {
      description:
        "List the kdb connections the user has allowed for MCP and connected in this VS Code window, and the workspace name.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const connections = listUsableConnections();
      log(`list_connections returned ${connections.length} connection(s)`);
      return text(
        JSON.stringify({ workspace: workspaceLabel, connections }, null, 2),
      );
    },
  );

  server.registerTool(
    "run_q",
    {
      description: RUN_Q_DESCRIPTION,
      inputSchema: {
        connection: z
          .string()
          .describe("The exact connection name from list_connections"),
        code: z.string().describe("The q code to run"),
      },
      annotations: { openWorldHint: false },
    },
    async ({ connection, code }) => runQ(connection, code),
  );
}
