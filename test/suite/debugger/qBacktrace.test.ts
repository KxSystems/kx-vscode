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
} from "../../../src/debugger/qBacktrace";

function caret(column: number): string {
  return " ".repeat(column) + "^";
}

const H = '>>[3]  /w/t.q:3: h:{[x] x+"a"}';
const G = "  [2]  /w/t.q:2: g:{[x] h[x]}";
const TOP = "  [0]  f 5";

const STACK = [H, caret(25), G, caret(24), TOP, caret(7)].join("\n");

const VIRTUAL = [
  ">>[1]  vfn:",
  "  b:a+1;",
  "  'boom",
  caret(3),
  "  }",
  "  [0]  vfn 1",
  caret(7),
].join("\n");

describe("qBacktrace", () => {
  describe("parseBacktrace", () => {
    it("should parse file frames with their caret columns", () => {
      assert.deepStrictEqual(parseBacktrace(STACK), [
        {
          index: 3,
          file: "/w/t.q",
          line: 3,
          text: 'h:{[x] x+"a"}',
          column: 8,
          current: true,
          sourceLine: undefined,
          block: [caret(25)],
        },
        {
          index: 2,
          file: "/w/t.q",
          line: 2,
          text: "g:{[x] h[x]}",
          column: 7,
          current: false,
          sourceLine: undefined,
          block: [caret(24)],
        },
        {
          index: 0,
          file: undefined,
          line: undefined,
          text: "f 5",
          column: 0,
          current: false,
          sourceLine: undefined,
          block: [caret(7)],
        },
      ]);
    });

    it("should recover the source line of a multi-line frame without a file", () => {
      const frames = parseBacktrace(VIRTUAL);
      assert.strictEqual(frames.length, 2);
      assert.deepStrictEqual(frames[0], {
        index: 1,
        file: undefined,
        line: undefined,
        text: "vfn:",
        column: undefined,
        current: true,
        sourceLine: "  'boom",
        block: ["  b:a+1;", "  'boom", caret(3), "  }"],
      });
      assert.strictEqual(frames[1].text, "vfn 1");
      assert.strictEqual(frames[1].column, 0);
    });

    it("should keep the source lines q prints under a multi-line frame", () => {
      const frames = parseBacktrace(
        [
          ">>[6]  /w/s.q:8: quux:{",
          "    x + 2",
          caret(6),
          "    }",
          "  [5]  /w/s.q:5: bar:{",
          "    quux x",
          caret(4),
          "    }",
          "",
        ].join("\n"),
      );
      assert.deepStrictEqual(
        frames.map((f) => [f.line, f.text, f.column, f.block]),
        [
          [8, "quux:{", undefined, ["    x + 2", caret(6), "    }"]],
          [5, "bar:{", undefined, ["    quux x", caret(4), "    }"]],
        ],
      );
    });

    it("should skip lines that are not frames", () => {
      const frames = parseBacktrace("'type\n" + STACK.replace(">>", "  "));
      assert.deepStrictEqual(
        frames.map((f) => [f.index, f.current]),
        [
          [3, false],
          [2, false],
          [0, false],
        ],
      );
    });

    it("should return no frames for empty output", () => {
      assert.deepStrictEqual(parseBacktrace(""), []);
    });
  });

  describe("parseCurrentPosition", () => {
    it("should pick the current frame", () => {
      const moved = STACK.replace(">>", "  ").replace("  [2]", ">>[2]");
      assert.deepStrictEqual(parseCurrentPosition(moved), {
        file: "/w/t.q",
        line: 2,
        col: 7,
        index: 2,
        sourceLine: undefined,
        name: undefined,
      });
    });

    it("should fall back to the first frame when none is current", () => {
      const output = "'type\n" + STACK.replace(">>", "  ");
      assert.deepStrictEqual(parseCurrentPosition(output), {
        file: "/w/t.q",
        line: 3,
        col: 8,
        index: 3,
        sourceLine: undefined,
        name: undefined,
      });
    });

    it("should report the name and source line of a frame without a file", () => {
      assert.deepStrictEqual(parseCurrentPosition(VIRTUAL), {
        file: undefined,
        line: undefined,
        col: 3,
        index: 1,
        sourceLine: "  'boom",
        name: "vfn",
      });
    });

    it("should name a frame from its @ suffix", () => {
      const position = parseCurrentPosition(
        ">>[1]  .foo.bar@: x+1\n" + caret(9),
      );
      assert.strictEqual(position?.name, ".foo.bar");
      assert.strictEqual(position?.file, undefined);
    });

    it("should leave the column unset when there is no caret", () => {
      const position = parseCurrentPosition(">>[0]  /w/t.q:4: a:1");
      assert.strictEqual(position?.line, 4);
      assert.strictEqual(position?.col, undefined);
    });

    it("should return undefined when there is no frame", () => {
      assert.strictEqual(parseCurrentPosition("'type"), undefined);
    });
  });
});
