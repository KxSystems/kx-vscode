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
  discardNotebook,
  executeNotebook,
  file,
  focus,
  mark,
  reveal,
  since,
  terminal,
  until,
} from "./utils";
import { CONSOLE, kdb, start } from "./utils/connection";
import { picks, types, uninstall } from "./utils/dialog";
import { structuredText } from "./utils/fixtures";
import { insights, start as startInsights } from "./utils/insights";
import { Request } from "./utils/qserver";

/**
 * How many table rows a KX notebook cell shows, and from which end, chosen
 * from the notebook toolbar. A cell on a connection asks the process for only
 * those rows, and the extension cuts whatever comes back to them as well.
 * Nothing but a notebook is affected.
 */

// Assigned in the workspace settings: one notebook to each kind of target.
const NOTEBOOK = file("rowLimit.kxnb");
const INSIGHTS_NOTEBOOK = file("rowLimit.insights.kxnb");
const REPL_NOTEBOOK = file("rowLimit.repl.kxnb");

const Q_CELL = "([] n:til 100)";

// Written rather than committed, assigned in the workspace settings too.
const Q_WORKBOOK = file("rowLimit.kdb.q");
const PY_WORKBOOK = file("rowLimit.kdb.py");

const LIMIT = "notebookRowLimit";
const FROM = "notebookRowLimitFrom";

const rows = (count: number) =>
  Array.from({ length: count }, (_row, n) => ({ n: `row${n}` }));

const HUNDRED = rows(100);

// The rows formatQ.q picks for a limit, with the count of the whole result.
function honoured(
  all: Record<string, unknown>[],
  limit?: { size: number; from: string },
) {
  if (!limit || limit.size >= all.length) {
    return structuredText(all);
  }
  return structuredText(
    limit.from === "last" ? all.slice(-limit.size) : all.slice(0, limit.size),
    all.length,
  );
}

const honouring = (args: Request["args"]) => honoured(HUNDRED, args?.rowLimit);

const config = () => vscode.workspace.getConfiguration("kdb");

async function reset() {
  for (const key of [LIMIT, FROM]) {
    await config().update(key, undefined, vscode.ConfigurationTarget.Global);
  }
}

async function set(limit: number, from: string) {
  await config().update(LIMIT, limit, vscode.ConfigurationTarget.Global);
  await config().update(FROM, from, vscode.ConfigurationTarget.Global);
}

// Through the toolbar button showing the current value, the way a user does.
async function chooseFrom(label: string) {
  picks("Notebook Rows", label);
  await vscode.commands.executeCommand(
    `kdb.notebook.rowLimitFrom.${config().get(FROM)}`,
  );
}

async function chooseLimit(label: string, typed?: string) {
  picks("Notebook Row Limit", label);
  if (typed !== undefined) {
    types("Notebook Row Limit", typed);
  }
  await vscode.commands.executeCommand(
    `kdb.notebook.rowLimit.${config().get(LIMIT)}`,
  );
}

// The index column and the row each line of a cell's table shows.
function numbered(html: string) {
  const body = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)]
      .slice(0, 2)
      .map((cell) => cell[1]),
  );
}

const expected = (from: number, to: number) =>
  Array.from({ length: to - from }, (_row, n) => [
    `${from + n}`,
    `row${from + n}`,
  ]);

const footer = (html: string) => /<p>Showing [^<]*<\/p>/.exec(html)?.[0];

describe("Limiting the rows a notebook shows", () => {
  const opened: vscode.NotebookDocument[] = [];
  let previousTerminal: string | undefined;

  async function run(uri: vscode.Uri) {
    const notebook = await vscode.workspace.openNotebookDocument(uri);
    opened.push(notebook);
    kdb.clear();
    insights.clear();
    return executeNotebook(notebook);
  }

  // Both cells, q and python, of the kdb+ notebook show `range` of the 100
  // rows, having asked for `limit`.
  async function shows(
    limit: { size: number; from: string },
    range: [number, number],
    text?: string,
  ) {
    const shown = await run(NOTEBOOK);
    assert.deepStrictEqual(
      kdb.queries().map((request) => request.args?.rowLimit),
      [limit, limit],
    );
    for (const output of shown) {
      assert.deepStrictEqual(numbered(output), expected(...range));
      assert.strictEqual(footer(output), text);
    }
  }

  before(async () => {
    await activate();
    await start();
    await startInsights();
    previousTerminal = vscode.window.activeTerminal?.name;
    fs.writeFileSync(Q_WORKBOOK.fsPath, `${Q_CELL}\n`);
    fs.writeFileSync(PY_WORKBOOK.fsPath, 'print("ROWLIMIT_PY")\n');
    await reset();
    kdb.data = honouring;
  });

  after(async () => {
    uninstall();
    await reset();
    kdb.data = "OK";
    insights.structured = undefined;
    for (const notebook of opened) {
      await discardNotebook(notebook);
    }
    fs.rmSync(Q_WORKBOOK.fsPath, { force: true });
    fs.rmSync(PY_WORKBOOK.fsPath, { force: true });
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    // Whichever KX terminal was in front decides where an unassigned file
    // runs, so the suites after this one get back the one they would have had.
    if (previousTerminal && terminal(previousTerminal)) {
      await reveal(previousTerminal);
    }
  });

  describe("on a kdb+ connection", () => {
    // Mocha runs the tests outside this block first, which change the limit.
    before(reset);

    it("shows the first 100 rows by default", async () => {
      await shows({ size: 100, from: "first" }, [0, 100]);
    });

    it("shows the last 10 rows, numbered from the end, once chosen", async () => {
      await chooseFrom("$(arrow-down) Last");
      await chooseLimit("10 Rows");

      await shows(
        { size: 10, from: "last" },
        [90, 100],
        "<p>Showing last 10 of 100 rows.</p>",
      );
    });

    it("shows the first rows once First is chosen back", async () => {
      await chooseFrom("$(arrow-up) First");

      await shows(
        { size: 10, from: "first" },
        [0, 10],
        "<p>Showing first 10 of 100 rows.</p>",
      );
    });

    it("shows a custom limit", async () => {
      await chooseLimit("$(edit) Custom...", "25");

      await shows(
        { size: 25, from: "first" },
        [0, 25],
        "<p>Showing first 25 of 100 rows.</p>",
      );
    });

    it("lays out only the default rows of a large result a process did not cut", async () => {
      await reset();
      kdb.data = structuredText(rows(200_000));
      try {
        for (const output of await run(NOTEBOOK)) {
          assert.deepStrictEqual(numbered(output), expected(0, 100));
          assert.match(footer(output) ?? "", /of 200,?000 rows/);
          // Laid out, 200,000 rows would run to megabytes.
          assert.ok(Buffer.byteLength(output) < 20_000);
        }
      } finally {
        kdb.data = honouring;
      }
    });
  });

  it("limits a new notebook run on the active connection", async () => {
    await set(10, "first");
    await reveal(CONSOLE);
    await vscode.commands.executeCommand("kdb.createNotebook");
    await until(
      () => vscode.window.activeNotebookEditor?.notebook.isUntitled === true,
      "the new notebook to open",
    );
    const notebook = vscode.window.activeNotebookEditor!.notebook;
    opened.push(notebook);
    const edit = new vscode.WorkspaceEdit();
    edit.set(notebook.uri, [
      vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(0, 1), [
        new vscode.NotebookCellData(vscode.NotebookCellKind.Code, Q_CELL, "q"),
      ]),
    ]);
    await vscode.workspace.applyEdit(edit);

    kdb.clear();
    const [shown] = await executeNotebook(notebook);

    assert.deepStrictEqual(kdb.queries()[0]?.args?.rowLimit, {
      size: 10,
      from: "first",
    });
    assert.deepStrictEqual(numbered(shown), expected(0, 10));
  });

  it("asks an Insights scratchpad for the limit as its sample", async () => {
    await set(10, "last");
    insights.structured = (body) =>
      honoured(HUNDRED, { size: body.sampleSize, from: body.sampleFn });

    const shown = await run(INSIGHTS_NOTEBOOK);

    assert.deepStrictEqual(
      insights
        .queries()
        .map(({ body }) => [body.language, body.sampleFn, body.sampleSize]),
      [
        ["q", "last", 10],
        ["python", "last", 10],
      ],
    );
    for (const output of shown) {
      assert.deepStrictEqual(numbered(output), expected(90, 100));
      assert.strictEqual(footer(output), "<p>Showing last 10 of 100 rows.</p>");
    }
  });

  it("sends a REPL notebook's cell as written", async () => {
    await set(10, "last");
    const from = mark();

    const [shown] = await run(REPL_NOTEBOOK);

    const sent = since(from);
    assert.ok(sent.split("\n").includes(Q_CELL), sent);
    assert.ok(!/rowLimit/i.test(sent), sent);
    assert.ok(!shown.includes("<table>"), shown);
  });

  // The terminal and the results view get what they always did.
  for (const [what, uri, command] of [
    ["a q workbook", Q_WORKBOOK, "kdb.execute.fileQuery"],
    ["a python workbook", PY_WORKBOOK, "kdb.scratchpad.python.run.file"],
  ] as const) {
    it(`sends no row limit for ${what}`, async () => {
      await set(10, "last");
      await focus(uri);
      kdb.clear();

      await vscode.commands.executeCommand(command);
      await until(() => kdb.queries().length > 0, `${command} to run`);

      const [request] = kdb.queries();
      assert.ok(request.args && !("rowLimit" in request.args));
    });
  }
});
