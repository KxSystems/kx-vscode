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
  outputs,
  reveal,
  runOnRepl as run,
  selectionOf,
  since,
  terminal,
  terminalText,
  until,
  waitForLanguageServer,
  WORKSPACE,
} from "./utils";

const Q_FILE = file("main.q");
const SQL_FILE = file("main.sql");
const PY_FILE = file("main.py");

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
const EXPRESSION_FIRST_LINE = '"NOT",';
const SELECTABLE_TERM = "px*qty";
const EXPRESSION_CONTINUATION = '"IONAL"';
const LAST_STATEMENT = "sym";
const LAST_STATEMENT_COMMENT = "/ prints the symbol";

const SQL_FIRST_QUERY = "select sym, px from trades where px > 200";
const SQL_SECOND_QUERY = "px < 200";

const PY_SELECTABLE = 'alpha = "ALPHA_PY"';
const PY_MARKER = "ALPHA_PY";
const PY_OTHER = "BRAVO_PY";
const PY_BRIDGE = "pystruct_run";

// ReplConnection names its terminal after the folder it is based in.
const REPL = "KX REPL";

const SLEEPS = "SLEEP_2000";

describe("Executing on the REPL", () => {
  before(async () => {
    await activate();

    for (const [source, workbook] of WORKBOOKS) {
      fs.copyFileSync(source.fsPath, workbook.fsPath);
    }
    await waitForLanguageServer(Q_FILE);

    // An unassigned file runs on whichever KX terminal was focused last, so
    // whatever a suite before this one left connected, the REPL has to be the
    // one in front before any of these run.
    await vscode.commands.executeCommand("kdb.repl.start");
    await until(() => !!terminal(REPL), "the REPL terminal to open");
    await reveal(REPL);
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
      assert.ok(
        sent.includes(EXPRESSION_CONTINUATION),
        `joined expression:\n${sent}`,
      );
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
      await selectionOf(target(), SELECTABLE_TERM);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(SELECTABLE_TERM), `selection:\n${sent}`);
      assert.ok(
        !sent.includes(EXPRESSION_CONTINUATION),
        `${EXPRESSION_CONTINUATION} also sent:\n${sent}`,
      );
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(target(), TWO_STATEMENTS);
      const sent = await run("kdb.execute.selectedQuery");

      assert.ok(sent.includes(TWO_STATEMENTS), `line:\n${sent}`);
      assert.ok(
        !sent.includes(EXPRESSION_CONTINUATION),
        `${EXPRESSION_CONTINUATION} also sent:\n${sent}`,
      );
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
      await caretAt(target(), EXPRESSION_FIRST_LINE);
      const sent = await run("kdb.execute.block");

      assert.ok(
        sent.includes(EXPRESSION_CONTINUATION),
        `continuation line:\n${sent}`,
      );
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
    const QUKE_FILE = file("main.quke");
    const QUKE_SELECTED = '"QUKE_SELECTED"';
    const QUKE_LINE = '"QUKE_LINE"';

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
    const NOTEBOOK = file("main.kxnb");
    const NOTEBOOK_Q = '"NOTEBOOK_Q"';
    const NOTEBOOK_SQL = "s)select sym, px from nbtrades where px > 200";

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

    it("shows what each cell produced", async () => {
      const notebook = await vscode.workspace.openNotebookDocument(NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      await vscode.commands.executeCommand("notebook.execute");
      await until(
        () => outputs(notebook)[0].length > 0,
        "the first cell to produce output",
      );

      // The stand-in echoes what it is sent, so a cell shows its own
      // statements back.
      assert.ok(
        outputs(notebook)[0].includes(NOTEBOOK_Q),
        `q cell output:\n${outputs(notebook)[0]}`,
      );
    });
  });

  describe("typing at the REPL prompt", () => {
    const TYPED = '"TYPED_AT_PROMPT"';

    const KEY = {
      UP: "\x1b[A",
      CTRL_C: "\x03",
      CTRL_D: "\x04",
      CTRL_L: "\x0c",
    };

    // Pasted text lands in the input buffer; a lone carriage return is what
    // ReplConnection treats as Enter.
    function type(text: string) {
      const repl = terminal(REPL);
      assert.ok(repl, "no REPL terminal is open");
      repl.sendText(text, false);
    }

    // The terminal is read by copying it out, so polling means re-reading.
    async function untilShows(text: string, shown = true) {
      for (let attempt = 0; attempt < 50; attempt++) {
        if ((await terminalText(REPL)).includes(text) === shown) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.fail(
        `timed out waiting for ${text} to ${shown ? "appear in" : "leave"} the terminal`,
      );
    }

    before(async () => {
      await vscode.commands.executeCommand("kdb.repl.start");
      await until(() => !!terminal(REPL), "the REPL terminal to open");
    });

    it("runs what was typed when Enter is pressed", async () => {
      const from = mark();
      type(TYPED);
      type("\r");

      await until(
        () => since(from).includes(TYPED),
        "the typed statement to reach the process",
      );
    });

    it("shows the result in the terminal", async () => {
      const from = mark();
      type(TYPED);
      type("\r");
      await until(
        () => since(from).includes(TYPED),
        "the typed statement to reach the process",
      );

      const shown = await terminalText(REPL);

      // Once as typed at the prompt, once as the result the process sent back.
      assert.ok(
        shown.split(TYPED).length - 1 >= 2,
        `the result was not shown:\n${shown}`,
      );
    });

    it("runs the previous statement again when recalled", async () => {
      const from = mark();
      type(KEY.UP);
      type("\r");

      await until(
        () => since(from).includes(TYPED),
        "the recalled statement to reach the process",
      );
    });

    it("clears the terminal with Ctrl+L", async () => {
      const before = await terminalText(REPL);
      assert.ok(before.includes(TYPED), `nothing to clear:\n${before}`);

      type(KEY.CTRL_L);

      // Ctrl+L makes the REPL send ANSI.CLEAR: the escape sequence ESC[2J
      // erases the screen and ESC[3J the scrollback, so nothing is left
      // to copy.
      await untilShows(TYPED, false);
    });

    it("switches to k and back with a lone backslash", async () => {
      type("\\");
      type("\r");
      await untilShows("k)");

      type("\\");
      type("\r");
      await untilShows("q)");
    });

    it("restarts the process with Ctrl+D", async () => {
      const from = mark();
      type(KEY.CTRL_D);
      await until(
        () => since(from).includes("SPAWN"),
        `the process to be replaced:\n${since(from)}`,
      );

      // The replacement is driven the same way, so it takes statements too.
      type(TYPED);
      type("\r");
      await until(
        () => since(from).split("SPAWN")[1]?.includes(TYPED),
        `the new process did not run it:\n${since(from)}`,
      );
    });

    it("loads a file dropped onto the terminal", async () => {
      const from = mark();
      type(`${Q_FILE.fsPath}\n`);

      await until(
        () => /system"l .*main\.q"/.test(since(from)),
        `the file was not loaded:\n${since(from)}`,
      );
    });

    it("interrupts a running statement with Ctrl+C", async () => {
      const from = mark();
      type(`"${SLEEPS}"`);
      type("\r");
      await until(
        () => since(from).includes(SLEEPS),
        "the statement to reach the process",
      );

      type(KEY.CTRL_C);
      await until(
        () => since(from).includes("SIGINT"),
        `the interrupt to reach the process:\n${since(from)}`,
      );
    });
  });

  describe("interrupting a notebook", () => {
    const CANCEL_NOTEBOOK = file("cancel.kxnb");
    const AFTER_CANCEL = '"AFTER_CANCEL"';

    it("stops the running cell and the ones after it", async () => {
      const notebook =
        await vscode.workspace.openNotebookDocument(CANCEL_NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      const from = mark();
      // Not awaited: the first cell is still running when it is interrupted.
      const running = vscode.commands.executeCommand("notebook.execute");
      await until(
        () => since(from).includes(SLEEPS),
        "the first cell to reach the REPL",
      );

      await vscode.commands.executeCommand("notebook.cancelExecution");
      await until(
        () => since(from).includes("SIGINT"),
        `the interrupt to reach the process:\n${since(from)}`,
      );
      await running;

      // The cell the interrupt landed on resolves as cancelled, which stops
      // the run before the next one.
      await new Promise((resolve) => setTimeout(resolve, 500));
      assert.ok(
        !since(from).includes(AFTER_CANCEL),
        `the next cell ran anyway:\n${since(from)}`,
      );
    });
  });

  describe("what the REPL cannot do", () => {
    it("does not populate a scratchpad", async () => {
      await focus(Q_FILE);
      const sent = await run("kdb.file.populateScratchpad");

      assert.strictEqual(sent, "", `the file was sent anyway:\n${sent}`);
    });
  });

  // Last, because starting a REPL here leaves it as the active one.
  describe("with several REPLs", () => {
    const FOLDER_A_FILE = file(path.join("folderA", "a.q"));
    const FOLDER_A_QUERY = '"FOLDER_A"';
    const FOLDER_B = path.join(WORKSPACE, "folderB");

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
