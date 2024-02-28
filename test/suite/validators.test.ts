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

import assert from "assert";
import { validateScratchpadOutputVariableName } from "../../src/validators/interfaceValidator";
import {
  validateServerAlias,
  validateServerName,
  validateServerPassword,
  validateServerPort,
  validateServerUsername,
  validateTls,
} from "../../src/validators/kdbValidator";
import { Validator } from "../../src/validators/validator";

describe("Interface validation tests", () => {
  it("Should return successful scratchpad variable output name", () => {
    const result = validateScratchpadOutputVariableName("test");
    assert.strictEqual(
      result,
      undefined,
      "Correct input value should return success.",
    );
  });

  it("Should return failed validation with invalid scratchpad variable output name", () => {
    const result = validateScratchpadOutputVariableName(
      "ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt",
    );
    assert.strictEqual(
      result,
      "Input value must be between 1 and 64 alphanumeric characters in length.",
      "Invalid input value should return fail.",
    );
  });
});

describe("kdbValidator", () => {
  it("Should return fail for server alias that is blank or undefined", () => {
    const result = validateServerAlias(undefined, false);
    assert.strictEqual(
      result,
      undefined,
      "Server alias that is undefined should validate as undefined",
    );
  });

  it("Should return fail for server alias that starts with a space", () => {
    const result = validateServerAlias(" test", false);
    assert.strictEqual(
      result,
      "Input value cannot start with a space.",
      "Input started with a space and should fail validation.",
    );
  });

  it("Should return fail for server alias that is outside the size limits", () => {
    const result = validateServerAlias(
      "ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt",
      false,
    );
    assert.strictEqual(
      result,
      "Input value must be between 1 and 64 alphanumeric characters in length.",
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server alias should not contain special chars", () => {
    const result = validateServerAlias("test!", false);
    assert.strictEqual(
      result,
      "Input value must contain only alphanumeric characters and hypens only",
      "Input contained special chars",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = validateServerAlias("InsightsEnterprise", false);
    assert.strictEqual(
      result,
      "Input value using restricted keywords of Insights Enterprise",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = validateServerAlias("local", false);
    assert.strictEqual(
      result,
      "Input value using restricted keywords of Local for Bundle q Server",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = validateServerAlias("local", false);
    assert.strictEqual(
      result,
      "Input value using restricted keywords of Local for Bundle q Server",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail for server name that is blank or undefined", () => {
    const result = validateServerName(undefined);
    assert.strictEqual(
      result,
      undefined,
      "Server name that is undefined should validate as undefined",
    );
  });

  it("Should return fail for server name that is outside the size limits", () => {
    const result = validateServerName(
      "ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt",
    );
    assert.strictEqual(
      result,
      "Input value must be between 1 and 64 alphanumeric characters in length.",
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server port that is blank or undefined", () => {
    const result = validateServerPort(undefined);
    assert.strictEqual(
      result,
      undefined,
      "Server port that is undefined should validate as undefined",
    );
  });

  it("Should return fail for server port that is not a number", () => {
    const result = validateServerPort("test");
    assert.strictEqual(
      result,
      "Input value must be a number.",
      "Input was not a number for server port.",
    );
  });

  it("Should return fail for server port that is outside of range", () => {
    const result = validateServerPort("65537");
    assert.strictEqual(
      result,
      "Invalid port number, valid range is 1-65536",
      "input was not in valid port range",
    );
  });

  it("Should return success for server port that is valid", () => {
    const result = validateServerPort("5001");
    assert.strictEqual(result, undefined, "Server port was valid");
  });

  it("Should return fail for server username that is blank or undefined", () => {
    const result = validateServerUsername(undefined);
    assert.strictEqual(
      result,
      undefined,
      "Server username that is undefined should validate as undefined.",
    );
  });

  it("Should return fail for server username that is outside the size limits", () => {
    const result = validateServerUsername(
      "ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt",
    );
    assert.strictEqual(
      result,
      "Input value must be between 1 and 64 alphanumeric characters in length.",
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server password that is blank or undefined", () => {
    const result = validateServerPassword(undefined);
    assert.strictEqual(
      result,
      undefined,
      "Server password that is undefined should validate as undefined.",
    );
  });

  it("Should return fail for server password that is outside the size limits", () => {
    const result = validateServerPassword(
      "ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt",
    );
    assert.strictEqual(
      result,
      "Input value must be between 1 and 64 alphanumeric characters in length.",
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server tls that is blank or undefined", () => {
    const result = validateTls(undefined);
    assert.strictEqual(
      result,
      undefined,
      "Server tls that is undefined should validate as undefined.",
    );
  });

  it("Should return fail for server tls that is not true or false", () => {
    const result = validateTls("test");
    assert.strictEqual(
      result,
      "Input value must be a boolean (true or false)",
      "Server tls should be boolean",
    );
  });

  it("Should return success for server tls that is true", () => {
    const result = validateTls("true");
    assert.strictEqual(result, undefined, "Server tls is valid boolean");
  });
});

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
});
