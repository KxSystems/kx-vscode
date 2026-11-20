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

import { ext } from "../../extensionVariables";

// Access lives in globalState rather than kdb.servers, so that editing
// settings.json can't grant it and editKdbConnection can't drop it.
const ACCESS_KEY = "kdb.mcp.access";

export type McpAccessMode = "read";

type AccessMap = { [connectionLabel: string]: McpAccessMode };

export function isMcpEnabled(): boolean {
  return workspace.getConfiguration("kdb").get<boolean>("mcp.enabled", true);
}

function getAccessMap(): AccessMap {
  // ext.context is unset in unit tests that build KdbNodes directly
  return { ...(ext.context?.globalState?.get<AccessMap>(ACCESS_KEY) ?? {}) };
}

export function getMcpAccess(label: string): McpAccessMode | undefined {
  const map = getAccessMap();
  return Object.prototype.hasOwnProperty.call(map, label)
    ? map[label]
    : undefined;
}

export function isMcpAllowed(label: string): boolean {
  return getMcpAccess(label) !== undefined;
}

export function getMcpAllowedLabels(): string[] {
  return Object.keys(getAccessMap());
}

export async function setMcpAccess(
  label: string,
  mode: McpAccessMode | undefined,
): Promise<void> {
  const map = getAccessMap();
  const current = Object.prototype.hasOwnProperty.call(map, label)
    ? map[label]
    : undefined;
  // Deleting or editing a connection calls this for every connection, so
  // skip the write (and the need for ext.context) when nothing changes
  if (current === mode) {
    return;
  }
  if (mode) {
    map[label] = mode;
  } else {
    delete map[label];
  }
  await ext.context.globalState.update(ACCESS_KEY, map);
  updateMcpContext();
}

export async function removeAllMcpAccess(): Promise<void> {
  await ext.context.globalState.update(ACCESS_KEY, {});
  updateMcpContext();
}

// The explorer menus use kdb.mcp.allowed the way they use kdb.connected
export function updateMcpContext(): void {
  commands.executeCommand(
    "setContext",
    "kdb.mcp.allowed",
    getMcpAllowedLabels(),
  );
}
