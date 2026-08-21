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

import * as http from "node:http";
import * as https from "node:https";
import * as vscode from "vscode";

import { until } from "./index";
import { FakeInsights, Request } from "./insightsServer";

// What the extension is told about an Insights instance, i.e. the arguments
// kdb.connections.add.insights takes.
export interface Instance {
  alias: string;
  server: string;
  realm: string;
  insecure: boolean;
}

export const PORT = 25200;

export const instanceAt = (port: number, alias: string): Instance => ({
  alias,
  server: `https://localhost:${port}/`,
  realm: "insights",
  // Every stand-in presents a self-signed certificate, so this is the flag
  // under test as much as it is a setting.
  insecure: true,
});

// The stand-in the bulk of the suite runs against. Insights labels are the
// alias alone — unlike kdb+ ones they carry no [host:port] suffix — so this
// doubles as the connection label and, prefixed, as its console name.
export const INSIGHTS = instanceAt(PORT, "TESTINSIGHTS");
export const CONNECTION = INSIGHTS.alias;
export const CONSOLE = `KX ${INSIGHTS.alias}`;

// One instance and one connection for the whole window, for the same reason
// the kdb+ stand-in has one: an alias removed from the settings lingers in
// ext.kdbConnectionAliasList until the tree renders again, and validateServerAlias
// rejects it in the meantime.
export const insights = new FakeInsights();

/**
 * Everything connecting asked for, kept as it happens. Whichever suite runs
 * first is the one that connects, and every suite after it clears the
 * recording as it goes, so the handshake has to be held on to here rather than
 * read back later.
 */
export const handshake: Request[] = [];

const added: string[] = [];
let started = false;

function fetch(target: string) {
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const request = (target.startsWith("https:") ? https : http).get(
      target,
      { rejectUnauthorized: false },
      resolve,
    );
    request.on("error", reject);
  });
}

let browsing = false;

/**
 * Stands in for the browser the OAuth code flow opens.
 *
 * signIn() starts a local server, hands the authorization URL to the desktop
 * and waits for the instance to redirect a browser back to it with a code. In
 * a test window there is no one to open that URL, so this walks it the way a
 * browser would: fetch the authorization URL, follow the redirect the instance
 * answers with back to the extension's own server. Nothing in the extension is
 * replaced — the code flow, the token request and the certificate handling all
 * run for real.
 */
export function browser() {
  if (browsing) {
    return;
  }
  browsing = true;

  Object.defineProperty(vscode.env, "openExternal", {
    configurable: true,
    writable: true,
    value: async (uri: vscode.Uri) => {
      const authorized = await fetch(uri.toString(true));
      const redirect = authorized.headers.location;
      authorized.resume();
      if (!redirect) {
        return false;
      }
      (await fetch(redirect)).resume();
      return true;
    },
  });
}

function declared(alias: string) {
  const instances =
    vscode.workspace.getConfiguration().get<{
      [key: string]: { alias?: string };
    }>("kdb.insightsEnterpriseConnections") ?? {};
  return Object.values(instances).some((instance) => instance?.alias === alias);
}

// Declares an instance the way the UI does, and remembers to take it out again
// when the window is done.
export async function ensure(instance: Instance) {
  browser();

  if (declared(instance.alias)) {
    return;
  }
  await vscode.commands.executeCommand(
    "kdb.connections.add.insights",
    instance,
    [],
  );
  added.push(instance.alias);
  await until(() => declared(instance.alias), `${instance.alias} to be added`);

  // Connecting by label looks the connection up in the list the tree builds
  // when it renders, so make sure it has been rebuilt with the new entry.
  await vscode.commands.executeCommand("kdb-servers.focus");
}

// The command can still arrive before the tree has caught up, so keep asking.
export async function dial(alias: string, target: FakeInsights) {
  for (
    let attempt = 0;
    attempt < 20 && target.requests.length === 0;
    attempt++
  ) {
    await vscode.commands.executeCommand(
      "kdb.connections.connect.via.dialog",
      alias,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // The connection is only usable once the endpoints have been resolved, which
  // needs the configuration and the version; meta is the last of the three
  // requests connect() makes.
  await until(
    () => target.calls("/meta").length > 0,
    `the ${alias} handshake (requests: ${target.requests.length})`,
  );
}

export async function start() {
  if (started) {
    return;
  }
  started = true;

  await insights.listen(PORT);
  await ensure(INSIGHTS);
  await dial(CONNECTION, insights);

  handshake.push(...insights.requests);
}

// Torn down once, after every suite in the window has run.
after(async () => {
  if (started) {
    await vscode.commands.executeCommand(
      "kdb.connections.disconnect",
      CONNECTION,
    );
    await insights.close();
    started = false;
  }

  if (added.length) {
    const configuration = vscode.workspace.getConfiguration();
    const instances = {
      ...(configuration.get<{ [key: string]: { alias?: string } }>(
        "kdb.insightsEnterpriseConnections",
      ) ?? {}),
    };
    for (const [key, instance] of Object.entries(instances)) {
      if (instance?.alias && added.includes(instance.alias)) {
        delete instances[key];
      }
    }
    await configuration.update(
      "kdb.insightsEnterpriseConnections",
      instances,
      vscode.ConfigurationTarget.Global,
    );
    added.length = 0;
  }
});
