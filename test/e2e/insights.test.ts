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
  activate,
  caretAt,
  file,
  focus,
  outputs,
  selectionOf,
  terminalText,
  until,
} from "./utils";
import { ASSEMBLY, TIER } from "./utils/fixtures";
import {
  CONSOLE,
  dial,
  ensure,
  insights,
  instanceAt,
  start,
} from "./utils/insights";
import {
  FAILURE,
  FakeInsights,
  PNG,
  Request,
  RESULT,
} from "./utils/insightsServer";

// Copies of the main fixtures under the paths the workspace settings assign to
// the Insights connections. They need their own paths because kdb.connectionMap
// is keyed by path, and main.q is already spoken for by the REPL tests.
const Q_FILE = file("insights.q");
const PY_FILE = file("insights.py");
const SQL_FILE = file("insights.sql");
const QUKE_FILE = file("insights.quke");
const Q_WORKBOOK = file("insights.kdb.q");
const PY_WORKBOOK = file("insights.kdb.py");
const SQL_WORKBOOK = file("insights.kdb.sql");
const NOTEBOOK = file("insights.kxnb");
const IMAGE_NOTEBOOK = file("image.kxnb");
const TARGET_FILE = file("target.q");
const OLD_FILE = file("old.q");
const OLD_SQL_FILE = file("old.sql");
const OLDER_FILE = file("older.q");

const ASSIGNED: [vscode.Uri, vscode.Uri][] = [
  [file("main.q"), Q_FILE],
  [file("main.py"), PY_FILE],
  [file("main.sql"), SQL_FILE],
  [file("main.quke"), QUKE_FILE],
  [file("main.q"), Q_WORKBOOK],
  [file("main.py"), PY_WORKBOOK],
  [file("main.sql"), SQL_WORKBOOK],
  [file("main.kxnb"), NOTEBOOK],
  [file("main.q"), TARGET_FILE],
  [file("main.q"), OLD_FILE],
  [file("main.sql"), OLD_SQL_FILE],
  [file("main.q"), OLDER_FILE],
];

// Written rather than copied: it exists to carry the marker the stand-in fails
// on.
const FAILING_FILE = file("insights.error.q");

const TWO_STATEMENTS = "notional:px*qty;notional";
const SELECTABLE = "px*qty";
const JOINED = '"IONAL"';
const PY_MARKER = "ALPHA_PY";
const SQL_QUERY = "select sym, px from trades where px > 200";

const QUKE_SELECTED = '"QUKE_SELECTED"';
const QUKE_LINE = '"QUKE_LINE"';

const NOTEBOOK_Q = '"NOTEBOOK_Q"';
const NOTEBOOK_SQL = "select sym, px from nbtrades where px > 200";
const NOTEBOOK_PY = "NOTEBOOK_PY";

// The cells of populate.kxnb, each carrying an output variable.
const POPULATE_Q = "POPULATE_Q";
const POPULATE_SQL = "where px > 300";
const POPULATE_PY = "POPULATE_PY";

const SCRATCHPAD = "/scratchpadmanager/scratchpad/display";

// What connect() asked for, kept before any test clears the recording.
let handshake: Request[] = [];

// The first request a command sent, once it has arrived.
async function run(command: string) {
  insights.clear();
  await vscode.commands.executeCommand(command);
  await until(
    () => insights.queries().length > 0,
    `the request ${command} sends`,
  );
  return insights.queries()[0];
}

// The console is painted after the command that fills it has resolved, so what
// it shows has to be waited for rather than read once. Each read round trips
// the clipboard, so this polls slowly.
async function untilConsoleShows(text: string, what: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await terminalText(CONSOLE)).includes(text)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`timed out waiting for ${what}`);
}

describe("Executing on an Insights connection", () => {
  before(async () => {
    await activate();

    for (const [source, assigned] of ASSIGNED) {
      fs.copyFileSync(source.fsPath, assigned.fsPath);
    }
    fs.writeFileSync(FAILING_FILE.fsPath, `${FakeInsights.FAILS}\n`);

    await start();
    handshake = [...insights.requests];
  });

  after(async () => {
    for (const [, assigned] of ASSIGNED) {
      fs.rmSync(assigned.fsPath, { force: true });
    }
    fs.rmSync(FAILING_FILE.fsPath, { force: true });
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  describe("connecting", () => {
    const paths = (suffix: string) =>
      handshake
        .filter((request) => request.path.endsWith(suffix))
        .map((request) => request.path);

    it("signs in over the code flow", () => {
      // Which means the whole exchange happened against an instance presenting
      // a self-signed certificate: the discovery probe that decides where the
      // realm lives, the authorization redirect, and the token request.
      assert.deepStrictEqual(paths("/openid-configuration"), [
        "/realms/insights/.well-known/openid-configuration",
      ]);
      assert.deepStrictEqual(paths("/auth"), [
        "/realms/insights/protocol/openid-connect/auth",
      ]);
      assert.deepStrictEqual(paths("/token"), [
        "/realms/insights/protocol/openid-connect/token",
      ]);
    });

    it("reads the configuration before the meta", () => {
      assert.deepStrictEqual(
        handshake
          .map((request) => request.path)
          .filter((path) => !path.startsWith("/realms/")),
        ["/kxicontroller/config", "/api/config", "/servicegateway/api/v3/meta"],
      );
    });

    it("sends the token with every request", () => {
      for (const request of handshake.filter(
        (candidate) => !candidate.path.startsWith("/realms/"),
      )) {
        assert.match(
          String(request.headers.authorization),
          /^Bearer /,
          `${request.path} carried no token`,
        );
      }
    });

    it("opens the scratchpad log websocket", async () => {
      await until(
        () => insights.upgrades.length > 0,
        "the scratchpad log websocket",
      );

      // A socket at all is the point: ws does not go through getHttpsAgent, so
      // without the connection's insecure flag reaching it the handshake fails
      // against a self-signed certificate and no stdout ever arrives.
      assert.match(String(insights.upgrades[0].authorization), /^Bearer /);
    });

    it("shows what the log websocket sends in the console", async () => {
      await until(
        () => insights.upgrades.length > 0,
        "the scratchpad log websocket",
      );
      const marker = "LOGGED_BY_THE_WEBSOCKET";
      insights.log(`${marker}\n`);

      await untilConsoleShows(marker, "the log line to reach the console");
    });
  });

  // A file and the workbook of the same language take the same route to the
  // instance, so both are run through the same cases.
  function qCases(target: () => vscode.Uri) {
    it("sends the whole file as a scratchpad expression", async () => {
      await focus(target());
      const request = await run("kdb.execute.fileQuery");

      assert.strictEqual(request.path, SCRATCHPAD);
      assert.strictEqual(request.body.language, "q");
      assert.strictEqual(request.body.context, ".");
      assert.ok(
        request.body.expression.includes(TWO_STATEMENTS),
        `two statements:\n${request.body.expression}`,
      );
      assert.ok(
        request.body.expression.includes(JOINED),
        `joined expression:\n${request.body.expression}`,
      );
    });

    it("sends only the selection", async () => {
      await selectionOf(target(), SELECTABLE);
      const request = await run("kdb.execute.selectedQuery");

      assert.strictEqual(request.body.expression, SELECTABLE);
    });

    it("identifies itself as the signed in user", async () => {
      await focus(target());
      const request = await run("kdb.execute.fileQuery");

      // getOptions(needUsername) decodes the token to fill this in, so an
      // instance can attribute the scratchpad to a user.
      assert.strictEqual(request.headers.username, "e2e.user");
    });
  }

  function pythonCases(target: () => vscode.Uri) {
    it("runs the file as python", async () => {
      await focus(target());
      const request = await run("kdb.scratchpad.python.run.file");

      assert.strictEqual(request.path, SCRATCHPAD);
      assert.strictEqual(request.body.language, "python");
      assert.ok(
        request.body.expression.includes(PY_MARKER),
        `python file:\n${request.body.expression}`,
      );
    });
  }

  function sqlCases(target: () => vscode.Uri) {
    it("goes to the service gateway rather than the scratchpad", async () => {
      await focus(target());
      const request = await run("kdb.execute.fileQuery");

      // SQL on Insights is a datasource query, not a scratchpad expression, so
      // it is never wrapped in s) the way a kdb+ connection's is.
      assert.strictEqual(request.path, "/servicegateway/kxi/sql");
      assert.ok(
        request.body.query.includes(SQL_QUERY),
        `sql query:\n${request.body.query}`,
      );
      assert.ok(!request.body.query.startsWith("s)"), "sql was wrapped");
    });
  }

  describe("from a q file", () => {
    qCases(() => Q_FILE);
  });

  describe("from a q workbook", () => {
    qCases(() => Q_WORKBOOK);
  });

  describe("from a python file", () => {
    pythonCases(() => PY_FILE);
  });

  describe("from a python workbook", () => {
    pythonCases(() => PY_WORKBOOK);
  });

  describe("from a sql file", () => {
    sqlCases(() => SQL_FILE);
  });

  describe("from a sql workbook", () => {
    sqlCases(() => SQL_WORKBOOK);
  });

  describe("from a quke file", () => {
    it("sends only the selection as a scratchpad expression", async () => {
      await selectionOf(QUKE_FILE, QUKE_SELECTED);
      const request = await run("kdb.execute.selectedQuery");

      assert.strictEqual(request.path, SCRATCHPAD);
      assert.strictEqual(request.body.language, "q");
      assert.strictEqual(request.body.expression, QUKE_SELECTED);
    });

    it("sends the current line when nothing is selected", async () => {
      await caretAt(QUKE_FILE, QUKE_LINE);
      const request = await run("kdb.execute.selectedQuery");

      assert.ok(
        request.body.expression.includes(QUKE_LINE),
        `line:\n${request.body.expression}`,
      );
      assert.ok(
        !request.body.expression.includes(QUKE_SELECTED),
        `the rest of the file also ran:\n${request.body.expression}`,
      );
    });
  });

  describe("from a notebook", () => {
    it("runs every cell without a variable on the connection", async () => {
      const notebook = await vscode.workspace.openNotebookDocument(NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      insights.clear();
      await vscode.commands.executeCommand("notebook.execute");
      await until(
        () => insights.queries().length === 3,
        `all three cells to run (ran ${insights
          .queries()
          .map((request) => request.path)
          .join(", ")})`,
      );

      const [q, sql, python] = insights.queries();

      assert.strictEqual(q.path, SCRATCHPAD);
      assert.strictEqual(q.body.language, "q");
      assert.ok(
        q.body.expression.includes(NOTEBOOK_Q),
        `q cell:\n${q.body.expression}`,
      );

      // A sql cell has no target of its own and still leaves the scratchpad,
      // the same way a sql file does.
      assert.strictEqual(sql.path, "/servicegateway/kxi/sql");
      assert.ok(
        sql.body.query.includes(NOTEBOOK_SQL),
        `sql cell:\n${sql.body.query}`,
      );

      assert.strictEqual(python.path, SCRATCHPAD);
      assert.strictEqual(python.body.language, "python");
      assert.ok(
        python.body.expression.includes(NOTEBOOK_PY),
        `python cell:\n${python.body.expression}`,
      );

      // Every cell also has to be able to lay out what came back: a cell that
      // cannot stops the run, and the cells after it never reach the instance
      // at all.
      const rendered = outputs(notebook);
      assert.ok(
        !rendered.some((output) => output.includes("Execution stopped")),
        `a cell failed to render:\n${rendered.join("\n---\n")}`,
      );
    });
  });

  describe("showing an image from a notebook", () => {
    let notebook: vscode.NotebookDocument;

    const cell = () => notebook.cellAt(0);

    const shown = () =>
      cell()
        .outputs.flatMap((output) =>
          output.items.map((item) => Buffer.from(item.data).toString("utf8")),
        )
        .join("\n");

    before(async () => {
      notebook = await vscode.workspace.openNotebookDocument(IMAGE_NOTEBOOK);
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });
    });

    async function runCell() {
      const ran = cell().executionSummary?.executionOrder;

      insights.clear();
      await vscode.commands.executeCommand("notebook.execute");
      await until(
        () => cell().executionSummary?.executionOrder !== ran,
        "the cell to finish",
      );
    }

    it("shows the image next to the result", async () => {
      await runCell();
      await until(
        () => cell().outputs.length === 2,
        `the image and the result:\n${shown()}`,
      );

      assert.ok(
        shown().includes(`<img src="data:image/png;base64,${PNG}"/>`),
        `the image:\n${shown()}`,
      );
      assert.ok(shown().includes("<table>"), `the result:\n${shown()}`);
    });

    it("shows one of each when the cell is run again", async () => {
      await runCell();
      await until(
        () => shown().includes("<table>") && shown().includes("<img"),
        `the image and the result:\n${shown()}`,
      );

      assert.strictEqual(cell().outputs.length, 2, `outputs:\n${shown()}`);
      assert.strictEqual(shown().split("<img").length - 1, 1);
    });

    it("shows an image that arrives once the cell has ended", async () => {
      const { requestID } = insights.queries()[0].body;
      insights.image(PNG, requestID);

      await until(
        () => cell().outputs.length === 3,
        `the late image:\n${shown()}`,
      );
    });
  });

  describe("with a target assigned", () => {
    it("runs qsql against the assembly and tier", async () => {
      await focus(TARGET_FILE);
      const request = await run("kdb.execute.fileQuery");

      assert.strictEqual(request.path, "/servicegateway/kxi/qsql");
      assert.ok(
        request.body.query.includes(TWO_STATEMENTS),
        `qsql query:\n${request.body.query}`,
      );
      // 1.13 and later carry the target as a scope rather than as three
      // top level fields.
      assert.deepStrictEqual(request.body.scope, {
        affinity: "soft",
        assembly: ASSEMBLY,
        tier: TIER,
      });
    });
  });

  /**
   * A cell carrying an output variable populates a scratchpad instead of
   * returning results, which is the same query going to the import endpoints
   * rather than to the display one. The notebook is where this can be driven:
   * the file command asks for the variable through an input box, while a cell
   * carries it in its metadata.
   */
  describe("populating a scratchpad from a notebook", () => {
    let cells: Request[] = [];

    before(async () => {
      const notebook = await vscode.workspace.openNotebookDocument(
        file("populate.kxnb"),
      );
      await vscode.window.showNotebookDocument(notebook);
      await vscode.commands.executeCommand("notebook.selectKernel", {
        id: "kx-notebook-1",
        extension: "KX.kdb",
      });

      insights.clear();
      await vscode.commands.executeCommand("notebook.execute");
      await until(
        () => insights.queries().length === 3,
        `all three cells to run (ran ${insights.queries().length})`,
      );
      cells = insights.queries();
    });

    it("imports a targeted q cell as qsql", () => {
      const [q] = cells;

      assert.strictEqual(q.path, "/scratchpadmanager/scratchpad/import/qsql");
      assert.strictEqual(q.body.output, "populatedQ");
      assert.ok(
        q.body.params.query.includes(POPULATE_Q),
        `q cell:\n${q.body.params.query}`,
      );
      assert.deepStrictEqual(q.body.params.scope, {
        affinity: "soft",
        assembly: ASSEMBLY,
        tier: TIER,
      });
    });

    it("imports a sql cell as sql, with no target of its own", () => {
      const [, sql] = cells;

      assert.strictEqual(sql.path, "/scratchpadmanager/scratchpad/import/sql");
      assert.strictEqual(sql.body.output, "populatedSql");
      assert.ok(
        sql.body.params.query.includes(POPULATE_SQL),
        `sql cell:\n${sql.body.params.query}`,
      );
    });

    it("imports a python cell as qsql, wrapped for pykx", () => {
      const [, , python] = cells;

      // Python has no import endpoint of its own: the code travels as a q
      // lambda that hands it to pykx on the other side.
      assert.strictEqual(
        python.path,
        "/scratchpadmanager/scratchpad/import/qsql",
      );
      assert.strictEqual(python.body.output, "populatedPy");
      assert.ok(
        python.body.params.query.includes(POPULATE_PY),
        `python cell:\n${python.body.params.query}`,
      );
      assert.ok(
        python.body.params.query.startsWith("{[returnFormat;code;"),
        `not wrapped:\n${python.body.params.query}`,
      );
    });

    it("populates rather than returning results", () => {
      assert.deepStrictEqual(
        insights
          .calls("/scratchpad/display")
          .filter((call) => call.body.expression),
        [],
        "a cell was run as a scratchpad expression as well",
      );
    });
  });

  describe("the results destination", () => {
    after(async () => {
      await vscode.commands.executeCommand("kdb.results.destination.terminal");
    });

    it("asks for text and prints to the console for the terminal", async () => {
      await vscode.commands.executeCommand("kdb.results.destination.terminal");
      await focus(Q_FILE);
      const request = await run("kdb.execute.fileQuery");

      assert.strictEqual(request.body.returnFormat, "text");

      await untilConsoleShows(
        RESULT,
        "the result to be printed to the console",
      );
    });

    it("asks for structured text for the view", async () => {
      await vscode.commands.executeCommand("kdb.results.destination.view");
      await focus(Q_FILE);
      const request = await run("kdb.execute.fileQuery");

      assert.strictEqual(request.body.returnFormat, "structuredText");
    });
  });

  describe("when the scratchpad reports an error", () => {
    it("shows it in the console", async () => {
      await focus(FAILING_FILE);
      await run("kdb.execute.fileQuery");

      await untilConsoleShows(FAILURE, "the error to be shown in the console");
    });
  });

  /**
   * The endpoints and the request bodies are chosen from the version the
   * instance reports and from whether query environments are enabled, so the
   * same commands are run again against stand-ins that claim to be older.
   */
  describe("against other instance versions", () => {
    const OLD = instanceAt(25201, "TESTOLD");
    const OLDER = instanceAt(25202, "TESTOLDER");

    // 1.13 with query environments enabled: the endpoints gain a qe/ segment
    // and sql has no kxi/ one yet.
    const old = new FakeInsights();
    old.version = "1.13.0";
    old.queryEnvironments = true;

    // Older than 1.11, when the scratchpad was served by the service broker.
    const older = new FakeInsights();
    older.version = "1.10.0";

    // Which endpoint each was asked for the meta on, kept before the queries
    // below clear the recordings.
    let metas: { [alias: string]: string[] } = {};

    before(async () => {
      await old.listen(25201);
      await ensure(OLD);
      await dial(OLD.alias, old);

      await older.listen(25202);
      await ensure(OLDER);
      await dial(OLDER.alias, older);

      metas = {
        [OLD.alias]: old.calls("/meta").map((request) => request.path),
        [OLDER.alias]: older.calls("/meta").map((request) => request.path),
      };
    });

    after(async () => {
      for (const alias of [OLD.alias, OLDER.alias]) {
        await vscode.commands.executeCommand(
          "kdb.connections.disconnect",
          alias,
        );
      }
      await old.close();
      await older.close();
    });

    async function runOn(target: FakeInsights, uri: vscode.Uri) {
      target.clear();
      await focus(uri);
      await vscode.commands.executeCommand("kdb.execute.fileQuery");
      await until(
        () => target.queries().length > 0,
        `a request on ${uri.path}`,
      );
      return target.queries()[0];
    }

    it("prefixes the endpoints with qe when query environments are enabled", () => {
      assert.deepStrictEqual(metas[OLD.alias], [
        "/servicegateway/qe/api/v3/meta",
      ]);
    });

    it("runs sql without the kxi segment before 1.14", async () => {
      const request = await runOn(old, OLD_SQL_FILE);

      assert.strictEqual(request.path, "/servicegateway/qe/sql");
    });

    it("asks the service broker for the scratchpad before 1.11", async () => {
      const request = await runOn(older, OLDER_FILE);

      assert.strictEqual(request.path, "/servicebroker/scratchpad/display");
      // The meta moved under the api/v3 path in 1.11, so an older instance is
      // asked for it where it used to live — which is only reached at all
      // because the endpoints are resolved for versions the api/config
      // endpoint does not exist on.
      assert.deepStrictEqual(metas[OLDER.alias], ["/servicegateway/meta"]);
    });

    it("asks for a table view rather than a return format before 1.12", async () => {
      const request = await runOn(older, OLDER_FILE);

      assert.strictEqual(request.body.returnFormat, undefined);
      assert.strictEqual(request.body.isTableView, false);
    });
  });
});
