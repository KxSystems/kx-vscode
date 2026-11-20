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
import { z } from "zod";

import { getMcpAccess, isMcpEnabled, McpAccessMode } from "./mcpAccess";
import { LocalConnection } from "../../classes/localConnection";
import { ext } from "../../extensionVariables";
import { isErrorResult, queryConstants } from "../../models/queryResult";
import { MessageKind, notify } from "../../utils/notifications";
import { sanitizeQuery } from "../../utils/queryUtils";
import { InsightsNode } from "../kdbTreeProvider";

const logger = "mcp";

export type McpResolution =
  | { kind: "ok"; connection: LocalConnection; mode: McpAccessMode }
  | { kind: "refused"; message: string };

function refused(message: string): McpResolution {
  return { kind: "refused", message };
}

// Both checks of the core rule, on every call, with an exact label match
// (never ConnectionManagementService's ip:port regex or its fallback to the
// active connection).
export function resolveForMcp(name: string): McpResolution {
  if (!isMcpEnabled()) {
    return refused("MCP access is turned off in the kdb extension settings.");
  }

  const nodes = ext.connectionsList.filter((node) => node.label === name);
  if (nodes.length === 0) {
    return refused(`No connection named '${name}'.`);
  }
  // A label shared by a kdb and an Insights connection is treated as Insights
  if (nodes.some((node) => node instanceof InsightsNode)) {
    return refused("Insights connections aren't supported through MCP yet.");
  }

  const mode = getMcpAccess(name);
  if (!mode) {
    return refused(
      `Connection '${name}' is not allowed for MCP. Ask the user to enable 'Allow MCP access' on it.`,
    );
  }

  const connection = ext.connectedConnectionList.find(
    (conn): conn is LocalConnection =>
      conn instanceof LocalConnection && conn.connLabel === name,
  );
  if (!connection?.connected) {
    return refused(
      `Connection '${name}' is allowed but not connected. Ask the user to connect to it in the kdb explorer.`,
    );
  }

  if (mode === "read" && !connection.supportsReadOnly()) {
    return refused(
      `Connection '${name}' can't enforce read-only access (its vscode.q is too old), so MCP calls are refused. Ask the user to update vscode.q on that process.`,
    );
  }

  return { kind: "ok", connection, mode };
}

// Allowed and connected, which is what list_connections shows
function listUsableConnections() {
  return ext.connectedConnectionList
    .filter(
      (conn): conn is LocalConnection =>
        conn instanceof LocalConnection && conn.connected,
    )
    .map((conn) => ({ conn, mode: getMcpAccess(conn.connLabel) }))
    .filter(
      ({ conn, mode }) =>
        mode !== undefined &&
        // Leave out a label an Insights connection shares
        !ext.connectionsList.some(
          (node) =>
            node instanceof InsightsNode && node.label === conn.connLabel,
        ),
    )
    .map(({ conn, mode }) => ({
      name: conn.connLabel,
      access: mode!,
      canEnforceReadOnly: conn.supportsReadOnly(),
    }));
}

// reval restricts q, not embedded Python, and not what another process does
// with a message sent over a handle. These checks catch the obvious ways in;
// they are a guard against accidents, not a complete filter.
function refusedConstruct(code: string): string | undefined {
  if (/^[ \t]*p\)/m.test(code) || /(^|[^\w.])\.(p|pykx)\./.test(code)) {
    return "Python isn't supported through MCP. Use q.";
  }
  if (/\bhopen\b/.test(code)) {
    return "Opening handles to other processes isn't allowed through MCP. Query this connection only.";
  }
  return undefined;
}

// q errors the agent can act on, keyed by the q signal
function explainError(connection: string, result: string): string {
  const signal = result
    .slice(queryConstants.error.length)
    .trim()
    .replace(/^'/, "")
    .split(/\s/)[0];
  switch (signal) {
    case "noupdate":
      return `Connection '${connection}' is read only for MCP, so this code can't change data. Rewrite it without assignments, or ask the user to make the change.`;
    case "access":
      return "q's working directory or permissions don't allow this. In read-only mode, only files in q's working directory and below can be read.";
    case "sys":
      return "System commands are blocked in read-only mode.";
    case "reval":
      return `Connection '${connection}' can't enforce read-only access (it needs kdb+ 4.0 or later), so MCP calls are refused.`;
    default:
      return "";
  }
}

function text(message: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: message }], isError };
}

function log(message: string) {
  notify(message, MessageKind.DEBUG, { logger });
}

export async function runQ(
  connectionName: string,
  code: string,
): Promise<CallToolResult> {
  const started = Date.now();
  const outcome = (result: CallToolResult, summary: string) => {
    log(
      `run_q on '${connectionName}' ${summary} in ${Date.now() - started}ms: ${code}`,
    );
    return result;
  };

  const construct = refusedConstruct(code);
  if (construct) {
    return outcome(text(construct, true), "refused (Python or hopen)");
  }

  const resolution = resolveForMcp(connectionName);
  if (resolution.kind === "refused") {
    return outcome(text(resolution.message, true), "refused");
  }

  let result: unknown;
  try {
    result = await resolution.connection.executeQuery(
      sanitizeQuery(code),
      ".",
      true,
      false,
      undefined,
      resolution.mode === "read",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return outcome(text(message, true), "failed");
  }

  if (isErrorResult(result)) {
    const hint = explainError(connectionName, result);
    return outcome(
      text(hint ? `${result}\n\n${hint}` : result, true),
      "returned a q error",
    );
  }

  const output =
    typeof result === "string" ? result : JSON.stringify(result ?? "");
  return outcome(text(output), "succeeded");
}

const RUN_Q_DESCRIPTION = `Run q code on a kdb connection the user has allowed and connected, and return the result as console text, or the q error.

Access is read only: the code is evaluated with q's reval, so it can't change data.
- No assignments to globals (t: select ...), inserts, upserts, updates in place or definitions. Use a single expression, or a lambda with local variables, e.g. {t: select from trips where fare > 10; count t}[]
- No system commands (\\l, \\cd, system "...").
- Files can only be read from q's working directory and below, using relative paths.
- Python (p), .p, .pykx) isn't supported; use q.
- Don't open handles to other processes (hopen).
Call list_connections first to find the connection names.`;

export function registerTools(server: McpServer, workspaceName: string): void {
  server.registerTool(
    "list_connections",
    {
      description:
        "List the kdb connections the user has allowed for MCP and connected in this VS Code window, with their access mode, and the workspace name.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const connections = listUsableConnections();
      log(`list_connections returned ${connections.length} connection(s)`);
      return text(
        JSON.stringify({ workspace: workspaceName, connections }, null, 2),
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
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ connection, code }) => runQ(connection, code),
  );
}
