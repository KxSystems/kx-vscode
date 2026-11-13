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
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import * as sinon from "sinon";

import { QDebugSession } from "../../../src/debugger/debugSession";
import * as debugTerminal from "../../../src/debugger/debugTerminal";
import type { QFrame } from "../../../src/debugger/qBacktrace";

type Handler = string | ((command: string) => string | undefined);

class StubDriver extends EventEmitter {
  public verbose = false;
  public atLineStart = true;
  public exited = false;
  public busy = false;
  public namespace = "";
  public promptDepth = 1;
  public stopReason: "breakpoint" | "exception" | undefined;
  public errorMessage: string | undefined;
  public ready = Promise.resolve();
  public readonly commands: string[] = [];
  public readonly data: string[] = [];
  public readonly restoreStopReason = sinon.spy(
    (reason: "breakpoint" | "exception" | undefined) => {
      this.stopReason = reason;
    },
  );
  public readonly kill = sinon.spy();
  private readonly handlers: [RegExp, Handler][] = [];

  public constructor() {
    super();
    this.on("data", (text: string) => this.data.push(text));
  }

  public get suspended(): boolean {
    return this.promptDepth >= 2;
  }

  public on2(pattern: RegExp, handler: Handler): this {
    this.handlers.unshift([pattern, handler]);
    return this;
  }

  public async sendCommand(
    command: string,
    _echo?: boolean,
    _echoPrompt?: boolean,
    _timeout?: number,
    onChunk?: (text: string) => void,
  ) {
    if (this.exited) throw new Error("q process is not running");
    this.commands.push(command);
    const match = this.handlers.find(([pattern]) => pattern.test(command));
    const handler = match?.[1];
    const output =
      (typeof handler === "function" ? handler(command) : handler) ?? "";
    if (onChunk && output.length > 0) onChunk(output);
    return {
      output,
      depth: this.promptDepth,
      namespace: this.namespace,
      errored: output.startsWith("'"),
    };
  }
}

function response(command = "test"): any {
  return {
    seq: 0,
    type: "response",
    request_seq: 1,
    command,
    success: true,
  };
}

function frame(partial: Partial<QFrame>): QFrame {
  return { index: 0, text: "", current: false, block: [], ...partial };
}

describe("QDebugSession methods", () => {
  const program = join(
    __dirname,
    "../../../../test/suite/server/fixtures/debugger/hello.q",
  );
  let session: QDebugSession;
  let s: any;
  let driver: StubDriver;
  let requests: sinon.SinonStub;
  let client: { sendRequest: sinon.SinonStub } | undefined;
  let messages: any[];
  let show: sinon.SinonSpy;

  function events(name: string) {
    return messages.filter((m) => m.type === "event" && m.event === name);
  }

  function responses() {
    return messages.filter((m) => m.type === "response");
  }

  function answer(method: string, value: unknown) {
    requests.withArgs(method).resolves(value);
  }

  beforeEach(() => {
    requests = sinon
      .stub()
      .callsFake(async (method: string) =>
        method === "kdb.qls.lambdaPath" ? null : [],
      );
    client = { sendRequest: requests };
    session = new QDebugSession(() => client as any, "/helper.q");
    s = session as any;
    messages = [];
    session.onDidSendMessage((m) => messages.push(m));
    driver = new StubDriver();
    show = sinon.spy();
    s.driver = driver;
    s.debugTerminal = { terminal: { show } };
    s.programPath = program;
    s.programCwd = join(program, "..");
    s.tempDir = mkdtempSync(join(tmpdir(), "kdb-debug-"));
  });

  afterEach(async () => {
    sinon.restore();
    session.dispose();
  });

  describe("requests", () => {
    it("advertises its capabilities and signals initialized", () => {
      s.initializeRequest(response());
      const [reply] = responses();
      assert.strictEqual(reply.body.supportsConfigurationDoneRequest, true);
      assert.strictEqual(reply.body.exceptionBreakpointFilters.length, 1);
      assert.strictEqual(events("initialized").length, 1);
    });

    it("reports a single thread and accepts exception filters", () => {
      s.threadsRequest(response());
      s.setExceptionBreakPointsRequest(response());
      assert.strictEqual(responses()[0].body.threads.length, 1);
      assert.strictEqual(responses().length, 2);
    });

    it("answers an error response when a request handler fails", async () => {
      s.respond(response(), () => Promise.reject(new Error("boom")));
      await new Promise((r) => setImmediate(r));
      assert.strictEqual(responses()[0].success, false);
      assert.ok(responses()[0].message.includes("boom"));
    });

    it("verifies breakpoints in functions and on statements only", async () => {
      requests.callsFake(async (method: string, params: any) => {
        if (method === "kdb.qls.lambdaPath") {
          return params.line === 1
            ? { name: "f", path: [0], startLine: 1, rootLine: 0 }
            : null;
        }
        if (method === "kdb.qls.topLevelStatements") {
          return [
            {
              startLine: 4,
              startChar: 0,
              endLine: 4,
              text: "x",
              namespace: "",
            },
          ];
        }
        return null;
      });
      await s.onSetBreakPoints(response(), {
        source: { path: program },
        breakpoints: [{ line: 2 }, { line: 5 }, { line: 9 }],
      });
      const { breakpoints } = responses()[0].body;
      assert.deepStrictEqual(
        breakpoints.map((b: any) => b.verified),
        [true, true, false],
      );
      assert.ok(breakpoints[2].message);
    });

    it("arms new breakpoints straight away while suspended", async () => {
      driver.promptDepth = 2;
      answer("kdb.qls.lambdaPath", {
        name: "f",
        path: [],
        startLine: 0,
        rootLine: 0,
      });
      answer("kdb.qls.topLevelStatements", []);
      await s.onSetBreakPoints(response(), {
        source: { path: "/other.q" },
        breakpoints: [{ line: 1 }],
      });
      await s.pendingOp;
      assert.ok(driver.commands.some((c) => c.startsWith(".dbg.bkname")));
    });

    it("tolerates a breakpoint request without a source path", async () => {
      await s.onSetBreakPoints(response(), { source: {} });
      assert.deepStrictEqual(responses()[0].body.breakpoints, []);
    });

    it("launches the debug helper in the debug terminal", async () => {
      s.driver = undefined;
      sinon.stub(debugTerminal, "getOrCreateDebugTerminal").returns({
        process: driver as any,
        terminal: { show } as any,
        ready: Promise.resolve(),
        cwd: "/w",
        executable: "q",
      });
      await s.onLaunch(response(), { program, verboseTrace: true });
      assert.ok(driver.commands.includes("\\l /helper.q"));
      assert.strictEqual(driver.verbose, true);
      assert.strictEqual(responses()[0].success, true);
      sinon.assert.calledWith(show, true);

      driver.emit("exit", 3);
      assert.strictEqual(events("terminated").length, 1);
      assert.strictEqual(events("exited")[0].body.exitCode, 3);
      await (QDebugSession as any).releasing;
    });

    it("fails the launch when the terminal cannot start q", async () => {
      sinon
        .stub(debugTerminal, "getOrCreateDebugTerminal")
        .throws(new Error("no q"));
      await s.onLaunch(response(), { program });
      assert.strictEqual(responses()[0].success, false);
      assert.ok(responses()[0].message.includes("no q"));
    });

    it("fails the launch when q has already exited", async () => {
      driver.exited = true;
      sinon.stub(debugTerminal, "getOrCreateDebugTerminal").returns({
        process: driver as any,
        terminal: { show } as any,
        ready: Promise.resolve(),
        cwd: "/w",
        executable: "q",
      });
      await s.onLaunch(response(), { program, cwd: "/w" });
      assert.ok(responses()[0].message.includes("not running"));
    });

    it("cancels the previous session on a new launch", async () => {
      const previous = new QDebugSession(() => undefined, "/helper.q");
      (QDebugSession as any).current = previous;
      sinon
        .stub(debugTerminal, "getOrCreateDebugTerminal")
        .throws(new Error("x"));
      await s.onLaunch(response(), { program });
      assert.strictEqual((previous as any).cancelled, true);
      assert.strictEqual(QDebugSession.activeSession, session);
      previous.dispose();
    });

    it("runs once configured", async () => {
      const tryRun = sinon.stub(s, "tryRun").resolves();
      s.configurationDoneRequest(response());
      assert.strictEqual(s.configDone, true);
      sinon.assert.calledOnce(tryRun);
    });

    it("forwards stepping requests", async () => {
      const resume = sinon.stub(s, "resume").resolves();
      const stepStatement = sinon.stub(s, "stepStatement").resolves();
      const stepInto = sinon.stub(s, "stepInto").resolves();
      const stepOut = sinon.stub(s, "stepOut").resolves();
      await s.onContinue(response());
      await s.onNext(response());
      await s.onStepIn(response());
      await s.onStepOut(response());
      sinon.assert.calledOnce(resume);
      sinon.assert.calledOnce(stepStatement);
      sinon.assert.calledOnce(stepInto);
      sinon.assert.calledOnce(stepOut);
      assert.strictEqual(responses().length, 4);
    });

    it("terminates and disconnects by releasing q", async () => {
      const release = sinon.stub(s, "release").resolves();
      s.terminateRequest(response());
      s.disconnectRequest(response());
      assert.strictEqual(events("terminated").length, 1);
      sinon.assert.calledTwice(release);
    });

    it("serves the text of a virtual source", () => {
      s.virtualSourceText.set(4, "{x}");
      s.sourceRequest(response(), { sourceReference: 4 });
      s.sourceRequest(response(), { source: { sourceReference: 9 } });
      assert.strictEqual(responses()[0].body.content, "{x}");
      assert.strictEqual(responses()[1].body.content, "");
    });

    it("offers globals at the top level and locals in a frame", () => {
      s.topLevelPaused = { startLine: 1 };
      s.scopesRequest(response(), { frameId: 0 });
      s.topLevelPaused = undefined;
      s.scopesRequest(response(), { frameId: 2 });
      assert.strictEqual(responses()[0].body.scopes[0].name, "Globals");
      assert.strictEqual(
        responses()[1].body.scopes[0].variablesReference,
        1002,
      );
    });
  });

  describe("stack traces", () => {
    it("shows a single top-level frame while paused between statements", () => {
      s.topLevelPaused = { startLine: 3, startColumn: 0 };
      s.stackTraceRequest(response());
      const [top] = responses()[0].body.stackFrames;
      assert.strictEqual(top.name, "<top level>");
      assert.strictEqual(top.line, 3);
      assert.strictEqual(top.source.path, program);
    });

    it("shows a subtle top-level frame without a program", () => {
      s.programPath = "";
      s.topLevelPaused = { startLine: 3, startColumn: 0 };
      s.stackTraceRequest(response());
      assert.strictEqual(
        responses()[0].body.stackFrames[0].presentationHint,
        "subtle",
      );
    });

    it("maps frames to files, virtual sources and the current column", () => {
      s.currentFrames = [
        frame({
          index: 2,
          text: "f:{x}",
          file: "/a.q",
          line: 4,
          current: true,
        }),
        frame({ index: 1, text: "g:{x}", line: 7 }),
        frame({ index: 0, text: ".dbg.a0:{x}", file: "/b.q", line: 1 }),
        frame({ index: 3, text: "plain" }),
      ];
      s.frameVirtual.set(1, { ref: 5, line: 2 });
      s.currentMarker = { line: 4, col: 3 };
      s.stackTraceRequest(response());
      const frames = responses()[0].body.stackFrames;
      assert.deepStrictEqual(
        frames.map((f: any) => f.name),
        ["f", "g", "<lambda>", "plain"],
      );
      assert.strictEqual(frames[0].column, 4);
      assert.strictEqual(frames[1].source.sourceReference, 5);
      assert.strictEqual(frames[1].line, 2);
      assert.strictEqual(frames[3].presentationHint, "subtle");
    });
  });

  describe("variables and evaluation", () => {
    it("reads the globals at the top level", async () => {
      s.topLevelPaused = { startLine: 1 };
      driver
        .on2(/^\.dbg\.globalNames/, '["a","","b"]')
        .on2(/^\.dbg\.vals/, '{"a":1,"b":"x"}');
      await s.onVariables(response(), { variablesReference: 999 });
      assert.deepStrictEqual(
        responses()[0].body.variables.map((v: any) => [v.name, v.value]),
        [
          ["a", "1"],
          ["b", "x"],
        ],
      );
    });

    it("reads no globals once the pause has ended", async () => {
      await s.onVariables(response(), { variablesReference: 999 });
      assert.deepStrictEqual(responses()[0].body.variables, []);
    });

    it("reads the locals of a frame, one by one when they cannot be read together", async () => {
      driver.promptDepth = 2;
      s.currentFrames = [
        frame({ index: 1, text: "f:{x}", file: "/a.q", line: 1 }),
      ];
      s.qCurrentIndex = 1;
      answer("kdb.qls.lambdaPath", {
        name: "f",
        path: [],
        startLine: 0,
        rootLine: 0,
      });
      driver
        .on2(/^\.dbg\.locals/, '["x","y",""]')
        .on2(/^\.dbg\.vals/, "'type")
        .on2(/^x$/, "1")
        .on2(/^y$/, "'y");
      await s.onVariables(response(), { variablesReference: 1001 });
      assert.deepStrictEqual(
        responses()[0].body.variables.map((v: any) => v.value),
        ["1", "<error>"],
      );
    });

    it("reads nothing for an unknown frame or a frame with no locals", async () => {
      driver.promptDepth = 2;
      s.currentFrames = [frame({ index: 1, text: "{x}" })];
      await s.onVariables(response(), { variablesReference: 1009 });
      await s.onVariables(response(), { variablesReference: 1001 });
      assert.deepStrictEqual(responses()[0].body.variables, []);
      assert.deepStrictEqual(responses()[1].body.variables, []);
    });

    it("answers an empty expression with nothing", async () => {
      await s.onEvaluate(response(), { expression: "  " });
      assert.strictEqual(responses()[0].body.result, "");
      assert.deepStrictEqual(driver.commands, []);
    });

    it("never evaluates an unsafe hover", async () => {
      await s.onEvaluate(response(), { expression: "f[]", context: "hover" });
      assert.strictEqual(responses()[0].body.result, "");
      assert.deepStrictEqual(driver.commands, []);
    });

    it("hovers a global at the top level, qualified by the namespace", async () => {
      s.topLevelPaused = { startLine: 1 };
      s.currentNamespace = ".foo";
      driver
        .on2(/^\.dbg\.globalNames/, '[".foo.a"]')
        .on2(/^\.dbg\.vals/, '{".foo.a":7}');
      await s.onEvaluate(response(), { expression: "a", context: "hover" });
      await s.onEvaluate(response(), { expression: "zz", context: "hover" });
      assert.strictEqual(responses()[0].body.result, "7");
      assert.strictEqual(responses()[1].body.result, "");
    });

    it("hovers a local in a frame", async () => {
      driver.promptDepth = 2;
      s.currentFrames = [frame({ index: 0, text: "f:{x}" })];
      driver
        .on2(/^\.dbg\.locals/, '["x"]')
        .on2(/^\.dbg\.globalNames/, "[]")
        .on2(/^\.dbg\.vals/, '{"x":3}');
      await s.onEvaluate(response(), {
        expression: "x",
        context: "hover",
        frameId: 0,
      });
      await s.onEvaluate(response(), {
        expression: "x",
        context: "hover",
        frameId: 8,
      });
      await s.onEvaluate(response(), { expression: "x", context: "hover" });
      assert.strictEqual(responses()[0].body.result, "3");
      assert.strictEqual(responses()[1].body.result, "");
      assert.strictEqual(responses()[2].body.result, "");
    });

    it("evaluates at the top level", async () => {
      s.topLevelPaused = { startLine: 1 };
      driver.on2(/^1\+1$/, "2\n");
      await s.onEvaluate(response(), { expression: "1+1" });
      assert.strictEqual(responses()[0].body.result, "2");
    });

    it("refuses to evaluate when not paused", async () => {
      await s.onEvaluate(response(), { expression: "1+1" });
      assert.strictEqual(responses()[0].success, false);
    });

    it("refuses to evaluate when q fails at the top level", async () => {
      s.topLevelPaused = { startLine: 1 };
      driver.exited = true;
      await s.onEvaluate(response(), { expression: "1+1" });
      assert.strictEqual(responses()[0].success, false);
    });

    it("evaluates in a frame, and ends the session if that unwound it", async () => {
      driver.promptDepth = 2;
      s.qCurrentIndex = 1;
      driver.on2(/^`$/, "").on2(/^x$/, () => {
        driver.promptDepth = 1;
        return "5";
      });
      await s.onEvaluate(response(), { expression: "x", frameId: 0 });
      assert.strictEqual(responses()[0].body.result, "5");
      assert.ok(driver.commands.includes("`"));
      assert.strictEqual(events("terminated").length, 1);
    });

    it("refuses to evaluate in a frame when q fails", async () => {
      driver.promptDepth = 2;
      sinon.stub(driver, "sendCommand").rejects(new Error("x"));
      await s.onEvaluate(response(), { expression: "x" });
      assert.strictEqual(responses()[0].success, false);
    });

    it("pops back and restores the stop reason after a nested suspension", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      driver.on2(/^boom$/, () => {
        driver.promptDepth = 3;
        return "'err";
      });
      driver.on2(/^\\$/, () => {
        driver.promptDepth--;
        return "";
      });
      await s.evaluate("boom");
      assert.strictEqual(driver.promptDepth, 2);
      sinon.assert.calledWith(driver.restoreStopReason, "breakpoint");
    });

    it("throws when there is no driver", async () => {
      s.driver = undefined;
      await assert.rejects(s.evaluate("1"), /no active debug session/);
      await assert.rejects(s.continueFromBreakpoint(), /no active/);
      await assert.rejects(s.loadStatement({}), /no active/);
    });
  });

  describe("running statements", () => {
    const statements = [
      { startLine: 1, startChar: 0, endLine: 0, text: "x:6*7", namespace: "" },
      {
        startLine: 1,
        startChar: 0,
        endLine: 1,
        text: '-1 "answer=",string x;',
        namespace: ".foo",
      },
      { startLine: 2, startChar: 0, endLine: 2, text: "x", namespace: "" },
    ];

    it("loads each statement from a temp file and terminates", async () => {
      answer("kdb.qls.topLevelStatements", statements);
      s.launchArgs = { program, args: ["a", 'b"c'] };
      s.started = true;
      s.configDone = true;
      driver
        .on2(/^\.dbg\.wraps/, "1b")
        .on2(/^\.dbg\.pop\[\]$/, "42")
        .on2(/s\d+\.q$/, "hello\n");
      await s.tryRun();
      assert.ok(driver.commands.includes('.z.x:("a";"b\\"c")'));
      assert.ok(driver.commands.includes("\\d .foo"));
      const loads = driver.commands.filter((c) => /^\\l .*s\d+\.q$/.test(c));
      assert.strictEqual(loads.length, 3);
      assert.ok(driver.data.some((d) => d.includes("hello")));
      assert.ok(driver.data.includes("42\n"));
      assert.strictEqual(events("terminated").length, 1);
      await s.tryRun();
      assert.strictEqual(events("terminated").length, 1);
    });

    it("waits until launched and configured", async () => {
      await s.tryRun();
      assert.deepStrictEqual(driver.commands, []);
    });

    it("terminates when the program cannot be read", async () => {
      s.launchArgs = { program: "/missing/prog.q" };
      s.started = true;
      s.configDone = true;
      await s.tryRun();
      assert.ok(events("output")[0].body.output.includes("Cannot read"));
      assert.strictEqual(events("terminated").length, 1);
    });

    it("reports a debugger error and terminates", async () => {
      s.statements = [
        { startLine: 1, startColumn: 0, endLine: 1, text: "x", namespace: "" },
      ];
      sinon.stub(s, "loadStatement").rejects(new Error("bad"));
      await s.runStatements();
      assert.ok(events("output")[0].body.output.includes("bad"));
      assert.strictEqual(events("terminated").length, 1);
    });

    it("stops when cancelled", async () => {
      s.statements = [
        { startLine: 1, startColumn: 0, endLine: 1, text: "x", namespace: "" },
      ];
      s.cancelled = true;
      await s.runStatements();
      assert.strictEqual(events("terminated").length, 0);
      s.driver = undefined;
      await s.runStatements();
    });

    it("pauses on a top-level breakpoint, then steps over it", async () => {
      s.statements = [
        { startLine: 1, startColumn: 0, endLine: 1, text: "a", namespace: "" },
        { startLine: 2, startColumn: 0, endLine: 2, text: "b", namespace: "" },
      ];
      s.requestedBreakpoints.set(program, [1]);
      await s.runStatements();
      assert.strictEqual(events("stopped")[0].body.reason, "breakpoint");
      assert.strictEqual(s.topLevelPaused, s.statements[0]);

      await s.stepStatement();
      assert.strictEqual(events("stopped")[1].body.reason, "step");
      assert.strictEqual(s.topLevelPaused, s.statements[1]);

      await s.stepOut();
      assert.strictEqual(events("terminated").length, 1);
    });

    it("steps into a top-level statement", async () => {
      s.statements = [
        {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          text: "f 1",
          namespace: "",
        },
        { startLine: 2, startColumn: 0, endLine: 2, text: "b", namespace: "" },
      ];
      s.topLevelPaused = s.statements[0];
      answer("kdb.qls.identifiersOnLines", [{ name: "f", canon: ".f" }]);
      driver.on2(/^100h~type/, "1b").on2(/^\.dbg\.bktname/, '"..f"');
      await s.stepInto();
      assert.ok(driver.commands.includes(".dbg.bs[`.f;`long$()]"));
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("steps into a top-level statement that suspends", async () => {
      s.statements = [
        {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          text: "f 1",
          namespace: "",
        },
      ];
      s.topLevelPaused = s.statements[0];
      driver.on2(/s\d+\.q$/, () => {
        driver.promptDepth = 2;
        driver.stopReason = "breakpoint";
        return "";
      });
      await s.stepInto();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("steps into a top-level statement that raises", async () => {
      s.statements = [
        {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          text: "f 1",
          namespace: "",
        },
      ];
      s.topLevelPaused = s.statements[0];
      driver.on2(/s\d+\.q$/, () => {
        driver.promptDepth = 2;
        driver.stopReason = "exception";
        driver.errorMessage = "type";
        return "";
      });
      await s.stepInto();
      assert.strictEqual(events("stopped")[0].body.reason, "exception");
    });

    it("steps into a top-level statement that hits a breakpoint", async () => {
      s.statements = [
        {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          text: "f 1",
          namespace: "",
        },
      ];
      s.topLevelPaused = s.statements[0];
      s.armedTraps.set("f#", { name: "f", descentPath: [] });
      s.requestedBreakpoints.set("/lib.q", [3]);
      answer("kdb.qls.lambdaPath", {
        name: "f",
        path: [],
        startLine: 2,
        rootLine: 0,
      });
      driver.on2(/s\d+\.q$/, () => {
        driver.promptDepth = 2;
        driver.stopReason = "breakpoint";
        return "";
      });
      driver.on2(/^\.Q\.bt\[\]$/, ">>[1]  /lib.q:3: f:{x}");
      driver.on2(/^\.dbg\.bkname/, '"f"');
      await s.stepInto();
      assert.strictEqual(events("stopped")[0].body.reason, "breakpoint");
    });

    it("stops on an exception raised by a statement", async () => {
      s.statements = [
        {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          text: "f 1",
          namespace: "",
        },
      ];
      driver.on2(/s\d+\.q$/, () => {
        driver.promptDepth = 2;
        driver.stopReason = "exception";
        driver.errorMessage = "type";
        return "'type\n  [1]  /a.q:1: f\n";
      });
      driver.on2(
        /^\.Q\.bt\[\]$/,
        `>>[1]  ${program}:1: f:{x}\n         ^\n  [0]  \\l ${s.tempDir}/s0.q`,
      );
      driver.atLineStart = false;
      await s.runStatements();
      assert.strictEqual(events("stopped")[0].body.reason, "exception");
      assert.strictEqual(s.currentFrames.length, 1);
      const report = driver.data.find((d) => d.includes(">>[1]"));
      assert.ok(report?.startsWith("\n"));

      s.exceptionInfoRequest(response());
      const { stackTrace } = responses()[0].body.details;
      assert.ok(stackTrace.startsWith("'type"));
    });

    it("advances to a breakpoint after a statement suspends", async () => {
      s.statements = [
        {
          startLine: 1,
          startColumn: 0,
          endLine: 1,
          text: "f 1",
          namespace: "",
        },
      ];
      s.requestedBreakpoints.set("/lib.q", [5]);
      driver.on2(/s\d+\.q$/, () => {
        driver.promptDepth = 2;
        driver.stopReason = "breakpoint";
        return "";
      });
      driver.on2(/^\.Q\.bt\[\]$/, ">>[1]  /lib.q:4: f:{x}");
      driver.on2(/^>$/, ">>[1]  /lib.q:5: f:{x}");
      await s.runStatements();
      assert.strictEqual(events("stopped")[0].body.reason, "breakpoint");
    });

    it("hoists root lambdas into aliases before loading a statement", async () => {
      const file = join(s.tempDir, "prog.q");
      writeFileSync(file, "r:{x}[1]+{y}[2]\n");
      s.programPath = file;
      s.stepIntoRoots = true;
      answer("kdb.qls.rootLambdas", [
        { line: 0, column: 2, endLine: 0, endColumn: 5 },
        { line: 0, column: 9, endLine: 0, endColumn: 12 },
      ]);
      driver.on2(/a1\.q$/, "'nyi");
      const text = await s.hoistRootLambdas({
        startLine: 1,
        startColumn: 0,
        endLine: 1,
        text: "r:{x}[1]+{y}[2]",
        namespace: "",
      });
      assert.strictEqual(text, "r:{x}[1]+(.dbg.a0)[2]");
      assert.strictEqual(s.anonAliases.get("1:9"), ".dbg.a0");
      assert.strictEqual(s.anonAliases.get("1:2"), undefined);
      assert.ok(driver.commands.includes(".dbg.bs[`.dbg.a0;()]"));
    });

    it("hoists a lambda that spans lines", async () => {
      const file = join(s.tempDir, "prog.q");
      writeFileSync(file, "r:{\n  x\n  }[1]\n");
      s.programPath = file;
      answer("kdb.qls.rootLambdas", [
        { line: 0, column: 2, endLine: 2, endColumn: 3 },
      ]);
      const text = await s.hoistRootLambdas({
        startLine: 1,
        startColumn: 0,
        endLine: 3,
        text: "r:{\n  x\n  }[1]",
        namespace: "",
      });
      assert.strictEqual(text, "r:(.dbg.a0)\n   \n   [1]");
    });

    it("keeps the statement when there is nothing to hoist", async () => {
      const stmt = { startLine: 1, text: "a" };
      assert.strictEqual(await s.hoistRootLambdas(stmt), "a");
      s.programPath = "/missing.q";
      assert.strictEqual(await s.hoistRootLambdas(stmt), "a");
    });

    it("does not capture the value of a statement that cannot have one", async () => {
      assert.strictEqual(await s.capturesValue("a:1;"), false);
      assert.strictEqual(await s.capturesValue("\\l x"), false);
      assert.strictEqual(await s.capturesValue("k)1"), false);
    });

    it("forwards live output until a suspension marker", async () => {
      driver.on2(/s\d+\.q$/, "");
      sinon.stub(driver, "sendCommand").callsFake(async (...args: any[]) => {
        const onChunk = args[4];
        if (onChunk) {
          onChunk("\n\nhel");
          onChunk("lo\n#");
          onChunk("1\n>>[1] f\n");
          onChunk("more\n");
        }
        return { output: "", depth: 1, namespace: "", errored: false };
      });
      await s.loadStatement({
        startLine: 1,
        startColumn: 0,
        endLine: 1,
        text: "a;",
        namespace: "",
      });
      assert.deepStrictEqual(driver.data, ["hel", "lo\n"]);
    });

    it("forwards held output at the end", async () => {
      sinon.stub(driver, "sendCommand").callsFake(async (...args: any[]) => {
        const onChunk = args[4];
        onChunk?.("#1");
        return { output: "", depth: 1, namespace: "", errored: false };
      });
      await s.continueFromBreakpoint();
      assert.deepStrictEqual(driver.data, []);
      s.verboseTrace = true;
      (driver.sendCommand as sinon.SinonStub).callsFake(
        async (...args: any[]) => {
          args[4]?.("a");
          args[4]?.("b");
          args[4]?.("  [x");
          return { output: "", depth: 1, namespace: "", errored: false };
        },
      );
      await s.continueFromBreakpoint();
      assert.deepStrictEqual(driver.data, ["a", "b", "  [x"]);
    });
  });

  describe("resuming", () => {
    it("continues from the top level", async () => {
      s.topLevelPaused = { startLine: 1 };
      const run = sinon.stub(s, "runStatements").resolves();
      await s.resume();
      sinon.assert.calledOnce(run);
    });

    it("aborts an exception and continues", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "exception";
      driver.on2(/^\\$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      const run = sinon.stub(s, "runStatements").resolves();
      await s.resume();
      assert.ok(driver.commands.includes("\\"));
      sinon.assert.calledOnce(run);
    });

    it("continues from a breakpoint outside a function", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      driver.on2(/^:$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      const run = sinon.stub(s, "runStatements").resolves();
      await s.resume();
      assert.ok(driver.commands.includes(":"));
      sinon.assert.calledOnce(run);
    });

    it("continues from a breakpoint in a function to the next one", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      s.requestedBreakpoints.set("/lib.q", [3]);
      answer("kdb.qls.lambdaPath", {
        name: "f",
        path: [],
        startLine: 1,
        rootLine: 0,
      });
      driver.on2(/^\.Q\.bt\[\]$/, ">>[1]  /lib.q:3: f:{x}");
      const positions = ["/lib.q:3", "/lib.q:4", "/lib.q:3"];
      driver.on2(/^>$/, () => `>>[1]  ${positions.shift()}: f:{x}`);
      await s.resume();
      assert.strictEqual(events("stopped")[0].body.reason, "breakpoint");
    });

    it("runs on when continuing a function leaves it", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      answer("kdb.qls.lambdaPath", {
        name: "f",
        path: [],
        startLine: 1,
        rootLine: 0,
      });
      driver.on2(/^\.Q\.bt\[\]$/, ">>[1]  /lib.q:3: f:{x}");
      driver.on2(/^>$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      const run = sinon.stub(s, "runStatements").resolves();
      await s.resume();
      sinon.assert.calledOnce(run);
    });

    it("gives up searching for a breakpoint after too many steps", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      let steps = 0;
      driver.on2(/^>$/, () => {
        steps++;
        return `>>[1]  /lib.q:${steps}: f`;
      });
      sinon.stub(s, "programCounter").resolves(undefined);
      const clock = { steps: 0 };
      sinon.stub(s, "stepPosition").callsFake(async () => {
        clock.steps++;
        return { file: "/lib.q", line: 1 };
      });
      const outcome = await s.advanceToBreakpoint();
      assert.strictEqual(outcome, "breakpoint");
      assert.ok(events("output")[0].body.output.includes("Stopped searching"));
      assert.strictEqual(clock.steps, 100000);
    });

    it("reports an exception when stepping loses the position", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      sinon.stub(s, "stepPosition").resolves(undefined);
      assert.strictEqual(await s.advanceToBreakpoint(), "exception");
      driver.stopReason = "exception";
      assert.strictEqual(await s.advanceToBreakpoint(), "exception");
      s.driver = undefined;
      assert.strictEqual(await s.advanceToBreakpoint(), "exited");
    });
  });

  describe("stepping", () => {
    function suspendedAt(file: string, line: number, index = 1) {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      driver.on2(/^\.Q\.bt\[\]$/, `>>[${index}]  ${file}:${line}: f:{x}`);
    }

    beforeEach(() => {
      answer("kdb.qls.lambdaPath", {
        name: "f",
        path: [],
        startLine: 0,
        rootLine: 0,
      });
      answer("kdb.qls.statementSeparators", [{ line: 2, column: 4 }]);
    });

    it("steps over to the next line", async () => {
      suspendedAt("/lib.q", 2);
      const lines = [1, 2, 3];
      driver.on2(/^>$/, () => `>>[1]  /lib.q:${lines.shift()}: f:{x}`);
      await s.stepStatement();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("steps over, skipping phantom steps", async () => {
      suspendedAt("/lib.q", 2);
      const pcs = ["[0,9,2,1]", "[6,9,2,1]", "[1,9,2,-1]", "[2,9,2,1]"];
      driver.on2(/^\.dbg\.pc\[\]$/, () => pcs.shift() ?? "[3,9,2,1]");
      driver.on2(/^>$/, () => ">>[1]  /lib.q:3: f:{x}");
      await s.stepStatement();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("stops stepping over at an exception", async () => {
      suspendedAt("/lib.q", 2);
      driver.on2(/^>$/, () => {
        driver.stopReason = "exception";
        return "";
      });
      await s.stepStatement();
      assert.strictEqual(events("stopped")[0].body.reason, "exception");
    });

    it("pauses after the function returns while stepping over", async () => {
      suspendedAt("/lib.q", 2);
      s.statements = [{ startLine: 4, startColumn: 0, endLine: 4, text: "b" }];
      driver.on2(/^>$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      await s.stepStatement();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
      assert.strictEqual(s.topLevelPaused, s.statements[0]);
    });

    it("runs on when stepping over while not suspended", async () => {
      const run = sinon.stub(s, "runStatements").resolves();
      await s.stepStatement();
      await s.stepInto();
      await s.stepOut();
      sinon.assert.calledThrice(run);
    });

    it("steps into a call on the line", async () => {
      suspendedAt("/lib.q", 2, 1);
      answer("kdb.qls.identifiersOnLines", [
        { name: "g", canon: ".g" },
        { name: "f", canon: "f" },
      ]);
      answer("kdb.qls.statementLambdas", [
        { name: "f", path: [0], rootLine: 0 },
        { name: "", path: [1], rootLine: 0 },
      ]);
      driver.on2(/^\.dbg\.childidx/, "0");
      driver.on2(/^>$/, () => ">>[2]  /lib.q:7: g:{x}");
      await s.stepInto();
      assert.ok(driver.commands.some((c) => c.startsWith(".dbg.bs[`f;")));
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("steps into, stopping on the next line of the same function", async () => {
      suspendedAt("/lib.q", 2, 1);
      driver.on2(/^>$/, () => ">>[1]  /lib.q:3: f:{x}");
      await s.stepInto();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("stops stepping into at an exception", async () => {
      suspendedAt("/lib.q", 2);
      driver.on2(/^>$/, () => {
        driver.stopReason = "exception";
        return "";
      });
      await s.stepInto();
      assert.strictEqual(events("stopped")[0].body.reason, "exception");
    });

    it("pauses after the function returns while stepping into", async () => {
      suspendedAt("/lib.q", 2);
      driver.on2(/^>$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      await s.stepInto();
      assert.strictEqual(events("terminated").length, 1);
    });

    it("steps out to the caller", async () => {
      suspendedAt("/lib.q", 2, 2);
      driver.on2(/^>$/, () => ">>[1]  /lib.q:9: g:{x}");
      await s.stepOut();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
    });

    it("stops stepping out at an exception", async () => {
      suspendedAt("/lib.q", 2, 2);
      driver.on2(/^>$/, () => {
        driver.stopReason = "exception";
        return "";
      });
      await s.stepOut();
      assert.strictEqual(events("stopped")[0].body.reason, "exception");
    });

    it("pauses after stepping out of the last function", async () => {
      suspendedAt("/lib.q", 2, 2);
      driver.on2(/^>$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      await s.stepOut();
      assert.strictEqual(events("terminated").length, 1);
    });

    it("steps a function with no source file through its virtual source", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      driver.on2(/^\.Q\.bt\[\]$/, ">>[1]  g@:{x}\n  a:1\n  ^");
      driver.on2(/^\.dbg\.src/, '"{x}\\n  a:1\\n  b:2"');
      driver.on2(/^>$/, () => ">>[1]  g@:{x}\n  b:2\n  ^");
      await s.stepStatement();
      assert.strictEqual(events("stopped")[0].body.reason, "step");
      assert.strictEqual(s.virtualSourceText.size, 1);
    });
  });

  describe("traps", () => {
    it("arms, keeps and disarms breakpoints as they change", async () => {
      s.requestedBreakpoints.set(program, [2, 3, 4]);
      requests.callsFake(async (method: string, params: any) => {
        if (method !== "kdb.qls.lambdaPath") return null;
        if (params.line === 1) {
          return { name: "f", path: [0], startLine: 1, rootLine: 0 };
        }
        if (params.line === 2) {
          return { name: "", path: [], startLine: 1, rootLine: 0 };
        }
        return { name: "late", path: [], startLine: 3, rootLine: 3 };
      });
      await s.syncBreakpoints(2);
      assert.ok(s.armedTraps.has("f#0"));
      assert.ok(!s.armedTraps.has("late#"));

      driver.on2(/^\.dbg\.trapped/, "0b");
      await s.syncBreakpoints(2);
      assert.strictEqual(
        driver.commands.filter((c) => c.startsWith(".dbg.bs[`f;")).length,
        2,
      );

      s.armedTraps.set("gone#", { name: "gone", descentPath: [] });
      await s.syncBreakpoints(2);
      assert.ok(driver.commands.includes(".dbg.bu[`gone;`long$()]"));
    });

    it("skips breakpoints on the stack and in unknown external files", async () => {
      s.requestedBreakpoints.set("/lib.q", [1, 2]);
      requests.callsFake(async (method: string, params: any) =>
        method === "kdb.qls.lambdaPath"
          ? {
              name: params.line === 0 ? "a" : "b",
              path: [],
              startLine: 0,
              rootLine: 0,
            }
          : null,
      );
      driver.on2(/^\.dbg\.bkname\[.*"a"\]$/, '".m.a"');
      driver.on2(/^\.dbg\.bkname\[.*"b"\]$/, "not json");
      await s.syncBreakpoints(0, { skipKeys: new Set([".m.a#"]) });
      assert.strictEqual(s.armedTraps.size, 0);
      assert.ok(!driver.commands.some((c) => c.startsWith(".dbg.bs")));
    });

    it("drops step-in traps for functions no longer on the stack", async () => {
      driver.promptDepth = 2;
      s.stepInTraps.set("f#", { name: "f", descentPath: [] });
      s.stepInTraps.set("g#", {
        name: "g",
        descentPath: [],
        backtraceName: "..g",
      });
      s.stepInTraps.set("h#", { name: "h", descentPath: [] });
      await s.recoverStepInTraps([
        frame({ text: "f:{x}" }),
        frame({ text: "..g:{x}" }),
      ]);
      assert.deepStrictEqual([...s.stepInTraps.keys()], ["f#", "g#"]);
      driver.promptDepth = 1;
      await s.recoverStepInTraps();
      assert.strictEqual(s.stepInTraps.size, 0);
    });

    it("resolves step-in targets and their backtrace names", async () => {
      driver.on2(/^\.dbg\.childidx/, "x");
      assert.strictEqual(await s.resolveLocalStepInTarget("f", "g"), undefined);
      assert.strictEqual(
        await s.resolveLocalStepInTarget(undefined, "g"),
        undefined,
      );
      driver.on2(/^\.dbg\.bktname/, "'err");
      assert.strictEqual(await s.bktName("f", []), undefined);
      driver.on2(/^\.dbg\.bktname/, "bad");
      assert.strictEqual(await s.bktName("f", []), undefined);
      driver.on2(/^\.dbg\.bktname/, '""');
      assert.strictEqual(await s.bktName("f", []), undefined);
      driver.on2(/^\.dbg\.bkname/, "'err");
      assert.strictEqual(
        await s.resolveExternalTrapName("/a.q", "f"),
        undefined,
      );
      driver.on2(/^\.dbg\.bkname/, '""');
      assert.strictEqual(
        await s.resolveExternalTrapName("/a.q", "f"),
        undefined,
      );
    });

    it("arms nothing to step into without a position", async () => {
      await s.armStepInTraps(undefined, 1, 1, undefined);
      await s.armStepInTraps("/a.q", undefined, 1, undefined);
      assert.deepStrictEqual(driver.commands, []);
    });

    it("collects the trap keys of the frames on the stack", async () => {
      s.currentFrames = [frame({ text: "f:{x}" }), frame({ text: "{x}" })];
      assert.deepStrictEqual([...(await s.onStackTrapKeys())], ["f#"]);
    });
  });

  describe("release", () => {
    it("aborts, disarms traps, leaves the namespace and removes the temp dir", async () => {
      driver.promptDepth = 2;
      driver.stopReason = "breakpoint";
      driver.on2(/^\.dbg\.pc\[\]$/, "[0,9,2,1]");
      driver.on2(/^>$/, () => {
        driver.promptDepth = 1;
        return "";
      });
      s.onExited = () => undefined;
      s.armedTraps.set("f#", { name: "f", descentPath: [] });
      s.stepInTraps.set("g#1", { name: "g", descentPath: [1] });
      (QDebugSession as any).current = session;
      const temp = s.tempDir;
      await s.release();
      await s.release();
      assert.ok(driver.commands.includes(">"));
      assert.ok(driver.commands.includes(".dbg.bu[`f;`long$()]"));
      assert.ok(driver.commands.includes(".dbg.bu[`g;`long$(1)]"));
      assert.ok(driver.commands.includes("\\d ."));
      assert.strictEqual(existsSync(temp), false);
      assert.strictEqual(QDebugSession.activeSession, undefined);
    });

    it("releases a session whose q has exited", async () => {
      driver.exited = true;
      s.tempDir = undefined;
      await s.release();
      assert.deepStrictEqual(driver.commands, []);
    });
  });

  describe("sources and positions", () => {
    it("maps temp files back to the program, also from an earlier session", () => {
      const name = basename(s.tempDir);
      assert.strictEqual(s.mapToProgram(`${s.tempDir}/s0.q`), program);
      (QDebugSession as any).tempDirPrograms.set("kdb-debug-old", "/old.q");
      assert.strictEqual(s.mapToProgram("/t/kdb-debug-old/s1.q"), "/old.q");
      assert.strictEqual(s.mapToProgram("/x.q"), "/x.q");
      assert.strictEqual(s.mapToProgram(undefined), undefined);
      assert.ok(name.startsWith("kdb-debug-"));
    });

    it("recognises the frame that loaded a temp file", () => {
      assert.strictEqual(
        s.isTempLoaderFrame(frame({ text: `\\l ${s.tempDir}/s0.q` })),
        true,
      );
      assert.strictEqual(
        s.isTempLoaderFrame(frame({ text: "\\l /x.q" })),
        false,
      );
      assert.strictEqual(s.isTempLoaderFrame(frame({ text: "f" })), false);
    });

    it("shows paths relative to the program folder when it can", () => {
      assert.strictEqual(s.relPath(program), "hello.q");
      assert.strictEqual(s.relPath(s.programCwd), s.programCwd);
      s.programCwd = "";
      assert.strictEqual(s.relPath(program), program);
    });

    it("builds the exception report with carets and block lines", () => {
      s.currentFrames = [
        frame({
          index: 1,
          text: ".dbg.a0:{x}",
          file: program,
          line: 1,
          column: 2,
          current: true,
          block: ["{x}", "  y"],
        }),
        frame({ index: 0, text: "f[]", block: ["more"] }),
      ];
      assert.deepStrictEqual(s.backtraceReportLines(), [
        ">>[1]  hello.q:1:         {x}",
        "                    ^",
        "  y",
        "  [0]  f[]",
        "more",
      ]);
      s.exceptionInfoRequest(response());
      assert.ok(responses()[0].body.details.stackTrace.startsWith("'error"));
    });

    it("does not print an exception report in verbose mode or without frames", () => {
      s.emitExceptionReport();
      s.verboseTrace = true;
      s.currentFrames = [frame({ text: "f" })];
      s.emitExceptionReport();
      assert.deepStrictEqual(driver.data, []);
    });

    it("gives functions without a source file a virtual source", async () => {
      s.currentFrames = [
        frame({ index: 1, text: "g@:{x}", sourceLine: "  b" }),
        frame({ index: 2, text: "g@:{x}", file: "/gone.q", line: 3 }),
        frame({ index: 3, text: "h@:{x}" }),
        frame({ index: 4, text: "{x}" }),
        frame({ index: 5, text: "f:{x}", file: program, line: 1 }),
      ];
      driver.on2(/^\.dbg\.src\[`g/, '"{x}\\n  b"');
      driver.on2(/^\.dbg\.src\[`h/, "'nyi");
      await s.resolveVirtualSources();
      assert.deepStrictEqual(s.frameVirtual.get(1), { ref: 1, line: 2 });
      assert.deepStrictEqual(s.frameVirtual.get(2), { ref: 1, line: 1 });
      assert.strictEqual(s.frameVirtual.has(3), false);

      await s.ensureVirtualSource("g");
      await s.ensureVirtualSource(undefined);
      driver.on2(/^\.dbg\.src\[`k/, "not json");
      await s.ensureVirtualSource("k");
      driver.on2(/^\.dbg\.src\[`n/, "1");
      await s.ensureVirtualSource("n");
      assert.strictEqual(s.virtualSourceRef.size, 1);
    });

    it("finds the line of a position in a virtual source", () => {
      s.virtualSourceRef.set("g", 1);
      s.virtualSourceText.set(1, "{x}\n  b");
      assert.strictEqual(s.lineOf(undefined), undefined);
      assert.strictEqual(s.lineOf({ file: "/a.q", line: 4 }), 4);
      assert.strictEqual(s.lineOf({ line: 4 }), 4);
      assert.strictEqual(s.lineOf({ name: "z", line: 4 }), 4);
      assert.strictEqual(s.lineOf({ name: "g", sourceLine: "b", line: 9 }), 2);
      assert.strictEqual(s.lineOf({ name: "g", sourceLine: "?", line: 9 }), 9);
    });

    it("captures the statement start of the current position", async () => {
      s.tempStatements.set("s0.q", { startLine: 1, startColumn: 4 });
      answer("kdb.qls.statementSeparators", [{ line: 1, column: 2 }]);
      driver.on2(/^\.Q\.bt\[\]$/, `>>[1]  ${s.tempDir}/s0.q:1: x\n   ^`);
      await s.captureMarker();
      assert.deepStrictEqual(s.currentMarker, { line: 1, col: 0 });

      driver.on2(/^\.Q\.bt\[\]$/, ">>[1]  /missing.q:1: x\n   ^");
      await s.captureMarker();
      assert.strictEqual(s.currentMarker, undefined);
    });

    it("maps a position column to program coordinates", () => {
      s.tempStatements.set("s0.q", { startLine: 2, startColumn: 5 });
      assert.strictEqual(s.programColumn(undefined), undefined);
      assert.strictEqual(s.programColumn({ col: 1 }), 1);
      assert.strictEqual(
        s.programColumn({ file: "/t/s0.q", line: 2, col: 1 }),
        6,
      );
      assert.strictEqual(
        s.programColumn({ file: "/t/s0.q", line: 3, col: 1 }),
        1,
      );
    });

    it("cleans captured values and hoisted aliases out of a backtrace", () => {
      const file = join(s.tempDir, "prog.q");
      writeFileSync(file, "r:{x}[1]\n");
      s.programPath = file;
      s.sourceCache.clear();
      s.tempStatements.set("s0.q", {
        startLine: 1,
        startColumn: 0,
        endLine: 1,
      });
      s.capturedFiles.add("s0.q");
      const text = [
        `>>[1]  ${s.tempDir}/s0.q:1: .dbg.v::((.dbg.a0)[1])`,
        "                                             ^",
        "  [0]  other",
      ].join("\n");
      const cleaned = s.cleanBacktrace(text).split("\n");
      assert.strictEqual(cleaned[0], `>>[1]  ${s.tempDir}/s0.q:1: r:{x}[1]`);
      assert.ok(cleaned[1].trimEnd().endsWith("^"));
    });

    it("reads no program counter when q is not suspended or answers badly", async () => {
      assert.strictEqual(await s.programCounter(), undefined);
      driver.promptDepth = 2;
      driver.on2(/^\.dbg\.pc\[\]$/, "[1,2]");
      assert.strictEqual(await s.programCounter(), undefined);
      driver.on2(/^\.dbg\.pc\[\]$/, "[1,2,3,4]");
      assert.deepStrictEqual(await s.programCounter(), {
        index: 1,
        length: 2,
        depth: 3,
        position: 4,
      });
    });

    it("answers nothing without a driver", async () => {
      s.driver = undefined;
      assert.strictEqual(await s.stepPosition(), undefined);
      assert.deepStrictEqual(await s.frames(), []);
      assert.strictEqual(await s.position(), undefined);
      assert.strictEqual(await s.handleSuspension(), false);
      await s.abortToTop();
      await s.popTo(1);
      await s.enterNamespace(".x");
      await s.stepOverTopLevel({});
      await s.stepIntoTopLevel({});
    });

    it("moves the frame pointer up and down", async () => {
      driver.promptDepth = 2;
      s.qCurrentIndex = 2;
      s.qExecIndex = 4;
      await s.resetFramePointer();
      await s.navigateTo(3);
      assert.deepStrictEqual(driver.commands, [".", ".", "`"]);
    });

    it("abandons nested suspensions on the way to the top", async () => {
      driver.promptDepth = 3;
      driver.stopReason = "exception";
      driver.on2(/^\\$/, () => {
        driver.promptDepth--;
        return "";
      });
      await s.abortToTop();
      assert.strictEqual(driver.promptDepth, 1);
    });

    it("prints a captured value on its own line", async () => {
      s.pendingValue = true;
      driver.atLineStart = false;
      driver.on2(/^\.dbg\.pop\[\]$/, "7");
      await s.flushValue();
      assert.deepStrictEqual(driver.data, ["\n7\n"]);
    });
  });

  describe("language server requests", () => {
    it("answers empty without a client", async () => {
      client = undefined;
      assert.strictEqual(await s.lambdaPathAt("/a.q", 1), undefined);
      assert.deepStrictEqual(await s.statementLambdas("/a.q", 1, 0), []);
      assert.deepStrictEqual(await s.rootLambdas("/a.q", 1, 1), []);
      assert.deepStrictEqual(await s.topLevelStatements("/a.q"), []);
      assert.deepStrictEqual(await s.statementSeparators("/a.q", 1), []);
      assert.deepStrictEqual(await s.identifiersOnLines("/a.q", 1, 1), []);
    });

    it("answers empty when the server fails", async () => {
      requests.rejects(new Error("down"));
      assert.strictEqual(await s.lambdaPathAt("/a.q", 1), undefined);
      assert.deepStrictEqual(await s.statementLambdas("/a.q", 1, 0), []);
      assert.deepStrictEqual(await s.rootLambdas("/a.q", 1, 1), []);
      assert.deepStrictEqual(await s.topLevelStatements("/a.q"), []);
      assert.deepStrictEqual(await s.statementSeparators("/a.q", 1), []);
      assert.deepStrictEqual(await s.identifiersOnLines("/a.q", 1, 1), []);
    });

    it("names an anonymous lambda by its hoisted alias", async () => {
      s.anonAliases.set("3:4", ".dbg.a7");
      answer("kdb.qls.lambdaPath", {
        name: "",
        path: [],
        startLine: 2,
        rootLine: 2,
        rootColumn: 4,
      });
      assert.strictEqual((await s.lambdaPathAt(program, 3)).name, ".dbg.a7");
      assert.strictEqual((await s.lambdaPathAt("/other.q", 3)).name, "");
      answer("kdb.qls.statementLambdas", [
        { name: "", path: [0], rootLine: 2, rootColumn: 4 },
        { name: "", path: [1], rootLine: 0 },
      ]);
      assert.deepStrictEqual(await s.statementLambdas(program, 3, 0), [
        { name: ".dbg.a7", descentPath: [0] },
      ]);
    });

    it("converts spans and statements to one-based lines", async () => {
      answer("kdb.qls.rootLambdas", [
        { line: 0, column: 1, endLine: 2, endColumn: 3 },
      ]);
      answer("kdb.qls.statementSeparators", [{ line: 0, column: 5 }]);
      assert.deepStrictEqual(await s.rootLambdas("/a.q", 1, 1), [
        { line: 1, column: 1, endLine: 3, endColumn: 3 },
      ]);
      assert.deepStrictEqual(await s.statementSeparators("/a.q", 1), [
        { line: 1, column: 5 },
      ]);
    });
  });
});
