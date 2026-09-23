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
  caretAt,
  completions,
  file,
  until,
  waitForLanguageServer,
} from "./utils";

/**
 * The q language features, driven the way the editor drives them. The language
 * server runs as its own process and nothing here is stubbed, so what these
 * assert on is what a user gets from Go to Definition, Find References, the
 * completion list and the rest.
 */

const LANG = file("lang.q");

const CALC = ".e2e.calc";
const BLOCK = "LANG_BLOCK_MARKER";
const SYMBOL = "`:/tmp/e2e/lang/data";
const LOCAL = "total";

let document: vscode.TextDocument;

/**
 * Where the nth occurrence of `text` sits, `into` characters in, so the
 * position is inside the token rather than on its edge. The assertions name
 * the code they act on; line and column numbers would move with every edit.
 */
function inside(text: string, occurrence = 0, into = 2) {
  const source = document.getText();
  let offset = -1;
  for (let found = 0; found <= occurrence; found++) {
    offset = source.indexOf(text, offset + 1);
    assert.notStrictEqual(
      offset,
      -1,
      `lang.q has no occurrence ${occurrence} of ${text}`,
    );
  }
  return document.positionAt(offset + Math.min(into, text.length - 1));
}

// The line the nth occurrence of `text` is on.
const lineOf = (text: string, occurrence = 0) => inside(text, occurrence).line;

// Every symbol in the document, flattened: a lambda's parameters and locals
// are nested under it.
function flatten(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  return symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children)]);
}

const names = (symbols: vscode.DocumentSymbol[]) =>
  flatten(symbols).map((symbol) => symbol.name);

async function symbols() {
  return (
    (await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      LANG,
    )) ?? []
  );
}

describe("q language features", () => {
  before(async () => {
    await activate();
    document = await vscode.workspace.openTextDocument(LANG);
    await vscode.window.showTextDocument(document, { preview: false });
    await waitForLanguageServer(LANG);
  });

  after(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  describe("document symbols", () => {
    it("lists the globals the file defines", async () => {
      const found = names(await symbols());

      for (const name of [CALC, ".e2e.report", "path"]) {
        assert.ok(found.includes(name), `${name} is missing from ${found}`);
      }
    });

    /**
     * A symbol literal runs to the end of the token, forward slashes and all.
     * Were one read as the start of a trailing comment instead, everything
     * after it on the line would be dropped and the assignment would not be a
     * definition at all.
     */
    it("reads a symbol literal containing forward slashes as one token", async () => {
      const found = flatten(await symbols()).find(
        (symbol) => symbol.name === "path",
      );

      assert.ok(found, "path was not defined");
      assert.strictEqual(found.range.start.line, lineOf(SYMBOL));
    });

    it("nests a lambda's parameters and locals under it", async () => {
      const found = names(await symbols());

      for (const name of ["qty", "px", LOCAL]) {
        assert.ok(found.includes(name), `${name} is missing from ${found}`);
      }
    });
  });

  describe("navigation", () => {
    it("goes from a call to the definition", async () => {
      const definitions = await vscode.commands.executeCommand<
        vscode.Location[]
      >("vscode.executeDefinitionProvider", LANG, inside(CALC, 1));

      assert.strictEqual(definitions.length, 1);
      assert.strictEqual(definitions[0].uri.fsPath, LANG.fsPath);
      assert.strictEqual(definitions[0].range.start.line, lineOf(CALC, 0));
    });

    it("finds every reference to a global", async () => {
      const references = await vscode.commands.executeCommand<
        vscode.Location[]
      >("vscode.executeReferenceProvider", LANG, inside(CALC, 0));

      const lines = references.map((reference) => reference.range.start.line);

      // The call inside .e2e.report and the one at the end of the file.
      for (const occurrence of [1, 2]) {
        assert.ok(
          lines.includes(lineOf(CALC, occurrence)),
          `occurrence ${occurrence} is missing from lines ${lines}`,
        );
      }
    });

    /**
     * Every place the function is named, the definition included. The entries
     * carry the callee's own name rather than the enclosing function's, so
     * what they identify is the call site and not the caller.
     */
    it("lists a function's call sites in the call hierarchy", async () => {
      const prepared = await vscode.commands.executeCommand<
        vscode.CallHierarchyItem[]
      >("vscode.prepareCallHierarchy", LANG, inside(CALC, 0));

      assert.ok(prepared?.length, "no call hierarchy item was prepared");
      assert.strictEqual(prepared[0].name, CALC);

      const incoming = await vscode.commands.executeCommand<
        vscode.CallHierarchyIncomingCall[]
      >("vscode.provideIncomingCalls", prepared[0]);

      const lines = incoming.map((call) => call.from.range.start.line);

      // The definition, the call inside .e2e.report, and the one at the end
      // of the file.
      assert.deepStrictEqual(lines, [
        lineOf(CALC, 0),
        lineOf(CALC, 1),
        lineOf(CALC, 2),
      ]);
    });
  });

  describe("editing", () => {
    it("folds a block comment as one range", async () => {
      const ranges = await vscode.commands.executeCommand<
        vscode.FoldingRange[]
      >("vscode.executeFoldingRangeProvider", LANG);

      const marker = lineOf(BLOCK);
      const found = ranges.find(
        (range) => range.start <= marker && range.end >= marker,
      );

      assert.ok(found, `no folding range covers line ${marker} of ${ranges}`);
      assert.strictEqual(found.kind, vscode.FoldingRangeKind.Comment);
    });

    // What Expand Selection does with the caret part way through a name.
    it("expands the selection to the whole name", async () => {
      const ranges = await vscode.commands.executeCommand<
        vscode.SelectionRange[]
      >("vscode.executeSelectionRangeProvider", LANG, [inside(LOCAL, 1)]);

      assert.ok(ranges?.length, "no selection range was offered");
      assert.strictEqual(document.getText(ranges[0].range), LOCAL);
    });

    it("completes a namespace member from its prefix", async () => {
      // Right after the dot that ends the namespace, i.e. ".e2e.|calc".
      const labels = await completions(LANG, inside(CALC, 2, ".e2e.".length));
      assert.ok(
        labels.some((label) => label.includes("calc")),
        `calc is missing from the completions ${labels}`,
      );
    });

    /**
     * A document that has never been saved has no path on disk, so it only
     * reaches the language server if untitled documents are synchronised too.
     */
    it("completes in a document that has never been saved", async () => {
      const untitled = await vscode.workspace.openTextDocument({
        language: "q",
        content: ".unsaved.value:42;\n.unsaved.v",
      });
      await vscode.window.showTextDocument(untitled, { preview: false });

      const position = new vscode.Position(1, 10);

      // The server is told about the document as it opens, so the first
      // request can arrive before it knows anything about it.
      let labels: string[] = [];
      for (let attempt = 0; attempt < 100; attempt++) {
        labels = await completions(untitled.uri, position);
        if (labels.some((label) => label.includes("value"))) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      assert.fail(`value is missing from the completions ${labels}`);
    });
  });

  /**
   * Toggle Parameter Cache rewrites the document, so this puts it back
   * afterwards rather than leaving the change for the tests that follow.
   */
  describe("the parameter cache", () => {
    const CACHED = ".axdebug.temp";

    afterEach(async () => {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    });

    it("caches a lambda's parameters and takes them back out", async () => {
      await caretAt(LANG, LOCAL);
      await vscode.commands.executeCommand("kdb.toggleParameterCache");
      await until(
        () => document.getText().includes(CACHED),
        "the parameters to be cached",
      );

      const cached = document.getText();
      assert.ok(
        cached.includes("`qty`px set'"),
        `the parameters were not set:\n${cached}`,
      );

      await caretAt(LANG, LOCAL);
      await vscode.commands.executeCommand("kdb.toggleParameterCache");
      await until(
        () => !document.getText().includes(CACHED),
        "the cache to be removed again",
      );
    });
  });
});
