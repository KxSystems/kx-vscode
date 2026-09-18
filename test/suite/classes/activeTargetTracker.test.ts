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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import {
  getActiveTarget,
  setActiveTarget,
} from "../../../src/classes/activeTarget";
import { initActiveTargetTracking } from "../../../src/classes/activeTargetTracker";
import { ConnectionConsole } from "../../../src/classes/connectionConsole";
import { ReplConnection } from "../../../src/classes/replConnection";
import { ext } from "../../../src/extensionVariables";

describe("initActiveTargetTracking", () => {
  let tracker: vscode.Disposable;
  let serverProvider: any;

  beforeEach(() => {
    serverProvider = ext.serverProvider;
    ext.serverProvider = <any>{ reload() {} };
    ext.activeConnection = undefined;
    setActiveTarget(undefined);
    tracker = initActiveTargetTracking();
  });

  afterEach(() => {
    sinon.restore();
    tracker.dispose();
    for (const console of ext.connectionConsoles.values()) {
      console.dispose();
    }
    ext.connectionConsoles.clear();
    ext.connectionsList.length = 0;
    ext.connectedConnectionList.length = 0;
    ext.activeConnection = undefined;
    ext.serverProvider = serverProvider;
    setActiveTarget(undefined);
  });

  function connect(label: string) {
    ext.connectionsList.push(<any>{ label });
    ext.connectedConnectionList.push(<any>{
      connLabel: label,
      setActive() {},
      setInactive() {},
    });
    const console = new ConnectionConsole(label);
    ext.connectionConsoles.set(label, console);
    return console;
  }

  async function focus(terminal: vscode.Terminal) {
    const focused = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        sub.dispose();
        reject(new Error("the terminal never became active"));
      }, 8000);
      const sub = vscode.window.onDidChangeActiveTerminal((active) => {
        if (active === terminal) {
          clearTimeout(timer);
          sub.dispose();
          resolve();
        }
      });
    });
    terminal.show();
    await focused;
  }

  it("should follow the console the user clicks", async function () {
    this.timeout(30000);

    const first = connect("first");
    const second = connect("second");

    await focus(first.terminal);
    assert.deepStrictEqual(getActiveTarget(), {
      kind: "connection",
      connLabel: "first",
    });
    assert.strictEqual(ext.activeConnection?.connLabel, "first");

    await focus(second.terminal);
    assert.deepStrictEqual(getActiveTarget(), {
      kind: "connection",
      connLabel: "second",
    });
    assert.strictEqual(ext.activeConnection?.connLabel, "second");

    await focus(first.terminal);
    assert.strictEqual(ext.activeConnection?.connLabel, "first");
  });

  it("should clear the active connection when a REPL is clicked", async function () {
    this.timeout(30000);

    const console = connect("first");
    const repl = vscode.window.createTerminal({
      name: "repl",
      isTransient: true,
    });
    sinon
      .stub(ReplConnection, "isReplTerminal")
      .callsFake((terminal) => terminal === repl);

    try {
      await focus(console.terminal);
      assert.strictEqual(ext.activeConnection?.connLabel, "first");

      await focus(repl);
      assert.deepStrictEqual(getActiveTarget(), { kind: "repl" });
      assert.strictEqual(ext.activeConnection, undefined);
    } finally {
      repl.dispose();
    }
  });

  it("should keep the target when an unrelated terminal is clicked", async function () {
    this.timeout(30000);

    const console = connect("first");
    const other = vscode.window.createTerminal({
      name: "other",
      isTransient: true,
    });

    try {
      await focus(console.terminal);
      await focus(other);

      assert.deepStrictEqual(getActiveTarget(), {
        kind: "connection",
        connLabel: "first",
      });
      assert.strictEqual(ext.activeConnection?.connLabel, "first");
    } finally {
      other.dispose();
    }
  });
});
