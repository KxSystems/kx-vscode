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

import { functionAt, functionLocalsAt } from "../../../src/utils/qLocals";

describe("qLocals.functionLocalsAt", () => {
  it("returns params and assigned locals of a single-line function", () => {
    const text = "g:{[z] a:z+1; a+`sym}\nf:{[x] b:x*2; g[b]}\nf[10]";
    assert.deepStrictEqual(functionLocalsAt(text, "g", 1).sort(), ["a", "z"]);
    assert.deepStrictEqual(functionLocalsAt(text, "f", 2).sort(), ["b", "x"]);
  });

  it("recovers locals of a multi-line function, excluding its own name", () => {
    const text = "c: {\n  d:1;\n  e:d+2;\n  d+e\n  }\nc[]";
    assert.deepStrictEqual(functionLocalsAt(text, "c", 3).sort(), ["d", "e"]);
  });

  it("falls back to the enclosing lambda by line when no name is given", () => {
    const text = "c: {\n  d:1;\n  e:d+2;\n  d+e\n  }\nc[]";
    assert.deepStrictEqual(functionLocalsAt(text, "", 3).sort(), ["d", "e"]);
  });

  it("returns an empty list at top level", () => {
    assert.deepStrictEqual(functionLocalsAt("a:1;\nb:2", "", 1), []);
  });
});

describe("qLocals.functionAt", () => {
  it("identifies the enclosing function name and brace line", () => {
    const text = "/ header\nx:42;\nf:{[y]\n  p:y+1;\n  p\n  }";
    assert.deepStrictEqual(functionAt(text, 4), { name: "f", startLine: 3 });
  });

  it("returns undefined for a top-level line", () => {
    assert.strictEqual(functionAt("a:1;\nb:2", 1), undefined);
  });
});
