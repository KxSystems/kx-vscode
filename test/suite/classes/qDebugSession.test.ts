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
  formatValue,
  frameFuncName,
  frameName,
  isReadOnlyExpression,
  parseJsonDict,
  parseJsonNames,
  statementId,
  statementStart,
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
    assert.deepStrictEqual(parseJsonNames('"[\\"x\\",\\"y\\"]"'), ["x", "y"]);
    assert.deepStrictEqual(parseJsonNames('"[]"'), []);
    assert.deepStrictEqual(parseJsonNames("garbage"), []);
  });

  it("parses a JSON dict from .j.j output", () => {
    assert.deepStrictEqual(parseJsonDict('"{\\"a\\":1,\\"b\\":2}"'), {
      a: 1,
      b: 2,
    });
    assert.strictEqual(parseJsonDict("not-a-dict"), undefined);
  });

  it("formats values, rendering q null as `::`", () => {
    assert.strictEqual(formatValue(null), "::");
    assert.strictEqual(formatValue(42), "42");
    assert.strictEqual(formatValue([1, 2]), "[1,2]");
  });
});
