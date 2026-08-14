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

// The folder VS Code is opened on; see test/runE2E.ts.
export const WORKSPACE = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "test",
  "e2e",
  "workspace",
);

export const file = (name: string) =>
  vscode.Uri.file(path.join(WORKSPACE, name));

// The stand-in q records what it is sent next to the directory it runs in, so
// each REPL has its own transcript.
function transcript(folder = WORKSPACE) {
  const target = path.join(folder, ".transcript.log");
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
}

// Where a REPL transcript currently ends, so a test can read only what a
// command adds to it rather than tearing REPLs down.
export const mark = (folder?: string) => transcript(folder).length;

export const since = (from: number, folder?: string) =>
  transcript(folder).slice(from);

// Everything the REPL was sent while `command` ran.
export async function runOnRepl(command: string, folder?: string) {
  const from = mark(folder);
  await vscode.commands.executeCommand(command);
  return since(from, folder);
}

// Generous enough for a loaded CI runner; it only costs that long when
// something is actually wrong.
export async function until(condition: () => boolean, what: string) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`timed out waiting for ${what}`);
}

export async function activate() {
  const extension = vscode.extensions.getExtension("KX.kdb");
  assert.ok(extension, "the kdb extension is not installed in this window");
  await extension.activate();
}

/**
 * Opens a file and gives it the requested selection, or selects the whole file
 * when none is given.
 *
 * Both halves have to settle before a command can be run against it: a
 * selection is applied optimistically and then confirmed by the renderer, and
 * the extension only learns which editor is active through
 * onDidChangeActiveTextEditor. Acting too early runs the command against the
 * previous selection.
 */
export async function focus(uri: vscode.Uri, selection?: vscode.Selection) {
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
  });
  const wanted = selection ?? new vscode.Selection(0, 0, document.lineCount, 0);
  editor.selection = wanted;

  await until(
    () => {
      const active = vscode.window.activeTextEditor;
      return (
        active?.document.uri.toString() === uri.toString() &&
        active.selection.isEqual(wanted)
      );
    },
    `${path.basename(uri.fsPath)} to be focused with the requested selection`,
  );

  return editor;
}

function positionOf(document: vscode.TextDocument, text: string) {
  const offset = document.getText().indexOf(text);
  assert.notStrictEqual(offset, -1, `${text} is not in ${document.fileName}`);
  return document.positionAt(offset);
}

export async function caretAt(uri: vscode.Uri, text: string) {
  const document = await vscode.workspace.openTextDocument(uri);
  const caret = positionOf(document, text);
  return focus(uri, new vscode.Selection(caret, caret));
}

export async function selectionOf(uri: vscode.Uri, text: string) {
  const document = await vscode.workspace.openTextDocument(uri);
  const start = positionOf(document, text);
  return focus(
    uri,
    new vscode.Selection(
      start,
      document.positionAt(document.offsetAt(start) + text.length),
    ),
  );
}

export async function lastLineOf(uri: vscode.Uri) {
  const document = await vscode.workspace.openTextDocument(uri);
  const caret = new vscode.Position(document.lineCount - 1, 0);
  return focus(uri, new vscode.Selection(caret, caret));
}

// The q language server runs as its own process, so the first request has to
// wait for it. Symbols are the cheapest proof it is answering.
export async function waitForLanguageServer(uri: vscode.Uri) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const symbols = await vscode.commands.executeCommand<
      vscode.DocumentSymbol[]
    >("vscode.executeDocumentSymbolProvider", uri);
    if (symbols?.length) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the language server did not answer");
}
