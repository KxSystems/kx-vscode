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

import * as lang from "../../../server/src/parser";

describe("q Language", () => {
  describe("CutDrop", () => {
    it("should be part of Identifier", () => {
      const source = lang.Source.create("uri", "a_b");

      assert.strictEqual(source.tokens.length, 1);
      assert.strictEqual(source.tokens[0].tokenType, lang.Identifier);
    });
    it("should be part of Identifier", () => {
      const source = lang.Source.create("uri", "a_ b");

      assert.strictEqual(source.tokens.length, 3);
      assert.strictEqual(source.tokens[0].tokenType, lang.Identifier);
    });
    it("should be CutDrop", () => {
      const source = lang.Source.create("uri", "a _b");

      assert.strictEqual(source.tokens.length, 4);
      assert.strictEqual(source.tokens[2].tokenType, lang.CutDrop);
    });
    it("should be CutDrop", () => {
      const source = lang.Source.create("uri", "a _ b");

      assert.strictEqual(source.tokens.length, 5);
      assert.strictEqual(source.tokens[2].tokenType, lang.CutDrop);
    });
    it("should be CutDrop", () => {
      const source = lang.Source.create("uri", "a _2");

      assert.strictEqual(source.tokens.length, 4);
      assert.strictEqual(source.tokens[2].tokenType, lang.CutDrop);
    });
  });
});
