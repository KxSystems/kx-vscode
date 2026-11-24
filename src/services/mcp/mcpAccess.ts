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
// Set once the first-allow confirmation has been accepted
export const EXPLAINED_KEY = "kdb.mcp.explained";

// A label is in the map when MCP access is allowed for it, stored as true
type AccessMap = { [connectionLabel: string]: true };

export function isMcpEnabled(): boolean {
  return workspace.getConfiguration("kdb").get<boolean>("mcp.enabled", true);
}

function getAccessMap(): AccessMap {
  // ext.context is unset in unit tests that build KdbNodes directly
  const stored =
    ext.context?.globalState?.get<Record<string, unknown>>(ACCESS_KEY) ?? {};
  const map: AccessMap = {};
  for (const [label, value] of Object.entries(stored)) {
    if (value === true) {
      map[label] = true;
    }
  }
  return map;
}

// Entries saved by an earlier read-only build hold a mode string rather than
// true. They are dropped, and the first-allow confirmation is shown again, so
// the access they gave is not carried over as full access.
export async function purgeLegacyMcpAccess(): Promise<void> {
  const stored =
    ext.context?.globalState?.get<Record<string, unknown>>(ACCESS_KEY);
  if (!stored || Object.values(stored).every((value) => value === true)) {
    return;
  }
  await ext.context.globalState.update(ACCESS_KEY, getAccessMap());
  await ext.context.globalState.update(EXPLAINED_KEY, undefined);
  updateMcpContext();
}

export function isMcpAllowed(label: string): boolean {
  return Object.prototype.hasOwnProperty.call(getAccessMap(), label);
}

export function getMcpAllowedLabels(): string[] {
  return Object.keys(getAccessMap());
}

export async function setMcpAccess(
  label: string,
  allowed: boolean,
): Promise<void> {
  const map = getAccessMap();
  // Deleting or editing a connection calls this for every connection, so
  // skip the write (and the need for ext.context) when nothing changes
  if (isMcpAllowed(label) === allowed) {
    return;
  }
  if (allowed) {
    map[label] = true;
  } else {
    delete map[label];
  }
  await ext.context.globalState.update(ACCESS_KEY, map);
  updateMcpContext();
}

// Editing a connection can change its label (alias [host:port]). A rename on
// the same host and port keeps access, since it's the same process. A new
// host or port clears it: that may be a different process the user never
// allowed.
export async function updateMcpAccessOnEdit(
  oldLabel: string,
  newLabel: string,
  sameAddress: boolean,
): Promise<void> {
  if (oldLabel === newLabel) {
    return;
  }
  if (sameAddress && isMcpAllowed(oldLabel)) {
    await setMcpAccess(newLabel, true);
  }
  await setMcpAccess(oldLabel, false);
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
