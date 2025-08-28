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

import * as decodeUtils from "../../../src/utils/decode";

describe("decode", () => {
  describe("decodeQUTF", () => {
    it("should return undefined if the input is undefined", () => {
      const result = decodeUtils.decodeQUTF(undefined);

      assert.strictEqual(result, undefined);
    });

    it("should decode octal escape sequences in the input string", () => {
      const input = "\\344\\275\\240\\345\\245\\275";
      const expectedOutput = "你好";
      const result = decodeUtils.decodeQUTF(input);

      assert.strictEqual(result, expectedOutput);
    });

    it("should decode 1b to true and 0b to false", () => {
      const input1 = "1b";
      const input2 = "0b";
      const result1 = decodeUtils.decodeQUTF(input1);
      const result2 = decodeUtils.decodeQUTF(input2);

      assert.strictEqual(result1, true);
      assert.strictEqual(result2, false);
    });
  });

  describe("decodeUnicode", () => {
    it("should return the input string if the index is even", () => {
      const input = "hello";
      const result = decodeUtils.decodeUnicode(input, 0);

      assert.strictEqual(result, input);
    });

    it("should decode percent-encoded characters in the input string if the index is odd", () => {
      const input = "ããç ãã¯ãªããªãªããªãªããª";
      const expectedOutput = "もう眠くはないなないなないな";
      const result = decodeUtils.decodeUnicode(input, 1);

      assert.strictEqual(result, expectedOutput);
    });
  });

  describe("toOctalEscapes", () => {
    it("should return the input string if all characters have code points less than 128", () => {
      const input = "hello";
      const result = decodeUtils.toOctalEscapes(input);

      assert.strictEqual(result, input);
    });
  });

  describe("decodeOctal", () => {
    it("should decode an octal escape sequence to a character", () => {
      const input = "\\344";
      const expectedOutput = "ä";
      const result = decodeUtils.decodeOctal(input);

      assert.strictEqual(result, expectedOutput);
    });
  });
});
