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

import { until } from "./index";
import { FakeQ } from "./qserver";

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

// A second process on its own port that never answers the manifest handshake,
// i.e. a plain kdb+ without the .vscode namespace loaded.
export const plain = new FakeQ();
plain.manifest = false;

export const PLAIN_SERVER = {
  serverName: "127.0.0.1",
  serverPort: "25099",
  serverAlias: "TESTPLAIN",
  auth: false,
  tls: false,
  managed: false,
};

export const PLAIN_CONNECTION = `${PLAIN_SERVER.serverAlias} [${PLAIN_SERVER.serverName}:${PLAIN_SERVER.serverPort}]`;

const added: string[] = [];
let started = false;
let startedPlain = false;

function declared(alias: string) {
  const servers =
    vscode.workspace
      .getConfiguration()
      .get<{ [key: string]: { serverAlias?: string } }>("kdb.servers") ?? {};
  return Object.values(servers).some((server) => server?.serverAlias === alias);
}

// How getServerName() labels a connection, which is what the connect and
// disconnect commands expect.
export const labelOf = (server: typeof SERVER) =>
  `${server.serverAlias} [${server.serverName}:${server.serverPort}]`;

// Declares a connection the way the UI does, and remembers to take it out
// again when the window is done.
export async function ensure(server: typeof SERVER) {
  if (declared(server.serverAlias)) {
    return;
  }
  await vscode.commands.executeCommand("kdb.connections.add.kdb", server, []);
  added.push(server.serverAlias);
  await until(
    () => declared(server.serverAlias),
    `${server.serverAlias} to be added`,
  );

  // Connecting by label looks the connection up in the list the tree builds
  // when it renders, so make sure it has been rebuilt with the new entry.
  await vscode.commands.executeCommand("kdb-servers.focus");
}

// The command can still arrive before the tree has caught up, so keep asking.
export async function dial(label: string, target: FakeQ) {
  for (let attempt = 0; attempt < 20 && target.connections === 0; attempt++) {
    await vscode.commands.executeCommand(
      "kdb.connections.connect.via.dialog",
      label,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // The manifest handshake decides whether the .vscode namespace is used, so
  // the connection is only ready once it has been asked for.
  await until(
    () =>
      target.requests.some((request) => request.fn === ".vscode.getManifest"),
    `the ${label} handshake (sockets: ${target.connections})`,
  );
}

/**
 * Starts the stand-in process and connects the extension to it.
 *
 * kdb.servers is machine scoped, so it lives in whichever user profile the
 * window happens to run under, and the window runs under a throwaway one that
 * starts empty. So the connection is added the way the UI adds it, and removed
 * again afterwards for whatever profile is in force.
 */
export async function start() {
  if (started) {
    return;
  }
  started = true;

  await kdb.listen(PORT);
  await ensure(SERVER);
  await dial(CONNECTION, kdb);
}

// The plain kdb+ stand-in, connected only by the suites that need it.
export async function startPlain() {
  if (startedPlain) {
    return;
  }
  startedPlain = true;

  await plain.listen(Number(PLAIN_SERVER.serverPort));
  await ensure(PLAIN_SERVER);
  await dial(PLAIN_CONNECTION, plain);
}

/**
 * Dials again after the connection has gone away, so a suite that exercises
 * the lifecycle can put it back for the ones that follow.
 */
export async function redial() {
  const dialled = kdb.connections;
  await vscode.commands.executeCommand(
    "kdb.connections.connect.via.dialog",
    CONNECTION,
  );
  await until(
    () => kdb.connections > dialled,
    "the connection to be re-established",
  );
}

// Torn down once, after every suite in the window has run.
after(async () => {
  for (const [label, target, active] of [
    [CONNECTION, kdb, started],
    [PLAIN_CONNECTION, plain, startedPlain],
  ] as [string, FakeQ, boolean][]) {
    if (!active) {
      continue;
    }
    await vscode.commands.executeCommand("kdb.connections.disconnect", label);
    await target.close();
  }
  started = false;
  startedPlain = false;

  if (added.length) {
    const configuration = vscode.workspace.getConfiguration();
    const servers = {
      ...(configuration.get<{ [key: string]: { serverAlias?: string } }>(
        "kdb.servers",
      ) ?? {}),
    };
    for (const [key, server] of Object.entries(servers)) {
      if (server?.serverAlias && added.includes(server.serverAlias)) {
        delete servers[key];
      }
    }
    await configuration.update(
      "kdb.servers",
      servers,
      vscode.ConfigurationTarget.Global,
    );
    added.length = 0;
  }
});
