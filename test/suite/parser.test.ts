/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import { lint } from "../../server/src/linter";
import { generateTextMateGrammar, parse } from "../../server/src/parser";

describe("QParser", () => {
  describe("language", () => {
    it("should generate TextMate grammar file", () => {
      assert.ok(generateTextMateGrammar());
    });
  });
  describe("parse", () => {
    it("should not throw on empty text", () => {
      assert.doesNotThrow(() => parse(""));
      assert.doesNotThrow(() => parse(" "));
      assert.doesNotThrow(() => parse("\n"));
    });
    it("should not throw on missing scope", () => {
      assert.doesNotThrow(() => parse("}"));
      assert.doesNotThrow(() => parse("{\n}"));
      assert.doesNotThrow(() => parse("]"));
      assert.doesNotThrow(() => parse("[\n]"));
      assert.doesNotThrow(() => parse(")"));
      assert.doesNotThrow(() => parse("(\n)"));
      assert.doesNotThrow(() => parse("from"));
      assert.doesNotThrow(() => parse("select\nfrom"));
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
  it("should not lint unusedParam", () => {
    const text = "{[a];([]b:a)}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should lint unusedVar", () => {
    const text = "{a:1}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "UNUSED_VAR");
  });
  it("should not lint unusedVar", () => {
    const text = "{a::1}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should not lint unusedVar", () => {
    const text = "{a:1;([]b:a)}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should not lint unusedVar", () => {
    const text = "{.foo.a:1}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should lint declaredAfterUse", () => {
    const text = "a;a:1";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].code, "DECLARED_AFTER_USE");
  });
  it("should not lint declaredAfterUse", () => {
    const text = "a:1;a;a:1";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should not lint declaredAfterUse", () => {
    const text = "a;{a:1;a}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should not lint declaredAfterUse", () => {
    const text = "[1=1;[a:1;b:1];[a;b]]";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should not lint declaredAfterUse", () => {
    const text = "[[a:1;b:1;a;b];c:1;[a;b;c]]";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
  it("should not lint declaredAfterUse", () => {
    const text = "{[a]a;a:1}";
    const result = lint(parse(text));
    assert.strictEqual(result.length, 0);
  });
});
