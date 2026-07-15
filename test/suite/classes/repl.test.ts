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

import { PythonExtension } from "@vscode/python-extension";
import * as assert from "node:assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { QDebugDriver } from "../../../src/classes/qDebugDriver";
import * as repl from "../../../src/classes/replConnection";
import { ext } from "../../../src/extensionVariables";

describe("REPL", () => {
  const terminal = <vscode.Terminal>{ show() {}, dispose() {} };

  beforeEach(() => {
    // The output channel is a global set by extension activation; ensure it
    // exists so notify() paths are safe when this file runs in isolation.
    if (!ext.outputChannel) {
      ext.outputChannel = vscode.window.createOutputChannel("kdb", {
        log: true,
      });
    }
    if (!ext.context) {
      ext.context = {
        extensionPath: "/ext",
        extensionUri: vscode.Uri.file("/ext"),
        subscriptions: [],
      } as any;
    }
    // Never spawn a real q, resolve a real venv, or create a real terminal.
    sinon.stub(PythonExtension, "api").resolves({
      environments: {
        getActiveEnvironmentPath: () => ({}),
        resolveEnvironment: async () => undefined,
      },
    } as any);
    sinon.stub(QDebugDriver.prototype, "start").resolves();
    sinon.stub(vscode.window, "createTerminal").returns(terminal);
  });

  afterEach(() => {
    sinon.restore();
  });

  // Make an instance whose driver looks live and whose run() is scripted.
  async function makeInstance(run?: (line: string) => string) {
    const instance = await repl.ReplConnection.getOrCreateInstance();
    const driver = instance["driver"] as QDebugDriver;
    (driver as any).proc = {}; // alive === !!proc && !exited
    const runStub = sinon
      .stub(driver, "run")
      .callsFake(
        async (line: string) =>
          ({ output: run ? run(line) : "", depth: 1, errored: false }) as any,
      );
    return { instance, driver, runStub };
  }

  describe("session", () => {
    it("exposes the shared driver for the debugger", async () => {
      const { instance, driver } = await makeInstance();
      assert.strictEqual(await instance.session(), driver);
      instance["close"]();
    });
  });

  describe("executeQuery", () => {
    it("runs each normalized line via the driver and concatenates output", async () => {
      const { instance, runStub } = await makeInstance((line) => `<${line}>`);
      const token = new vscode.CancellationTokenSource().token;

      const result = await instance.executeQuery("2+2", token);

      assert.ok(runStub.calledWith("2+2"));
      assert.strictEqual(result.output, "<2+2>");
      instance["close"]();
    });

    it("stops and reports cancelled when the token is cancellation-requested", async () => {
      const { instance, runStub } = await makeInstance();
      const source = new vscode.CancellationTokenSource();
      source.cancel();

      const result = await instance.executeQuery("2+2", source.token);

      assert.strictEqual(result.cancelled, true);
      assert.ok(runStub.notCalled, "no line is sent once cancelled");
      instance["close"]();
    });
  });

  describe("interactive input", () => {
    it("submits the typed line to the driver on Enter", async () => {
      const { instance, runStub } = await makeInstance();
      instance["handleInput"]("a");
      instance["handleInput"]("b");
      instance["handleInput"]("\r");
      assert.ok(runStub.calledOnceWith("ab"));
      instance["close"]();
    });

    it("erases the last character on backspace", async () => {
      const { instance } = await makeInstance();
      instance["handleInput"]("a");
      instance["handleInput"]("b");
      instance["handleInput"]("\x7f");
      assert.strictEqual(instance["input"].join(""), "a");
      instance["close"]();
    });

    it("ignores control sequences like arrow keys", async () => {
      const { instance } = await makeInstance();
      instance["handleInput"]("\x1b[A"); // up arrow
      assert.strictEqual(instance["input"].length, 0);
      instance["close"]();
    });
  });

  describe("folder scoped instances", () => {
    const repls = () =>
      repl.ReplConnection["repls"] as Map<string, repl.ReplConnection>;

    it("should route a contained file to the most specific folder REPL", async () => {
      const folder = vscode.Uri.file("/ws/sub");
      const folderRepl = await repl.ReplConnection.openInFolder(folder);
      try {
        const chosen = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/sub/child/x.q"),
        );
        assert.strictEqual(chosen, folderRepl);
      } finally {
        folderRepl["close"]();
      }
    });

    it("should pick the most specific of several overlapping folder REPLs", async () => {
      const outer = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws"),
      );
      const inner = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/sub/child2"),
      );
      try {
        const chosenForOuter = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/other/x.q"),
        );
        assert.strictEqual(chosenForOuter, outer);

        const chosenForInner = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/sub/child2/x.q"),
        );
        assert.strictEqual(chosenForInner, inner);
      } finally {
        outer["close"]();
        inner["close"]();
      }
    });

    it("should remove the instance from the cache on close, by key", async () => {
      const folder = vscode.Uri.file("/ws/sub2");
      const folderRepl = await repl.ReplConnection.openInFolder(folder);
      assert.ok(repls().has(folder.toString()));
      folderRepl["close"]();
      assert.ok(!repls().has(folder.toString()));
    });
  });

  describe("active REPL routing", () => {
    const setActive = (value: repl.ReplConnection | undefined) => {
      (repl.ReplConnection as any)["active"] = value;
    };

    afterEach(() => {
      setActive(undefined);
    });

    it("should route an orphan file to the active REPL", async () => {
      const replA = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/a"),
      );
      const replB = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/b"),
      );
      try {
        setActive(replA);
        const chosen = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/x.q"),
        );
        assert.strictEqual(chosen, replA);
      } finally {
        replA["close"]();
        replB["close"]();
      }
    });

    it("should target the active REPL even for a file owned by another folder REPL", async () => {
      const replA = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/a"),
      );
      const replB = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/b"),
      );
      try {
        setActive(replB);
        const chosen = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/a/child.q"),
        );
        assert.strictEqual(chosen, replB);
      } finally {
        replA["close"]();
        replB["close"]();
      }
    });

    it("should fall back to folder routing when there is no active REPL", async () => {
      const replA = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/a"),
      );
      try {
        const chosen = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/a/child.q"),
        );
        assert.strictEqual(chosen, replA);
      } finally {
        replA["close"]();
      }
    });

    it("should ignore an exited active REPL", async () => {
      const replA = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/a"),
      );
      setActive(replA);
      replA["close"]();
      const chosen = await repl.ReplConnection.getOrCreateInstance(
        vscode.Uri.file("/ws/x.q"),
      );
      assert.notStrictEqual(chosen, replA);
    });

    it("should mark a REPL active when it is started", async () => {
      const instance = await repl.ReplConnection.getOrCreateInstance();
      instance["start"]();
      assert.strictEqual((repl.ReplConnection as any)["active"], instance);
      instance["close"]();
    });

    it("should clear the active REPL when it closes", async () => {
      const replA = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/a"),
      );
      setActive(replA);
      replA["close"]();
      assert.strictEqual((repl.ReplConnection as any)["active"], undefined);
    });
  });
});
