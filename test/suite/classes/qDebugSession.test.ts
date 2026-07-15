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

import {
  QDebugSession,
  formatValue,
  frameFuncName,
  frameName,
  isReadOnlyExpression,
  parseJsonDict,
  parseJsonNames,
  qList,
  statementId,
  statementStart,
  trapKey,
  unquoteQString,
} from "../../../src/classes/qDebugSession";
import { QFrame } from "../../../src/utils/qBacktrace";

function frame(text: string): QFrame {
  return { index: 0, text, current: true };
}

describe("qDebugSession.isReadOnlyExpression", () => {
  it("allows bare and dotted name lookups", () => {
    assert.ok(isReadOnlyExpression("x"));
    assert.ok(isReadOnlyExpression(".ns.total"));
    assert.ok(isReadOnlyExpression("  tbl  "));
  });

  it("allows a single simple index", () => {
    assert.ok(isReadOnlyExpression("t[0]"));
    assert.ok(isReadOnlyExpression("d[`k]"));
  });

  it("rejects assignments and statement separators", () => {
    assert.ok(!isReadOnlyExpression("x:1"));
    assert.ok(!isReadOnlyExpression("x::1"));
    assert.ok(!isReadOnlyExpression("a:1; b:2"));
    assert.ok(!isReadOnlyExpression(".[t;();:;v]"));
  });

  it("rejects compound expressions and calls", () => {
    assert.ok(!isReadOnlyExpression("x+1"));
    assert.ok(!isReadOnlyExpression("count x"));
    assert.ok(!isReadOnlyExpression("delete from t"));
  });

  it("rejects an index that could apply a function", () => {
    assert.ok(!isReadOnlyExpression("t[f x]"));
    assert.ok(!isReadOnlyExpression('t[system "ls"]'));
    assert.ok(!isReadOnlyExpression("t[f[x]]"));
    // Simple literal indexes stay allowed.
    assert.ok(isReadOnlyExpression("t[-1]"));
    assert.ok(isReadOnlyExpression("m[`a`b]"));
  });
});

describe("qDebugSession.statementId", () => {
  // Separators are 1-based (line, column); positions passed in are 0-based.
  const seps = [
    { line: 1, column: 5 }, // `;` at 0-based col 4
    { line: 1, column: 11 }, // `;` at 0-based col 10
  ];

  it("shares an id within a statement and increments across a `;`", () => {
    assert.strictEqual(statementId(seps, 1, 0), 0);
    assert.strictEqual(statementId(seps, 1, 3), 0);
    assert.strictEqual(statementId(seps, 1, 6), 1);
    assert.strictEqual(statementId(seps, 1, 12), 2);
  });

  it("counts separators on earlier lines", () => {
    assert.strictEqual(statementId(seps, 2, 0), 2);
  });

  it("returns -1 when the line is unknown", () => {
    assert.strictEqual(statementId(seps, undefined, 3), -1);
  });
});

describe("qDebugSession.statementStart", () => {
  it("snaps to the start of the statement after the nearest `;`", () => {
    const line = "a:1; b:2; c:3";
    const seps = [
      { line: 1, column: 4 }, // `;` after `a:1`
      { line: 1, column: 9 }, // `;` after `b:2`
    ];
    // Caret inside `b:2` -> start just after the first `;`, skipping the space.
    assert.strictEqual(statementStart(seps, line, 1, 6), 5);
    assert.strictEqual(line[5], "b");
    // Caret inside `c:3` -> start after the second `;`.
    assert.strictEqual(statementStart(seps, line, 1, 11), 10);
    assert.strictEqual(line[10], "c");
    // Caret in the first statement -> line start.
    assert.strictEqual(statementStart(seps, line, 1, 1), 0);
  });
});

describe("qDebugSession.frameName / frameFuncName", () => {
  it("extracts the assigned name from a definition frame", () => {
    assert.strictEqual(frameName(frame("g:{[z] a:z+1; a}")), "g");
    assert.strictEqual(frameFuncName(frame(".ns.f:{[x] x}")), ".ns.f");
  });

  it("falls back to source text for name, undefined for func name", () => {
    assert.strictEqual(frameName(frame("f[10]")), "f[10]");
    assert.strictEqual(frameFuncName(frame("{x+1}[10]")), undefined);
  });
});

describe("qDebugSession JSON parsing helpers", () => {
  it("unwraps and unescapes a q-printed string", () => {
    assert.strictEqual(unquoteQString('"hello"'), "hello");
    assert.strictEqual(unquoteQString('"a\\"b"'), 'a"b');
    assert.strictEqual(unquoteQString("nope"), undefined);
  });

  it("parses the JSON string array from .dbg.locals", () => {
    // Raw JSON, as written to stdout via neg[1] (the untruncated path).
    assert.deepStrictEqual(parseJsonNames('["x","y"]'), ["x", "y"]);
    assert.deepStrictEqual(parseJsonNames("[]"), []);
    // q-quoted JSON, as displayed at the prompt (compatibility).
    assert.deepStrictEqual(parseJsonNames('"[\\"x\\",\\"y\\"]"'), ["x", "y"]);
    assert.deepStrictEqual(parseJsonNames('"[]"'), []);
    assert.deepStrictEqual(parseJsonNames("garbage"), []);
    assert.deepStrictEqual(parseJsonNames(""), []);
  });

  it("parses a JSON dict from .j.j output", () => {
    // Raw JSON, as written to stdout via neg[1] (the untruncated path).
    assert.deepStrictEqual(parseJsonDict('{"a":1,"b":2}'), { a: 1, b: 2 });
    // q-quoted JSON, as displayed at the prompt (compatibility).
    assert.deepStrictEqual(parseJsonDict('"{\\"a\\":1,\\"b\\":2}"'), {
      a: 1,
      b: 2,
    });
    assert.strictEqual(parseJsonDict("not-a-dict"), undefined);
    assert.strictEqual(parseJsonDict(""), undefined);
  });

  it("formats values, rendering q null as `::`", () => {
    assert.strictEqual(formatValue(null), "::");
    assert.strictEqual(formatValue(42), "42");
    assert.strictEqual(formatValue([1, 2]), "[1,2]");
  });
});

// The private members are exercised directly (via an `any` cast) with a stubbed
// driver: the session cannot be launched without a live q process.
describe("qDebugSession.serialized", () => {
  it("runs queued operations strictly in order, without interleaving", async () => {
    const session = new QDebugSession() as any;
    const events: string[] = [];
    const first = session.serialized(async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("first:end");
      return 1;
    });
    const second = session.serialized(async () => {
      events.push("second:start");
      return 2;
    });
    assert.deepStrictEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepStrictEqual(events, [
      "first:start",
      "first:end",
      "second:start",
    ]);
  });

  it("keeps the chain alive after a failed operation", async () => {
    const session = new QDebugSession() as any;
    await assert.rejects(
      session.serialized(async () => {
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.strictEqual(await session.serialized(async () => "ok"), "ok");
  });
});

describe("qDebugSession.readLocals", () => {
  it("queries the frame dict through .dbg.vals and parses the JSON", async () => {
    const calls: string[] = [];
    const session = new QDebugSession() as any;
    session.driver = {
      evaluate: async (expr: string) => {
        calls.push(expr);
        return {
          output:
            '{"a":1,"t":"<98h type; 5000000 count; too large to display>"}',
          depth: 2,
          errored: false,
        };
      },
    };

    const vars = await session.readLocals(["a", "t"]);
    assert.deepStrictEqual(calls, [".dbg.vals `a`t!(a;t)"]);
    assert.deepStrictEqual(
      vars.map((v: { name: string; value: string }) => [v.name, v.value]),
      [
        ["a", "1"],
        ["t", "<98h type; 5000000 count; too large to display>"],
      ],
    );
  });

  it("falls back to per-name queries when the dict query fails", async () => {
    const calls: string[] = [];
    const session = new QDebugSession() as any;
    session.driver = {
      evaluate: async (expr: string) => {
        calls.push(expr);
        // The dict query fails (e.g. an unset local); each name is then queried
        // individually and errored ones are skipped.
        if (expr.startsWith(".dbg.vals")) {
          return { output: "'a", depth: 2, errored: true };
        }
        return expr === "a"
          ? { output: "'a", depth: 2, errored: true }
          : { output: "42", depth: 2, errored: false };
      },
    };

    const vars = await session.readLocals(["a", "b"]);
    assert.deepStrictEqual(calls, [".dbg.vals `a`b!(a;b)", "a", "b"]);
    assert.deepStrictEqual(
      vars.map((v: { name: string; value: string }) => [v.name, v.value]),
      [["b", "42"]],
    );
  });
});

describe("qDebugSession.syncBreakpoints", () => {
  function stubbedSession(calls: string[]) {
    const session = new QDebugSession() as any;
    session.driver = {
      evaluate: async (expr: string) => {
        calls.push(expr);
        return { output: "", depth: 1, errored: false };
      },
    };
    return session;
  }

  it("gates the program file by load progress but arms other files as they resolve", async () => {
    const calls: string[] = [];
    const session = stubbedSession(calls);
    session.programPath = "/prog/main.q";
    session.sourceCache.set("/prog/main.q", "f:{[x]\n  x+1\n  }\nf[1]");
    // The helper's function starts at line 200, far beyond the program's length.
    session.sourceCache.set(
      "/lib/helper.q",
      "\n".repeat(199) + "h:{[y]\n  y*2\n  }",
    );
    session.requestedBreakpoints.set("/prog/main.q", [2]);
    session.requestedBreakpoints.set("/lib/helper.q", [201]);

    // Nothing of the program has loaded yet: its own function is not armable,
    // but the helper file's is (its lines are unrelated to program progress).
    await session.syncBreakpoints(0);
    assert.deepStrictEqual(calls, [".dbg.bs[`h;()]"]);

    // Once the program's definition has loaded, its function arms too (and the
    // already-armed helper trap is not re-armed).
    await session.syncBreakpoints(1);
    assert.deepStrictEqual(calls, [".dbg.bs[`h;()]", ".dbg.bs[`f;()]"]);
  });

  it("arms a breakpoint inside a nested lambda via its descent path", async () => {
    const calls: string[] = [];
    const session = stubbedSession(calls);
    session.programPath = "/prog/main.q";
    // f (lines 1-4) contains g (lines 2-3); the breakpoint on line 3 is g's body.
    session.sourceCache.set(
      "/prog/main.q",
      "f:{[x]\n  g:{[y]\n    y+1 };\n  g x }",
    );
    session.requestedBreakpoints.set("/prog/main.q", [3]);

    // g is the first child lambda of f, so its descent path is `enlist 0` → "0".
    await session.syncBreakpoints(4);
    assert.deepStrictEqual(calls, [".dbg.bs[`f;0]"]);
    assert.strictEqual(session.armedTraps.size, 1);
    assert.ok(
      session.armedTraps.has(
        trapKey({ name: "f", path: [0], startLine: 2, rootLine: 1 }),
      ),
    );
  });

  it("recovers traps whose breakpoints were all removed", async () => {
    const calls: string[] = [];
    const session = stubbedSession(calls);
    // A top-level trap (empty path) and a nested one (path [1,0]) both go stale.
    const top = { name: "h", path: [], startLine: 1, rootLine: 1 };
    const nested = { name: "f", path: [1, 0], startLine: 1, rootLine: 1 };
    session.armedTraps.set(trapKey(top), { name: "h", path: [] });
    session.armedTraps.set(trapKey(nested), { name: "f", path: [1, 0] });

    await session.syncBreakpoints(0);
    assert.deepStrictEqual(calls, [".dbg.bu[`h;()]", ".dbg.bu[`f;1 0]"]);
    assert.strictEqual(session.armedTraps.size, 0);
  });
});

describe("qDebugSession.trapKey / qList", () => {
  it("keys traps by name and descent path, distinguishing nested lambdas", () => {
    const top = { name: "f", path: [], startLine: 1, rootLine: 1 };
    const nested = { name: "f", path: [1, 0], startLine: 4, rootLine: 1 };
    assert.notStrictEqual(trapKey(top), trapKey(nested));
    assert.strictEqual(
      trapKey({ name: "f", path: [1, 0], startLine: 9, rootLine: 1 }),
      trapKey(nested),
    );
  });

  it("renders a descent path as a q int-list literal", () => {
    assert.strictEqual(qList([]), "()"); // the function itself
    assert.strictEqual(qList([0]), "0"); // single index (q coerces to a list)
    assert.strictEqual(qList([1, 0]), "1 0"); // multi-level descent
  });
});

describe("qDebugSession.currentFunctionResumeLine", () => {
  // f spans lines 1-4; f[1] is the top-level call.
  const source = "f:{[x]\n  x+1\n  x+2\n  }\nf[1]";

  function sessionAt(line: number, breakpoints: number[]) {
    const session = new QDebugSession() as any;
    session.programPath = "/prog/main.q";
    session.sourceCache.set("/prog/main.q", source);
    session.requestedBreakpoints.set("/prog/main.q", breakpoints);
    session.driver = {
      position: async () => ({ file: "/prog/main.q", line, col: 3 }),
    };
    return session;
  }

  it("returns the current line when the function has a further breakpoint", async () => {
    // Two breakpoints (lines 2 and 3) inside f: resuming from line 2 must step
    // to line 3 rather than run freely, so the resume line is returned.
    assert.strictEqual(await sessionAt(2, [2, 3]).currentFunctionResumeLine(), 2);
  });

  it("returns undefined when the breakpoint is the function's only one", async () => {
    // A lone breakpoint uses a free continue (once per call), so no resume line.
    assert.strictEqual(
      await sessionAt(2, [2]).currentFunctionResumeLine(),
      undefined,
    );
  });
});

describe("qDebugSession.advanceToBreakpoint", () => {
  it("steps off the resume line and stops at the next in-function breakpoint", async () => {
    const session = new QDebugSession() as any;
    session.programPath = "/prog/main.q";
    session.requestedBreakpoints.set("/prog/main.q", [2, 4]);
    // stepPosition() output: still on the resume line, then two lines forward.
    const steps = [
      { file: "/prog/main.q", line: 2, col: 3 },
      { file: "/prog/main.q", line: 3, col: 3 },
      { file: "/prog/main.q", line: 4, col: 3 },
    ];
    let i = 0;
    session.driver = {
      suspended: true,
      stopReason: "breakpoint",
      position: async () => ({ file: "/prog/main.q", line: 2, col: 3 }),
      stepPosition: async () => steps[i++],
    };

    assert.strictEqual(await session.advanceToBreakpoint(2), "breakpoint");
    // Stepped past the resume line (2), skipped the non-breakpoint line (3), and
    // stopped at line 4.
    assert.strictEqual(i, 3);
  });

  it("returns 'exited' when the function returns before another breakpoint", async () => {
    const session = new QDebugSession() as any;
    session.programPath = "/prog/main.q";
    session.requestedBreakpoints.set("/prog/main.q", [2, 4]);
    const steps: (object | undefined)[] = [
      { file: "/prog/main.q", line: 3, col: 3 },
      undefined, // the function returned; the process leaves the debugger.
    ];
    let i = 0;
    const driver: any = {
      suspended: true,
      stopReason: "breakpoint",
      position: async () => ({ file: "/prog/main.q", line: 2, col: 3 }),
      stepPosition: async () => {
        const pos = steps[i++];
        if (i >= steps.length) driver.suspended = false;
        return pos;
      },
    };
    session.driver = driver;

    assert.strictEqual(await session.advanceToBreakpoint(2), "exited");
  });
});
