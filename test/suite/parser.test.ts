/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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
import { generateTextMateGrammar, parse } from "../../server/src/parser";
import { lint } from "../../server/src/linter";

describe("QParser", () => {
  describe("language", () => {
    it("should generate TextMate grammar file", () => {
      assert.ok(generateTextMateGrammar());
    });
  });
});

describe("TSQLint", () => {
  it("should lint deprecatedDatetime", () => {
    const text = "2000.01.01T12:00:00.000";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "DEPRECATED_DATETIME");
  });
  it("should lint invalidEscape", () => {
    const text = '"\\378"';
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "INVALID_ESCAPE");
  });
  it("should lint unusedParam", () => {
    const text = "{[a]}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "UNUSED_PARAM");
  });
  it("should lint unusedVar", () => {
    const text = "{a:1}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "UNUSED_VAR");
  });
  it("should lint declaredAfterUse", () => {
    const text = "a;a:1";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "DECLARED_AFTER_USE");
  });
});
