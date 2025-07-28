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
import * as validatorFuncs from "../../../src/validators/validatorFunctions";

describe("ValidatorFunctions", () => {
  describe("Static Methods", () => {
    describe("hasLowerCase", () => {
      it("should return null for strings with lowercase letters", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("password"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("Password"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("123abc"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("a"),
          null,
        );
      });

      it("should return default error message for strings without lowercase letters", () => {
        const expected =
          "Password should have at least one lowercase letter from a to z.";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("PASSWORD"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("123"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase("!@#$"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase(""),
          expected,
        );
      });

      it("should return custom error message when provided", () => {
        const customMessage = "Custom lowercase error";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasLowerCase(
            "PASSWORD",
            customMessage,
          ),
          customMessage,
        );
      });
    });

    describe("hasUpperCase", () => {
      it("should return null for strings with uppercase letters", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("Password"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("PASSWORD"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("123ABC"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("A"),
          null,
        );
      });

      it("should return default error message for strings without uppercase letters", () => {
        const expected =
          "Password should have at least one uppercase letter from A to Z.";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("password"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("123"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase("!@#$"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase(""),
          expected,
        );
      });

      it("should return custom error message when provided", () => {
        const customMessage = "Custom uppercase error";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasUpperCase(
            "password",
            customMessage,
          ),
          customMessage,
        );
      });
    });

    describe("hasSpecialChar", () => {
      const specialChars = /[!@#$%^&*(),.?":{}|<>]/;

      it("should return null for strings with special characters", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar(
            "password!",
            specialChars,
          ),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar(
            "pass@word",
            specialChars,
          ),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar(
            "!@#$",
            specialChars,
          ),
          null,
        );
      });

      it("should return default error message for strings without special characters", () => {
        const expected = "Password must have 1 special character.";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar(
            "password",
            specialChars,
          ),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar(
            "Password123",
            specialChars,
          ),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar("", specialChars),
          expected,
        );
      });

      it("should return custom error message when provided", () => {
        const customMessage = "Custom special char error";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasSpecialChar(
            "password",
            specialChars,
            customMessage,
          ),
          customMessage,
        );
      });
    });

    describe("hasNoForbiddenChar", () => {
      const forbiddenChars = /[<>]/;

      it("should return null for strings without forbidden characters", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "password",
            forbiddenChars,
          ),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "Password123!",
            forbiddenChars,
          ),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "",
            forbiddenChars,
          ),
          null,
        );
      });

      it("should return default error message for strings with forbidden characters", () => {
        const expected = "Contains forbidden characters";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "pass<word",
            forbiddenChars,
          ),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "password>",
            forbiddenChars,
          ),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "<>",
            forbiddenChars,
          ),
          expected,
        );
      });

      it("should return custom error message when provided", () => {
        const customMessage = "Custom forbidden char error";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.hasNoForbiddenChar(
            "pass<word",
            forbiddenChars,
            customMessage,
          ),
          customMessage,
        );
      });
    });

    describe("isNotEmpty", () => {
      it("should return null for non-empty strings", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("value"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("a"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("  value  "),
          null,
        );
      });

      it("should return default error message for empty or whitespace-only strings", () => {
        const expected = "Value cannot be empty.";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty(""),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("   "),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("\t"),
          expected,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("\n"),
          expected,
        );
      });

      it("should return custom error message when provided", () => {
        const customMessage = "Custom empty error";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.isNotEmpty("", customMessage),
          customMessage,
        );
      });
    });

    describe("lengthRange", () => {
      it("should return null for strings within length range", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange("password", 5, 10),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange("12345", 5, 10),
          null,
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange("1234567890", 5, 10),
          null,
        );
      });

      it("should return default error message for strings outside length range", () => {
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange("1234", 5, 10),
          "Length must be between 5 and 10 characters",
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange("12345678901", 5, 10),
          "Length must be between 5 and 10 characters",
        );
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange("", 1, 5),
          "Length must be between 1 and 5 characters",
        );
      });

      it("should return custom error message when provided", () => {
        const customMessage = "Custom length error";
        assert.strictEqual(
          validatorFuncs.ValidatorFunctions.lengthRange(
            "1234",
            5,
            10,
            customMessage,
          ),
          customMessage,
        );
      });
    });
  });

  describe("Instance Methods", () => {
    describe("constructor", () => {
      it("should create instance with default options", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.ok(validator instanceof validatorFuncs.ValidatorFunctions);
      });

      it("should create instance with custom options", () => {
        const options = {
          forbiddenChars: /[<>]/,
          forbiddenCharsErrorMessage: "Custom error",
          specialChars: /[!@#]/,
          minLength: 5,
          maxLength: 10,
        };
        const validator = new validatorFuncs.ValidatorFunctions(options);
        assert.ok(validator instanceof validatorFuncs.ValidatorFunctions);
      });
    });

    describe("validateHasLowerCase", () => {
      it("should work same as static method", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.strictEqual(validator.validateHasLowerCase("password"), null);
        assert.strictEqual(
          validator.validateHasLowerCase("PASSWORD"),
          "Password should have at least one lowercase letter from a to z.",
        );
      });

      it("should accept custom error message", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        const customMessage = "Custom lowercase error";
        assert.strictEqual(
          validator.validateHasLowerCase("PASSWORD", customMessage),
          customMessage,
        );
      });
    });

    describe("validateHasUpperCase", () => {
      it("should work same as static method", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.strictEqual(validator.validateHasUpperCase("Password"), null);
        assert.strictEqual(
          validator.validateHasUpperCase("password"),
          "Password should have at least one uppercase letter from A to Z.",
        );
      });

      it("should accept custom error message", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        const customMessage = "Custom uppercase error";
        assert.strictEqual(
          validator.validateHasUpperCase("password", customMessage),
          customMessage,
        );
      });
    });

    describe("validateIsNotEmpty", () => {
      it("should work same as static method", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.strictEqual(validator.validateIsNotEmpty("value"), null);
        assert.strictEqual(
          validator.validateIsNotEmpty(""),
          "Value cannot be empty.",
        );
      });

      it("should accept custom error message", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        const customMessage = "Custom empty error";
        assert.strictEqual(
          validator.validateIsNotEmpty("", customMessage),
          customMessage,
        );
      });
    });

    describe("validateHasNoForbiddenChar", () => {
      it("should validate with configured forbidden chars", () => {
        const validator = new validatorFuncs.ValidatorFunctions({
          forbiddenChars: /[<>]/,
          forbiddenCharsErrorMessage: "Contains forbidden characters",
        });
        assert.strictEqual(
          validator.validateHasNoForbiddenChar("password"),
          null,
        );
        assert.strictEqual(
          validator.validateHasNoForbiddenChar("pass<word"),
          "Contains forbidden characters",
        );
      });

      it("should return error message when forbidden chars not configured", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.strictEqual(
          validator.validateHasNoForbiddenChar("password"),
          "forbiddenChars must be configured",
        );
      });

      it("should accept custom error message", () => {
        const validator = new validatorFuncs.ValidatorFunctions({
          forbiddenChars: /[<>]/,
          forbiddenCharsErrorMessage: "Default error",
        });
        const customMessage = "Custom forbidden char error";
        assert.strictEqual(
          validator.validateHasNoForbiddenChar("pass<word", customMessage),
          customMessage,
        );
      });
    });

    describe("validateHasSpecialChar", () => {
      it("should validate with configured special chars", () => {
        const validator = new validatorFuncs.ValidatorFunctions({
          specialChars: /[!@#$%^&*(),.?":{}|<>]/,
        });
        assert.strictEqual(validator.validateHasSpecialChar("password!"), null);
        assert.strictEqual(
          validator.validateHasSpecialChar("password"),
          "Password must have 1 special character.",
        );
      });

      it("should return error message when special chars not configured", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.strictEqual(
          validator.validateHasSpecialChar("password"),
          "specialChars must be configured",
        );
      });

      it("should accept custom error message", () => {
        const validator = new validatorFuncs.ValidatorFunctions({
          specialChars: /[!@#]/,
        });
        const customMessage = "Custom special char error";
        assert.strictEqual(
          validator.validateHasSpecialChar("password", customMessage),
          customMessage,
        );
      });
    });

    describe("validateLengthRange", () => {
      it("should validate with configured length range", () => {
        const validator = new validatorFuncs.ValidatorFunctions({
          minLength: 5,
          maxLength: 10,
        });
        assert.strictEqual(validator.validateLengthRange("password"), null);
        assert.strictEqual(
          validator.validateLengthRange("1234"),
          "Length must be between 5 and 10 characters",
        );
      });

      it("should return error message when length range not configured", () => {
        const validator = new validatorFuncs.ValidatorFunctions();
        assert.strictEqual(
          validator.validateLengthRange("password"),
          "minLength and maxLength must be configured",
        );
      });

      it("should accept custom error message", () => {
        const validator = new validatorFuncs.ValidatorFunctions({
          minLength: 5,
          maxLength: 10,
        });
        const customMessage = "Custom length error";
        assert.strictEqual(
          validator.validateLengthRange("1234", customMessage),
          customMessage,
        );
      });
    });
  });

  describe("Rule Creation Methods", () => {
    describe("createHasLowerCaseRule", () => {
      it("should create rule with default error message", () => {
        const rule = validatorFuncs.ValidatorFunctions.createHasLowerCaseRule();
        assert.strictEqual(rule.validate("password"), null);
        assert.strictEqual(
          rule.validate("PASSWORD"),
          "Password should have at least one lowercase letter from a to z.",
        );
      });

      it("should create rule with custom error message", () => {
        const customMessage = "Custom rule error";
        const rule =
          validatorFuncs.ValidatorFunctions.createHasLowerCaseRule(
            customMessage,
          );
        assert.strictEqual(rule.validate("PASSWORD"), customMessage);
      });
    });

    describe("createHasUpperCaseRule", () => {
      it("should create rule with default error message", () => {
        const rule = validatorFuncs.ValidatorFunctions.createHasUpperCaseRule();
        assert.strictEqual(rule.validate("Password"), null);
        assert.strictEqual(
          rule.validate("password"),
          "Password should have at least one uppercase letter from A to Z.",
        );
      });

      it("should create rule with custom error message", () => {
        const customMessage = "Custom rule error";
        const rule =
          validatorFuncs.ValidatorFunctions.createHasUpperCaseRule(
            customMessage,
          );
        assert.strictEqual(rule.validate("password"), customMessage);
      });
    });

    describe("createHasSpecialCharRule", () => {
      it("should create rule with default error message", () => {
        const rule =
          validatorFuncs.ValidatorFunctions.createHasSpecialCharRule(/[!@#]/);
        assert.strictEqual(rule.validate("password!"), null);
        assert.strictEqual(
          rule.validate("password"),
          "Password must have 1 special character.",
        );
      });

      it("should create rule with custom error message", () => {
        const customMessage = "Custom rule error";
        const rule = validatorFuncs.ValidatorFunctions.createHasSpecialCharRule(
          /[!@#]/,
          customMessage,
        );
        assert.strictEqual(rule.validate("password"), customMessage);
      });
    });

    describe("createHasNoForbiddenCharRule", () => {
      it("should create rule with default error message", () => {
        const rule =
          validatorFuncs.ValidatorFunctions.createHasNoForbiddenCharRule(
            /[<>]/,
          );
        assert.strictEqual(rule.validate("password"), null);
        assert.strictEqual(
          rule.validate("pass<word"),
          "Contains forbidden characters",
        );
      });

      it("should create rule with custom error message", () => {
        const customMessage = "Custom rule error";
        const rule =
          validatorFuncs.ValidatorFunctions.createHasNoForbiddenCharRule(
            /[<>]/,
            customMessage,
          );
        assert.strictEqual(rule.validate("pass<word"), customMessage);
      });
    });

    describe("createIsNotEmptyRule", () => {
      it("should create rule with default error message", () => {
        const rule = validatorFuncs.ValidatorFunctions.createIsNotEmptyRule();
        assert.strictEqual(rule.validate("value"), null);
        assert.strictEqual(rule.validate(""), "Value cannot be empty.");
      });

      it("should create rule with custom error message", () => {
        const customMessage = "Custom rule error";
        const rule =
          validatorFuncs.ValidatorFunctions.createIsNotEmptyRule(customMessage);
        assert.strictEqual(rule.validate(""), customMessage);
      });
    });

    describe("createLengthRangeRule", () => {
      it("should create rule with default error message", () => {
        const rule = validatorFuncs.ValidatorFunctions.createLengthRangeRule(
          5,
          10,
        );
        assert.strictEqual(rule.validate("password"), null);
        assert.strictEqual(
          rule.validate("1234"),
          "Length must be between 5 and 10 characters",
        );
      });

      it("should create rule with custom error message", () => {
        const customMessage = "Custom rule error";
        const rule = validatorFuncs.ValidatorFunctions.createLengthRangeRule(
          5,
          10,
          customMessage,
        );
        assert.strictEqual(rule.validate("1234"), customMessage);
      });
    });
  });

  describe("Backward Compatibility Exports", () => {
    describe("HasLowerCase", () => {
      it("should work as exported rule", () => {
        assert.strictEqual(
          validatorFuncs.HasLowerCase.validate("password"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.HasLowerCase.validate("PASSWORD"),
          "Password should have at least one lowercase letter from a to z.",
        );
      });
    });

    describe("HasUpperCase", () => {
      it("should work as exported rule", () => {
        assert.strictEqual(
          validatorFuncs.HasUpperCase.validate("Password"),
          null,
        );
        assert.strictEqual(
          validatorFuncs.HasUpperCase.validate("password"),
          "Password should have at least one uppercase letter from A to Z.",
        );
      });
    });

    describe("HasSpecialChar", () => {
      it("should work as exported function with default error message", () => {
        const rule = validatorFuncs.HasSpecialChar(/[!@#]/);
        assert.strictEqual(rule.validate("password!"), null);
        assert.strictEqual(
          rule.validate("password"),
          "Password must have 1 special character.",
        );
      });

      it("should work as exported function with custom error message", () => {
        const customMessage = "Custom special char error";
        const rule = validatorFuncs.HasSpecialChar(/[!@#]/, customMessage);
        assert.strictEqual(rule.validate("password"), customMessage);
      });
    });

    describe("HasNoForbiddenChar", () => {
      it("should work as exported function with default error message", () => {
        const rule = validatorFuncs.HasNoForbiddenChar(/[<>]/);
        assert.strictEqual(rule.validate("password"), null);
        assert.strictEqual(
          rule.validate("pass<word"),
          "Contains forbidden characters",
        );
      });

      it("should work as exported function with custom error message", () => {
        const customMessage = "Custom forbidden char error";
        const rule = validatorFuncs.HasNoForbiddenChar(/[<>]/, customMessage);
        assert.strictEqual(rule.validate("pass<word"), customMessage);
      });
    });

    describe("IsNotEmpty", () => {
      it("should work as exported rule", () => {
        assert.strictEqual(validatorFuncs.IsNotEmpty.validate("value"), null);
        assert.strictEqual(
          validatorFuncs.IsNotEmpty.validate(""),
          "Value cannot be empty.",
        );
      });
    });

    describe("LengthRange", () => {
      it("should work as exported function with default error message", () => {
        const rule = validatorFuncs.LengthRange(5, 10);
        assert.strictEqual(rule.validate("password"), null);
        assert.strictEqual(
          rule.validate("1234"),
          "Length must be between 5 and 10 characters",
        );
      });

      it("should work as exported function with custom error message", () => {
        const customMessage = "Custom length error";
        const rule = validatorFuncs.LengthRange(5, 10, customMessage);
        assert.strictEqual(rule.validate("1234"), customMessage);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle special characters in regex correctly", () => {
      const validator = new validatorFuncs.ValidatorFunctions({
        forbiddenChars: /[[\]]/,
        forbiddenCharsErrorMessage: "Square brackets not allowed",
      });
      assert.strictEqual(
        validator.validateHasNoForbiddenChar("password"),
        null,
      );
      assert.strictEqual(
        validator.validateHasNoForbiddenChar("pass[word]"),
        "Square brackets not allowed",
      );
    });

    it("should handle unicode characters", () => {
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.hasLowerCase("pássword"),
        null,
      );
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.hasUpperCase("Pássword"),
        null,
      );
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.isNotEmpty("  café  "),
        null,
      );
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(1000);
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.hasLowerCase(longString),
        null,
      );
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.lengthRange(longString, 500, 1500),
        null,
      );
    });

    it("should handle empty regex patterns correctly", () => {
      const emptyRegex = /(?:)/;
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.hasSpecialChar(
          "password",
          emptyRegex,
        ),
        null,
      );
    });

    it("should handle undefined error messages gracefully", () => {
      assert.strictEqual(
        validatorFuncs.ValidatorFunctions.hasLowerCase("PASSWORD", undefined),
        "Password should have at least one lowercase letter from a to z.",
      );
    });
  });
});
