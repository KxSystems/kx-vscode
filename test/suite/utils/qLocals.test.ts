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
