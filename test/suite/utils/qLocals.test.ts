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
  functionAt,
  lambdaPathAt,
  lambdaStatementSeparators,
} from "../../../src/utils/qLocals";

describe("qLocals.functionAt", () => {
  it("identifies the enclosing function name and brace line", () => {
    const text = "/ header\nx:42;\nf:{[y]\n  p:y+1;\n  p\n  }";
    assert.deepStrictEqual(functionAt(text, 4), { name: "f", startLine: 3 });
  });

  it("returns undefined for a top-level line", () => {
    assert.strictEqual(functionAt("a:1;\nb:2", 1), undefined);
  });
});

describe("qLocals.lambdaPathAt", () => {
  // f (lines 1-6) contains sibling lambdas aa (line 2) and bb (lines 3-5); bb
  // contains cc (line 4). Child-lambda source order → q's `value` constant order.
  const nested =
    "f:{[x]\n" + //           1
    "  aa:{[p] p+1};\n" + //  2  aa
    "  bb:{[q]\n" + //        3  bb
    "    cc:{[r]\n" + //      4  cc
    "      r*10 };\n" + //    5  cc body
    "  cc q };\n" + //        6  bb body
    "  (aa x) + bb x }"; //   7  f body

  it("returns an empty path for a line in the top-level function body", () => {
    assert.deepStrictEqual(lambdaPathAt(nested, 7), {
      name: "f",
      path: [],
      startLine: 1,
      rootLine: 1,
    });
  });

  it("resolves a single-nested lambda to its source-order child index", () => {
    // Line 6 (`cc q`) is bb's own body; bb is the SECOND child lambda of f. (A
    // nested lambda's body maps into it, while its definition/brace line maps to
    // the enclosing scope where the assignment runs.)
    assert.deepStrictEqual(lambdaPathAt(nested, 6), {
      name: "f",
      path: [1],
      startLine: 3,
      rootLine: 1,
    });
  });

  it("resolves a doubly-nested lambda through the full descent path", () => {
    // Line 5 is inside cc; cc is the 1st child of bb, bb the 2nd child of f.
    assert.deepStrictEqual(lambdaPathAt(nested, 5), {
      name: "f",
      path: [1, 0],
      startLine: 4,
      rootLine: 1,
    });
  });

  it("keeps the outermost name for a lambda assigned to a namespaced fn", () => {
    // .ns.f (lines 1-4) contains g (lines 2-3); line 3 (`y+1`) is inside g.
    const text = ".ns.f:{[x]\n  g:{[y]\n    y+1 };\n  g x }";
    assert.deepStrictEqual(lambdaPathAt(text, 3), {
      name: ".ns.f",
      path: [0],
      startLine: 2,
      rootLine: 1,
    });
  });

  it("returns undefined when the outermost lambda has no global name", () => {
    // An anonymous top-level lambda cannot be reached with `get`, so its nested
    // breakpoints are unsupported.
    assert.strictEqual(lambdaPathAt("{[x] {y} x} each til 3", 1), undefined);
  });

  it("returns undefined for a top-level (non-lambda) line", () => {
    assert.strictEqual(lambdaPathAt("a:1;\nb:2", 1), undefined);
  });
});

describe("qLocals.lambdaStatementSeparators", () => {
  it("returns the lambda's top-level `;` positions", () => {
    // Two statements on line 2: the `;` after `p:x+1` separates them.
    const text = "add:{[x;y]\n  p:x+1; q:y+1;\n  p+q }";
    const seps = lambdaStatementSeparators(text, 2);
    assert.deepStrictEqual(
      seps.map((s) => [s.line, s.column]),
      [
        [2, 8],
        [2, 15],
      ],
    );
  });

  it("includes `;` inside control brackets (if/while/do/$)", () => {
    // Control constructs sequence their `;`-separated parts, so the condition and
    // body separators count as well as the lambda-level `;` after the `if[...]`.
    const text = "g:{[a;b]\n  if[a>0; r:1; r:2];\n  r }";
    const seps = lambdaStatementSeparators(text, 2);
    assert.deepStrictEqual(
      seps.map((s) => [s.line, s.column]),
      [
        [2, 9],
        [2, 14],
        [2, 20],
      ],
    );
  });

  it("excludes `;` in application, lists, and params", () => {
    // f[a;b] and (a;b) semicolons are argument separators, not statements; only
    // the two lambda-level `;` remain.
    const text = "h:{[a;b]\n  z:f[a;b]; w:(a;b);\n  z }";
    const seps = lambdaStatementSeparators(text, 2);
    assert.deepStrictEqual(
      seps.map((s) => [s.line, s.column]),
      [
        [2, 11],
        [2, 20],
      ],
    );
  });

  it("returns [] for a top-level line", () => {
    assert.deepStrictEqual(lambdaStatementSeparators("a:1;\nb:2", 1), []);
  });
});
