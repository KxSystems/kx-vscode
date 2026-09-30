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

import {
  PythonEnvironment,
  PythonEnvironments,
} from "@vscode/python-environments";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import proxyquire from "proxyquire";
import * as sinon from "sinon";
import * as vscode from "vscode";

import * as repl from "../../../src/classes/replConnection";
import * as setupCommand from "../../../src/commands/setupCommand";
import * as coreUtils from "../../../src/utils/core";

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

  describe("loadPath", () => {
    const base = path.join(path.sep, "work", "space");

    it("should resolve against the working directory", () => {
      sinon.stub(repl.ReplConnection.prototype, <any>"cwd").get(() => base);
      const result = instance["loadPath"](path.join(base, "src", "test.q"));
      assert.strictEqual(result, ["src", "test.q"].join("/"));
    });

    it("should keep the absolute path without a working directory", () => {
      sinon
        .stub(repl.ReplConnection.prototype, <any>"cwd")
        .get(() => undefined);
      const target = path.join(base, "src", "test.q");
      const result = instance["loadPath"](target);
      assert.strictEqual(result, target.split(path.sep).join("/"));
    });

    it("should load a file dropped on the terminal", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repl-drop-"));
      try {
        fs.mkdirSync(path.join(dir, "src"));
        fs.writeFileSync(path.join(dir, "src", "test.q"), "");
        sinon.stub(repl.ReplConnection.prototype, <any>"cwd").get(() => dir);
        const runQueryStub = sinon.stub(instance, <any>"runQuery");
        instance["handleInput"](path.join(dir, "src", "test.q") + "\r\n");
        sinon.assert.calledWith(runQueryStub, "\\l src/test.q");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    it("should not load a path that is not a file", () => {
      const runQueryStub = sinon.stub(instance, <any>"runQuery");
      instance["handleInput"]("/no such comment.q\r\n");
      sinon.assert.calledWith(runQueryStub, "/no such comment.q\r\n");
    });
  });

  describe("killProcess", () => {
    let notifyStub: sinon.SinonStub;
    let killStub: sinon.SinonStub;
    let ReplConnectionClass: any;

    const createInstance = (pid?: number) => {
      sinon
        .stub(ReplConnectionClass.prototype, "createProcess")
        .returns({ ...target, pid });
      return ReplConnectionClass.getOrCreateInstance();
    };

    beforeEach(() => {
      notifyStub = sinon.stub();
      killStub = sinon.stub().throws(new Error("taskkill failed"));
      ReplConnectionClass = proxyquire.noPreserveCache()(
        "../../../src/classes/replConnection",
        {
          "kill-sync": killStub,
          "../utils/notifications": { notify: notifyStub },
        },
      ).ReplConnection;
    });

    it("should log instead of throwing when the kill fails", async () => {
      const killable = await createInstance(1234);
      assert.doesNotThrow(() => killable["stopProcess"]());
      sinon.assert.calledWith(killStub, 1234, "SIGKILL", true);
      sinon.assert.called(notifyStub);
    });

    it("should not kill without a pid", async () => {
      const killable = await createInstance(undefined);
      killable["killProcess"]("SIGKILL");
      sinon.assert.notCalled(killStub);
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

  describe("without q", () => {
    let showSetupErrorStub: sinon.SinonStub;

    beforeEach(() => {
      (<sinon.SinonStub>(
        (<any>repl.ReplConnection.prototype).createProcess
      )).restore();
      sinon.stub(coreUtils, "getEnvironment").returns({ qBinPath: "" });
      showSetupErrorStub = sinon.stub(setupCommand, "showSetupError");
    });

    it("should refuse to start rather than run an empty command", () => {
      assert.throws(
        () => instance["createProcess"](),
        (error: unknown) =>
          error instanceof repl.QNotFoundError &&
          /no q was found/.test(`${error}`),
      );
      sinon.assert.calledOnce(showSetupErrorStub);
    });

    it("should exit instead of restarting when q has gone", () => {
      const sendToTerminalStub = sinon.stub(instance, <any>"sendToTerminal");
      sinon.stub(instance, <any>"showPrompt");
      instance["stopped"] = true;
      instance["handleExit"](0);
      assert.strictEqual(instance["exited"], true);
      sinon.assert.calledWithMatch(sendToTerminalStub, /exited with code/);
    });
  });

  describe("python environment", () => {
    const folder = vscode.Uri.file("/ws/py");
    const win32 = process.platform === "win32";
    const started = (q: string) =>
      sinon.match(
        (command: string) =>
          command.replace(/[0-9a-f-]{36}/, "ID") ===
          (win32
            ? `(source /ws/py/.venv/bin/activate) 2>nul || echo ID! & ${q}`
            : `{ source /ws/py/.venv/bin/activate; } 2>/dev/null || echo ID!; ${q}`),
      );
    const venv = <PythonEnvironment>{
      name: ".venv",
      execInfo: {
        run: { executable: "/ws/py/.venv/bin/python" },
        shellActivation: new Map([
          [
            win32 ? "cmd" : "bash",
            [{ executable: "source", args: ["/ws/py/.venv/bin/activate"] }],
          ],
        ]),
      },
    };
    let spawnStub: sinon.SinonStub;
    let apiStub: sinon.SinonStub;
    let getEnvironmentStub: sinon.SinonStub;
    let environmentStub: sinon.SinonStub;
    let ReplConnectionClass: typeof repl.ReplConnection;

    beforeEach(() => {
      spawnStub = sinon.stub().returns(target);
      getEnvironmentStub = sinon.stub().resolves(venv);
      apiStub = sinon
        .stub(PythonEnvironments, "api")
        .resolves(<any>{ getEnvironment: getEnvironmentStub });
      environmentStub = sinon
        .stub(coreUtils, "getEnvironment")
        .callsFake(() => ({ qBinPath: "/q/bin/q", qBinKdbX: "" }));
      ReplConnectionClass = proxyquire.noPreserveCache()(
        "../../../src/classes/replConnection",
        { "node:child_process": { spawn: spawnStub } },
      ).ReplConnection;
    });

    it("should ask for the environment selected for the REPL's folder", async () => {
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWith(getEnvironmentStub, folder);
    });

    it("should activate the environment before starting q", async () => {
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWith(spawnStub, started("/q/bin/q"));
    });

    it("should pass a q path the shell would change through the environment", async () => {
      environmentStub.callsFake(() => ({
        qBinPath: "/Users/Jo $HOME/q/bin/q",
        qBinKdbX: "",
      }));
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWithMatch(
        spawnStub,
        started(win32 ? '"%KX_REPL_ARG_0%"' : '"$KX_REPL_ARG_0"'),
        { env: sinon.match({ KX_REPL_ARG_0: "/Users/Jo $HOME/q/bin/q" }) },
      );
    });

    it("should point PyKX at the environment's interpreter", async () => {
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWithMatch(spawnStub, sinon.match.string, {
        env: sinon.match({ PYKX_EXECUTABLE: "/ws/py/.venv/bin/python" }),
      });
    });

    it("should keep a PYKX_EXECUTABLE that is already set", async () => {
      environmentStub.callsFake(() => ({
        qBinPath: "/q/bin/q",
        qBinKdbX: "",
        PYKX_EXECUTABLE: "/other/python",
      }));
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWithMatch(spawnStub, sinon.match.string, {
        env: sinon.match({ PYKX_EXECUTABLE: "/other/python" }),
      });
    });

    it("should leave PYKX_EXECUTABLE to activation for a path with spaces", async () => {
      getEnvironmentStub.resolves({
        ...venv,
        execInfo: {
          ...venv.execInfo,
          run: { executable: "/Users/Jo Doe/py/.venv/bin/python" },
        },
      });
      await ReplConnectionClass.openInFolder(folder);
      assert.strictEqual(
        spawnStub.firstCall.args[1].env.PYKX_EXECUTABLE,
        undefined,
      );
      sinon.assert.calledWith(spawnStub, started("/q/bin/q"));
    });

    it("should name the environment in the prompt", async () => {
      const instance = await ReplConnectionClass.openInFolder(folder);
      assert.strictEqual(instance["prefix"], "(.venv) ");
    });

    it("should not name an environment it did not activate", async () => {
      getEnvironmentStub.resolves({
        ...venv,
        execInfo: { run: venv.execInfo.run },
      });
      const instance = await ReplConnectionClass.openInFolder(folder);
      assert.strictEqual(instance["prefix"], "");
      sinon.assert.calledWith(spawnStub, "/q/bin/q");
    });

    it("should ignore an environment with an error", async () => {
      getEnvironmentStub.resolves({ ...venv, error: "python is missing" });
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWith(spawnStub, "/q/bin/q");
      assert.strictEqual(
        spawnStub.firstCall.args[1].env.PYKX_EXECUTABLE,
        undefined,
      );
    });

    it("should start q without the Python Environments extension", async () => {
      apiStub.rejects(new Error("not installed"));
      await ReplConnectionClass.openInFolder(folder);
      sinon.assert.calledWith(spawnStub, "/q/bin/q");
    });
  });

  describe("source expressions", () => {
    let sendToTerminalStub: sinon.SinonStub;
    let sendToProcessStub: sinon.SinonStub;

    const written = () =>
      sendToTerminalStub.getCalls().map((call) => call.args[0] as string);
    const done = () => {
      const marker = `${instance["identity"]}@.@`;
      instance["handleOutput"](Buffer.from(marker + marker));
    };

    beforeEach(() => {
      sendToTerminalStub = sinon.stub(instance, <any>"sendToTerminal");
      sendToProcessStub = sinon.stub(instance, <any>"sendToProcess");
      sinon.stub(instance, <any>"showPrompt");
      instance["columns"] = 80;
      instance["rows"] = 24;
      instance["messages"] = undefined;
      instance["executing"] = undefined;
      instance["executions"].length = 0;
    });

    it("should show each statement at a prompt before it runs", async () => {
      const running = instance.executeQuery("a:1\nb:a+1", true);
      assert.ok(
        written().some((text) => /q\) .*a:1/.test(text)),
        written().join("|"),
      );
      assert.ok(!written().some((text) => text.includes("b:a+1")));
      done();
      assert.ok(
        written().some((text) => /q\) .*b:a\+1\r\n$/.test(text)),
        written().join("|"),
      );
      sinon.assert.calledWith(sendToProcessStub, "b:a+1");
      done();
      await running;
    });

    it("should show nothing but a new line when not asked to", async () => {
      const running = instance.executeQuery("a:1", false);
      assert.deepStrictEqual(written(), ["\r\n"]);
      done();
      await running;
    });

    it("should show the source it was given instead of what it runs", async () => {
      const running = instance.executeQuery(
        "{wrapper}[]",
        true,
        "print(1)\nprint(2)\n",
      );
      const shown = written().join("");
      assert.ok(shown.includes("print(1)\r\nprint(2)"), shown);
      assert.ok(!shown.includes("{wrapper}"), shown);
      done();
      await running;
    });

    it("should follow kdb.hideSourceExpressions by default", async () => {
      const setting = sinon
        .stub(coreUtils, "getHideDetailedConsoleQueryOutputSetting")
        .returns(false);
      let running = instance.executeQuery("a:1");
      assert.ok(written().some((text) => text.includes("a:1")));
      done();
      await running;

      sendToTerminalStub.resetHistory();
      setting.returns(true);
      running = instance.executeQuery("a:1");
      assert.deepStrictEqual(written(), ["\r\n"]);
      done();
      await running;
    });
  });

  describe("paste", () => {
    const paste = (text: string) => `\x1b[200~${text}\x1b[201~`;

    let sendToTerminalStub: sinon.SinonStub;
    let runQueryStub: sinon.SinonStub;

    beforeEach(() => {
      sendToTerminalStub = sinon.stub(instance, <any>"sendToTerminal");
      runQueryStub = sinon.stub(instance, <any>"runQuery");
      instance["columns"] = 80;
      instance["rows"] = 24;
      instance["maxInputIndex"] = 1000;
      instance["executing"] = undefined;
      instance["input"] = [];
      instance["inputIndex"] = 0;
      instance["block"] = undefined;
    });

    it("should turn on bracketed paste when the terminal opens", () => {
      instance["open"]();
      sinon.assert.calledWith(sendToTerminalStub, "\x1b[?2004h");
    });

    it("should put a pasted line at the prompt without running it", () => {
      instance["handleInput"](paste("/test.q\r"));
      sinon.assert.notCalled(runQueryStub);
      assert.strictEqual(instance["input"].join(""), "/test.q");
      assert.strictEqual(instance["block"], undefined);
    });

    it("should hold pasted lines until Enter", () => {
      instance["handleInput"](paste("a: 1\r   2 3\r   4 5;\r"));
      sinon.assert.notCalled(runQueryStub);
      assert.strictEqual(instance["block"], "a: 1\n   2 3\n   4 5;");
      sinon.assert.calledWithMatch(sendToTerminalStub, "a: 1\r\n   2 3");

      instance["handleInput"]("\r");
      sinon.assert.calledOnceWithExactly(runQueryStub, "a: 1\n   2 3\n   4 5;");
      assert.strictEqual(instance["block"], undefined);
    });

    it("should discard held lines on Ctrl+C", () => {
      instance["handleInput"](paste("a\rb"));
      instance["handleInput"]("\x03");
      assert.strictEqual(instance["block"], undefined);
      instance["handleInput"]("\r");
      sinon.assert.neverCalledWith(runQueryStub, "a\nb");
    });

    it("should stop the running query on Ctrl+C with lines held", () => {
      const cancelStub = sinon.stub(instance, "cancel");
      instance["executing"] = <any>{ output: [] };
      instance["handleInput"](paste("a\rb"));
      instance["handleInput"]("\x03");
      assert.strictEqual(instance["block"], undefined);
      sinon.assert.calledOnce(cancelStub);
    });

    it("should show held lines again when the running query ends", () => {
      instance["executing"] = <any>{
        output: [],
        cancelled: false,
        resolve: sinon.stub(),
      };
      instance["handleInput"](paste("a\rb"));
      sendToTerminalStub.resetHistory();
      instance["resolve"]();
      sinon.assert.calledWithMatch(
        sendToTerminalStub,
        sinon.match(
          (data: string) =>
            data.startsWith("\x1b[s") && data.includes("a\r\nb"),
        ),
      );
      assert.strictEqual(instance["block"], "a\nb");
    });

    it("should ignore typing while lines are held", () => {
      instance["handleInput"](paste("a\rb"));
      instance["handleInput"]("x");
      instance["handleInput"]("\x7f");
      assert.strictEqual(instance["block"], "a\nb");
      assert.strictEqual(instance["input"].join(""), "");
    });

    it("should keep what was typed around the cursor", () => {
      instance["input"] = [..."f:g"];
      instance["inputIndex"] = 2;
      instance["handleInput"](paste("1\r2"));
      assert.strictEqual(instance["block"], "f:1\n2g");
    });

    it("should add another paste on a line of its own", () => {
      instance["handleInput"](paste("a\rb"));
      instance["handleInput"](paste("c"));
      assert.strictEqual(instance["block"], "a\nb\nc");
    });

    it("should put together a paste that arrives in pieces", () => {
      instance["handleInput"]("\x1b[200~a\r");
      assert.strictEqual(instance["block"], undefined);
      instance["handleInput"]("b\x1b[201~");
      assert.strictEqual(instance["block"], "a\nb");
    });

    it("should still run text sent with a newline", () => {
      instance["handleInput"]("1+1\r\n");
      sinon.assert.calledOnceWithExactly(runQueryStub, "1+1\r\n");
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

    describe("handleOutput", () => {
      it("should resolve and strip the marker of a nested namespace", () => {
        const resolve = sinon.stub();
        const showPromptStub = sinon.stub(instance, <any>"showPrompt");
        instance["executing"] = <any>{
          lines: ["\\d .foo.i"],
          output: [],
          done: [],
          index: 0,
          cancelled: false,
          resolve,
        };
        const marker = `${instance["identity"]}@.foo.i@`;
        instance["handleOutput"](Buffer.from(marker + marker));
        assert.strictEqual(instance["namespace"], ".foo.i");
        sinon.assert.calledOnce(resolve);
        sinon.assert.calledWith(showPromptStub, true);
        sinon.assert.neverCalledWithMatch(
          sendToTerminalSub,
          sinon.match(instance["identity"]),
        );
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

    it("should remove the instance from the cache on close, by key", async () => {
      const folder = vscode.Uri.file("/ws/sub2");
      const folderRepl = await repl.ReplConnection.openInFolder(folder);
      assert.ok(repls().has(folder.toString()));
      folderRepl["close"]();
      assert.ok(!repls().has(folder.toString()));
    });
  });

  describe("REPLs by label", () => {
    const repls = () =>
      repl.ReplConnection["repls"] as Map<string, repl.ReplConnection>;

    let root: string;
    let folders: vscode.WorkspaceFolder[];

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), "repl-label-"));
      fs.mkdirSync(path.join(root, "sub"));
      folders = [{ name: "ws", uri: vscode.Uri.file(root), index: 0 }];
      sinon.stub(vscode.workspace, "workspaceFolders").get(() => folders);
    });

    afterEach(() => {
      (repl.ReplConnection as any)["active"] = undefined;
      fs.rmSync(root, { recursive: true, force: true });
    });

    it("should list the open REPLs by label", async () => {
      const folderRepl = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/b"),
      );
      try {
        assert.ok(repl.ReplConnection.labels().includes(folderRepl.label));
        folderRepl["close"]();
        assert.ok(!repl.ReplConnection.labels().includes("b"));
      } finally {
        folderRepl["close"]();
      }
    });

    it("should name the active REPL and say when it changes", async () => {
      const changed = sinon.stub();
      const listener = repl.ReplConnection.onDidChangeActive(changed);
      const folderRepl = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/b"),
      );
      try {
        (repl.ReplConnection as any)["active"] = folderRepl;
        assert.strictEqual(repl.ReplConnection.activeLabel, folderRepl.label);
        sinon.assert.calledOnce(changed);
        (repl.ReplConnection as any)["active"] = folderRepl;
        sinon.assert.calledOnce(changed);
        folderRepl["close"]();
        assert.strictEqual(repl.ReplConnection.activeLabel, undefined);
        sinon.assert.calledTwice(changed);
      } finally {
        listener.dispose();
        folderRepl["close"]();
      }
    });

    it("should find an open REPL by its label", async () => {
      const folderRepl = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/b"),
      );
      try {
        assert.strictEqual(
          await repl.ReplConnection.forLabel(folderRepl.label),
          folderRepl,
        );
      } finally {
        folderRepl["close"]();
      }
    });

    it("should start the REPL a label names in its folder", async () => {
      const base = vscode.Uri.joinPath(vscode.Uri.file(root), "sub");
      const started = await repl.ReplConnection.forLabel("ws/sub");
      try {
        assert.strictEqual(repls().get(base.toString()), started);
      } finally {
        started["close"]();
      }
    });

    it("should open a label saved under another name in the only folder", async () => {
      const started = await repl.ReplConnection.forLabel("other/sub");
      try {
        assert.ok(started.label.endsWith("sub"));
      } finally {
        started["close"]();
      }
    });

    it("should refuse a label with no workspace folder of its name", async () => {
      folders.push({ name: "ws2", uri: vscode.Uri.file(root + "2"), index: 1 });
      await assert.rejects(
        repl.ReplConnection.forLabel("other/sub"),
        /no workspace folder named other/,
      );
    });

    it("should refuse a label whose folder does not exist", async () => {
      await assert.rejects(
        repl.ReplConnection.forLabel("ws/missing"),
        /does not exist/,
      );
    });

    it("should start again a closed REPL outside the workspace", async () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), "repl-outside-"));
      const base = vscode.Uri.file(outside);
      const closed = await repl.ReplConnection.openInFolder(base);
      closed["close"]();
      const started = await repl.ReplConnection.forLabel(closed.label);
      try {
        assert.notStrictEqual(started, closed);
        assert.strictEqual(repls().get(base.toString()), started);
      } finally {
        started["close"]();
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    it("should start again the closed default REPL", async () => {
      const closed = repl.ReplConnection["repls"].get("default");
      closed?.["close"]();
      (repl.ReplConnection as any)["bases"].set("default", undefined);
      const started = await repl.ReplConnection.forLabel("default");
      try {
        assert.strictEqual(started.label, "default");
        assert.strictEqual(repls().get("default"), started);
      } finally {
        started["close"]();
      }
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

    it("should not route by folder when there is no active REPL", async () => {
      const replA = await repl.ReplConnection.openInFolder(
        vscode.Uri.file("/ws/a"),
      );
      try {
        const chosen = await repl.ReplConnection.getOrCreateInstance(
          vscode.Uri.file("/ws/a/child.q"),
        );
        // The workspace REPL, not the one based in the file's own folder.
        assert.notStrictEqual(chosen, replA);
        assert.strictEqual(chosen, instance);
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
