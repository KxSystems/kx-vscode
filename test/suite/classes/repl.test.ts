/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

  beforeEach(() => {
    sinon
      .stub(repl.ReplConnection.prototype, <any>"createProcess")
      .returns(target);
    sinon.stub(vscode.window, "createTerminal").returns(terminal);
    instance = repl.ReplConnection.getOrCreateInstance();
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
    it("should send token with data when no error on q", () => {
      instance["sendToProcess"]("a:1");
      assert.ok(stdinChunk.endsWith(',string system"d";\r\n'));
    });
    it("should send token with data when no error on k", () => {
      instance["context"] = "k";
      instance["sendToProcess"]("a:1");
      assert.ok(stdinChunk.endsWith(',$:."\\\\d";\r\n'));
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
});
