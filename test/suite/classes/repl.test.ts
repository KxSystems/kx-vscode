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
import * as sinon from "sinon";
import * as vscode from "vscode";

import * as repl from "../../../src/classes/replConnection";

describe("REPL", () => {
  let stdinChunk: string;
  let stdinWriteCallback: (error: Error) => void;
  let instance: repl.ReplConnection;

  const target = {
    on(_: string) {},
    stdout: { on(_: string) {} },
    stderr: { on(_: string) {} },
    stdin: {
      write(chunk: any, callback: (error: Error) => void) {
        stdinChunk = chunk;
        stdinWriteCallback = callback;
      },
      on(_: string) {},
    },
  };
  const terminal = <vscode.Terminal>{ show() {} };

  beforeEach(async () => {
    sinon
      .stub(repl.ReplConnection.prototype, <any>"createProcess")
      .returns(target);
    sinon.stub(vscode.window, "createTerminal").returns(terminal);
    instance = await repl.ReplConnection.getOrCreateInstance();
  });

  afterEach(() => {
    sinon.restore();
    stdinChunk = undefined;
    stdinWriteCallback = undefined;
    instance = undefined;
  });

  describe("connect", () => {
    it("should listen error on target", () => {
      const stub = sinon.stub(target, "on");
      instance["connect"]();
      sinon.assert.calledWithMatch(stub, "error");
    });
    it("should listen exit on target", () => {
      const stub = sinon.stub(target, "on");
      instance["connect"]();
      sinon.assert.calledWithMatch(stub, "exit");
    });
    it("should listen data on target stdout", () => {
      const stub = sinon.stub(target.stdout, "on");
      instance["connect"]();
      sinon.assert.calledWithMatch(stub, "data");
    });
    it("should listen error on target stdout", () => {
      const stub = sinon.stub(target.stdout, "on");
      instance["connect"]();
      sinon.assert.calledWithMatch(stub, "error");
    });
    it("should listen data on target stderr", () => {
      const stub = sinon.stub(target.stderr, "on");
      instance["connect"]();
      sinon.assert.calledWithMatch(stub, "data");
    });
    it("should listen error on target stderr", () => {
      const stub = sinon.stub(target.stderr, "on");
      instance["connect"]();
      sinon.assert.calledWithMatch(stub, "error");
    });
  });

  describe("sendToProcess", () => {
    it("should write data to stdin with CRLF", () => {
      instance["sendToProcess"]("a:1");
      assert.ok(stdinChunk.startsWith("a:1\r\n"));
    });
  });

  describe("sendToTerminal", () => {
    let data: string;

    beforeEach(() => {
      sinon.stub(instance, <any>"onDidWrite").value({
        fire(_data: string) {
          data = _data;
        },
      });
    });

    afterEach(() => {
      data = undefined;
    });

    it("should fire onDidWrite", () => {
      instance["messages"] = undefined;
      instance["sendToTerminal"]("test");
      assert.strictEqual(data, "test");
    });
  });

  describe("moveCursorToColumn", () => {
    it("should return ANSİ code for moving cursor", () => {
      const res = instance["moveCursorToColumn"](1);
      assert.strictEqual(res, "\x1B[1G");
    });
  });

  describe("word deletion", () => {
    beforeEach(() => {
      sinon.stub(instance, <any>"showPrompt");
      instance["maxInputIndex"] = 1000;
    });

    const setInput = (text: string, index: number) => {
      instance["input"] = [...text];
      instance["inputIndex"] = index;
    };

    it("should delete the previous word", () => {
      setInput("foo bar", 7);
      instance["deleteWordLeft"]();
      assert.strictEqual(instance["input"].join(""), "foo ");
      assert.strictEqual(instance["inputIndex"], 4);
    });

    it("should delete trailing whitespace and the previous word", () => {
      setInput("foo bar  ", 9);
      instance["deleteWordLeft"]();
      assert.strictEqual(instance["input"].join(""), "foo ");
      assert.strictEqual(instance["inputIndex"], 4);
    });

    it("should do nothing deleting the previous word at the start", () => {
      setInput("foo", 0);
      instance["deleteWordLeft"]();
      assert.strictEqual(instance["input"].join(""), "foo");
      assert.strictEqual(instance["inputIndex"], 0);
    });

    it("should delete the next word", () => {
      setInput("foo bar", 0);
      instance["deleteWordRight"]();
      assert.strictEqual(instance["input"].join(""), " bar");
      assert.strictEqual(instance["inputIndex"], 0);
    });

    it("should delete leading whitespace and the next word", () => {
      setInput("  foo bar", 0);
      instance["deleteWordRight"]();
      assert.strictEqual(instance["input"].join(""), " bar");
      assert.strictEqual(instance["inputIndex"], 0);
    });

    it("should do nothing deleting the next word at the end", () => {
      setInput("foo", 3);
      instance["deleteWordRight"]();
      assert.strictEqual(instance["input"].join(""), "foo");
      assert.strictEqual(instance["inputIndex"], 3);
    });
  });

  describe("keyboard navigation", () => {
    beforeEach(() => {
      sinon.stub(instance, <any>"showPrompt");
      instance["maxInputIndex"] = 1000;
    });

    const setInput = (text: string, index: number) => {
      instance["input"] = [...text];
      instance["inputIndex"] = index;
    };

    it("should jump to the start of the previous word on Ctrl+Left", () => {
      setInput("select price", 12);
      instance["handleInput"]("\x1b[1;5D");
      assert.strictEqual(instance["inputIndex"], 7);
    });

    it("should jump to the start of the previous word on Option+Left", () => {
      setInput("select price", 12);
      instance["handleInput"]("\x1bb");
      assert.strictEqual(instance["inputIndex"], 7);
    });

    it("should jump to the end of the next word on Ctrl+Right", () => {
      setInput("select price", 0);
      instance["handleInput"]("\x1b[1;5C");
      assert.strictEqual(instance["inputIndex"], 6);
    });

    it("should jump to the end of the next word on Option+Right", () => {
      setInput("select price", 0);
      instance["handleInput"]("\x1bf");
      assert.strictEqual(instance["inputIndex"], 6);
    });

    it("should not insert stray characters for a navigation sequence", () => {
      setInput("select price", 12);
      instance["handleInput"]("\x1b[1;5D");
      assert.strictEqual(instance["input"].join(""), "select price");
    });
  });

  describe("clear", () => {
    let sendToTerminalStub: sinon.SinonStub;
    let showPromptStub: sinon.SinonStub;

    beforeEach(() => {
      sendToTerminalStub = sinon.stub(instance, <any>"sendToTerminal");
      showPromptStub = sinon.stub(instance, <any>"showPrompt");
      instance["maxInputIndex"] = 1000;
      instance["executing"] = undefined;
    });

    it("should clear the screen and scrollback and preserve input on Ctrl+L", () => {
      instance["input"] = [..."select price"];
      instance["inputIndex"] = 12;
      instance["handleInput"]("\x0c");
      sinon.assert.calledWith(sendToTerminalStub, "\x1b[2J\x1b[3J\x1b[H");
      sinon.assert.calledWith(showPromptStub, true);
      assert.strictEqual(instance["input"].join(""), "select price");
    });
  });

  describe("Output", () => {
    let sendToTerminalSub: sinon.SinonStub;

    beforeEach(() => {
      sendToTerminalSub = sinon.stub(instance, <any>"sendToTerminal");
    });

    describe("showPrompt", () => {
      it("should not output to terminal if exited", () => {
        sinon.stub(instance, <any>"exited").value(true);
        instance["showPrompt"]();
        sinon.assert.notCalled(sendToTerminalSub);
      });
    });
  });

  describe("show", () => {
    let showStub: sinon.SinonStub;

    beforeEach(() => {
      showStub = sinon.stub(terminal, "show");
    });

    it("should show REPL when autofocus is enabled", () => {
      instance["show"]();
      sinon.assert.calledOnce(showStub);
    });

    it("should not show REPL when autofocus is disabled", () => {
      sinon.stub(vscode.workspace, "getConfiguration").value(() => {
        return {
          get() {
            return false;
          },
        };
      });
      instance["show"]();
      sinon.assert.notCalled(showStub);
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

    it("should mark a REPL active when it is started", () => {
      instance["start"]();
      assert.strictEqual((repl.ReplConnection as any)["active"], instance);
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
