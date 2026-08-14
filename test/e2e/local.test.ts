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

import {
  CONNECTION,
  CONSOLE,
  dial,
  ensure,
  kdb,
  labelOf,
  plain,
  redial,
  SERVER,
  start,
  startPlain,
} from "./connection";
import { FAILURE, FakeQ } from "./qserver";
import {
  activate,
  caretAt,
  file,
  focus,
  lastLineOf,
  selectionOf,
  terminal,
  terminalText,
  until,
  waitForLanguageServer,
} from "./utils";

// Copies of the main fixtures, under the paths the workspace settings assign
// to TESTLOCAL. They need their own paths because kdb.connectionMap is keyed
// by path: main.q has to stay unassigned so it still runs on the REPL.
const Q_FILE = file("local.q");
const SQL_FILE = file("local.sql");
const PY_FILE = file("local.py");
const QUKE_FILE = file("local.quke");

const Q_WORKBOOK = file("local.kdb.q");
const SQL_WORKBOOK = file("local.kdb.sql");
const PY_WORKBOOK = file("local.kdb.py");
const NOTEBOOK = file("local.kxnb");
const PLAIN_FILE = file("plain.q");
const ERROR_NOTEBOOK = file("error.kxnb");

const ASSIGNED: [vscode.Uri, vscode.Uri][] = [
  [file("main.q"), Q_FILE],
  [file("main.sql"), SQL_FILE],
  [file("main.py"), PY_FILE],
  [file("main.quke"), QUKE_FILE],
  [file("main.q"), Q_WORKBOOK],
  [file("main.sql"), SQL_WORKBOOK],
  [file("main.py"), PY_WORKBOOK],
  [file("main.kxnb"), NOTEBOOK],
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

const NOTEBOOK_Q = '"NOTEBOOK_Q"';
const NOTEBOOK_SQL = "select sym, px from nbtrades where px > 200";
const NOTEBOOK_PY = "NOTEBOOK_PY";

// queryWrapper() picks the namespace function by language once the .vscode
// namespace is in use.
const Q_QUERY = ".vscode.runQQuery";
const PY_QUERY = ".vscode.runPyQuery";

const PLAIN_QUERY = '"PLAIN_KDB"';

// What the stand-in answers a successful query with.
const RESULT = '"OK"';

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

  function qCases(target: () => vscode.Uri) {
    it("runs the whole file", async () => {
      await focus(target());
      const code = await run("kdb.execute.fileQuery");

      assert.ok(code.includes(TWO_STATEMENTS), `two statements:\n${code}`);
      assert.ok(code.includes(JOINED), `joined expression:\n${code}`);
    });

    it("sends the file with its comments intact", async () => {
      await focus(target());
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
      await selectionOf(target(), SELECTABLE);
      const code = await run("kdb.execute.selectedQuery");

      assert.strictEqual(code, SELECTABLE);
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(target(), TWO_STATEMENTS);
      const code = await run("kdb.execute.selectedQuery");

      assert.ok(code.includes(TWO_STATEMENTS), `line:\n${code}`);
      assert.ok(!code.includes(JOINED), `${JOINED} also sent:\n${code}`);
    });

    it("sends the whole multi-line expression for a block", async () => {
      await caretAt(target(), OPENS_JOINED);
      const code = await run("kdb.execute.block");

      assert.ok(code.includes(JOINED), `continuation line:\n${code}`);
      assert.ok(
        !code.includes(TWO_STATEMENTS),
        `${TWO_STATEMENTS} also sent:\n${code}`,
      );
    });

    it("sends nothing when the caret is on the trailing empty line", async () => {
      await lastLineOf(target());
      const code = await run("kdb.execute.selectedQuery");

      assert.strictEqual(code, "", `an empty line was sent:\n${code}`);
    });
  }

  function sqlCases(target: () => vscode.Uri) {
    it("wraps the whole file for sql", async () => {
      await focus(target());
      const code = await run("kdb.execute.fileQuery");

      assert.ok(code.startsWith("s)"), `no sql wrapper:\n${code}`);
      assert.ok(/where px > 200/.test(code), `first query:\n${code}`);
      assert.ok(/where px < 200/.test(code), `second query:\n${code}`);
    });

    it("runs only the selected query", async () => {
      await selectionOf(target(), SQL_FIRST_QUERY);
      const code = await run("kdb.execute.selectedQuery");

      assert.ok(code.startsWith("s)"), `no sql wrapper:\n${code}`);
      assert.ok(code.includes(SQL_FIRST_QUERY), `selected query:\n${code}`);
      assert.ok(
        !code.includes(SQL_SECOND_QUERY),
        `the unselected query also ran:\n${code}`,
      );
    });
  }

  function pythonCases(target: () => vscode.Uri) {
    it("runs the whole file as python", async () => {
      await focus(target());
      const code = await run("kdb.scratchpad.python.run.file");

      assert.ok(code.includes(PY_MARKER), `${PY_MARKER}:\n${code}`);
      assert.ok(code.includes(PY_OTHER), `${PY_OTHER}:\n${code}`);
    });

    it("runs only the selection as python", async () => {
      await selectionOf(target(), PY_SELECTABLE);
      const code = await run("kdb.scratchpad.python.run");

      assert.ok(code.includes(PY_MARKER), `selection:\n${code}`);
      assert.ok(!code.includes(PY_OTHER), `${PY_OTHER} also sent:\n${code}`);
    });
  }

  describe("from a q file", () => {
    qCases(() => Q_FILE);
  });

  describe("from a q workbook", () => {
    qCases(() => Q_WORKBOOK);
  });

  describe("from a sql file", () => {
    sqlCases(() => SQL_FILE);
  });

  describe("from a sql workbook", () => {
    sqlCases(() => SQL_WORKBOOK);
  });

  describe("from a python file", () => {
    pythonCases(() => PY_FILE);
  });

  describe("from a python workbook", () => {
    pythonCases(() => PY_WORKBOOK);
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

  describe("from a notebook", () => {
    it("runs every cell on the connection, each in its own language", async () => {
      const notebook = await vscode.workspace.openNotebookDocument(NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      kdb.clear();
      await vscode.commands.executeCommand("notebook.execute");
      await until(
        () => kdb.queries().length === 3,
        `all three cells to run (ran ${kdb.queries().length})`,
      );

      const [q, sql, python] = kdb.queries();

      assert.strictEqual(q.fn, Q_QUERY);
      assert.ok(q.args?.code?.includes(NOTEBOOK_Q), `q cell:\n${q.args?.code}`);

      // SQL has no namespace function of its own on a kdb+ connection; it is
      // the q one carrying an s) wrapped statement.
      assert.strictEqual(sql.fn, Q_QUERY);
      assert.ok(
        sql.args?.code?.startsWith("s)"),
        `no sql wrapper:\n${sql.args?.code}`,
      );
      assert.ok(
        sql.args?.code?.includes(NOTEBOOK_SQL),
        `sql cell:\n${sql.args?.code}`,
      );

      assert.strictEqual(python.fn, PY_QUERY);
      assert.ok(
        python.args?.code?.includes(NOTEBOOK_PY),
        `python cell:\n${python.args?.code}`,
      );
    });
  });

  describe("on a process without the .vscode namespace", () => {
    before(async function () {
      this.timeout(60_000);
      await startPlain();
    });

    it("sends the evaluate lambda instead of the namespace function", async () => {
      await focus(PLAIN_FILE);

      plain.clear();
      await vscode.commands.executeCommand("kdb.execute.fileQuery");
      await until(() => plain.queries().length > 0, "the query to arrive");

      const [query] = plain.queries();

      // resources/q/evaluateQ.q and formatQ.q, inlined into a lambda, rather
      // than a call into the namespace the process does not have.
      assert.ok(
        query.fn.startsWith("{[args]"),
        `not a lambda:\n${query.fn.slice(0, 120)}`,
      );
      assert.ok(
        query.fn.includes("evaluateQ") && query.fn.includes("formatQ"),
        `lambda is missing the evaluate helpers:\n${query.fn.slice(0, 120)}`,
      );
      assert.ok(
        query.args?.code?.includes(PLAIN_QUERY),
        `file was not sent as an argument:\n${query.args?.code}`,
      );
    });
  });

  describe("when the process reports an error", () => {
    it("shows it in the cell output", async () => {
      const notebook =
        await vscode.workspace.openNotebookDocument(ERROR_NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      kdb.clear();
      await vscode.commands.executeCommand("notebook.execute");
      await until(() => kdb.queries().length > 0, "the failing cell to run");
      await until(
        () => notebook.cellAt(0).outputs.length > 0,
        "the cell to produce output",
      );

      assert.ok(
        kdb.queries()[0].args?.code?.includes(FakeQ.FAILS),
        "the failing cell did not reach the connection",
      );

      const output = notebook
        .cellAt(0)
        .outputs.flatMap((item) =>
          item.items.map((part) => Buffer.from(part.data).toString("utf8")),
        )
        .join("\n");

      assert.ok(output.includes(FAILURE), `the error is not shown:\n${output}`);
    });
  });

  describe("the connection console", () => {
    it("shows what the process sent back", async () => {
      await focus(Q_FILE);
      await run("kdb.execute.fileQuery");

      const shown = await terminalText(CONSOLE);

      assert.ok(shown.includes(RESULT), `the result was not shown:\n${shown}`);
    });
  });

  // Last, because it takes the connection down and puts it back.
  describe("the connection lifecycle", () => {
    after(async () => {
      await redial();
      await until(() => !!terminal(CONSOLE), "the console to reopen");
    });

    it("opens a console for the connection", () => {
      assert.ok(terminal(CONSOLE), "no console was opened");
    });

    it("closes the console when the process goes away", async () => {
      kdb.drop();

      await until(
        () => !terminal(CONSOLE),
        "the console to close after the process dropped the connection",
      );
    });

    it("opens a new console when reconnected", async () => {
      await redial();

      await until(() => !!terminal(CONSOLE), "the console to reopen");
    });

    it("closes the console on disconnect", async () => {
      await vscode.commands.executeCommand(
        "kdb.connections.disconnect",
        CONNECTION,
      );

      await until(() => !terminal(CONSOLE), "the console to close");
    });
  });

  describe("the results destination", () => {
    // Terminal is the default; put it back for whatever runs next.
    after(async () => {
      await vscode.commands.executeCommand("kdb.results.destination.terminal");
    });

    const printed = (text: string) => text.split(RESULT).length - 1;

    it("asks for text and prints to the console for the terminal", async () => {
      await vscode.commands.executeCommand("kdb.results.destination.terminal");
      await focus(Q_FILE);

      const before = printed(await terminalText(CONSOLE));
      kdb.clear();
      await vscode.commands.executeCommand("kdb.execute.fileQuery");

      assert.strictEqual(kdb.queries()[0].args?.returnFormat, "text");
      assert.strictEqual(
        printed(await terminalText(CONSOLE)),
        before + 1,
        "the console did not print the result",
      );
    });

    it("asks for structured text and leaves the console alone for the view", async () => {
      await vscode.commands.executeCommand("kdb.results.destination.view");
      await focus(Q_FILE);

      const before = printed(await terminalText(CONSOLE));
      kdb.clear();
      await vscode.commands.executeCommand("kdb.execute.fileQuery");

      // Structured text is what the results view renders from; the console is
      // left as it was.
      assert.strictEqual(kdb.queries()[0].args?.returnFormat, "structuredText");
      assert.strictEqual(
        printed(await terminalText(CONSOLE)),
        before,
        "the console printed the result as well",
      );
    });
  });

  describe("what a kdb+ connection cannot do", () => {
    it("does not populate a scratchpad", async () => {
      await focus(Q_FILE);

      kdb.clear();
      await vscode.commands.executeCommand("kdb.file.populateScratchpad");

      assert.deepStrictEqual(
        kdb.queries().map((request) => request.args?.code),
        [],
        "the file was sent anyway",
      );
    });
  });

  describe("connecting", () => {
    // Nothing is listening on this one until the second test starts it.
    const LATE = { ...SERVER, serverAlias: "TESTLATE", serverPort: "25100" };
    const late = new FakeQ();

    const AUTH = {
      ...SERVER,
      serverAlias: "TESTAUTH",
      serverPort: "25101",
      auth: true,
      username: "tester",
      password: "secret",
    };
    const authenticated = new FakeQ();

    after(async () => {
      for (const label of [labelOf(LATE), labelOf(AUTH)]) {
        await vscode.commands.executeCommand(
          "kdb.connections.disconnect",
          label,
        );
      }
      await late.close();
      await authenticated.close();
    });

    it("opens no console when nothing is listening", async () => {
      await ensure(LATE);
      await vscode.commands.executeCommand(
        "kdb.connections.connect.via.dialog",
        labelOf(LATE),
      );

      // The attempt is reported and abandoned rather than left hanging.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      assert.strictEqual(
        terminal(`KX ${LATE.serverAlias}`),
        undefined,
        "a console was opened for a connection that never came up",
      );
    });

    it("opens one once that process is up", async () => {
      await late.listen(Number(LATE.serverPort));
      await dial(labelOf(LATE), late);

      // Which also shows the failure above was the process being down, not the
      // connection being unknown.
      await until(
        () => !!terminal(`KX ${LATE.serverAlias}`),
        "the console to open",
      );
    });

    it("introduces itself with the stored credentials", async () => {
      await authenticated.listen(Number(AUTH.serverPort));
      await ensure(AUTH);
      await dial(labelOf(AUTH), authenticated);

      assert.strictEqual(
        authenticated.handshakes[0],
        `${AUTH.username}:${AUTH.password}`,
      );
    });

    it("introduces itself anonymously without credentials", () => {
      assert.strictEqual(kdb.handshakes[0], "anonymous");
    });
  });
});
