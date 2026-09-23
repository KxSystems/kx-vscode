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

import { activate, file, focus, until, WORKSPACE } from "./utils";
import { kdb, start } from "./utils/connection";
import { structuredText } from "./utils/fixtures";
import { clear, raised } from "./utils/prompt";

/**
 * Exporting what the results view is showing.
 *
 * The export writes a `results-<timestamp>.csv` into the first workspace
 * folder rather than asking where to put it, so the file it wrote is what
 * these read back. What matters is the quoting: a cell holding a list or a
 * string carries the comma that would otherwise end it early, and a quote that
 * would otherwise end the field.
 */

const QUERY_FILE = file("csv.q");

// A row whose cells are the two the export has to survive: a list, which is
// rendered into the cell comma separated, and a string carrying both a comma
// and a quote of its own.
const ROW = {
  sym: "AAPL",
  tags: "alpha,beta,gamma",
  note: 'say "hi", twice',
};

// Every results file sitting in the workspace, newest last.
const exported = () =>
  fs
    .readdirSync(WORKSPACE)
    .filter((name) => /^results-\d+\.csv$/.test(name))
    .sort();

function discard() {
  for (const name of exported()) {
    fs.rmSync(path.join(WORKSPACE, name), { force: true });
  }
}

describe("Exporting the results as CSV", () => {
  let lines: string[] = [];

  before(async () => {
    await activate();
    await start();

    // What the stand-in answers the query with, in the shape a process answers
    // a results view query in.
    kdb.data = structuredText([ROW]);
    fs.writeFileSync(QUERY_FILE.fsPath, `${ROW.sym}\n`);
    discard();
    clear();

    // The view only renders once it has been resolved, and only holds
    // something to export once a query has been rendered into it.
    await vscode.commands.executeCommand("kdb.results.destination.view");
    await vscode.commands.executeCommand("kdb-results.focus");
    await focus(QUERY_FILE);
    kdb.clear();
    await vscode.commands.executeCommand("kdb.execute.fileQuery");
    await until(() => kdb.queries().length > 0, "the query to run");

    // The results are rendered after the command that filled them resolves, so
    // the export is asked for until there is something to export.
    for (let attempt = 0; attempt < 100; attempt++) {
      clear();
      await vscode.commands.executeCommand("kdb.resultsPanel.export.csv");
      if (exported().length > 0) {
        break;
      }
      assert.deepStrictEqual(
        raised("Open a folder to export results"),
        [],
        "the workspace folder was not found",
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const written = exported();
    assert.strictEqual(
      written.length,
      1,
      `nothing was exported: ${raised("export").map((n) => n.message)}`,
    );
    lines = fs
      .readFileSync(path.join(WORKSPACE, written[0]), "utf8")
      .split("\n");

    // The export opens what it wrote, and does not wait for the editor before
    // it resolves. Letting that finish is what makes the file safe to delete.
    await until(
      () =>
        vscode.window.visibleTextEditors.some((editor) =>
          editor.document.uri.fsPath.endsWith(written[0]),
        ),
      "the exported file to be opened",
    );
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  after(async () => {
    kdb.data = "OK";
    fs.rmSync(QUERY_FILE.fsPath, { force: true });
    discard();
    await vscode.commands.executeCommand("kdb.results.destination.terminal");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("writes a header naming every column the view is showing", () => {
    assert.strictEqual(lines[0], '"index","sym","tags","note"');
  });

  it("quotes a cell holding a list, so its commas do not end the field", () => {
    assert.ok(
      lines[1].includes(`"${ROW.tags}"`),
      `the list was not quoted:\n${lines[1]}`,
    );
  });

  it("doubles the quotes inside a string rather than ending the field", () => {
    assert.ok(
      lines[1].includes('"say ""hi"", twice"'),
      `the string was not escaped:\n${lines[1]}`,
    );
  });

  it("writes one row, numbered, with every cell quoted", () => {
    assert.strictEqual(
      lines[1],
      `"1","${ROW.sym}","${ROW.tags}","say ""hi"", twice"`,
    );
    assert.deepStrictEqual(lines.slice(2), []);
  });

  it("says so rather than writing a file when there is nothing to export", async () => {
    discard();
    await vscode.commands.executeCommand("kdb.resultsPanel.clear");
    clear();

    await vscode.commands.executeCommand("kdb.resultsPanel.export.csv");

    assert.deepStrictEqual(exported(), []);
    assert.strictEqual(raised("No results to export").length, 1);
  });
});
