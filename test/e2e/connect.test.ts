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

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as vscode from "vscode";

import { activate, file, focus, settle, until } from "./utils";
import { ensure, labelOf } from "./utils/connection";
import { answer, clear, raised, untilRaised } from "./utils/prompt";
import { FakeQ } from "./utils/qserver";

/**
 * Running a file whose connection is declared but not connected.
 *
 * The file names its connection in kdb.connectionMap, so it neither falls back
 * to the REPL nor to whatever is active: the run stops and asks. Answering is
 * what the notification stand-in is for — the buttons are drawn by the
 * workbench and no API presses one.
 */

// A stand-in of its own, on its own port, so nothing else in the window has
// connected to it: these are about a connection that is declared and idle.
const SERVER = {
  serverName: "127.0.0.1",
  serverPort: "25100",
  serverAlias: "TESTOFFER",
  auth: false,
  tls: false,
  managed: false,
};

const CONNECTION = labelOf(SERVER);
const OFFER = "would you like to connect?";

// Assigned to TESTOFFER in the workspace settings.
const QUERY_FILE = file("offer.q");
const QUERY = '"OFFER_TO_CONNECT"';

const server = new FakeQ();

async function runFile() {
  await focus(QUERY_FILE);
  await vscode.commands.executeCommand("kdb.execute.fileQuery");
}

describe("Running a file whose connection is not connected", () => {
  before(async () => {
    await activate();
    fs.writeFileSync(QUERY_FILE.fsPath, `${QUERY}\n`);

    await server.listen(Number(SERVER.serverPort));
    // Declared the way the UI declares it, and deliberately not dialled.
    await ensure(SERVER);
  });

  beforeEach(() => clear());

  after(async () => {
    fs.rmSync(QUERY_FILE.fsPath, { force: true });
    await vscode.commands.executeCommand(
      "kdb.connections.disconnect",
      CONNECTION,
    );
    await server.close();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("asks rather than running the file somewhere else", async () => {
    answer(OFFER, "Cancel");
    await runFile();

    await untilRaised(OFFER);
    const [asked] = raised(OFFER);
    assert.strictEqual(asked.kind, "warning");
    assert.ok(
      asked.message.includes(SERVER.serverAlias),
      `the connection was not named:\n${asked.message}`,
    );
    assert.deepStrictEqual(asked.buttons, ["Connect", "Cancel"]);
  });

  it("runs nothing when the offer is declined", async () => {
    answer(OFFER, "Cancel");
    await runFile();

    await untilRaised(OFFER);
    await settle();

    assert.strictEqual(server.connections, 0, "it connected anyway");
  });

  it("connects and runs the file when the offer is accepted", async () => {
    answer(OFFER, "Connect");
    await runFile();

    await until(
      () =>
        server.queries().some((request) => request.args?.code?.includes(QUERY)),
      `the query to reach ${CONNECTION} (sent ${server
        .queries()
        .map((request) => request.args?.code)
        .join(", ")})`,
    );
  });

  it("stops asking once it is connected", async () => {
    await runFile();

    await until(
      () => server.queries().length > 1,
      "the file to run a second time",
    );
    assert.deepStrictEqual(raised(OFFER), []);
  });
});
