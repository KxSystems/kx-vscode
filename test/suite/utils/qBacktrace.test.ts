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
  parseBacktrace,
  parseCurrentPosition,
} from "../../../src/utils/qBacktrace";

describe("qBacktrace.parseBacktrace", () => {
  it("parses interactively-defined frames (no file) with the current marker", () => {
    const text = [
      ">>[2]  g:{[z] a:z+1; a+`sym}",
      "                    ^",
      "  [1]  f:{[x] b:x*2; g[b]}",
      "                   ^",
      "  [0]  f[10]",
      "       ^",
    ].join("\n");

    const frames = parseBacktrace(text);
    assert.strictEqual(frames.length, 3);
    assert.deepStrictEqual(
      frames.map((f) => [f.index, f.current, f.file, f.text]),
      [
        [2, true, undefined, "g:{[z] a:z+1; a+`sym}"],
        [1, false, undefined, "f:{[x] b:x*2; g[b]}"],
        [0, false, undefined, "f[10]"],
      ],
    );
  });

  it("parses file:line frames and resolves the caret column", () => {
    // Build the caret line programmatically so it aligns exactly under the `.
    const body = "g:{[z] a:z+1; a+`sym}";
    const header = ">>[5]  /tmp/prog.q:1: " + body;
    const caretAbs = header.length - body.length + body.indexOf("`");
    const text = [
      header,
      " ".repeat(caretAbs) + "^",
      "  [3]  /tmp/prog.q:3: f[10]",
      "       ".padEnd("  [3]  /tmp/prog.q:3: ".length) + "^",
    ].join("\n");

    const frames = parseBacktrace(text);
    assert.strictEqual(frames.length, 2);

    const g = frames[0];
    assert.strictEqual(g.index, 5);
    assert.strictEqual(g.current, true);
    assert.strictEqual(g.file, "/tmp/prog.q");
    assert.strictEqual(g.line, 1);
    assert.strictEqual(g.text, body);
    // Caret column is reported relative to the frame's source text.
    assert.strictEqual(g.text[g.column!], "`");

    assert.strictEqual(frames[1].line, 3);
    assert.strictEqual(frames[1].current, false);
  });

  it("returns an empty list when there is no backtrace", () => {
    assert.deepStrictEqual(parseBacktrace(""), []);
    assert.deepStrictEqual(parseBacktrace("q))"), []);
  });
});

describe("qBacktrace.parseCurrentPosition", () => {
  // A suspended lambda prints its whole source under the >> frame; the caret sits
  // below the current line (not adjacent to the header), and there is a second
  // caret under the caller frame that must be ignored.
  const bt = [
    ">>[1]  /tmp/add.q:2: add:{[x;y]",
    "  p:x+1; q:y+1;",
    "             ^",
    "  p+q }",
    "  [0]  add[10;20]",
    "       ^",
  ].join("\n");

  it("reads the current frame's file, line, and caret column", () => {
    const pos = parseCurrentPosition(bt);
    assert.strictEqual(pos?.file, "/tmp/add.q");
    assert.strictEqual(pos?.line, 2);
    // Caret under the `1` of `q:y+1` (0-based column 13 of "  p:x+1; q:y+1;").
    assert.strictEqual(pos?.col, 13);
    assert.strictEqual("  p:x+1; q:y+1;"[pos!.col!], "1");
  });

  it("returns undefined when no frame is current", () => {
    assert.strictEqual(parseCurrentPosition(""), undefined);
    assert.strictEqual(
      parseCurrentPosition("  [0]  add[10;20]\n       ^"),
      undefined,
    );
  });
});
