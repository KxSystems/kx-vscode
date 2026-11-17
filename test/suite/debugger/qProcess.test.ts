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

import * as assert from "assert";
import * as sinon from "sinon";

import { qAvailable } from "./dapClient";
import { FakeChild, loadQProcess } from "./fakeChild";
import { QProcess } from "../../../src/debugger/qProcess";
import { getEnvironment } from "../../../src/utils/core";

describe("QProcess", function () {
  this.timeout(30000);

  let proc: QProcess | undefined;

  function spawnQ(): QProcess {
    const { qBinPath, ...env } = getEnvironment();
    return new QProcess(qBinPath, [], undefined, env);
  }

  before(function () {
    if (!qAvailable()) this.skip();
  });

  afterEach(() => {
    proc?.kill();
    proc = undefined;
  });

  it("interrupts a command blocked in a child process", async () => {
    proc = spawnQ();
    await proc.ready;

    const started = Date.now();
    const blocked = proc.sendCommand('system"sleep 20"', false, false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    proc.interrupt();
    const result = await blocked;
    assert.ok(Date.now() - started < 5000);
    assert.strictEqual(result.errored, true);

    const next = await proc.sendCommand("1+1", false, false);
    assert.strictEqual(next.output, "2");
  });

  it("keeps replies in step with a line typed while q is busy", async () => {
    proc = spawnQ();
    await proc.ready;
    const shown: string[] = [];
    proc.on("data", (text: string) => shown.push(text));

    const running = proc.sendCommand('system"sleep 1"; 8', false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    proc.write("1+1\n");
    assert.strictEqual((await running).output, "8");
    assert.strictEqual((await proc.sendCommand("10+10", false)).output, "20");
    assert.strictEqual((await proc.sendCommand("20+20", false)).output, "40");
    assert.strictEqual(shown.join(""), "2\nq)");
  });

  it("hands a line typed while busy to the read0 that waits for it", async () => {
    proc = spawnQ();
    await proc.ready;
    const running = proc.sendCommand('system"sleep 1"; x:read0 0', false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    proc.write("hello\n");
    await running;
    assert.strictEqual((await proc.sendCommand("x", false)).output, '"hello"');
  });

  it("does not hang when a typed line reads the input itself", async () => {
    proc = spawnQ();
    await proc.ready;
    const running = proc.sendCommand('system"sleep 1"; 8', false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    proc.write("y:read0 0\n");
    assert.strictEqual((await running).output, "8");
    assert.strictEqual((await proc.sendCommand("1+1", false)).output, "2");
  });

  it("reports the state a typed line leaves behind", async () => {
    proc = spawnQ();
    await proc.ready;
    const running = proc.sendCommand('f:{system"sleep 1"; x+1}; f`a', false);
    await new Promise((resolve) => setTimeout(resolve, 300));
    proc.write("\\\n");
    assert.strictEqual((await running).depth, 1);
    assert.strictEqual(proc.suspended, false);
  });
});

describe("QProcess without q", () => {
  let loaded: ReturnType<typeof loadQProcess>;
  let child: FakeChild;
  let proc: InstanceType<typeof loaded.module.QProcess>;

  function start(...args: string[]) {
    proc = new loaded.module.QProcess("/opt/q", args, "/work", { A: "1" });
    child = loaded.children[loaded.children.length - 1];
    return proc;
  }

  async function started() {
    start();
    child.out("KDB-X banner\nq)");
    await proc.ready;
  }

  function reply(text: string) {
    return new Promise<void>((resolve) => setImmediate(resolve)).then(() =>
      child.out(text),
    );
  }

  beforeEach(() => {
    loaded = loadQProcess();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("starts q through bash with its arguments quoted and the pipe environment", () => {
    start("-p", "it's");
    const [command, options] = loaded.spawn.firstCall.args;
    assert.strictEqual(command, "exec '/opt/q' '-p' 'it'\\''s' 2>&1");
    assert.strictEqual(options.shell, "bash");
    assert.strictEqual(options.detached, process.platform !== "win32");
    assert.strictEqual(options.cwd, "/work");
    assert.strictEqual(options.env.A, "1");
    assert.strictEqual(options.env.KX_TTY, "1");
    assert.strictEqual(options.env.KX_LINE, "0");
  });

  it("is ready at the first prompt and sends nothing for it", async () => {
    await started();
    assert.deepStrictEqual(child.stdin.written, []);
    assert.strictEqual(proc.promptDepth, 1);
    assert.strictEqual(proc.suspended, false);
    assert.strictEqual(proc.busy, false);
  });

  it("resolves a command with its output up to the next prompt", async () => {
    await started();
    const result = proc.sendCommand("1+1");
    assert.strictEqual(proc.busy, true);
    await reply("\n2\n\nq)");
    assert.deepStrictEqual(await result, {
      output: "2",
      depth: 1,
      namespace: "",
      errored: false,
    });
    assert.deepStrictEqual(child.lines, ["1+1"]);
  });

  it("runs queued commands one at a time", async () => {
    await started();
    const first = proc.sendCommand("a");
    const second = proc.sendCommand("b");
    assert.deepStrictEqual(child.lines, ["a"]);
    await reply("1\nq)");
    assert.strictEqual((await first).output, "1");
    assert.deepStrictEqual(child.lines, ["a", "b"]);
    await reply("2\nq)");
    assert.strictEqual((await second).output, "2");
  });

  it("tracks the namespace and depth of the prompt", async () => {
    await started();
    const result = proc.sendCommand("\\d .foo");
    await reply("q.foo)");
    assert.strictEqual((await result).namespace, ".foo");
    assert.strictEqual(proc.namespace, ".foo");
  });

  it("flags an error result", async () => {
    await started();
    const result = proc.sendCommand("1+`a");
    await reply("'type\nq)");
    const { errored, depth } = await result;
    assert.strictEqual(errored, true);
    assert.strictEqual(depth, 1);
    assert.strictEqual(proc.stopReason, undefined);
    assert.strictEqual(proc.errorMessage, undefined);
  });

  it("reports a breakpoint stop from its marker and frame line", async () => {
    await started();
    const result = proc.sendCommand("f[]");
    await reply("#1\n>>[1] f:{x}\n       ^\nq))");
    assert.strictEqual((await result).depth, 2);
    assert.strictEqual(proc.suspended, true);
    assert.strictEqual(proc.stopReason, "breakpoint");
    assert.strictEqual(proc.errorMessage, undefined);
  });

  it("reports an exception stop with its signal", async () => {
    await started();
    const result = proc.sendCommand("f[]");
    await reply("'type \n  [1] f:{x+`a}\n        ^\nq))");
    await result;
    assert.strictEqual(proc.stopReason, "exception");
    assert.strictEqual(proc.errorMessage, "type");
  });

  it("finds a stop marker after output the program printed", async () => {
    await started();
    const result = proc.sendCommand("f[]");
    await reply("hello\n'oops\n>>[0] f\nq))");
    await result;
    assert.strictEqual(proc.stopReason, "exception");
    assert.strictEqual(proc.errorMessage, "oops");
  });

  it("falls back to the first line when there is no frame line", async () => {
    await started();
    const exception = proc.sendCommand("f[]");
    await reply("'length\nmore\nq))");
    await exception;
    assert.strictEqual(proc.stopReason, "exception");
    assert.strictEqual(proc.errorMessage, "length");

    const breakpoint = proc.sendCommand("g[]");
    await reply("#3\nq)))");
    await breakpoint;
    assert.strictEqual(proc.promptDepth, 3);
    assert.strictEqual(proc.stopReason, "breakpoint");
  });

  it("keeps the last stop reason for output without a marker", async () => {
    await started();
    const stop = proc.sendCommand("f[]");
    await reply("#1\n>>[0] f\nq))");
    await stop;
    const local = proc.sendCommand("x");
    await reply("42\nq))");
    await local;
    assert.strictEqual(proc.stopReason, "breakpoint");
    proc.restoreStopReason("exception");
    assert.strictEqual(proc.stopReason, "exception");
  });

  it("echoes output and the prompt by default", async () => {
    await started();
    const data: string[] = [];
    proc.on("data", (text: string) => data.push(text));
    const result = proc.sendCommand("1");
    await reply("1\nq)");
    await result;
    assert.deepStrictEqual(data, ["1\nq)"]);
    assert.strictEqual(proc.atLineStart, false);
  });

  it("echoes output without the prompt when asked", async () => {
    await started();
    const data: string[] = [];
    proc.on("data", (text: string) => data.push(text));
    const result = proc.sendCommand("1", true, false);
    await reply("1\n");
    await reply("q)");
    await result;
    assert.deepStrictEqual(data, ["1\n"]);
    assert.strictEqual(proc.atLineStart, true);
  });

  it("does not echo a silent command unless verbose", async () => {
    await started();
    const data: string[] = [];
    proc.on("data", (text: string) => data.push(text));
    const silent = proc.sendCommand("1", false);
    await reply("1\nq)");
    await silent;
    assert.deepStrictEqual(data, []);

    proc.verbose = true;
    const loud = proc.sendCommand("2", false, false);
    await reply("2\nq)");
    await loud;
    assert.deepStrictEqual(data, ["2\nq)"]);
  });

  it("streams output to a chunk handler instead of echoing it", async () => {
    await started();
    const data: string[] = [];
    const chunks: string[] = [];
    proc.on("data", (text: string) => data.push(text));
    const result = proc.sendCommand("f[]", true, true, (text) =>
      chunks.push(text),
    );
    await reply("a\n");
    await reply("b\nq)");
    await result;
    assert.deepStrictEqual(chunks, ["a\n", "b"]);
    assert.deepStrictEqual(data, []);
  });

  it("waits for a slow command however long it takes", async () => {
    await started();
    const clock = sinon.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });
    const slow = proc.sendCommand("slow");
    clock.tick(60 * 60 * 1000);
    clock.restore();
    await reply("done\nq)");
    assert.strictEqual((await slow).output, "done");
  });

  describe("lines typed while busy", () => {
    function markers() {
      return child.lines.filter((line) => line.startsWith('-1 "kdbdbg-'));
    }

    function marker(n: number) {
      const line = markers()[n - 1];
      assert.ok(line, `marker ${n} was not sent`);
      return line.slice(4, -2);
    }

    it("drains them behind a marker before settling the command", async () => {
      await started();
      const data: string[] = [];
      proc.on("data", (text: string) => data.push(text));
      let settled = false;
      const result = proc.sendCommand("slow", false).then((r) => {
        settled = true;
        return r;
      });
      proc.write("1+1\n");
      await reply("8\nq)");
      assert.strictEqual(settled, false);
      assert.match(markers()[0], /^-1 "kdbdbg-[0-9a-f-]+-1";$/);

      await reply("2\nq)");
      assert.strictEqual(markers().length, 2);
      await reply(`${marker(1)}\nq)`);
      assert.strictEqual(settled, false);
      await reply(`${marker(2)}\nq)`);
      assert.strictEqual((await result).output, "8");
      assert.deepStrictEqual(data, ["2\nq)"]);
    });

    it("ends the command at its own prompt when a typed line's reply follows in the same chunk", async () => {
      await started();
      const data: string[] = [];
      proc.on("data", (text: string) => data.push(text));
      const result = proc.sendCommand("slow", false);
      proc.write("1+1\n");
      await reply("8\nq)2\nq)");
      assert.strictEqual(markers().length, 2);
      await reply(`${marker(1)}\nq)${marker(2)}\nq)`);
      assert.strictEqual((await result).output, "8");
      assert.deepStrictEqual(data, ["2\nq)"]);
    });

    it("settles at once when nothing was typed", async () => {
      await started();
      const result = proc.sendCommand("1");
      await reply("1\nq)");
      assert.strictEqual((await result).output, "1");
      assert.deepStrictEqual(markers(), []);
    });

    it("sends a fresh marker when a typed line swallows one", async () => {
      await started();
      const result = proc.sendCommand("slow", false);
      proc.write("y:read0 0\n");
      await reply("8\nq)");
      await reply("q)");
      assert.strictEqual(markers().length, 2);
      await reply(`${marker(2)}\nq)`);
      assert.strictEqual((await result).output, "8");
    });

    it("keeps draining while more is typed", async () => {
      await started();
      const result = proc.sendCommand("slow", false);
      proc.write("a\n");
      await reply("8\nq)");
      proc.write("b\n");
      await reply(`1\nq)${marker(1)}\nq)`);
      assert.strictEqual(markers().length, 2);
      await reply(`2\nq)${marker(2)}\nq)`);
      assert.strictEqual((await result).output, "8");
      assert.strictEqual(markers().length, 2);
    });

    it("takes the depth and namespace from the last marker's prompt", async () => {
      await started();
      const result = proc.sendCommand("f[]", false);
      proc.write("\\d .foo\n");
      await reply("'type\nq))");
      await reply(`q.foo)${marker(1)}\nq.foo)`);
      const r = await result;
      assert.strictEqual(r.output, "'type");
      assert.strictEqual(r.depth, 1);
      assert.strictEqual(r.namespace, ".foo");
    });

    it("never shows a marker split across chunks", async () => {
      await started();
      const data: string[] = [];
      proc.on("data", (text: string) => data.push(text));
      const result = proc.sendCommand("slow", false);
      proc.write("x\n");
      await reply("8\nq)");
      const text = `${marker(1)}\nq)`;
      await reply(text.slice(0, 10));
      await reply(text.slice(10, -1));
      await reply(text.slice(-1));
      assert.strictEqual((await result).output, "8");
      assert.deepStrictEqual(data, []);
    });

    it("does not count a write made while q is idle", async () => {
      await started();
      proc.write("x\n");
      const result = proc.sendCommand("1");
      await reply("1\nq)");
      assert.strictEqual((await result).output, "1");
      assert.deepStrictEqual(markers(), []);
    });
  });

  it("rejects pending commands when q exits, and refuses new ones", async () => {
    await started();
    let code: number | undefined;
    proc.on("exit", (c: number) => (code = c));
    const pending = proc.sendCommand("a");
    child.emit("exit", 3);
    child.emit("exit", 4);
    await assert.rejects(pending, /q process exited/);
    assert.strictEqual(code, 3);
    assert.strictEqual(proc.exited, true);
    await assert.rejects(proc.sendCommand("b"), /not running/);
  });

  it("reports a q that fails to start", async () => {
    start();
    const data: string[] = [];
    let code: number | undefined;
    proc.on("data", (text: string) => data.push(text));
    proc.on("exit", (c: number) => (code = c));
    child.emit("error", new Error("ENOENT"));
    await assert.rejects(proc.ready, /q process exited/);
    assert.deepStrictEqual(data, ["Failed to start q: ENOENT\n"]);
    assert.strictEqual(code, 0);
  });

  it("writes raw text and interrupts with SIGINT", async () => {
    await started();
    proc.write("line\n");
    proc.interrupt();
    assert.deepStrictEqual(child.stdin.written, ["line\n"]);
    assert.deepStrictEqual(child.signals, ["SIGINT"]);
  });

  it("signals the whole process group so children are interrupted too", async function () {
    if (process.platform === "win32") this.skip();
    await started();
    child.pid = 42;
    const kill = sinon.stub(process, "kill").returns(true);
    proc.interrupt();
    sinon.assert.calledOnceWithExactly(kill, -42, "SIGINT");
    assert.deepStrictEqual(child.signals, []);
  });

  it("signals q alone when its process group cannot be signalled", async function () {
    if (process.platform === "win32") this.skip();
    await started();
    child.pid = 42;
    sinon.stub(process, "kill").throws(new Error("ESRCH"));
    proc.interrupt();
    assert.deepStrictEqual(child.signals, ["SIGINT"]);
  });

  it("escalates a plain kill to SIGKILL when q does not exit", async () => {
    const clock = sinon.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });
    try {
      start();
      proc.kill();
      clock.tick(300);
      assert.deepStrictEqual(child.signals, ["SIGTERM", "SIGKILL"]);
    } finally {
      clock.restore();
    }
  });

  it("does not escalate once q has exited, nor kill it again", async () => {
    const clock = sinon.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
    });
    try {
      start();
      proc.ready.catch(() => undefined);
      proc.kill();
      child.emit("exit", 0);
      clock.tick(300);
      proc.kill("SIGTERM");
      assert.deepStrictEqual(child.signals, ["SIGTERM"]);
    } finally {
      clock.restore();
    }
  });

  it("strips a trailing prompt from text", () => {
    assert.strictEqual(loaded.module.stripPrompt("abc\nq))"), "abc");
    assert.strictEqual(loaded.module.stripPrompt('"x"q)'), '"x"');
    assert.strictEqual(loaded.module.stripPrompt("abc"), "abc");
  });
});
