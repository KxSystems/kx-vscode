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

import {
  activate,
  file,
  focus,
  mark,
  reveal,
  since,
  terminal,
  until,
} from "./utils";
import { CONSOLE, kdb, start } from "./utils/connection";

// Unassigned, so nothing in kdb.connectionMap decides where it runs.
const ACTIVE_FILE = file("active.q");
const QUERY = '"ACTIVE_TARGET"';

// Assigned to the REPL in kdb.connectionMap, which outranks the active target.
const PINNED_FILE = file("pinned.q");
const PINNED = '"PINNED_REPL"';

// ReplConnection names its terminal after the folder it is based in.
const REPL = "KX REPL";

describe("Routing to the active target", () => {
  before(async () => {
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

  it("keeps a file assigned to the REPL there while a connection is active", async () => {
    await reveal(CONSOLE);
    await focus(PINNED_FILE);

    kdb.clear();
    const from = mark();
    await vscode.commands.executeCommand("kdb.execute.fileQuery");

    assert.ok(
      since(from).includes(PINNED),
      `the REPL did not receive it:\n${since(from)}`,
    );
    assert.deepStrictEqual(
      kdb.queries().map((request) => request.args?.code),
      [],
      "the active connection received it instead",
    );
  });
});
