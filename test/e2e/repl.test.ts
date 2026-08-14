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
import * as path from "node:path";
import * as vscode from "vscode";

import {
  activate,
  caretAt,
  file,
  focus,
  lastLineOf,
  mark,
  runOnRepl as run,
  selectionOf,
  since,
  waitForLanguageServer,
  WORKSPACE,
} from "./utils";

const Q_FILE = file("main.q");
const SQL_FILE = file("main.sql");
const PY_FILE = file("main.py");
const QUKE_FILE = file("main.quke");
const NOTEBOOK = file("main.kxnb");

const Q_WORKBOOK = file("main.kdb.q");
const SQL_WORKBOOK = file("main.kdb.sql");
const PY_WORKBOOK = file("main.kdb.py");

const WORKBOOKS: [vscode.Uri, vscode.Uri][] = [
  [Q_FILE, Q_WORKBOOK],
  [SQL_FILE, SQL_WORKBOOK],
  [PY_FILE, PY_WORKBOOK],
];

const IN_BLOCK_COMMENT = "BLOCK_COMMENT_MARKER";
const BELOW_EXIT_COMMENT = "EXIT_COMMENT_MARKER";

const TWO_STATEMENTS = "notional:px*qty;notional";
const OPENS_JOINED = '"NOT",';
const SELECTABLE = "px*qty";
const JOINED = '"IONAL"';
const LAST_STATEMENT = "sym";
const LAST_STATEMENT_COMMENT = "/ prints the symbol";

const SQL_FIRST_QUERY = "select sym, px from trades where px > 200";
const SQL_SECOND_QUERY = "px < 200";

const PY_SELECTABLE = 'alpha = "ALPHA_PY"';
const PY_MARKER = "ALPHA_PY";
const PY_OTHER = "BRAVO_PY";
const PY_BRIDGE = "pystruct_run";

const QUKE_SELECTED = '"QUKE_SELECTED"';
const QUKE_LINE = '"QUKE_LINE"';

const NOTEBOOK_Q = '"NOTEBOOK_Q"';
const NOTEBOOK_SQL = "s)select sym, px from nbtrades where px > 200";

const FOLDER_A_FILE = file(path.join("folderA", "a.q"));
const FOLDER_A_QUERY = '"FOLDER_A"';
const FOLDER_B = path.join(WORKSPACE, "folderB");

describe("Executing on the REPL", () => {
  before(async () => {
    await activate();

    for (const [source, workbook] of WORKBOOKS) {
      fs.copyFileSync(source.fsPath, workbook.fsPath);
    }
    await waitForLanguageServer(Q_FILE);
  });

  after(async () => {
    for (const [, workbook] of WORKBOOKS) {
      fs.rmSync(workbook.fsPath, { force: true });
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  function executionCases(target: () => vscode.Uri) {
    it("runs the whole file", async () => {
      await focus(target());
      const sent = await run("kdb.execute.fileQuery");

      assert.ok(sent.includes(TWO_STATEMENTS), `two statements:\n${sent}`);
      assert.ok(sent.includes(JOINED), `joined expression:\n${sent}`);
    });

    it("evaluates nothing inside a block or exit comment", async () => {
      await focus(target());
      const sent = await run("kdb.execute.fileQuery");

      assert.ok(
        !sent.includes(IN_BLOCK_COMMENT),
        `block comment was sent:\n${sent}`,
      );
      assert.ok(
        !sent.includes(BELOW_EXIT_COMMENT),
        `text below the exit comment was sent:\n${sent}`,
      );
    });

    it("sends only the selection", async () => {
      await selectionOf(target(), SELECTABLE);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(SELECTABLE), `selection:\n${sent}`);
      assert.ok(!sent.includes(JOINED), `${JOINED} also sent:\n${sent}`);
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(target(), TWO_STATEMENTS);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(TWO_STATEMENTS), `line:\n${sent}`);
      assert.ok(!sent.includes(JOINED), `${JOINED} also sent:\n${sent}`);
    });

    it("sends the last statement without its trailing comment", async () => {
      await caretAt(target(), LAST_STATEMENT_COMMENT);
      const sent = await run("kdb.execute.selectedQuery");

      assert.deepStrictEqual(sent.split("\n").filter(Boolean), [
        LAST_STATEMENT,
      ]);
    });

    it("sends nothing when the caret is on the trailing empty line", async () => {
      await lastLineOf(target());
      const sent = await run("kdb.execute.selectedQuery");

      assert.strictEqual(sent, "", `an empty line was sent:\n${sent}`);
    });

    it("sends the whole multi-line expression for a block", async () => {
      await caretAt(target(), OPENS_JOINED);
      const sent = await run("kdb.execute.block");

      assert.ok(sent.includes(JOINED), `continuation line:\n${sent}`);
      assert.ok(
        !sent.includes(TWO_STATEMENTS),
        `${TWO_STATEMENTS} also sent:\n${sent}`,
      );
    });
  }

  function sqlExecutionCases(target: () => vscode.Uri) {
    it("flattens the whole file into a single statement line", async () => {
      await focus(target());
      const lines = (await run("kdb.execute.fileQuery"))
        .split("\n")
        .filter(Boolean);

      assert.strictEqual(lines.length, 1, `not one statement:\n${lines}`);
      assert.ok(lines[0].startsWith("s)"), `no sql wrapper:\n${lines[0]}`);
      assert.ok(/where px > 200/.test(lines[0]), `first query:\n${lines[0]}`);
      assert.ok(
        /where px < 200/.test(lines[0]),
        `the three-line query was not flattened:\n${lines[0]}`,
      );
    });

    it("runs only the selected query", async () => {
      await selectionOf(target(), SQL_FIRST_QUERY);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(SQL_FIRST_QUERY), `selected query:\n${sent}`);
      assert.ok(
        !sent.includes(SQL_SECOND_QUERY),
        `the unselected query also ran:\n${sent}`,
      );
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(target(), SQL_FIRST_QUERY);
      const lines = (await run("kdb.execute.selectedQuery"))
        .split("\n")
        .filter(Boolean);

      assert.strictEqual(lines.length, 1, `not one statement:\n${lines}`);
      assert.ok(lines[0].startsWith("s)"), `no sql wrapper:\n${lines[0]}`);
      assert.ok(lines[0].includes(SQL_FIRST_QUERY), `line:\n${lines[0]}`);
      assert.ok(
        !lines[0].includes(SQL_SECOND_QUERY),
        `the second query also ran:\n${lines[0]}`,
      );
    });

    it("sends nothing when the caret is on the trailing empty line", async () => {
      await lastLineOf(target());
      const sent = await run("kdb.execute.selectedQuery");

      assert.strictEqual(sent, "", `an empty line was sent:\n${sent}`);
    });
  }

  function pythonExecutionCases(target: () => vscode.Uri) {
    it("sends the whole file through the pykx bridge", async () => {
      await focus(target());
      const sent = await run("kdb.scratchpad.python.run.file");

      assert.ok(sent.includes(PY_BRIDGE), `no bridge:\n${sent}`);
      assert.ok(sent.includes(PY_MARKER), `${PY_MARKER}:\n${sent}`);
      assert.ok(sent.includes(PY_OTHER), `${PY_OTHER}:\n${sent}`);
    });

    it("sends a selection through the pykx bridge", async () => {
      await selectionOf(target(), PY_SELECTABLE);
      const sent = await run("kdb.scratchpad.python.run");

      assert.ok(sent.includes(PY_BRIDGE), `no bridge:\n${sent}`);
      assert.ok(sent.includes(PY_MARKER), `selection:\n${sent}`);
      assert.ok(!sent.includes(PY_OTHER), `${PY_OTHER} also sent:\n${sent}`);
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(target(), PY_SELECTABLE);
      const sent = await run("kdb.scratchpad.python.run");

      assert.ok(sent.includes(PY_BRIDGE), `no bridge:\n${sent}`);
      assert.ok(sent.includes(PY_MARKER), `line:\n${sent}`);
      assert.ok(!sent.includes(PY_OTHER), `${PY_OTHER} also sent:\n${sent}`);
    });

    it("sends nothing when the caret is on the trailing empty line", async () => {
      await lastLineOf(target());
      const sent = await run("kdb.scratchpad.python.run");

      assert.strictEqual(sent, "", `an empty line was sent:\n${sent}`);
    });
  }

  describe("from a q file", () => {
    executionCases(() => Q_FILE);
  });

  describe("from a q workbook", () => {
    executionCases(() => Q_WORKBOOK);
  });

  describe("from a sql file", () => {
    sqlExecutionCases(() => SQL_FILE);
  });

  describe("from a sql workbook", () => {
    sqlExecutionCases(() => SQL_WORKBOOK);
  });

  describe("from a python file", () => {
    pythonExecutionCases(() => PY_FILE);
  });

  describe("from a python workbook", () => {
    pythonExecutionCases(() => PY_WORKBOOK);
  });

  describe("from a quke file", () => {
    it("sends only the selection", async () => {
      await selectionOf(QUKE_FILE, QUKE_SELECTED);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(QUKE_SELECTED), `selection:\n${sent}`);
      assert.ok(
        !sent.includes(QUKE_LINE),
        `the rest of the file also ran:\n${sent}`,
      );
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(QUKE_FILE, QUKE_LINE);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(QUKE_LINE), `line:\n${sent}`);
      assert.ok(
        !sent.includes(QUKE_SELECTED),
        `the rest of the file also ran:\n${sent}`,
      );
    });

    it("sends nothing when the caret is on the trailing empty line", async () => {
      await lastLineOf(QUKE_FILE);
      const sent = await run("kdb.execute.selectedQuery");

      assert.strictEqual(sent, "", `an empty line was sent:\n${sent}`);
    });
  });

  describe("from a notebook", () => {
    it("runs every cell on the REPL, each in its own language", async () => {
      const notebook = await vscode.workspace.openNotebookDocument(NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      const sent = await run("notebook.execute");

      const q = sent.indexOf(NOTEBOOK_Q);
      const sql = sent.indexOf(NOTEBOOK_SQL);
      const python = sent.indexOf(PY_BRIDGE);

      assert.notStrictEqual(q, -1, `the q cell did not run:\n${sent}`);
      assert.notStrictEqual(sql, -1, `the sql cell did not run:\n${sent}`);
      assert.notStrictEqual(
        python,
        -1,
        `the python cell did not run:\n${sent}`,
      );
      assert.ok(q < sql && sql < python, `cells ran out of order:\n${sent}`);

      const lines = sent.split("\n").filter(Boolean);
      assert.ok(
        !lines.includes("s)"),
        `the empty sql cell was sent:\n${lines.join("\n")}`,
      );
      assert.strictEqual(
        lines.filter((line) => line.includes(PY_BRIDGE)).length,
        1,
        `the blank python cell was sent:\n${lines.join("\n")}`,
      );
    });
  });

  // Last, because starting a REPL here leaves it as the active one.
  describe("with several REPLs", () => {
    it("runs on the active REPL, whatever folder the file is in", async () => {
      await vscode.commands.executeCommand(
        "kdb.repl.openFolder",
        vscode.Uri.file(FOLDER_B),
      );

      await focus(FOLDER_A_FILE);
      const fromWorkspace = mark();
      const sent = await run("kdb.execute.fileQuery", FOLDER_B);

      assert.ok(
        sent.includes(FOLDER_A_QUERY),
        `the active REPL did not receive the query:\n${sent}`,
      );
      assert.strictEqual(
        since(fromWorkspace),
        "",
        `the workspace REPL received it:\n${since(fromWorkspace)}`,
      );
    });
  });
});
