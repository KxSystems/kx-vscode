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

import { activate, completions, file, focus, until } from "./utils";
import { CONNECTION, kdb, start } from "./utils/connection";
import { MemoryItem } from "./utils/qserver";

/**
 * What the process reports having in memory, as the editor sees it.
 *
 * The listing is asked for over IPC on connect and after every query, and each
 * item becomes a completion for the connected process. The tree draws the same
 * listing under Tables, Functions and the rest, but a tree's contents are not
 * reachable from a test window — the extension exposes no API for them — so
 * how items are filed by category is covered in test/suite instead.
 */

const FIXTURE = file("objects.q");

// The namespaces and the items in them, in the shape listMem.q reports: an
// item's fname carries its namespace, a namespace's own row is marked isNs.
let next = 0;

function item(
  name: string,
  typeNum: number,
  namespace = ".",
  isNs = false,
): MemoryItem {
  return {
    id: next++,
    pid: 0,
    name,
    fname: namespace === "." ? name : `${namespace}.${name}`,
    typeNum,
    namespace,
    context: namespace === "." ? "" : namespace,
    isNs,
  };
}

const namespace = (name: string) => ({
  ...item(name, 99, ".", true),
  fname: name,
});

const MEMORY: MemoryItem[] = [
  namespace("."),
  namespace(".e2e"),
  item("trade", 98),
  item("pricer", 100),
  item("px", -9),
  item("syms", 11),
  item("helper", 100, ".e2e"),
  item("rates", 98, ".e2e"),
  // The namespace the extension injects into the process to talk to it. Its
  // own API must never be offered back to the user as their code.
  item("getManifest", 100, ".vscode"),
];

describe("What the connected process has in memory", () => {
  let offered: string[] = [];

  before(async () => {
    await activate();
    await start();

    kdb.serverObjects = MEMORY;

    /**
     * The listing is read on connect, and only the process connected last is
     * the one completions are offered for. Suites that ran earlier will have
     * connected something else since, so this connects again — which both
     * makes the stand-in current and has it read the listing set above.
     */
    kdb.clear();
    await vscode.commands.executeCommand(
      "kdb.connections.disconnect",
      CONNECTION,
    );
    await vscode.commands.executeCommand(
      "kdb.connections.connect.via.dialog",
      CONNECTION,
    );
    await until(
      () => kdb.requests.some((request) => request.fn === ".vscode.listMem"),
      "the memory listing to be asked for",
    );

    fs.writeFileSync(FIXTURE.fsPath, "/ objects.q\n");
    await focus(FIXTURE);

    // The listing is answered after the connection reports itself ready, so
    // what it produced has to be waited for rather than read once.
    for (let attempt = 0; attempt < 100; attempt++) {
      offered = await completions(FIXTURE);
      if (offered.includes("trade")) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(
      offered.includes("trade"),
      `the memory listing was never offered as completions: ${offered}`,
    );
  });

  after(async () => {
    kdb.serverObjects = [];
    fs.rmSync(FIXTURE.fsPath, { force: true });
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("offers every item the process reported", () => {
    for (const name of ["trade", "pricer", "px", "syms"]) {
      assert.ok(offered.includes(name), `${name} is missing from ${offered}`);
    }
  });

  it("offers an item in a namespace by its full name", () => {
    for (const name of [".e2e.helper", ".e2e.rates"]) {
      assert.ok(offered.includes(name), `${name} is missing from ${offered}`);
    }
    assert.ok(
      !offered.includes("helper"),
      "a namespaced item was offered by its bare name",
    );
  });

  it("offers no namespace as an item of its own", () => {
    for (const name of [".", ".e2e"]) {
      assert.ok(!offered.includes(name), `the namespace ${name} was offered`);
    }
  });

  it("offers nothing out of the namespace the extension injected", () => {
    const injected = offered.filter((name) => name.startsWith(".vscode"));

    assert.deepStrictEqual(injected, []);
  });
});
