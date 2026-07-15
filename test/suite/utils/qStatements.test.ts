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

import { splitTopLevelStatements } from "../../../src/utils/qStatements";

describe("qStatements.splitTopLevelStatements", () => {
  it("splits single-line statements and reports their lines", () => {
    const stmts = splitTopLevelStatements("a:1;\nb:2;\nc:3");
    assert.deepStrictEqual(
      stmts.map((s) => [s.startLine, s.endLine, s.text]),
      [
        [1, 1, "a:1;"],
        [2, 2, "b:2;"],
        [3, 3, "c:3"],
      ],
    );
  });

  it("keeps a multi-line function definition as one statement", () => {
    const src = "f:{[x]\n  a:x+1;\n  a*2\n  }\nf[10]";
    const stmts = splitTopLevelStatements(src);
    assert.strictEqual(stmts.length, 2);
    assert.strictEqual(stmts[0].startLine, 1);
    assert.strictEqual(stmts[0].endLine, 4);
    assert.ok(stmts[0].text.startsWith("f:{[x]"));
    assert.strictEqual(stmts[1].text, "f[10]");
  });

  it("does not treat semicolons inside braces as boundaries", () => {
    const stmts = splitTopLevelStatements("f:{a:1; b:2; a+b}");
    assert.strictEqual(stmts.length, 1);
  });

  it("ignores blank lines and keeps comments with the following code", () => {
    const src = "/ header\n\ng:1\n\nc: {\n  d:1;\n  d\n  }\n\nc[]";
    const stmts = splitTopLevelStatements(src);
    const texts = stmts.map((s) => s.text.trim());
    assert.ok(texts.some((t) => t === "g:1"));
    assert.ok(texts.some((t) => t.startsWith("c: {")));
    assert.ok(texts.some((t) => t === "c[]"));
  });

  it("returns nothing for empty or whitespace-only input", () => {
    assert.deepStrictEqual(splitTopLevelStatements(""), []);
    assert.deepStrictEqual(splitTopLevelStatements("\n\n  \n"), []);
  });
});
