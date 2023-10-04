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
import * as index from "../../src/validators/debounceValidation/index";
import * as interfaceValidator from "../../src/validators/interfaceValidator";
import * as kdbValidator from "../../src/validators/kdbValidator";
import * as rule from "../../src/validators/rule";
import * as hasLowerCase from "../../src/validators/validationFunctions/hasLowerCase";
import * as hasNoForbiddenChar from "../../src/validators/validationFunctions/hasNoForbiddenChar";
import * as hasSpecialChar from "../../src/validators/validationFunctions/hasSpecialChar";
import * as hasUpperCase from "../../src/validators/validationFunctions/hasUpperCase";
import * as isAvailable from "../../src/validators/validationFunctions/isAvailable";
import * as isNotEmpty from "../../src/validators/validationFunctions/isNotEmpty";
import * as lengthRange from "../../src/validators/validationFunctions/lengthRange";
import { Validator } from "../../src/validators/validator";

describe("interfaceValidator", () => {
  //write tests for src/validators/interfaceValidator.ts
  //function to be deleted after write the tests
  interfaceValidator;
});

describe("kdbValidator", () => {
  //write tests for src/validators/kdbValidator.ts
  //function to be deleted after write the tests
  kdbValidator;
});

describe("rule", () => {
  //write tests for src/validators/rule.ts
  //function to be deleted after write the tests
  rule;
});

describe("validator", () => {
  it("Should return validated empty object", () => {
    const vTest = new Validator("");
    const result = vTest.isNotEmpty();
    assert.strictEqual(
      result.getErrors(),
      "Value cannot be empty.",
      "Empty value should return validation error"
    );
  });

  it("Should return validated success for special char", () => {
    const vTest = new Validator("t*st");
    const result = vTest.hasSpecialChar(new RegExp("*"));
    assert.strictEqual(
      result.getErrors(),
      undefined,
      "String passed contained special chars"
    );
  });
});

describe("debounceValidation", () => {
  describe("index", () => {
    //write tests for src/validators/debounceValidation/index.ts
    //function to be deleted after write the tests
    index;
  });
});

describe("validationFunctions", () => {
  describe("hasLowerCase", () => {
    //write tests for src/validators/validationFunctions/hasLowerCase.ts
    //function to be deleted after write the tests
    hasLowerCase;
  });

  describe("hasNoForbiddenChar", () => {
    //write tests for src/validators/validationFunctions/hasNoForbiddenChar.ts
    //function to be deleted after write the tests
    hasNoForbiddenChar;
  });

  describe("hasSpecialChar", () => {
    //write tests for src/validators/validationFunctions/hasSpecialChar.ts
    //function to be deleted after write the tests
    hasSpecialChar;
  });

  describe("hasUpperCase", () => {
    //write tests for src/validators/validationFunctions/hasUpperCase.ts
    //function to be deleted after write the tests
    hasUpperCase;
  });

  describe("isAvailable", () => {
    //write tests for src/validators/validationFunctions/isAvailable.ts
    //function to be deleted after write the tests
    isAvailable;
  });

  describe("isNotEmpty", () => {
    //write tests for src/validators/validationFunctions/isNotEmpty.ts
    //function to be deleted after write the tests
    isNotEmpty;
  });

  describe("lengthRange", () => {
    //write tests for src/validators/validationFunctions/lengthRange.ts
    //function to be deleted after write the tests
    lengthRange;
  });
});
