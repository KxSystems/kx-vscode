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
import * as vscode from "vscode";

import { CONSOLE, kdb, start } from "./connection";
import { activate, file, focus, mark, since, until } from "./utils";

// Unassigned, so nothing in kdb.connectionMap decides where it runs.
const ACTIVE_FILE = file("active.q");
const QUERY = '"ACTIVE_TARGET"';

// ReplConnection names its terminal after the folder it is based in.
const REPL = "KX REPL";

function terminal(name: string) {
  return vscode.window.terminals.find((found) => found.name.startsWith(name));
}

// Focusing a KX terminal is what makes its target active, so wait for VS Code
// to actually hand it focus before running anything.
async function reveal(name: string) {
  const found = terminal(name);
  assert.ok(found, `no ${name} terminal is open`);
  found.show();
  await until(
    () => vscode.window.activeTerminal?.name.startsWith(name) === true,
    `${name} to be the active terminal`,
  );
  return found;
}

describe("Routing to the active target", () => {
  before(async function () {
    this.timeout(60_000);

    await activate();
    await start();

    // Connecting opens the connection console; the REPL has to be started for
    // its terminal to exist at all.
    await vscode.commands.executeCommand("kdb.repl.start");
    await until(() => !!terminal(REPL), "the REPL terminal to open");
  });

  after(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("runs an unassigned file on the REPL when its terminal is focused", async () => {
    await reveal(REPL);
    await focus(ACTIVE_FILE);

    kdb.clear();
    const from = mark();
    await vscode.commands.executeCommand("kdb.execute.fileQuery");

    assert.ok(
      since(from).includes(QUERY),
      `the REPL did not receive it:\n${since(from)}`,
    );
    assert.deepStrictEqual(
      kdb.queries().map((request) => request.args?.code),
      [],
      "the connection received it as well",
    );
  });

  it("runs an unassigned file on the connection when its console is focused", async () => {
    await reveal(CONSOLE);
    await focus(ACTIVE_FILE);

    kdb.clear();
    const from = mark();
    await vscode.commands.executeCommand("kdb.execute.fileQuery");

    const code = kdb
      .queries()
      .map((request) => request.args?.code ?? "")
      .join("\n");

    assert.ok(
      code.includes(QUERY),
      `the connection did not receive it:\n${code}`,
    );
    assert.strictEqual(
      since(from),
      "",
      `the REPL received it as well:\n${since(from)}`,
    );
  });

  it("follows the target back to the REPL", async () => {
    await reveal(REPL);
    await focus(ACTIVE_FILE);

    kdb.clear();
    const from = mark();
    await vscode.commands.executeCommand("kdb.execute.fileQuery");

    assert.ok(
      since(from).includes(QUERY),
      `the REPL did not receive it:\n${since(from)}`,
    );
    assert.deepStrictEqual(
      kdb.queries().map((request) => request.args?.code),
      [],
      "the connection received it as well",
    );
  });
});
