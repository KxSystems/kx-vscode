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

import assert from "assert";

import { Validator } from "../../../src/validators/validator";

describe("Validation functions", () => {
  it("Should return validated empty object", () => {
    const vTest = new Validator("");
    const result = vTest.isNotEmpty();
    assert.strictEqual(
      result.getErrors(),
      "Value cannot be empty.",
      "Empty value should return validation error",
    );
  });

  it("Should return validated success for special char", () => {
    const vTest = new Validator("t*st");
    const result = vTest.hasSpecialChar(new RegExp("\\*"));
    assert.strictEqual(
      result.getErrors(),
      null,
      "String passed contains the special chars and didn't pass validation.",
    );
  });

  it("Should return validated fail for special char", () => {
    const vTest = new Validator("t*st");
    const result = vTest.hasSpecialChar(new RegExp("\\!"));
    assert.strictEqual(
      result.getErrors(),
      "Password must have 1 special character.",
      "String passed does not contain the special chars and should not pass.",
    );
  });

  it("Should return validated success for forbidden chars", () => {
    const vTest = new Validator("t*est");
    const result = vTest.hasNoForbiddenChar(
      new RegExp("\\!"),
      "Forbidden char found",
    );
    assert.strictEqual(
      result.getErrors(),
      null,
      "String passsed does not contain forbidden characters",
    );
  });

  it("Should return validated fail for forbidden chars", () => {
    const vTest = new Validator("t*est");
    const result = vTest.hasNoForbiddenChar(
      new RegExp("\\*"),
      "Forbidden char found",
    );
    assert.strictEqual(
      result.getErrors(),
      "Forbidden char found",
      "String passsed does not contain forbidden characters",
    );
  });

  it("Should return validated success for length", () => {
    const vTest = new Validator("test");
    const result = vTest.inLengthRange(1, 4);
    assert.strictEqual(
      result.getErrors(),
      null,
      "Length of string is in range",
    );
  });

  it("Should return validated failed for length", () => {
    const vTest = new Validator("test");
    const result = vTest.inLengthRange(1, 3);
    assert.strictEqual(
      result.getErrors(),
      "Length must be between 1 and 3 characters",
      "Length of string is not in range",
    );
  });

  it("Should return validated success for lower case", () => {
    const vTest = new Validator("test");
    const result = vTest.hasLowerCase();
    assert.strictEqual(
      result.getErrors(),
      null,
      `String contains at least one lower case char: ${result.getErrors()}`,
    );
  });

  it("Should return validated fail for lower case", () => {
    const vTest = new Validator("TEST");
    const result = vTest.hasLowerCase();
    assert.strictEqual(
      result.getErrors(),
      "Password should have at least one lowercase letter from a to z.",
      "String contains both cases",
    );
  });

  it("Should return validated success for upper case", () => {
    const vTest = new Validator("Test");
    const result = vTest.hasUpperCase();
    assert.strictEqual(
      result.getErrors(),
      null,
      "String contains at least one upper case char",
    );
  });

  it("Should return validated fail for upper case", () => {
    const vTest = new Validator("test");
    const result = vTest.hasUpperCase();
    assert.strictEqual(
      result.getErrors(),
      "Password should have at least one uppercase letter from A to Z.",
      "String does not contain upper case",
    );
  });

  it("Should return null for valid non-empty string", () => {
    const vTest = new Validator("validString");
    const result = vTest.isNotEmpty();
    assert.strictEqual(
      result.getErrors(),
      null,
      "Valid string should pass empty validation",
    );
  });

  it("Should return error for whitespace only string", () => {
    const vTest = new Validator("   ");
    const result = vTest.isNotEmpty();
    assert.strictEqual(
      result.getErrors(),
      "Value cannot be empty.",
      "Whitespace only string should fail validation",
    );
  });

  it("Should return null for minimum length boundary", () => {
    const vTest = new Validator("a");
    const result = vTest.inLengthRange(1, 5);
    assert.strictEqual(
      result.getErrors(),
      null,
      "String at minimum length should pass",
    );
  });

  it("Should return null for maximum length boundary", () => {
    const vTest = new Validator("abcde");
    const result = vTest.inLengthRange(1, 5);
    assert.strictEqual(
      result.getErrors(),
      null,
      "String at maximum length should pass",
    );
  });

  it("Should return error for string below minimum length", () => {
    const vTest = new Validator("");
    const result = vTest.inLengthRange(1, 5);
    assert.strictEqual(
      result.getErrors(),
      "Length must be between 1 and 5 characters",
      "String below minimum length should fail",
    );
  });

  it("Should return error for string above maximum length", () => {
    const vTest = new Validator("abcdef");
    const result = vTest.inLengthRange(1, 5);
    assert.strictEqual(
      result.getErrors(),
      "Length must be between 1 and 5 characters",
      "String above maximum length should fail",
    );
  });

  it("Should chain multiple validations successfully", () => {
    const vTest = new Validator("Test123!");
    const result = vTest
      .isNotEmpty()
      .hasLowerCase()
      .hasUpperCase()
      .hasSpecialChar(/[!@#$%^&*]/)
      .inLengthRange(8, 20);
    assert.strictEqual(
      result.getErrors(),
      null,
      "Valid string should pass all chained validations",
    );
  });

  it("Should accumulate multiple validation errors", () => {
    const vTest = new Validator("T");
    const result = vTest
      .hasLowerCase()
      .hasSpecialChar(/[!@#$%^&*]/)
      .inLengthRange(8, 20);
    const errors = result.getErrors();
    assert.ok(
      errors?.includes(
        "Password should have at least one lowercase letter from a to z.",
      ),
    );
    assert.ok(errors?.includes("Password must have 1 special character."));
    assert.ok(errors?.includes("Length must be between 8 and 20 characters"));
  });

  it("Should format multiple errors with line breaks", () => {
    const vTest = new Validator("");
    const result = vTest.isNotEmpty().hasLowerCase();
    const errors = result.getErrors();
    assert.ok(errors?.includes("\r\n"));
    assert.ok(errors?.includes("Value cannot be empty."));
    assert.ok(
      errors?.includes(
        "Password should have at least one lowercase letter from a to z.",
      ),
    );
  });

  it("Should handle special characters in regex patterns", () => {
    const vTest = new Validator("test@domain.com");
    const result = vTest.hasSpecialChar(/[@.]/);
    assert.strictEqual(
      result.getErrors(),
      null,
      "Should handle complex regex patterns",
    );
  });

  it("Should handle custom error messages for forbidden chars", () => {
    const customMessage = "Custom forbidden character error";
    const vTest = new Validator("test<script>");
    const result = vTest.hasNoForbiddenChar(/<|>/, customMessage);
    assert.strictEqual(
      result.getErrors(),
      customMessage,
      "Should use custom error message",
    );
  });

  it("Should validate with zero minimum length", () => {
    const vTest = new Validator("");
    const result = vTest.inLengthRange(0, 5);
    assert.strictEqual(
      result.getErrors(),
      null,
      "Empty string should pass with zero minimum length",
    );
  });

  it("Should handle edge case with equal min and max length", () => {
    const vTest = new Validator("test");
    const result = vTest.inLengthRange(4, 4);
    assert.strictEqual(
      result.getErrors(),
      null,
      "String should pass when length equals both min and max",
    );
  });

  it("Should fail when length does not match exact requirement", () => {
    const vTest = new Validator("test");
    const result = vTest.inLengthRange(5, 5);
    assert.strictEqual(
      result.getErrors(),
      "Length must be between 5 and 5 characters",
      "String should fail when length does not match exact requirement",
    );
  });
});
