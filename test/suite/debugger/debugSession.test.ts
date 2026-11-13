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
import * as path from "path";

import {
  assertContains,
  DapClient,
  fixture,
  FIXTURES,
  qAvailable,
  TerminalRecorder,
} from "./dapClient";
import { QDebugSession } from "../../../src/debugger/debugSession";
import {
  getOrCreateDebugTerminal,
  killDebugTerminal,
} from "../../../src/debugger/debugTerminal";

const GLOBALS_VAR_REF = 999;

const THROWS_FIXTURE = fixture("throws.q");
const TOP_LEVEL_ERROR_FIXTURE = fixture("topLevelError.q");
const DICT_THEN_ERROR_FIXTURE = fixture("dictThenError.q");
const PARTIAL_THEN_ERROR_FIXTURE = fixture("partialThenError.q");
const BAD_IMPORT_FIXTURE = fixture("badImport.q");
const BAD_LOAD_FIXTURE = fixture("badLoad.q");
const LOAD_ERR_MAIN_FIXTURE = fixture("loadErrMain.q");
const LOAD_ERR_HELPER_FIXTURE = fixture("loadErrHelper.q");
const BREAKPOINTS_FIXTURE = fixture("breakpoints.q");
const TOP_LEVEL_STATEMENTS_FIXTURE = fixture("topLevelStatements.q");
const CONTINUATION_FIXTURE = fixture("continuation.q");
const INTERACTIVE_READ_FIXTURE = fixture("interactiveRead.q");
const LOOP_FIXTURE = fixture("loop.q");
const DO_LOOP_FIXTURE = fixture("doloop.q");
const FRAME_POINTER_FIXTURE = fixture("framePointer.q");
const MID_SESSION_BREAKPOINT_FIXTURE = fixture("midSessionBreakpoint.q");
const GLOBALS_RACE_FIXTURE = fixture("globalsRace.q");
const MID_LINE_FN_FIXTURE = fixture("midLineFn.q");
const NAMESPACE_FIXTURE = fixture("namespace.q");
const NAMESPACE_BREAK_FIXTURE = fixture("namespaceBreak.q");
const NAMESPACE_GLOBALS_FIXTURE = fixture("namespaceGlobals.q");
const COMMENTS_FIXTURE = fixture("comments.q");
const CROSS_DEFINER_FIXTURE = fixture("crossDefiner.q");
const CROSS_CALLER_FIXTURE = fixture("crossCaller.q");
const VIRTUAL_CALLER_FIXTURE = fixture("virtualCaller.q");
const VSTEP_CALLER_FIXTURE = fixture("vstepCaller.q");
const FOO_FIXTURE = fixture("foo.q");
const BAR_MODULE_FIXTURE = fixture("mod", "bar.q");
const FOREIGN_FIXTURE = fixture("foreign.q");
const LOAD_MAIN_FIXTURE = fixture("loadmain.q");
const LOAD_HELPER_FIXTURE = fixture("loadhelper.q");
const STACK_LINES_FIXTURE = fixture("stackLines.q");
const LONG_ERROR_FIXTURE = fixture("longError.q");
const COND_STEP_FIXTURE = fixture("condStep.q");
const ANON_STEP_FIXTURE = fixture("anonStep.q");
const NESTED_STEP_IN_FIXTURE = fixture("nestedStepIn.q");
const TABLE_VALUE_FIXTURE = fixture("tableValue.q");
const STEP_IN_MARKER_FIXTURE = fixture("stepInMarker.q");
const CONSOLE_ABORT_FIXTURE = fixture("consoleAbort.q");
const ITERATOR_BREAK_FIXTURE = fixture("iteratorBreak.q");

interface StackFrame {
  id: number;
  name: string;
  line: number;
  column?: number;
  source?: { path?: string; sourceReference?: number };
}
interface Variable {
  name: string;
  value: string;
}

async function stackFrames(
  client: DapClient,
  threadId: number,
): Promise<StackFrame[]> {
  const trace = await client.request<{ stackFrames: StackFrame[] }>(
    "stackTrace",
    { threadId },
  );
  return trace.stackFrames;
}

async function localsOf(
  client: DapClient,
  frameId: number,
): Promise<Variable[]> {
  const scopes = await client.request<{
    scopes: { name: string; variablesReference: number }[];
  }>("scopes", { frameId });
  const variables = await client.request<{ variables: Variable[] }>(
    "variables",
    { variablesReference: scopes.scopes[0].variablesReference },
  );
  return variables.variables;
}

async function settle(
  client: DapClient,
  from: number,
  timeoutMs = 10000,
): Promise<string> {
  const start = Date.now();
  for (;;) {
    const found = client.events
      .slice(from)
      .find((e) => e.event === "stopped" || e.event === "terminated");
    if (found) return found.event;
    if (Date.now() - start > timeoutMs) return "timeout";
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function step(
  client: DapClient,
  command: string,
  threadId: number,
): Promise<string> {
  const from = client.events.length;
  await client.request(command, { threadId });
  return settle(client, from);
}

async function stopsWhileStepping(
  client: DapClient,
  command: string,
  threadId: number,
): Promise<string[]> {
  const stops: string[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const frames = await stackFrames(client, threadId);
    stops.push(`${frames[0].name}:${frames[0].line}`);
    if ((await step(client, command, threadId)) !== "stopped") break;
  }
  return stops;
}

async function launch(
  client: DapClient,
  program: string,
  breakpoints?: number[],
): Promise<number> {
  await client.request("initialize", {
    adapterID: "q",
    pathFormat: "path",
    linesStartAt1: true,
    columnsStartAt1: true,
  });
  await client.waitForEvent("initialized");
  await client.request("launch", { program });
  if (breakpoints) {
    await client.request("setBreakpoints", {
      source: { path: program },
      breakpoints: breakpoints.map((line) => ({ line })),
    });
  }
  await client.request("setExceptionBreakpoints", { filters: ["uncaught"] });
  await client.request("configurationDone", {});
  await client.waitForEvent("stopped");
  const threads = await client.request<{
    threads: { id: number; name: string }[];
  }>("threads");
  assert.strictEqual(threads.threads.length, 1);
  return threads.threads[0].id;
}

describe("QDebugSession", function () {
  this.timeout(60000);

  const terminals = new TerminalRecorder();

  before(function () {
    if (!qAvailable()) this.skip();
    terminals.install();
  });

  after(() => {
    killDebugTerminal();
    terminals.restore();
  });

  it("stops on an uncaught error, reports a real stack trace/variables, evaluates in frame, and resumes to completion", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, THROWS_FIXTURE);
      const frames = await stackFrames(client, threadId);

      assert.ok(frames.length >= 3);
      assert.strictEqual(frames[0].line, 3);
      assert.strictEqual(frames[0].name, "h");
      assert.strictEqual(frames[0].source?.path, THROWS_FIXTURE);
      assert.strictEqual(frames[1].line, 2);
      assert.strictEqual(frames[1].name, "g");
      assert.strictEqual(frames[2].line, 1);
      assert.strictEqual(frames[2].name, "f");

      const variables = await localsOf(client, frames[0].id);
      assertContains(variables, { name: "x", value: "5" });

      const evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "x",
        frameId: frames[0].id,
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "5");

      await client.request("continue", { threadId: threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("carries a \\d namespace across per-statement loads", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, NAMESPACE_FIXTURE, [7]);
      const frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 7);

      const inNamespace = async (expression: string): Promise<string> =>
        (
          await client.request<{ result: string }>("evaluate", {
            expression,
            frameId: frames[0].id,
            context: "repl",
          })
        ).result;

      assert.strictEqual(await inNamespace("r"), "42");
      assert.strictEqual(await inNamespace("s"), "3");
      assert.strictEqual(await inNamespace("`helper in key `."), "0b");
      assert.strictEqual(await inNamespace("`helper in key `.foo"), "1b");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("arms a breakpoint inside a function defined under \\d", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, NAMESPACE_BREAK_FIXTURE, [7]);
      assert.strictEqual((await stackFrames(client, threadId))[0].line, 7);

      await client.request("setBreakpoints", {
        source: { path: NAMESPACE_BREAK_FIXTURE },
        breakpoints: [{ line: 3 }],
      });
      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");

      const frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 3);
      assert.strictEqual(frames[0].name, ".foo.helper");
      assert.strictEqual(frames[0].source?.path, NAMESPACE_BREAK_FIXTURE);

      const variables = await localsOf(client, frames[0].id);
      assertContains(variables, { name: "x", value: "21" });

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("lists a namespaced program's globals under their qualified names", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, NAMESPACE_GLOBALS_FIXTURE, [5, 8]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 5);

      const globals = await localsOf(client, frames[0].id);
      assertContains(globals, { name: ".foo.scale", value: "3" });
      assert.ok(globals.map((v) => v.name).includes(".foo.helper"));
      assert.ok(!globals.map((v) => v.name).includes("rootbefore"));
      for (const v of globals) {
        assert.ok(!v.name.includes(","));
        assert.ok(!v.name.includes(".."));
        assert.notStrictEqual(v.value, "<error>");
      }

      const hover = async (expression: string): Promise<string> =>
        (
          await client.request<{ result: string }>("evaluate", {
            expression,
            frameId: frames[0].id,
            context: "hover",
          })
        ).result;
      assert.strictEqual(await hover("scale"), "3");
      assert.strictEqual(await hover(".foo.scale"), "3");
      assert.strictEqual(await hover("nosuchname"), "");
      assert.strictEqual(await hover("rootbefore"), "");

      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 8);
      const rootGlobals = await localsOf(client, frames[0].id);
      const roots = rootGlobals.filter((v) => v.name === "a");
      assert.strictEqual(roots.length, 1);
      assert.strictEqual(roots[0].value, "1");
      assertContains(rootGlobals, { name: "rootbefore", value: "9" });
      assert.ok(!rootGlobals.map((v) => v.name).includes("..a"));

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("surfaces the q error signal and a backtrace on an uncaught error (not just a bare exception)", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: THROWS_FIXTURE,
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      const stopped = (await client.waitForEvent("stopped")) as {
        reason: string;
        text?: string;
      };
      assert.strictEqual(stopped.reason, "exception");
      assert.strictEqual(stopped.text, undefined);

      const info = await client.request<{
        exceptionId: string;
        description?: string;
        breakMode: string;
        details?: { stackTrace?: string };
      }>("exceptionInfo", { threadId: 1 });
      assert.strictEqual(info.exceptionId, "");
      assert.strictEqual(info.breakMode, "unhandled");
      assert.strictEqual(info.description, undefined);
      const trace = info.details?.stackTrace ?? "";
      assert.strictEqual(trace.split("\n")[0], "'type");
      assert.ok(trace.includes(`throws.q:3: h:{[x] x+"a"}`));
      assert.ok(trace.includes(`throws.q:1: f:{[x] g[x]}`));
      assert.ok(trace.includes("^"));

      const out = await terminals.waitFor("throws.q:3:");
      assert.ok(out.includes("'type"));
      assert.ok(out.includes(`h:{[x] x+"a"}`));
      const reportLines = out.split(/\r?\n/);
      const frameIdx = reportLines.findIndex((l) =>
        l.includes(`throws.q:3: h:{[x] x+"a"}`),
      );
      assert.ok(frameIdx >= 0);
      assert.strictEqual(reportLines[frameIdx + 1]?.trim(), "^");
      for (const l of trace.split("\n")) assert.ok(out.includes(l));

      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("prints the error report (with caret) to the terminal for a top-level error, not just an error inside a function", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: TOP_LEVEL_ERROR_FIXTURE,
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      const stopped = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(stopped.reason, "exception");

      const out = await terminals.waitFor("topLevelError.q:2:");
      const reportLines = out.split(/\r?\n/);
      const frameIdx = reportLines.findIndex((l) =>
        l.includes("topLevelError.q:2: a+`notanumber"),
      );
      assert.ok(frameIdx >= 0);
      assert.match(reportLines[frameIdx], /^(?:>>|\s\s)\[\d+\]\s/);
      assert.strictEqual(reportLines[frameIdx + 1]?.trim(), "^");

      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("starts the error report on a fresh line even when the previous statement left the cursor mid-line", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: DICT_THEN_ERROR_FIXTURE,
        cwd: path.dirname(DICT_THEN_ERROR_FIXTURE),
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      await client.waitForEvent("stopped");

      const out = await terminals.waitFor("dictThenError.q:2:");
      const lines = out.split(/\r?\n/);
      assert.doesNotMatch(out, /`big'type/);
      const bigIdx = lines.findIndex((l) => l.endsWith("`big"));
      assert.ok(bigIdx >= 0);
      assert.strictEqual(lines[bigIdx + 1], "'type");
      assert.ok(out.includes("dictThenError.q:2: 1 + `notanumber"));

      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("reports a failed `use` as an exception instead of single-stepping forever", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: BAD_IMPORT_FIXTURE,
        cwd: path.dirname(BAD_IMPORT_FIXTURE),
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      const stopped = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(stopped.reason, "exception");

      const info = await client.request<{
        details?: { stackTrace?: string };
      }>("exceptionInfo", { threadId: 1 });
      assert.strictEqual(
        info.details?.stackTrace?.split("\n")[0],
        "'notfound: nosuchmodule",
      );

      const out = await terminals.waitFor("badImport.q:1:");
      assert.ok(out.includes("tried the following paths:"));
      assert.doesNotMatch(out, /^>$/m);

      await client.request("continue", { threadId: 1 });
      const second = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(second.reason, "exception");
      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("reports a failed `\\l` at its own line instead of with an empty call stack", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: BAD_LOAD_FIXTURE,
        cwd: path.dirname(BAD_LOAD_FIXTURE),
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      const stopped = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(stopped.reason, "exception");

      const frames = await stackFrames(client, 1);
      assert.strictEqual(frames.length, 1);
      assert.strictEqual(frames[0].line, 1);
      assert.strictEqual(frames[0].source?.path, BAD_LOAD_FIXTURE);

      const info = await client.request<{
        details?: { stackTrace?: string };
      }>("exceptionInfo", { threadId: 1 });
      assert.strictEqual(
        info.details?.stackTrace?.split("\n")[0],
        "'nosuchfile_xyz.q. OS reports: No such file or directory",
      );
      assert.ok(info.details?.stackTrace.includes("badLoad.q:1: \\l"));

      const out = await terminals.waitFor("badLoad.q:1:");
      const reportLines = out.split(/\r?\n/);
      const frameIdx = reportLines.findIndex((l) =>
        l.includes("badLoad.q:1: \\l nosuchfile_xyz.q"),
      );
      assert.ok(frameIdx >= 0);
      assert.match(reportLines[frameIdx], /^(?:>>|\s\s)\[\d+\]\s/);
      assert.strictEqual(reportLines[frameIdx + 1]?.trim(), "^");
      assert.ok(!out.includes("qlangx-debug-"));

      await client.request("continue", { threadId: 1 });
      const second = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(second.reason, "exception");
      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("keeps the `\\l` frame of a nested script load on the stack", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: LOAD_ERR_MAIN_FIXTURE,
        cwd: path.dirname(LOAD_ERR_MAIN_FIXTURE),
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      const stopped = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(stopped.reason, "exception");

      const frames = await stackFrames(client, 1);
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].source?.path, LOAD_ERR_HELPER_FIXTURE);
      const loader = frames.find(
        (f) => f.source?.path === LOAD_ERR_MAIN_FIXTURE,
      );
      assert.strictEqual(loader?.line, 2);

      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("does not stall when a top-level statement prints without a trailing newline (glued prompt)", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: PARTIAL_THEN_ERROR_FIXTURE,
        cwd: path.dirname(PARTIAL_THEN_ERROR_FIXTURE),
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      const stopped = (await client.waitForEvent("stopped")) as {
        reason: string;
      };
      assert.strictEqual(stopped.reason, "exception");
      const out = await terminals.waitFor("partialThenError.q:3:");
      assert.ok(out.includes("partial: "));

      await client.request("continue", { threadId: 1 });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("ends the debug session when the shared REPL terminal is closed (SIGTERM-ignoring suspended q)", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: THROWS_FIXTURE,
        cwd: path.dirname(THROWS_FIXTURE),
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      await client.waitForEvent("stopped");

      const terminated = client.waitForEvent("terminated");
      const terminal = terminals.latest;
      assert.ok(terminal);
      terminal.dispose();
      await terminated;
    } finally {
      client.close();
    }
  });

  it("runs release() cleanup when the q process exits unexpectedly, with no disconnect", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, THROWS_FIXTURE);
      assert.notStrictEqual(QDebugSession.activeSession, undefined);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      assert.strictEqual(QDebugSession.activeSession, undefined);
    } finally {
      client.close();
    }
  });

  it("resolves a hover to an in-scope value, and never runs an arbitrary/unknown expression that could unwind the suspension", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, THROWS_FIXTURE);
      const frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "h");

      const known = await client.request<{ result: string }>("evaluate", {
        expression: "x",
        frameId: frames[0].id,
        context: "hover",
      });
      assert.strictEqual(known.result, "5");

      const unknown = await client.request<{ result: string }>("evaluate", {
        expression: "zzz",
        frameId: frames[0].id,
        context: "hover",
      });
      assert.strictEqual(unknown.result, "");

      const expr = await client.request<{ result: string }>("evaluate", {
        expression: "x+`a",
        frameId: frames[0].id,
        context: "hover",
      });
      assert.strictEqual(expr.result, "");

      const variables = await localsOf(client, frames[0].id);
      assertContains(variables, { name: "x", value: "5" });
      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("resumes from the execution frame after the user inspected an outer frame (frame pointer reset)", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, FRAME_POINTER_FIXTURE, [3, 7]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "h");
      const outer = frames.find((f) => f.name === "f");
      assert.notStrictEqual(outer, undefined);

      await localsOf(client, outer!.id);

      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "g");
      assert.strictEqual(frames[0].line, 7);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("arms a breakpoint added mid-session in a not-yet-called function, and hits it on continue", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, MID_SESSION_BREAKPOINT_FIXTURE, [
        4,
      ]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "a");
      assert.strictEqual(frames[0].line, 4);

      await client.request("setBreakpoints", {
        source: { path: MID_SESSION_BREAKPOINT_FIXTURE },
        breakpoints: [{ line: 4 }, { line: 2 }],
      });

      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "b");
      assert.strictEqual(frames[0].line, 2);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("does not read the Globals scope once a queued continue has left the top-level pause", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, GLOBALS_RACE_FIXTURE, [2, 3]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 3);
      const scopes = await client.request<{
        scopes: { name: string; variablesReference: number }[];
      }>("scopes", { frameId: frames[0].id });
      assert.strictEqual(scopes.scopes[0].name, "Globals");

      const continued = client.request("continue", { threadId });
      const globals = client.request<{ variables: unknown[] }>("variables", {
        variablesReference: GLOBALS_VAR_REF,
      });
      await continued;
      const result = await globals;
      assert.deepStrictEqual(result.variables, []);

      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "f");
      assert.strictEqual(frames[0].line, 2);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("reports the current-statement column in original coordinates for a mid-line function (temp-file column shift undone)", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, MID_LINE_FN_FIXTURE);
      const frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "g");
      assert.strictEqual(frames[0].line, 1);
      assert.ok(frames[0].column > 7);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("stops at a breakpoint inside a nested/anonymous lambda, with that lambda's own locals", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, BREAKPOINTS_FIXTURE, [3]);
      const frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 3);
      assert.strictEqual(frames[0].source?.path, BREAKPOINTS_FIXTURE);

      const variables = await localsOf(client, frames[0].id);
      assertContains(variables, { name: "y", value: "5" });

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("stops at each of two breakpoints in the same function in turn, not skipping the second", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, BREAKPOINTS_FIXTURE, [5, 6]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 5);
      assert.strictEqual(frames[0].name, "g");

      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 6);
      assert.strictEqual(frames[0].name, "g");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("stops on every iteration of a native while loop at a single breakpoint, in one call", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, LOOP_FIXTURE, [4]);
      for (let i = 1; i <= 3; i++) {
        const frames = await stackFrames(client, threadId);
        assert.strictEqual(frames[0].line, 4);
        const variables = await localsOf(client, frames[0].id);
        assertContains(variables, { name: "c", value: String(i) });
        await client.request("continue", { threadId });
        if (i < 3) await client.waitForEvent("stopped");
      }
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("revisits the control-block header of a single-line do loop on every Step Over iteration", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, DO_LOOP_FIXTURE, [3]);
      const cols: number[] = [];
      for (let i = 0; i < 12; i++) {
        const frames = await stackFrames(client, threadId);
        if (frames[0].line !== 3) break;
        cols.push(frames[0].column ?? -1);
        await client.request("next", { threadId });
        await client.waitForEvent("stopped");
      }
      assert.strictEqual(cols[0], 3);
      assert.strictEqual(cols[1], 9);
      assert.ok(cols.filter((c) => c === 3).length > 1);
      for (let i = 1; i < cols.length; i++) {
        assert.notStrictEqual(cols[i], cols[i - 1]);
      }
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("stops at a top-level statement breakpoint, with a Globals scope, then at a second one", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, BREAKPOINTS_FIXTURE, [7, 8]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 7);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].source?.path, BREAKPOINTS_FIXTURE);

      const globals = await localsOf(client, frames[0].id);
      assertContains(globals, { name: "g" });

      const evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "1+1",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "2");

      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 8);
      assert.strictEqual(frames[0].name, "<top level>");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps into a global function called from a top-level statement", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, BREAKPOINTS_FIXTURE, [7]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 7);

      await client.request("stepIn", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "g");
      assert.strictEqual(frames[0].source?.path, BREAKPOINTS_FIXTURE);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps over a top-level statement without entering the function it calls", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, BREAKPOINTS_FIXTURE, [7]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 7);

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 8);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps out of a function called directly from a top-level statement, back to the top level", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, BREAKPOINTS_FIXTURE, [3]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 3);

      await client.request("stepOut", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 8);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps a top-level statement at a time even when several share one source line", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, TOP_LEVEL_STATEMENTS_FIXTURE, [1]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 1);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].column, 1);

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 1);
      assert.strictEqual(frames[0].column, 6);
      let evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "a",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "1");

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 1);
      assert.strictEqual(frames[0].column, 11);
      evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "b",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "2");

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].column, 1);
      evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "c",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "3");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("keeps an indented continuation line with the statement it continues", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, CONTINUATION_FIXTURE, [1]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 1);

      for (const [line, name, value] of [
        [4, "a", "3"],
        [7, "b", "7"],
        [11, "c", "11"],
      ] as const) {
        await client.request("next", { threadId });
        await client.waitForEvent("stopped");
        frames = await stackFrames(client, threadId);
        assert.strictEqual(frames[0].line, line);
        const evaluated = await client.request<{ result: string }>("evaluate", {
          expression: name,
          context: "repl",
        });
        assert.strictEqual(evaluated.result, value);
      }

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps over comment and empty lines between top-level statements", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, COMMENTS_FIXTURE, [3]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 3);
      assert.strictEqual(frames[0].column, 1);

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 5);
      let evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "a",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "1");

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 10);
      evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "b",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "2");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("maps a frame back to its real source file when stepping into a function an earlier debug session defined", async () => {
    const definer = DapClient.start();
    try {
      await definer.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await definer.waitForEvent("initialized");
      await definer.request("launch", {
        program: CROSS_DEFINER_FIXTURE,
      });
      await definer.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await definer.request("configurationDone", {});
      await definer.waitForEvent("terminated");
      await definer.request("disconnect", {});
    } finally {
      definer.close();
    }

    const client = DapClient.start();
    try {
      const threadId = await launch(client, CROSS_CALLER_FIXTURE, [1]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 1);

      await client.request("stepIn", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "crossFn");
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].source?.path, CROSS_DEFINER_FIXTURE);
      assert.strictEqual(frames[1].source?.path, CROSS_CALLER_FIXTURE);
      assert.strictEqual(frames[1].name, "crossCaller.q");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("shows a read-only virtual document for a function that has no source file on disk", async () => {
    const client = DapClient.start();
    try {
      const session = getOrCreateDebugTerminal(FIXTURES);
      await session.ready;
      await session.process.sendCommand(
        'value "vfn:{[a]\\n  b:a+1;\\n  \'boom\\n  }"',
        false,
      );

      const threadId = await launch(client, VIRTUAL_CALLER_FIXTURE);
      const frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "vfn");
      assert.ok(frames[0].source?.sourceReference > 0);
      assert.ok(!frames[0].source?.path);
      assert.strictEqual(frames[0].line, 3);

      const src = await client.request<{ content: string }>("source", {
        sourceReference: frames[0].source!.sourceReference,
      });
      assert.ok(src.content.includes("b:a+1"));
      assert.ok(src.content.includes("'boom"));

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps line-by-line through a function that has no source file on disk", async () => {
    const client = DapClient.start();
    try {
      const session = getOrCreateDebugTerminal(FIXTURES);
      await session.ready;
      await session.process.sendCommand(
        'value "vstep:{[a]\\n  b:a+1;\\n  c:b+1;\\n  d:c+1;\\n  d }"',
        false,
      );

      const threadId = await launch(client, VSTEP_CALLER_FIXTURE, [1]);
      await client.request("stepIn", { threadId });
      await client.waitForEvent("stopped");

      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "vstep");
      assert.ok(!frames[0].source?.path);
      const ref = frames[0].source?.sourceReference;
      assert.ok(ref > 0);
      assert.strictEqual(frames[0].line, 2);

      for (const expected of [3, 4, 5]) {
        await client.request("next", { threadId });
        await client.waitForEvent("stopped");
        frames = await stackFrames(client, threadId);
        assert.strictEqual(frames[0].line, expected);
        assert.strictEqual(frames[0].source?.sourceReference, ref);
      }

      await client.request("next", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps into a module function imported via `use`, then back out to the calling file", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, FOO_FIXTURE, [2]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].source?.path, FOO_FIXTURE);

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 3);

      await client.request("stepIn", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "0mod.0bar.add");
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].source?.path, BAR_MODULE_FIXTURE);
      assert.strictEqual(frames[1].source?.path, FOO_FIXTURE);
      assert.strictEqual(frames[1].line, 3);

      const locals = await localsOf(client, frames[0].id);
      assertContains(locals, { name: "x", value: "2" });
      assertContains(locals, { name: "y", value: "3" });

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "0mod.0bar.add");
      assert.strictEqual(frames[0].line, 3);

      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 4);
      assert.strictEqual(frames[0].source?.path, FOO_FIXTURE);

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("steps out of a module function back to the calling file, leaving the process healthy", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, FOO_FIXTURE, [2]);
      await client.request("next", { threadId });
      await client.waitForEvent("stopped");
      await client.request("stepIn", { threadId });
      await client.waitForEvent("stopped");
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "0mod.0bar.add");
      assert.strictEqual(frames[0].source?.path, BAR_MODULE_FIXTURE);

      await client.request("stepOut", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].name, "<top level>");
      assert.strictEqual(frames[0].line, 4);
      assert.strictEqual(frames[0].source?.path, FOO_FIXTURE);

      const evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "r",
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "6");

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("hits a breakpoint set in a `use`-imported module file (not the program file)", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: FOO_FIXTURE,
      });
      const bp = await client.request<{
        breakpoints: { verified: boolean; line: number }[];
      }>("setBreakpoints", {
        source: { path: BAR_MODULE_FIXTURE },
        breakpoints: [{ line: 2 }],
      });
      assert.strictEqual(bp.breakpoints[0].verified, true);
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      await client.waitForEvent("stopped");
      const threads = await client.request<{ threads: { id: number }[] }>(
        "threads",
      );
      const tid = threads.threads[0].id;
      const frames = await stackFrames(client, tid);
      assert.strictEqual(frames[0].name, "0mod.0bar.add");
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].source?.path, BAR_MODULE_FIXTURE);
      const locals = await localsOf(client, frames[0].id);
      assertContains(locals, { name: "x", value: "2" });

      await client.request("continue", { threadId: tid });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("hits a breakpoint set in a script pulled in with `\\l` (a root-namespace global, not a module)", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: LOAD_MAIN_FIXTURE,
      });
      const bp = await client.request<{
        breakpoints: { verified: boolean; line: number }[];
      }>("setBreakpoints", {
        source: { path: LOAD_HELPER_FIXTURE },
        breakpoints: [{ line: 2 }],
      });
      assert.strictEqual(bp.breakpoints[0].verified, true);
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });
      await client.request("configurationDone", {});
      await client.waitForEvent("stopped");
      const threads = await client.request<{ threads: { id: number }[] }>(
        "threads",
      );
      const tid = threads.threads[0].id;
      const frames = await stackFrames(client, tid);
      assert.strictEqual(frames[0].name, "hello");
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].source?.path, LOAD_HELPER_FIXTURE);
      const locals = await localsOf(client, frames[0].id);
      assertContains(locals, { name: "name", value: "world" });

      await client.request("continue", { threadId: tid });
      await client.waitForEvent("terminated");
      await client.request("disconnect", {});
    } finally {
      client.close();
    }
  });

  it("hits a breakpoint set in a `\\l`-pulled-in script again on a SECOND debug run of the same program in the same shared q process", async () => {
    async function runOnce(): Promise<"stopped" | "terminated"> {
      const client = DapClient.start();
      try {
        await client.request("initialize", {
          adapterID: "q",
          pathFormat: "path",
          linesStartAt1: true,
          columnsStartAt1: true,
        });
        await client.waitForEvent("initialized");
        await client.request("launch", {
          program: LOAD_MAIN_FIXTURE,
        });
        await client.request("setBreakpoints", {
          source: { path: LOAD_HELPER_FIXTURE },
          breakpoints: [{ line: 2 }],
        });
        await client.request("setExceptionBreakpoints", {
          filters: ["uncaught"],
        });
        await client.request("configurationDone", {});
        const outcome = await new Promise<"stopped" | "terminated">(
          (resolve, reject) => {
            const timeout = setTimeout(
              () =>
                reject(new Error("timed out waiting for stopped/terminated")),
              10000,
            );
            const check = () => {
              if (client.events.some((e) => e.event === "stopped")) {
                clearTimeout(timeout);
                resolve("stopped");
              } else if (client.events.some((e) => e.event === "terminated")) {
                clearTimeout(timeout);
                resolve("terminated");
              } else {
                setTimeout(check, 25);
              }
            };
            check();
          },
        );
        if (outcome === "stopped") {
          const threads = await client.request<{ threads: { id: number }[] }>(
            "threads",
          );
          const tid = threads.threads[0].id;
          const frames = await stackFrames(client, tid);
          assert.strictEqual(frames[0].name, "hello");
          assert.strictEqual(frames[0].line, 2);
          await client.request("continue", { threadId: tid });
          await client.waitForEvent("terminated");
        }
        await client.request("disconnect", {});
        return outcome;
      } finally {
        client.close();
      }
    }

    assert.strictEqual(await runOnce(), "stopped");
    assert.strictEqual(await runOnce(), "stopped");
  });

  it("shows a same-line prompt before a blocking top-level read0 resolves, not just after", async () => {
    const client = DapClient.start();
    try {
      await client.request("initialize", {
        adapterID: "q",
        pathFormat: "path",
        linesStartAt1: true,
        columnsStartAt1: true,
      });
      await client.waitForEvent("initialized");
      await client.request("launch", {
        program: INTERACTIVE_READ_FIXTURE,
      });
      await client.request("setExceptionBreakpoints", {
        filters: ["uncaught"],
      });

      const session = getOrCreateDebugTerminal(FIXTURES);
      void client.request("configurationDone", {});

      const start = Date.now();
      while (!terminals.outputOf(session.terminal).includes("Guess: ")) {
        if (Date.now() - start > 10000) {
          throw new Error(
            `prompt never appeared before the blocking read; got ${JSON.stringify(
              terminals.outputOf(session.terminal),
            )}`,
          );
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(!terminals.outputOf(session.terminal).includes("You said"));
      assert.strictEqual(session.process.busy, true);

      session.process.write("42\n");
      await client.waitForEvent("terminated");
      assert.ok(terminals.outputOf(session.terminal).includes("You said 42"));
    } finally {
      client.close();
    }
  });

  it("runs a program containing k) lines, stopping on one as a top-level statement", async () => {
    const client = DapClient.start();
    try {
      const threadId = await launch(client, FOREIGN_FIXTURE, [2]);
      let frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 2);
      assert.strictEqual(frames[0].name, "<top level>");

      await client.request("setBreakpoints", {
        source: { path: FOREIGN_FIXTURE },
        breakpoints: [{ line: 7 }],
      });
      await client.request("continue", { threadId });
      await client.waitForEvent("stopped");
      frames = await stackFrames(client, threadId);
      assert.strictEqual(frames[0].line, 7);
      const evaluated = await client.request<{ result: string }>("evaluate", {
        expression: "b",
        frameId: frames[0].id,
        context: "repl",
      });
      assert.strictEqual(evaluated.result, "2");

      const oneSpace = await client.request<{ result: string }>("evaluate", {
        expression: "-3!get`v",
        frameId: frames[0].id,
        context: "repl",
      });
      assert.strictEqual(oneSpace.result, '"k){x+\\n 1}"');

      await client.request("continue", { threadId });
      await client.waitForEvent("terminated");
      assert.ok((await terminals.waitFor("done")).includes("done"));
    } finally {
      client.close();
    }
  });
  describe("KXI-73916", () => {
    it("reports the executing line of each frame in an uncaught error", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, STACK_LINES_FIXTURE);
        const frames = await stackFrames(client, threadId);
        assert.deepStrictEqual(
          frames.slice(0, 3).map((f) => `${f.name}:${f.line}`),
          ["quux:8", "bar:5", "foo:2"],
        );
        const info = await client.request<{
          details: { stackTrace: string };
        }>("exceptionInfo", { threadId });
        const report = info.details.stackTrace.split("\n");
        const at = report.findIndex((l) => l.includes("stackLines.q:8:"));
        assert.ok(at >= 0, info.details.stackTrace);
        assert.strictEqual(report[at + 1], "    x + 2");
        assert.strictEqual(report[at + 2], "      ^");
        await client.request("disconnect", {});
      } finally {
        client.close();
      }
    });

    it("wraps a long error signal in the exception details", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, LONG_ERROR_FIXTURE);
        const info = await client.request<{
          details: { stackTrace: string };
        }>("exceptionInfo", { threadId });
        const lines = info.details.stackTrace.split("\n");
        const signal = lines
          .slice(
            0,
            lines.findIndex((l) => l.includes("longError.q:2:")),
          )
          .join("");
        assert.ok(signal.startsWith("'0x8c6b8b"));
        assert.ok(signal.endsWith("c64d8"));
        assert.ok(lines.every((l) => l.length <= 100));
        await client.request("disconnect", {});
      } finally {
        client.close();
      }
    });

    it("does not stop on a branch of a conditional that does not run", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, COND_STEP_FIXTURE, [2]);
        assert.deepStrictEqual(
          await stopsWhileStepping(client, "next", threadId),
          ["fibonacci:2", "fibonacci:5"],
        );
      } finally {
        client.close();
      }
    });

    it("steps through an anonymous function", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, ANON_STEP_FIXTURE, [2]);
        assert.deepStrictEqual(
          await stopsWhileStepping(client, "next", threadId),
          ["<lambda>:2", "<lambda>:3", "<lambda>:4", "<lambda>:5"],
        );
      } finally {
        client.close();
      }
    });

    it("steps into a nested function called on the current line", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, NESTED_STEP_IN_FIXTURE, [2]);
        assert.deepStrictEqual(
          await stopsWhileStepping(client, "stepIn", threadId),
          ["foo:2", "foo:3", "foo:5"],
        );
        const frames = await stackFrames(client, threadId).catch(() => []);
        assert.ok(frames.length === 0 || frames[0].line !== 1);
      } finally {
        client.close();
      }
    });

    it("steps into and continues into a function called through each", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, ITERATOR_BREAK_FIXTURE, [6]);
        assert.strictEqual(await step(client, "stepIn", threadId), "stopped");
        const frames = await stackFrames(client, threadId);
        assert.strictEqual(`${frames[0].name}:${frames[0].line}`, "g:2");
        await client.request("disconnect", {});
      } finally {
        client.close();
      }
      const next = DapClient.start();
      try {
        const threadId = await launch(next, ITERATOR_BREAK_FIXTURE, [5, 2]);
        assert.strictEqual(await step(next, "continue", threadId), "stopped");
        const frames = await stackFrames(next, threadId);
        assert.strictEqual(`${frames[0].name}:${frames[0].line}`, "g:2");
        await next.request("disconnect", {});
      } finally {
        next.close();
      }
    });

    it("keeps q running after disconnecting at a breakpoint", async () => {
      for (const [program, line] of [
        [BREAKPOINTS_FIXTURE, 3],
        [ITERATOR_BREAK_FIXTURE, 2],
      ] as const) {
        const client = DapClient.start();
        try {
          await launch(client, program, [line]);
          const q = getOrCreateDebugTerminal(FIXTURES).process;
          await client.request("disconnect", {});
          assert.strictEqual(q.exited, false);
          assert.strictEqual((await q.sendCommand("1+1", false)).output, "2");
        } finally {
          client.close();
        }
      }
    });

    it("prints a statement's value the way the REPL does", async () => {
      const client = DapClient.start();
      try {
        const terminal = getOrCreateDebugTerminal(FIXTURES).terminal;
        const before = terminals.outputOf(terminal).length;
        await client.request("initialize", {
          adapterID: "q",
          pathFormat: "path",
          linesStartAt1: true,
          columnsStartAt1: true,
        });
        await client.waitForEvent("initialized");
        await client.request("launch", { program: TABLE_VALUE_FIXTURE });
        await client.request("configurationDone", {});
        await client.waitForEvent("terminated");
        const out = (await terminals.waitFor("after", terminal))
          .slice(before)
          .replace(/\r/g, "");
        assert.ok(out.includes("a\n-\n0\n1\n2\n"), out);
        assert.ok(out.includes("c\n-\n7\n8\n"), out);
        assert.ok(!out.includes("+(,`"), out);
      } finally {
        client.close();
      }
    });

    it("does not print the trap marker when stepping into a function", async () => {
      const client = DapClient.start();
      try {
        const terminal = getOrCreateDebugTerminal(FIXTURES).terminal;
        const threadId = await launch(client, STEP_IN_MARKER_FIXTURE, [5]);
        const before = terminals.outputOf(terminal).length;
        assert.deepStrictEqual(
          await stopsWhileStepping(client, "stepIn", threadId),
          ["f:5", "g:2", "f:5", "f:6"],
        );
        const out = terminals.outputOf(terminal).slice(before);
        assert.ok(!/^#\d+\s*$/m.test(out.replace(/\r/g, "")), out);
      } finally {
        client.close();
      }
    });

    it("ends the session cleanly when the Debug Console aborts with a backslash", async () => {
      const client = DapClient.start();
      try {
        const threadId = await launch(client, CONSOLE_ABORT_FIXTURE);
        const frames = await stackFrames(client, threadId);
        const from = client.events.length;
        await client.request("evaluate", {
          expression: "\\",
          frameId: frames[0].id,
          context: "repl",
        });
        assert.strictEqual(await settle(client, from), "terminated");
        await client.request("disconnect", {});
      } finally {
        client.close();
      }
      const next = DapClient.start();
      try {
        const threadId = await launch(next, STACK_LINES_FIXTURE);
        assert.strictEqual((await stackFrames(next, threadId))[0].name, "quux");
        await next.request("disconnect", {});
      } finally {
        next.close();
      }
    });
  });
});
