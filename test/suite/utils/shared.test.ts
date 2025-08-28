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

import * as sharedUtils from "../../../src/utils/shared";

describe("Shared", () => {
  describe("normalizeAssemblyTarget", () => {
    it("should return qe assembly -qe", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "test-assembly-qe tier dapProcess",
      );

      assert.strictEqual(res, "test-assembly-qe tier dapProcess");
    });

    it("should return normal assembly without -qe", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "test-assembly  tier dapProcess",
      );

      assert.strictEqual(res, "test-assembly tier dapProcess");
    });

    it("should return empty string for null input", () => {
      const res = sharedUtils.normalizeAssemblyTarget(null as any);

      assert.strictEqual(res, "");
    });

    it("should return empty string for undefined input", () => {
      const res = sharedUtils.normalizeAssemblyTarget(undefined as any);

      assert.strictEqual(res, "");
    });

    it("should return empty string for empty string", () => {
      const res = sharedUtils.normalizeAssemblyTarget("");

      assert.strictEqual(res, "");
    });

    it("should return empty string for whitespace-only string", () => {
      const res = sharedUtils.normalizeAssemblyTarget("   ");

      assert.strictEqual(res, "");
    });

    it("should handle single word input", () => {
      const res = sharedUtils.normalizeAssemblyTarget("assembly");

      assert.strictEqual(res, "assembly");
    });

    it("should handle single word with -qe suffix", () => {
      const res = sharedUtils.normalizeAssemblyTarget("assembly-qe");

      assert.strictEqual(res, "assembly-qe");
    });

    it("should normalize multiple consecutive spaces", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "assembly    tier    dap",
      );

      assert.strictEqual(res, "assembly tier dap");
    });

    it("should normalize tabs and mixed whitespace", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "assembly\t\ttier\n\ndap",
      );

      assert.strictEqual(res, "assembly tier dap");
    });

    it("should trim leading and trailing spaces", () => {
      const res = sharedUtils.normalizeAssemblyTarget("  assembly tier dap  ");

      assert.strictEqual(res, "assembly tier dap");
    });

    it("should handle complex whitespace normalization", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "  \t assembly-qe   \n  tier   \t dap  \n  ",
      );

      assert.strictEqual(res, "assembly-qe tier dap");
    });

    it("should handle input with only spaces between words", () => {
      const res = sharedUtils.normalizeAssemblyTarget("assembly tier");

      assert.strictEqual(res, "assembly tier");
    });

    it("should preserve -qe in middle of assembly name", () => {
      const res = sharedUtils.normalizeAssemblyTarget("test-qe-assembly  tier");

      assert.strictEqual(res, "test-qe-assembly tier");
    });

    it("should handle special characters in assembly name", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "test_assembly-qe:v1.0   tier   dap",
      );

      assert.strictEqual(res, "test_assembly-qe:v1.0 tier dap");
    });

    it("should normalize newlines and carriage returns", () => {
      const res = sharedUtils.normalizeAssemblyTarget(
        "assembly\r\ntier\rdap\n",
      );

      assert.strictEqual(res, "assembly tier dap");
    });
  });

  describe("stripUnprintableChars", () => {
    it("should remove control characters", () => {
      const input = "abc\u0000\u0001def";
      const result = sharedUtils.stripUnprintableChars(input);

      assert.strictEqual(result, "abcdef");
    });

    it("should remove private use characters", () => {
      const input = "abc\udb80\udc00def";
      const result = sharedUtils.stripUnprintableChars(input);

      assert.strictEqual(result, "abcdef");
    });

    it("should remove unassigned characters", () => {
      const input = "abc\u0378def";
      const result = sharedUtils.stripUnprintableChars(input);

      assert.strictEqual(result, "abcdef");
    });

    it("should return original string if no unprintable chars", () => {
      const input = "normal string";
      const result = sharedUtils.stripUnprintableChars(input);

      assert.strictEqual(result, "normal string");
    });

    it("should handle empty string", () => {
      const result = sharedUtils.stripUnprintableChars("");

      assert.strictEqual(result, "");
    });
  });

  describe("errorMessage", () => {
    it("should return error message for Error instance", () => {
      const error = new Error("Test error");
      const result = sharedUtils.errorMessage(error);

      assert.strictEqual(result, "Test error");
    });

    it("should return string for string input", () => {
      const result = sharedUtils.errorMessage("Some error");

      assert.strictEqual(result, "Some error");
    });

    it("should stringify number input", () => {
      const result = sharedUtils.errorMessage(123);

      assert.strictEqual(result, "123");
    });

    it("should stringify object input", () => {
      const result = sharedUtils.errorMessage({ msg: "fail" });

      assert.strictEqual(result, "[object Object]");
    });

    it("should handle null input", () => {
      const result = sharedUtils.errorMessage(null);

      assert.strictEqual(result, "null");
    });

    it("should handle undefined input", () => {
      const result = sharedUtils.errorMessage(undefined);

      assert.strictEqual(result, "undefined");
    });
  });

  describe("cleanDapName", () => {
    it("should remove port suffix from dap name", () => {
      const result = sharedUtils.cleanDapName("my-dap:1234");

      assert.strictEqual(result, "my-dap");
    });

    it("should not change dap name without port", () => {
      const result = sharedUtils.cleanDapName("my-dap");

      assert.strictEqual(result, "my-dap");
    });

    it("should handle dap name with multiple colons", () => {
      const result = sharedUtils.cleanDapName("my:dap:name:5678");

      assert.strictEqual(result, "my:dap:name");
    });

    it("should handle empty string", () => {
      const result = sharedUtils.cleanDapName("");

      assert.strictEqual(result, "");
    });
  });

  describe("cleanAssemblyName", () => {
    it("should remove -qe suffix from assembly name", () => {
      const result = sharedUtils.cleanAssemblyName("assembly-qe");

      assert.strictEqual(result, "assembly");
    });

    it("should not change assembly name without -qe", () => {
      const result = sharedUtils.cleanAssemblyName("assembly");

      assert.strictEqual(result, "assembly");
    });

    it("should remove only trailing -qe", () => {
      const result = sharedUtils.cleanAssemblyName("test-qe-assembly-qe");

      assert.strictEqual(result, "test-qe-assembly");
    });

    it("should handle empty string", () => {
      const result = sharedUtils.cleanAssemblyName("");

      assert.strictEqual(result, "");
    });
  });
});
