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

import { kdb, start } from "./connection";
import {
  activate,
  caretAt,
  file,
  focus,
  lastLineOf,
  selectionOf,
  waitForLanguageServer,
} from "./utils";

// Copies of the main fixtures, under the paths the workspace settings assign
// to TESTLOCAL. They need their own paths because kdb.connectionMap is keyed
// by path: main.q has to stay unassigned so it still runs on the REPL.
const Q_FILE = file("local.q");
const SQL_FILE = file("local.sql");
const PY_FILE = file("local.py");
const QUKE_FILE = file("local.quke");

const ASSIGNED: [vscode.Uri, vscode.Uri][] = [
  [file("main.q"), Q_FILE],
  [file("main.sql"), SQL_FILE],
  [file("main.py"), PY_FILE],
  [file("main.quke"), QUKE_FILE],
];

const IN_BLOCK_COMMENT = "BLOCK_COMMENT_MARKER";
const BELOW_EXIT_COMMENT = "EXIT_COMMENT_MARKER";

const TWO_STATEMENTS = "notional:px*qty;notional";
const OPENS_JOINED = '"NOT",';
const SELECTABLE = "px*qty";
const JOINED = '"IONAL"';

const SQL_FIRST_QUERY = "select sym, px from trades where px > 200";
const SQL_SECOND_QUERY = "px < 200";

const PY_SELECTABLE = 'alpha = "ALPHA_PY"';
const PY_MARKER = "ALPHA_PY";
const PY_OTHER = "BRAVO_PY";

const QUKE_SELECTED = '"QUKE_SELECTED"';
const QUKE_LINE = '"QUKE_LINE"';

// The code the connection was asked to run, as a single string, for whatever
// the command executed.
async function run(command: string) {
  kdb.clear();
  await vscode.commands.executeCommand(command);
  return kdb
    .queries()
    .map((request) => request.args?.code ?? "")
    .join("\n");
}

describe("Executing on a kdb+ connection", () => {
  before(async function () {
    this.timeout(60_000);

    await activate();

    for (const [source, assigned] of ASSIGNED) {
      fs.copyFileSync(source.fsPath, assigned.fsPath);
    }

    await start();
    await waitForLanguageServer(Q_FILE);
  });

  after(async () => {
    for (const [, assigned] of ASSIGNED) {
      fs.rmSync(assigned.fsPath, { force: true });
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  describe("from a q file", () => {
    it("runs the whole file", async () => {
      await focus(Q_FILE);
      const code = await run("kdb.execute.fileQuery");

      assert.ok(code.includes(TWO_STATEMENTS), `two statements:\n${code}`);
      assert.ok(code.includes(JOINED), `joined expression:\n${code}`);
    });

    it("sends the file with its comments intact", async () => {
      await focus(Q_FILE);
      const code = await run("kdb.execute.fileQuery");

      // Unlike the REPL, a connection is sent the file as written: the process
      // parses it, so comments and the exit marker travel with it.
      assert.ok(
        code.includes(IN_BLOCK_COMMENT),
        `block comment was stripped:\n${code}`,
      );
      assert.ok(
        code.includes(BELOW_EXIT_COMMENT),
        `text below the exit comment was stripped:\n${code}`,
      );
    });

    it("sends only the selection", async () => {
      await selectionOf(Q_FILE, SELECTABLE);
      const code = await run("kdb.execute.selectedQuery");

      assert.strictEqual(code, SELECTABLE);
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(Q_FILE, TWO_STATEMENTS);
      const code = await run("kdb.execute.selectedQuery");

      assert.ok(code.includes(TWO_STATEMENTS), `line:\n${code}`);
      assert.ok(!code.includes(JOINED), `${JOINED} also sent:\n${code}`);
    });

    it("sends the whole multi-line expression for a block", async () => {
      await caretAt(Q_FILE, OPENS_JOINED);
      const code = await run("kdb.execute.block");

      assert.ok(code.includes(JOINED), `continuation line:\n${code}`);
      assert.ok(
        !code.includes(TWO_STATEMENTS),
        `${TWO_STATEMENTS} also sent:\n${code}`,
      );
    });

    it("sends nothing when the caret is on the trailing empty line", async () => {
      await lastLineOf(Q_FILE);
      const code = await run("kdb.execute.selectedQuery");

      assert.strictEqual(code, "", `an empty line was sent:\n${code}`);
    });
  });

  describe("from a sql file", () => {
    it("wraps the whole file for sql", async () => {
      await focus(SQL_FILE);
      const code = await run("kdb.execute.fileQuery");

      assert.ok(code.startsWith("s)"), `no sql wrapper:\n${code}`);
      assert.ok(/where px > 200/.test(code), `first query:\n${code}`);
      assert.ok(/where px < 200/.test(code), `second query:\n${code}`);
    });

    it("runs only the selected query", async () => {
      await selectionOf(SQL_FILE, SQL_FIRST_QUERY);
      const code = await run("kdb.execute.selectedQuery");

      assert.ok(code.startsWith("s)"), `no sql wrapper:\n${code}`);
      assert.ok(code.includes(SQL_FIRST_QUERY), `selected query:\n${code}`);
      assert.ok(
        !code.includes(SQL_SECOND_QUERY),
        `the unselected query also ran:\n${code}`,
      );
    });
  });

  describe("from a python file", () => {
    it("runs the whole file as python", async () => {
      await focus(PY_FILE);
      const code = await run("kdb.scratchpad.python.run.file");

      assert.ok(code.includes(PY_MARKER), `${PY_MARKER}:\n${code}`);
      assert.ok(code.includes(PY_OTHER), `${PY_OTHER}:\n${code}`);
    });

    it("runs only the selection as python", async () => {
      await selectionOf(PY_FILE, PY_SELECTABLE);
      const code = await run("kdb.scratchpad.python.run");

      assert.ok(code.includes(PY_MARKER), `selection:\n${code}`);
      assert.ok(!code.includes(PY_OTHER), `${PY_OTHER} also sent:\n${code}`);
    });
  });

  describe("from a quke file", () => {
    it("sends only the selection", async () => {
      await selectionOf(QUKE_FILE, QUKE_SELECTED);
      const code = await run("kdb.execute.selectedQuery");

      assert.ok(code.includes(QUKE_SELECTED), `selection:\n${code}`);
      assert.ok(
        !code.includes(QUKE_LINE),
        `the rest of the file also ran:\n${code}`,
      );
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(QUKE_FILE, QUKE_LINE);
      const code = await run("kdb.execute.selectedQuery");

      assert.ok(code.includes(QUKE_LINE), `line:\n${code}`);
      assert.ok(
        !code.includes(QUKE_SELECTED),
        `the rest of the file also ran:\n${code}`,
      );
    });
  });
});
