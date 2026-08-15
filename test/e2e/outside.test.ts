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
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { kdb, SERVER, start } from "./connection";
import { activate, focus, mark, reveal, since, terminal, until } from "./utils";

const REPL = "KX REPL";

// Deliberately not under the folder VS Code was opened on: assignments for
// these cannot go into kdb.connectionMap, which is keyed by workspace relative
// path, so the extension keeps them in memory for the session instead.
const OUTSIDE = fs.mkdtempSync(path.join(os.tmpdir(), "kx-e2e-"));
const OUTSIDE_FILE = vscode.Uri.file(path.join(OUTSIDE, "outside.q"));
const QUERY = '"OUTSIDE_WORKSPACE"';

// The picker's items, in the order pickConnection builds them.
function items() {
  const configuration = vscode.workspace.getConfiguration("kdb");
  const servers = configuration.get<{
    [key: string]: { serverAlias: string };
  }>("servers", {});
  const insights = configuration.get<{ [key: string]: { alias: string } }>(
    "insightsEnterpriseConnections",
    {},
  );

  return [
    "(active)",
    "REPL",
    ...Object.keys(servers).map((key) => servers[key].serverAlias),
    ...Object.keys(insights).map((key) => insights[key].alias),
  ];
}

// Picks a connection for the active file the way a user does: open the picker,
// arrow down to the entry, accept. The index is derived from the same
// configuration the command reads, so it holds in any profile.
async function pick(label: string) {
  const index = items().indexOf(label);
  assert.notStrictEqual(index, -1, `${label} is not offered by the picker`);

  const picking = vscode.commands.executeCommand("kdb.file.pickConnection");
  await new Promise((resolve) => setTimeout(resolve, 300));

  for (let step = 0; step < index; step++) {
    await vscode.commands.executeCommand(
      "workbench.action.quickOpenSelectNext",
    );
  }
  await vscode.commands.executeCommand(
    "workbench.action.acceptSelectedQuickOpenItem",
  );

  return picking;
}

function assigned() {
  const map =
    vscode.workspace
      .getConfiguration("kdb")
      .get<{ [key: string]: string }>("connectionMap") ?? {};
  return Object.keys(map);
}

describe("A file outside the workspace", () => {
  before(async () => {
    await activate();
    await start();

    fs.writeFileSync(
      OUTSIDE_FILE.fsPath,
      `/ Outside the workspace on purpose.\n\n${QUERY}\n`,
    );

    await vscode.commands.executeCommand("kdb.repl.start");
    await until(() => !!terminal(REPL), "the REPL terminal to open");
  });

  after(async () => {
    fs.rmSync(OUTSIDE, { recursive: true, force: true });
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("runs on the active target while it is unassigned", async () => {
    await reveal(REPL);
    await focus(OUTSIDE_FILE);

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
      "the connection received it instead",
    );
  });

  it("can be assigned a connection, kept for the session", async () => {
    await focus(OUTSIDE_FILE);
    await pick(SERVER.serverAlias);

    // Nothing was written to the workspace setting: the assignment only lives
    // in memory, keyed by uri.
    assert.ok(
      !assigned().some((key) => key.includes("outside")),
      `the assignment was written to kdb.connectionMap:\n${assigned().join("\n")}`,
    );
  });

  it("runs on that connection even when the REPL is active", async () => {
    await reveal(REPL);
    await focus(OUTSIDE_FILE);

    kdb.clear();
    const from = mark();
    await vscode.commands.executeCommand("kdb.execute.fileQuery");

    await until(
      () => kdb.queries().length > 0,
      `the connection did not receive it, the REPL got:\n${since(from)}`,
    );
    assert.strictEqual(
      since(from),
      "",
      `the REPL received it as well:\n${since(from)}`,
    );
  });
});
