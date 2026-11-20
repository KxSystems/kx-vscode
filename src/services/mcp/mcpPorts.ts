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

import { existsSync } from "fs";
import { request } from "http";
import { createServer } from "net";
import { Uri, window, workspace } from "vscode";

import { ext } from "../../extensionVariables";

// Ports live in globalState, which every window on the machine shares and
// which never reaches .vscode/settings.json or git
const PORTS_KEY = "kdb.mcp.ports";

export const MCP_HOST = "127.0.0.1";
// Provisional until the default port is decided
export const DEFAULT_MCP_PORT = 7464;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
const SCAN_LIMIT = 100;

type PortClaims = { [workspaceKey: string]: number };

// The workspace a port belongs to: the .code-workspace file, else the first
// folder. Undefined when no folder is open, and the port is then session-only.
export function workspaceKey(): string | undefined {
  const file = workspace.workspaceFile;
  if (file && file.scheme !== "untitled") {
    return file.toString();
  }
  return workspace.workspaceFolders?.[0]?.uri.toString();
}

// Claims for local folders that no longer exist are dropped
function isStale(key: string): boolean {
  try {
    const uri = Uri.parse(key);
    return uri.scheme === "file" && !existsSync(uri.fsPath);
  } catch {
    return true;
  }
}

export function getPortClaims(): PortClaims {
  const claims = {
    ...(ext.context?.globalState?.get<PortClaims>(PORTS_KEY) ?? {}),
  };
  for (const key of Object.keys(claims)) {
    if (isStale(key)) {
      delete claims[key];
    }
  }
  return claims;
}

export async function savePortClaim(key: string, port: number): Promise<void> {
  const claims = getPortClaims();
  if (claims[key] === port) {
    return;
  }
  claims[key] = port;
  await ext.context.globalState.update(PORTS_KEY, claims);
}

export async function forgetPortClaim(key: string): Promise<void> {
  const claims = getPortClaims();
  delete claims[key];
  await ext.context.globalState.update(PORTS_KEY, claims);
}

// Ports other workspaces have claimed, open or not
function portsClaimedByOthers(key: string | undefined): Set<number> {
  return new Set(
    Object.entries(getPortClaims())
      .filter(([claimKey]) => claimKey !== key)
      .map(([, port]) => port),
  );
}

// kdb.mcp.port set in .vscode/settings.json or a .code-workspace file
export function workspacePortSetting(): number | undefined {
  const inspected = workspace
    .getConfiguration("kdb")
    .inspect<number>("mcp.port");
  return inspected?.workspaceFolderValue ?? inspected?.workspaceValue;
}

function defaultPort(): number {
  return workspace
    .getConfiguration("kdb")
    .get<number>("mcp.port", DEFAULT_MCP_PORT);
}

export type PortChoice = {
  port: number;
  // A workspace setting is the user's explicit choice, so it's never replaced
  fromWorkspaceSetting: boolean;
};

// The workspace setting, then the saved port, then the default unless another
// workspace has claimed it, then the next free unclaimed port
export async function choosePort(): Promise<PortChoice> {
  const setting = workspacePortSetting();
  if (setting !== undefined) {
    return { port: setting, fromWorkspaceSetting: true };
  }
  const key = workspaceKey();
  const saved = key ? getPortClaims()[key] : undefined;
  if (saved !== undefined) {
    return { port: saved, fromWorkspaceSetting: false };
  }
  const port = defaultPort();
  if (!portsClaimedByOthers(key).has(port)) {
    return { port, fromWorkspaceSetting: false };
  }
  return {
    port: (await nextFreePort(port)) ?? port,
    fromWorkspaceSetting: false,
  };
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, MCP_HOST, () => probe.close(() => resolve(true)));
  });
}

// Scans upwards, skipping claimed ports and ports that fail to bind
export async function nextFreePort(after: number): Promise<number | undefined> {
  const claimed = portsClaimedByOthers(workspaceKey());
  const last = Math.min(after + SCAN_LIMIT, MAX_PORT);
  for (let port = after + 1; port <= last; port++) {
    if (!claimed.has(port) && (await canBind(port))) {
      return port;
    }
  }
  return undefined;
}

// Another window's kdb MCP server answers /health with its workspace, since
// every window shares the token. Anything else is "another program".
export function describePortHolder(
  port: number,
  token: string,
): Promise<string> {
  const other = "another program";
  return new Promise((resolve) => {
    const req = request(
      {
        host: MCP_HOST,
        port,
        path: "/health",
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        timeout: 1000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const health = JSON.parse(body);
            resolve(
              health?.server === "kdb-mcp" &&
                typeof health.workspace === "string"
                ? `the kdb MCP server for workspace '${health.workspace}'`
                : other,
            );
          } catch {
            resolve(other);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(other));
    req.end();
  });
}

function validatePort(value: string): string | undefined {
  const port = Number(value);
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT
    ? undefined
    : `Enter a whole number from ${MIN_PORT} to ${MAX_PORT}.`;
}

// Undefined means Don't start
export async function askForAnotherPort(
  port: number,
  holder: string,
): Promise<number | undefined> {
  const next = await nextFreePort(port);
  const useNext = next !== undefined ? `Use port ${next}` : undefined;
  const choose = "Choose port…";
  const dontStart = "Don't start";
  const items = [useNext, choose, dontStart].filter(
    (item): item is string => item !== undefined,
  );

  const picked = await window.showWarningMessage(
    `Port ${port} is used by ${holder}, so the kdb MCP server for this window can't start there.`,
    ...items,
  );
  if (picked === useNext) {
    return next;
  }
  if (picked === choose) {
    const value = await window.showInputBox({
      title: "kdb MCP server port",
      prompt: `A port from ${MIN_PORT} to ${MAX_PORT} for this workspace's MCP server`,
      value: String(next ?? port + 1),
      validateInput: validatePort,
    });
    return value === undefined ? undefined : Number(value);
  }
  return undefined;
}
