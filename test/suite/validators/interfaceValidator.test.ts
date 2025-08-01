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

import { validateScratchpadOutputVariableName } from "../../../src/validators/interfaceValidator";

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
