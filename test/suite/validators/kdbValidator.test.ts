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
import * as sinon from "sinon";

import { ext } from "../../../src/extensionVariables";
import * as kdbValidators from "../../../src/validators/kdbValidator";

describe("kdbValidator", () => {
  it("Should return fail for server alias that is blank or undefined", () => {
    const result = kdbValidators.validateServerAlias(undefined, false);

    assert.strictEqual(
      result,
      undefined,
      "Server alias that is undefined should validate as undefined",
    );
  });

  it("Should fail if the Alias already exist", () => {
    sinon.stub(kdbValidators, "isAliasInUse").returns(true);
    ext.kdbConnectionAliasList.push("teste");
    const result = kdbValidators.validateServerAlias("teste", false);

    assert.strictEqual(
      result,
      "Server Name is already in use. Please use a different name.",
    );
    sinon.restore();
    ext.kdbConnectionAliasList.pop();
  });

  it("Should return fail for server alias that starts with a space", () => {
    const result = kdbValidators.validateServerAlias(" test", false);

    assert.strictEqual(
      result,
      "Input value cannot start with a space.",
      "Input started with a space and should fail validation.",
    );
  });

  it("Should return fail for server alias that is outside the size limits", () => {
    const result = kdbValidators.validateServerAlias(
      "t".repeat(kdbValidators.MAX_STR_LEN + 1),
      false,
    );

    assert.strictEqual(
      result,
      `Input value must be between 1 and ${kdbValidators.MAX_STR_LEN} alphanumeric characters in length.`,
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server alias should not contain special chars", () => {
    const result = kdbValidators.validateServerAlias("test!", false);

    assert.strictEqual(
      result,
      "Input value must contain only alphanumeric characters and hypens",
      "Input contained special chars",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = kdbValidators.validateServerAlias(
      "InsightsEnterprise",
      false,
    );

    assert.strictEqual(
      result,
      "Input value using restricted keywords of Insights Enterprise",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = kdbValidators.validateServerAlias("local", false);

    assert.strictEqual(
      result,
      "The server name “local” is reserved for connections to the Bundled q process",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = kdbValidators.validateServerAlias("REPL", false);

    assert.strictEqual(
      result,
      "The server name 'REPL' is reserved for connections to the REPL",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail if using restricted keyword", () => {
    const result = kdbValidators.validateServerAlias("local", false);

    assert.strictEqual(
      result,
      "The server name “local” is reserved for connections to the Bundled q process",
      "Input contained restricted keyword.",
    );
  });

  it("Should return fail for server name that is blank or undefined", () => {
    const result = kdbValidators.validateServerName(undefined);

    assert.strictEqual(
      result,
      undefined,
      "Server name that is undefined should validate as undefined",
    );
  });

  it("Should return fail for server name that is outside the size limits", () => {
    const result = kdbValidators.validateServerName(
      "t".repeat(kdbValidators.MAX_STR_LEN + 1),
    );

    assert.strictEqual(
      result,
      `Input value must be between 1 and ${kdbValidators.MAX_STR_LEN} alphanumeric characters in length.`,
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server port that is blank or undefined", () => {
    const result = kdbValidators.validateServerPort(undefined);

    assert.strictEqual(
      result,
      undefined,
      "Server port that is undefined should validate as undefined",
    );
  });

  it("Should return fail for server port that is not a number", () => {
    const result = kdbValidators.validateServerPort("test");

    assert.strictEqual(
      result,
      "Input value must be a number.",
      "Input was not a number for server port.",
    );
  });

  it("Should return fail for server port that is outside of range", () => {
    const result = kdbValidators.validateServerPort("65537");

    assert.strictEqual(
      result,
      "Invalid port number, valid range is 1-65536",
      "input was not in valid port range",
    );
  });

  it("Should return success for server port that is valid", () => {
    const result = kdbValidators.validateServerPort("5001");

    assert.strictEqual(result, undefined, "Server port was valid");
  });

  it("Should return fail for server username that is blank or undefined", () => {
    const result = kdbValidators.validateServerUsername(undefined);

    assert.strictEqual(
      result,
      undefined,
      "Server username that is undefined should validate as undefined.",
    );
  });

  it("Should return fail for server username that is outside the size limits", () => {
    const result = kdbValidators.validateServerUsername(
      "t".repeat(kdbValidators.MAX_STR_LEN + 1),
    );

    assert.strictEqual(
      result,
      `Input value must be between 1 and ${kdbValidators.MAX_STR_LEN} alphanumeric characters in length.`,
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server password that is blank or undefined", () => {
    const result = kdbValidators.validateServerPassword(undefined);

    assert.strictEqual(
      result,
      undefined,
      "Server password that is undefined should validate as undefined.",
    );
  });

  it("Should return fail for server password that is outside the size limits", () => {
    const result = kdbValidators.validateServerPassword(
      "t".repeat(kdbValidators.MAX_STR_LEN + 1),
    );

    assert.strictEqual(
      result,
      `Input value must be between 1 and ${kdbValidators.MAX_STR_LEN} alphanumeric characters in length.`,
      "Input was outside the size limits.",
    );
  });

  it("Should return fail for server tls that is blank or undefined", () => {
    const result = kdbValidators.validateTls(undefined);

    assert.strictEqual(
      result,
      undefined,
      "Server tls that is undefined should validate as undefined.",
    );
  });

  it("Should return fail for server tls that is not true or false", () => {
    const result = kdbValidators.validateTls("test");

    assert.strictEqual(
      result,
      "Input value must be a boolean (true or false)",
      "Server tls should be boolean",
    );
  });

  it("Should return success for server tls that is true", () => {
    const result = kdbValidators.validateTls("true");

    assert.strictEqual(result, undefined, "Server tls is valid boolean");
  });
});
