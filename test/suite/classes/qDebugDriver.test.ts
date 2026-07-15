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

import { QDebugDriver } from "../../../src/classes/qDebugDriver";

// A minimal fake of the piped q child. `pid: undefined` makes dispose() skip the
// real kill(), so tests never signal an actual process.
function fakeProcess(onWrite?: (chunk: string) => void) {
  const proc: any = {
    pid: undefined,
    on() {
      return proc;
    },
    stdout: { on() {} },
    stderr: { on() {} },
    stdin: {
      write(chunk: string) {
        onWrite?.(chunk);
        return true;
      },
    },
  };
  return proc;
}

describe("QDebugDriver", () => {
  let driver: QDebugDriver;

  beforeEach(() => {
    driver = new QDebugDriver();
  });

  afterEach(() => {
    sinon.restore();
  });

  // Attach a fake process directly (bypassing start()). `data()` feeds q output
  // manually; a `responder` instead scripts the output that follows each command
  // (auto-fed on a microtask) so a full request/response can be simulated.
  function attach(responder?: (chunk: string) => string | undefined) {
    const writes: string[] = [];
    const proc = fakeProcess((chunk) => {
      writes.push(chunk);
      const out = responder?.(chunk);
      if (out !== undefined) queueMicrotask(() => (driver as any).onData(out));
    });
    (driver as any).proc = proc;
    (driver as any).pending = undefined;
    return { writes, data: (chunk: string) => (driver as any).onData(chunk) };
  }

  describe("start", () => {
    it("forces KX_TTY=1/KX_LINE=0 and loads the startup script, then resolves on the prompt", async () => {
      const createProcess = sinon
        .stub(QDebugDriver.prototype, <any>"createProcess")
        .returns(fakeProcess());
      sinon
        .stub(vscode.window, "createTerminal")
        .returns(<vscode.Terminal>{ show() {}, dispose() {} });

      const started = driver.start(
        "/opt/q",
        { QHOME: "/opt/qhome" },
        "/work",
        "/ext/debug.q",
      );
      // The boot banner + prompt arrives; the driver should now be ready.
      (driver as any).onData("KDB-X 5.0\n\nq)");
      await started;

      const [command, options] = createProcess.firstCall.args as [string, any];
      assert.ok(
        command.includes("/opt/q") && command.includes("/ext/debug.q"),
        "q is launched with the startup script",
      );
      assert.strictEqual(options.env.KX_TTY, "1");
      assert.strictEqual(options.env.KX_LINE, "0");
      assert.strictEqual(options.env.QHOME, "/opt/qhome");
      assert.strictEqual(driver.promptDepth, 1);
      assert.strictEqual(driver.suspended, false);
    });

    it("names the terminal 'q Debug'", async () => {
      sinon
        .stub(QDebugDriver.prototype, <any>"createProcess")
        .returns(fakeProcess());
      const createTerminal = sinon
        .stub(vscode.window, "createTerminal")
        .returns(<vscode.Terminal>{ show() {}, dispose() {} });

      const started = driver.start("/opt/q", {});
      (driver as any).onData("q)");
      await started;

      assert.strictEqual(createTerminal.firstCall.args[0].name, "q Debug");
    });
  });

  describe("run", () => {
    it("returns clean output at the top-level prompt (depth 1)", async () => {
      const io = attach();
      const p = driver.run("2+2");
      io.data("4\nq)");
      const result = await p;
      assert.strictEqual(result.output, "4");
      assert.strictEqual(result.depth, 1);
      assert.strictEqual(result.errored, false);
    });

    it("sends the command to the process stdin with a newline", async () => {
      const io = attach();
      const p = driver.run("a:1");
      io.data("q)");
      await p;
      assert.strictEqual(io.writes[0], "a:1\n");
    });

    it("does not strip a first line of output (q does not echo under KX_LINE=0)", async () => {
      const io = attach();
      const p = driver.run(".Q.bt[]");
      io.data(">>[1]  f:{x+1}\n  [0]  f 5\nq))");
      const result = await p;
      assert.ok(
        result.output.startsWith(">>[1]"),
        "the first output line is preserved",
      );
    });
  });

  describe("suspend detection", () => {
    it("marks an exception stop from a leading ' signal at a deeper prompt", async () => {
      const io = attach();
      const p = driver.run("f 1");
      io.data("'type\n  [1]  f:{x+`a}\n       ^\nq))");
      const result = await p;
      assert.strictEqual(result.depth, 2);
      assert.strictEqual(result.errored, true);
      assert.strictEqual(driver.suspended, true);
      assert.strictEqual(driver.stopReason, "exception");
    });

    it("marks a breakpoint stop from a leading # marker", async () => {
      const io = attach();
      const p = driver.run("f 5");
      io.data("#0\n  [1]  f:{x+1}\n       ^\nq))");
      const result = await p;
      assert.strictEqual(result.depth, 2);
      assert.strictEqual(driver.stopReason, "breakpoint");
    });

    it("reports no stop reason once back at the top level", async () => {
      const io = attach();
      const p = driver.run(":");
      io.data("29\nq)");
      await p;
      assert.strictEqual(driver.suspended, false);
      assert.strictEqual(driver.stopReason, undefined);
    });
  });

  describe("frames", () => {
    it("parses .Q.bt[] into frames with the current-frame marker", async () => {
      const io = attach();
      const p = driver.frames();
      io.data(
        ">>[1]  /tmp/f.q:2: f:{x+1}\n           ^\n  [0]  f 5\n       ^\nq))",
      );
      const frames = await p;
      assert.strictEqual(frames.length, 2);
      assert.strictEqual(frames[0].current, true);
      assert.strictEqual(frames[0].index, 1);
      assert.strictEqual(frames[0].file, "/tmp/f.q");
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[1].current, false);
      assert.strictEqual(frames[1].index, 0);
    });
  });

  describe("evaluate", () => {
    it("pops back to the original depth after a nested error and restores the stop reason", async () => {
      // Suspended at a breakpoint (depth 2). Evaluating an unassigned local nests
      // another level; evaluate() must unwind with `\` back to depth 2 and keep
      // the original "breakpoint" reason (the eval error is not why we stopped).
      const responder = (chunk: string) =>
        chunk.startsWith("\\") ? "q))" : "'badvar\nq)))";
      const io = attach(responder);
      (driver as any).depth = 2;
      (driver as any).lastStop = "breakpoint";

      const result = await driver.evaluate("badvar");

      assert.strictEqual(result.depth, 2, "unwound back to the breakpoint depth");
      assert.strictEqual(driver.stopReason, "breakpoint");
      assert.ok(
        io.writes.some((w) => w.startsWith("\\")),
        "an abort was sent to pop the nested level",
      );
    });

    it("returns the value without unwinding when the prompt does not deepen", async () => {
      const io = attach(() => "42\nq))");
      (driver as any).depth = 2;
      (driver as any).lastStop = "breakpoint";

      const result = await driver.evaluate("6*7");

      assert.strictEqual(result.output, "42");
      assert.strictEqual(result.depth, 2);
      assert.ok(
        !io.writes.some((w) => w.startsWith("\\")),
        "no abort is needed when the level did not change",
      );
    });
  });

  describe("dispose", () => {
    it("disposes the terminal, clears the process, and rejects further commands", async () => {
      attach();
      const disposeSpy = sinon.spy();
      (driver as any).terminal = { dispose: disposeSpy };

      driver.dispose();

      assert.ok(disposeSpy.calledOnce);
      assert.strictEqual((driver as any).proc, undefined);
      // A command issued after dispose must reject rather than hang forever.
      await assert.rejects(driver.run("2+2"), /not running/);
    });
  });
});
