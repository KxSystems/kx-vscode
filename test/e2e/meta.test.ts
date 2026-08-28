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

import { activate, until } from "./utils";
import { CONNECTION as KDB, start as startKdb } from "./utils/connection";
import { meta } from "./utils/fixtures";
import { CONNECTION, start } from "./utils/insights";
import { clear, raised, untilRaised } from "./utils/prompt";

/**
 * What the instance said about itself, opened from the tree. Each meta object
 * is a node under the connection's meta node, and the command those nodes run
 * is given the connection and the object's name — which is all this needs to
 * stand in for the click.
 */

const node = (label: string, connLabel = CONNECTION) => ({ connLabel, label });

// The document the command opened, once it is in front. The content provider
// serves one document at a time, so this waits for the editor rather than
// looking the document up by name.
async function opened() {
  await until(
    () => vscode.window.activeTextEditor?.document.uri.scheme === "meta",
    "a meta document to be opened",
  );
  return vscode.window.activeTextEditor!.document;
}

async function open(label: string, connLabel?: string) {
  await vscode.commands.executeCommand(
    "kdb.connections.open.meta",
    node(label, connLabel),
  );
}

describe("The meta objects of an Insights connection", () => {
  before(async () => {
    await activate();
    await start();
  });

  beforeEach(async () => {
    clear();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  after(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("names the document after the connection and the object", async () => {
    await open("schema");
    const document = await opened();

    assert.strictEqual(document.uri.scheme, "meta");
    assert.strictEqual(document.uri.path, `${CONNECTION} - schema.json`);
  });

  it("shows each object of the meta the instance answered with", async () => {
    for (const [label, payload] of [
      ["schema", meta.payload.schema],
      ["api", meta.payload.api],
      ["dap", meta.payload.dap],
      ["rc", meta.payload.rc],
      ["agg", meta.payload.agg],
    ] as [string, unknown][]) {
      await open(label);
      const document = await opened();

      assert.deepStrictEqual(
        JSON.parse(document.getText()),
        payload,
        `the ${label} object`,
      );
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    }
  });

  it("shows the whole payload for the meta node itself", async () => {
    await open("meta");
    const document = await opened();

    assert.deepStrictEqual(JSON.parse(document.getText()), meta.payload);
  });

  it("formats what it shows rather than serving it as one line", async () => {
    await open("dap");
    const document = await opened();

    assert.ok(
      document.lineCount > 1,
      `the document is a single line:\n${document.getText()}`,
    );
  });

  it("refuses an object the meta has no such type for", async () => {
    await open("nosuchobject");

    await untilRaised("not valid");
    assert.strictEqual(
      vscode.window.activeTextEditor,
      undefined,
      "a document was opened for an object that does not exist",
    );
  });

  it("refuses a connection that is not an Insights one", async () => {
    await startKdb();
    await open("schema", KDB);

    await untilRaised("not an Insights connection");
    assert.strictEqual(
      raised("not an Insights connection")[0].kind,
      "error",
      "the refusal was not reported as an error",
    );
    assert.strictEqual(vscode.window.activeTextEditor, undefined);
  });
});
