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

import { validateUtils } from "../../../src/utils/validateUtils";

describe("validateUtils", () => {
  describe("isValidLength", () => {
    it("should return true if value length is within range", () => {
      const value = "test-value";
      const lower = 1;
      const upper = 20;
      const result = validateUtils.isValidLength(value, lower, upper);

      assert.strictEqual(result, true);
    });

    it("should return false if value length is less than lower bound", () => {
      const value = "test-value";
      const lower = 20;
      const upper = 30;
      const result = validateUtils.isValidLength(value, lower, upper);

      assert.strictEqual(result, false);
    });

    it("should return false if value length is greater than upper bound", () => {
      const value = "test-value";
      const lower = 1;
      const upper = 5;
      const result = validateUtils.isValidLength(value, lower, upper);

      assert.strictEqual(result, false);
    });

    it("should return false if lower bound is greater than upper bound", () => {
      const value = "test-value";
      const lower = 30;
      const upper = 20;
      const result = validateUtils.isValidLength(value, lower, upper);

      assert.strictEqual(result, false);
    });

    it("should return true if upper bound is greater than max integer", () => {
      const value = "test-value";
      const lower = 1;
      const upper = 2147483648;
      const result = validateUtils.isValidLength(value, lower, upper);

      assert.strictEqual(result, true);
    });
  });

  describe("isAlphanumericWithHypens", () => {
    it("should return true if value is alphanumeric with hyphens", () => {
      const value = "test-value-123";
      const result = validateUtils.isAlphanumericWithHypens(value);

      assert.strictEqual(result, true);
    });
  });

  describe("isLowerCaseAlphanumericWithHypens", () => {
    it("should return true if value is lowercase alphanumeric with hyphens", () => {
      const value = "test-value-123";
      const result = validateUtils.isLowerCaseAlphanumericWithHypens(value);

      assert.strictEqual(result, true);
    });

    it("should return false if value contains uppercase characters", () => {
      const value = "Test-Value-123";
      const result = validateUtils.isLowerCaseAlphanumericWithHypens(value);

      assert.strictEqual(result, false);
    });
  });

  describe("isNumber", () => {
    it("should return true if value is a number", () => {
      const value = "123";
      const result = validateUtils.isNumber(value);

      assert.strictEqual(result, true);
    });

    it("should return false if value is not a number", () => {
      const value = "test";
      const result = validateUtils.isNumber(value);

      assert.strictEqual(result, false);
    });
  });

  describe("isBoolean", () => {
    it("should return true if value is 'true'", () => {
      const value = "true";
      const result = validateUtils.isBoolean(value);

      assert.strictEqual(result, true);
    });

    it("should return true if value is 'false'", () => {
      const value = "false";
      const result = validateUtils.isBoolean(value);

      assert.strictEqual(result, true);
    });

    it("should return false if value is not 'true' or 'false'", () => {
      const value = "test";
      const result = validateUtils.isBoolean(value);

      assert.strictEqual(result, false);
    });
  });
});
