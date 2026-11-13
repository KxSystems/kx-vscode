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
import proxyquire from "proxyquire";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { FIXTURES, qAvailable } from "./dapClient";
import { loadQProcess } from "./fakeChild";
import * as setupCommand from "../../../src/commands/setupCommand";
import {
  DebugTerminal,
  getOrCreateDebugTerminal,
  killDebugTerminal,
} from "../../../src/debugger/debugTerminal";
import * as core from "../../../src/utils/core";
import * as replPath from "../../../src/utils/replPath";

const ENTER = "\r";
const BACKSPACE = "\x7f";
const CTRL_C = "\x03";
const ESC = "\x1b";

describe("DebugPty", function () {
  this.timeout(30000);

  let session: DebugTerminal;
  let pty: vscode.Pseudoterminal;
  let output: string;
  let listener: vscode.Disposable;

  async function waitForOutput(substring: string, timeoutMs = 10000) {
    const start = Date.now();
    while (!output.includes(substring)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `timed out waiting for terminal output to include ${JSON.stringify(
            substring,
          )}; got ${JSON.stringify(output)}`,
        );
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  before(function () {
    if (!qAvailable()) this.skip();
  });

  beforeEach(async () => {
    killDebugTerminal();
    session = getOrCreateDebugTerminal(FIXTURES);
    pty = (session.terminal.creationOptions as vscode.ExtensionTerminalOptions)
      .pty;
    output = "";
    listener = pty.onDidWrite((data) => {
      output += data;
    });
    await session.ready;
    await waitForOutput("q)");
  });

  afterEach(async () => {
    sinon.restore();
    listener.dispose();
    const exit = session.process.exited
      ? Promise.resolve()
      : new Promise<void>((resolve) =>
          session.process.once("exit", () => resolve()),
        );
    killDebugTerminal();
    await exit;
  });

  it("echoes typed input locally and sends the completed line to q", async () => {
    pty.handleInput("1+1" + ENTER);
    await waitForOutput("1+1");
    await waitForOutput("2");
  });

  it("backspace erases the last echoed character before it's sent", async () => {
    pty.handleInput("a:12" + BACKSPACE);
    await waitForOutput("a:12\b \b");
    pty.handleInput(ENTER);

    pty.handleInput("a" + ENTER);
    await waitForOutput("1\r\n");
  });

  it("treats a CRLF paste as one line ending, not a line plus an empty line", () => {
    const sent: string[] = [];
    sinon.stub(session.process, "sendCommand").callsFake((cmd: string) => {
      sent.push(cmd);
      return Promise.resolve({
        output: "",
        depth: 1,
        namespace: "",
        errored: false,
      });
    });

    pty.handleInput("a:1\r\nb:2\r\n");
    assert.deepStrictEqual(sent, ["a:1", "b:2"]);
  });

  it("drops a multi-byte escape sequence without echoing it", async () => {
    pty.handleInput("x");
    await waitForOutput("x");
    const before = output;

    pty.handleInput(ESC + "[A");
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(output, before);
  });

  it("Ctrl+C interrupts without killing the underlying q process", async () => {
    pty.handleInput(CTRL_C);
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(session.process.exited, false);

    pty.handleInput("21+21" + ENTER);
    await waitForOutput("42");
  });

  it("feeds a line typed mid-execution straight to a blocked read0, instead of deadlocking behind it", async () => {
    pty.handleInput("x:read0 0" + ENTER);
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(session.process.busy, true);

    pty.handleInput("hello world" + ENTER);
    const start = Date.now();
    while (session.process.busy) {
      if (Date.now() - start > 5000) {
        throw new Error("still busy - read0 was never unblocked");
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    pty.handleInput("show x" + ENTER);
    await waitForOutput('"hello world"');
  });
});

describe("DebugTerminal without q", () => {
  let loaded: ReturnType<typeof loadQProcess>;
  let terminalModule: typeof import("../../../src/debugger/debugTerminal");
  let environment: sinon.SinonStub;
  let showSetupError: sinon.SinonStub;
  let created: vscode.ExtensionTerminalOptions[];
  let written: string;
  let closed: number[];

  function open(cwd = "/work", executable?: string) {
    const session = terminalModule.getOrCreateDebugTerminal(cwd, executable);
    const options = created[created.length - 1];
    return { session, pty: options.pty, child: loaded.children.at(-1)! };
  }

  function listen(pty: vscode.Pseudoterminal) {
    pty.onDidWrite((text) => (written += text));
    pty.onDidClose!((code) => closed.push(code as number));
  }

  beforeEach(() => {
    loaded = loadQProcess();
    created = [];
    written = "";
    closed = [];
    environment = sinon.stub(core, "getEnvironment").returns({
      qBinPath: "/q/bin/q",
      qBinKdbX: "true",
      QHOME: "/q",
    });
    sinon.stub(replPath, "moduleSearchPath").returns("/mods");
    showSetupError = sinon.stub(setupCommand, "showSetupError").resolves();
    sinon.stub(vscode.window, "createTerminal").callsFake(((
      options: vscode.ExtensionTerminalOptions,
    ) => {
      created.push(options);
      return { show() {}, dispose() {} } as unknown as vscode.Terminal;
    }) as never);
    terminalModule = proxyquire.noPreserveCache()(
      "../../../src/debugger/debugTerminal",
      { "./qProcess": loaded.module },
    );
  });

  afterEach(() => {
    terminalModule.killDebugTerminal();
    sinon.restore();
  });

  it("refuses to start without a q and offers the setup", () => {
    environment.returns({ qBinPath: "", qBinKdbX: "" });
    assert.throws(
      () => terminalModule.getOrCreateDebugTerminal("/work"),
      /no q was found/,
    );
    sinon.assert.calledOnce(showSetupError);
    assert.strictEqual(loaded.spawn.callCount, 0);
  });

  it("starts q in a transient q Debug terminal with the module search path", () => {
    const { session } = open();
    assert.strictEqual(created[0].name, "q Debug");
    assert.strictEqual(created[0].isTransient, true);
    assert.strictEqual(session.cwd, "/work");
    assert.strictEqual(session.executable, "/q/bin/q");
    const [command, options] = loaded.spawn.firstCall.args;
    assert.ok(command.includes("'/q/bin/q'"));
    assert.strictEqual(options.cwd, "/work");
    assert.strictEqual(options.env.QPATH, "/mods");
    assert.strictEqual(options.env.qBinPath, undefined);
  });

  it("leaves the module search path alone for a q that is not KDB-X", () => {
    environment.returns({ qBinPath: "/q/bin/q", qBinKdbX: "", QPATH: "/x" });
    open();
    assert.strictEqual(loaded.spawn.firstCall.args[1].env.QPATH, "/x");
  });

  it("prefers the executable the launch names", () => {
    const { session } = open("/work", "/other/q");
    assert.strictEqual(session.executable, "/other/q");
  });

  it("reuses the running session for the same folder and q", () => {
    const first = open().session;
    const second = open().session;
    assert.strictEqual(first, second);
    assert.strictEqual(loaded.spawn.callCount, 1);
  });

  it("replaces the session for another folder, killing the old q", () => {
    const first = open();
    const second = open("/elsewhere");
    assert.notStrictEqual(first.session, second.session);
    assert.deepStrictEqual(first.child.signals, [undefined]);
  });

  it("starts a new session once q has exited", () => {
    const first = open();
    first.child.emit("exit", 0);
    const second = open();
    assert.notStrictEqual(first.session, second.session);
  });

  it("forgets the session when killed", () => {
    const first = open();
    terminalModule.killDebugTerminal();
    assert.deepStrictEqual(first.child.signals, [undefined]);
    assert.notStrictEqual(open().session, first.session);
  });

  it("holds output until the terminal opens, then writes it with CRLF", () => {
    const { pty, child } = open();
    listen(pty);
    child.out("hello\nq)");
    assert.strictEqual(written, "");
    pty.open(undefined);
    assert.strictEqual(written, "hello\r\nq)");
    child.out("a\r\nb\n");
    assert.strictEqual(written, "hello\r\nq)a\r\nb\r\n");
  });

  it("closes the terminal with the exit code of q, and kills q when closed", () => {
    const { pty, child } = open();
    listen(pty);
    pty.close();
    assert.deepStrictEqual(child.signals, [undefined]);
    child.emit("exit", 2);
    assert.deepStrictEqual(closed, [2]);
  });

  it("echoes typed characters and sends the line on Enter", async () => {
    const { session, pty, child } = open();
    listen(pty);
    pty.open(undefined);
    child.out("q)");
    await session.ready;
    pty.handleInput!("1+1\r");
    assert.strictEqual(written, "q)1+1\r\n");
    assert.deepStrictEqual(child.lines, ["1+1"]);
  });

  it("erases with backspace, but not past the start of the line", async () => {
    const { session, pty, child } = open();
    listen(pty);
    pty.open(undefined);
    child.out("q)");
    await session.ready;
    pty.handleInput!("ab\x7f\x7f\x7f\n");
    assert.strictEqual(written, "q)ab\b \b\b \b\r\n");
    assert.deepStrictEqual(child.lines, [""]);
  });

  it("treats CRLF as a single line ending", async () => {
    const { session, pty, child } = open();
    listen(pty);
    child.out("q)");
    await session.ready;
    pty.handleInput!("a\r\n");
    child.out("q)");
    await new Promise((r) => setImmediate(r));
    pty.handleInput!("b\r\n");
    assert.deepStrictEqual(child.lines, ["a", "b"]);
  });

  it("feeds a line straight to q while a command is running", async () => {
    const { session, pty, child } = open();
    child.out("q)");
    await session.ready;
    void session.process.sendCommand("read0 0").catch(() => undefined);
    pty.handleInput!("typed\r");
    assert.deepStrictEqual(child.stdin.written, ["read0 0\n", "typed\n"]);
  });

  it("interrupts on Ctrl+C and drops escape sequences", () => {
    const { pty, child } = open();
    listen(pty);
    pty.open(undefined);
    pty.handleInput!("\x03");
    pty.handleInput!("\x1b[A");
    assert.deepStrictEqual(child.signals, ["SIGINT"]);
    assert.strictEqual(written, "");
  });

  it("ignores input once q has exited", () => {
    const { pty, child } = open();
    listen(pty);
    pty.open(undefined);
    child.emit("exit", 0);
    pty.handleInput!("x\r");
    assert.strictEqual(written, "");
    assert.deepStrictEqual(child.stdin.written, []);
  });
});
