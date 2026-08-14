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

import { FakeQ } from "./qserver";
import { until } from "./utils";

// The stand-in kdb+ process the connection tests run against.
export const SERVER = {
  serverName: "127.0.0.1",
  serverPort: "25098",
  serverAlias: "TESTLOCAL",
  auth: false,
  tls: false,
  managed: false,
};

export const PORT = Number(SERVER.serverPort);

// How getServerName() labels it, which is what the connect command expects.
export const CONNECTION = `${SERVER.serverAlias} [${SERVER.serverName}:${SERVER.serverPort}]`;

// The console terminal opened for it, named by getConnShortName().
export const CONSOLE = `KX ${SERVER.serverAlias}`;

// One stand-in process and one connection for the whole window: adding and
// removing it per suite trips validateServerAlias, which rejects a name still
// in ext.kdbConnectionAliasList — that list is only rebuilt when the tree
// renders, so a removed connection's alias lingers.
export const kdb = new FakeQ();

let added = false;
let started = false;

function declared() {
  const servers =
    vscode.workspace
      .getConfiguration()
      .get<{ [key: string]: { serverAlias?: string } }>("kdb.servers") ?? {};
  return Object.values(servers).some(
    (server) => server?.serverAlias === SERVER.serverAlias,
  );
}

/**
 * Starts the stand-in process and connects the extension to it.
 *
 * kdb.servers is machine scoped, so it lives in whichever user profile the
 * window happens to run under — and the debug launcher ignores the profile the
 * command line run prepares. Rather than depend on one being ready, the
 * connection is added the way the UI adds it and removed again afterwards.
 */
export async function start() {
  if (started) {
    return;
  }
  started = true;

  await kdb.listen(PORT);

  if (!declared()) {
    await vscode.commands.executeCommand("kdb.connections.add.kdb", SERVER, []);
    added = true;
    await until(declared, `${SERVER.serverAlias} to be added`);
  }

  // The connection list is built when the KX view renders its tree, and
  // connecting by label looks the connection up there, so the command can
  // arrive before it is present.
  await vscode.commands.executeCommand("kdb-servers.focus");

  for (let attempt = 0; attempt < 20 && kdb.connections === 0; attempt++) {
    await vscode.commands.executeCommand(
      "kdb.connections.connect.via.dialog",
      CONNECTION,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // Connecting runs the manifest handshake, which is how the extension decides
  // to call the .vscode namespace.
  await until(
    () => kdb.requests.some((request) => request.fn === ".vscode.getManifest"),
    `the connection handshake (sockets: ${kdb.connections})`,
  );
}

// Torn down once, after every suite in the window has run.
after(async () => {
  if (!started) {
    return;
  }
  started = false;

  await vscode.commands.executeCommand(
    "kdb.connections.disconnect",
    CONNECTION,
  );

  if (added) {
    const configuration = vscode.workspace.getConfiguration();
    const servers = {
      ...(configuration.get<{ [key: string]: { serverAlias?: string } }>(
        "kdb.servers",
      ) ?? {}),
    };
    for (const [key, server] of Object.entries(servers)) {
      if (server?.serverAlias === SERVER.serverAlias) {
        delete servers[key];
      }
    }
    await configuration.update(
      "kdb.servers",
      servers,
      vscode.ConfigurationTarget.Global,
    );
    added = false;
  }

  await kdb.close();
});
