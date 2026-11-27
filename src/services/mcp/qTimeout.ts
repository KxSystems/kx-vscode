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

import { commands, workspace } from "vscode";

import { LocalConnection } from "../../classes/localConnection";
import { MessageKind, notify } from "../../utils/notifications";

const logger = "mcp";

const DEFAULT_TIMEOUT_SECONDS = 60;

// Transport grace only, not extra q time: the extension waits this much
// longer than the timeout, so that a q \T set to the same value stops the
// query and its 'stop error arrives first.
export const TIMEOUT_GRACE_MS = 2_000;

// How long an agent's MCP client should wait for run_q: past the extension's
// own deadline, so the grace above isn't cut short by the agent giving up
// first (Codex's tool_timeout_sec defaults to 60)
const AGENT_MARGIN_SECONDS = 10;

export function agentToolTimeoutSeconds(): number {
  return queryTimeoutSeconds() + TIMEOUT_GRACE_MS / 1000 + AGENT_MARGIN_SECONDS;
}

// The q execution budget for an agent query: q's \T should match it, and the
// extension waits it plus TIMEOUT_GRACE_MS for the result or error to arrive
export function queryTimeoutSeconds(): number {
  return workspace
    .getConfiguration("kdb")
    .get<number>("mcp.queryTimeoutSeconds", DEFAULT_TIMEOUT_SECONDS);
}

// Each connection is checked once per connect, not on every server start
const checked = new WeakSet<LocalConnection>();

function notifyWithSettings(message: string, kind: MessageKind) {
  const open = "Open Settings";
  void notify(message, kind, { logger }, open).then((picked) => {
    if (picked === open) {
      void commands.executeCommand(
        "workbench.action.openSettings",
        "kdb.mcp.queryTimeoutSeconds",
      );
    }
  });
}

// The process's \T in seconds, or undefined when it can't be read (a
// locked-down process may refuse system calls). Read as a string:
// executeQueryRaw turns a falsy result into "", so a \T of 0 read as a
// number would look unreadable.
async function readProcessTimeout(
  connection: LocalConnection,
): Promise<number | undefined> {
  try {
    const value = await connection.executeQueryRaw('{string system"T"}', [
      null,
    ]);
    const seconds = typeof value === "string" ? Number(value) : NaN;
    return value !== "" && Number.isInteger(seconds) && seconds >= 0
      ? seconds
      : undefined;
  } catch {
    return undefined;
  }
}

// A 'stop is put down to \T only when it came back between this much before
// the limit and TIMEOUT_GRACE_MS after it
const STOP_TOLERANCE_MS = 500;

export type ProcessStop = { timedOut: boolean; message: string };

// Explains a 'stop from q, so the agent isn't left with a bare error. q also
// returns 'stop for an interrupt or from application code, so it's called a
// timeout only when it arrived at about \T. \T is read again rather than
// remembered, since it can change after connecting. Either way q answered, so
// the query is no longer running.
export async function explainProcessStop(
  connection: LocalConnection,
  elapsedMs: number,
): Promise<ProcessStop> {
  const current = await readProcessTimeout(connection);
  const atLimit =
    !!current &&
    elapsedMs >= current * 1000 - STOP_TOLERANCE_MS &&
    elapsedMs <= current * 1000 + TIMEOUT_GRACE_MS;
  if (atLimit) {
    return {
      timedOut: true,
      message: `The q process stopped the query after its ${current}-second execution limit. It is no longer running. Narrow the query, or ask the user to increase both kdb.mcp.queryTimeoutSeconds and the process's \\T, keeping them aligned. Codex users must regenerate their MCP configuration afterward.`,
    };
  }
  const seconds = Math.round(elapsedMs / 100) / 10;
  const limit = current
    ? `, which doesn't match its ${current}-second execution limit, so it was interrupted or stopped, not necessarily by a timeout`
    : "";
  return {
    timedOut: false,
    message: `The q process stopped the query ('stop) after ${seconds} seconds${limit}. It is no longer running.`,
  };
}

async function checkProcessTimeout(connection: LocalConnection): Promise<void> {
  const label = connection.connLabel;
  const limit = queryTimeoutSeconds();
  const current = await readProcessTimeout(connection);

  if (current === undefined) {
    notify(`Couldn't read \\T on '${label}'.`, MessageKind.DEBUG, { logger });
    return;
  }

  if (current === 0) {
    notifyWithSettings(
      `'${label}' has no query timeout. Set the timeout on the process to match the ${limit}-second MCP query timeout.`,
      MessageKind.WARNING,
    );
    return;
  }

  if (current < limit) {
    notify(
      `q stops queries on '${label}' after ${current} seconds (\\T), before the ${limit}-second MCP timeout.`,
      MessageKind.DEBUG,
      { logger },
    );
  } else if (current > limit) {
    notifyWithSettings(
      `'${label}' stops queries after ${current} seconds, but the MCP query timeout is ${limit} seconds, so an agent's query can keep running in q after the agent stops waiting. Set the timeout on the process to ${limit} seconds, or raise the MCP query timeout to ${current}.`,
      MessageKind.INFO,
    );
  }
}

// Checks \T on each connection the first time the MCP server serves it. The
// extension never changes \T: it's process-wide, so that's left to the owner.
export async function checkProcessTimeouts(
  connections: LocalConnection[],
): Promise<void> {
  const unchecked = connections.filter((conn) => !checked.has(conn));
  unchecked.forEach((conn) => {
    checked.add(conn);
    notify(`Checking \\T on '${conn.connLabel}'.`, MessageKind.DEBUG, {
      logger,
    });
  });
  await Promise.all(unchecked.map(checkProcessTimeout));
}
