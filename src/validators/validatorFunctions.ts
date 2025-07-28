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

import { IRule } from "./rule";

export class ValidatorFunctions {
  private forbiddenChars?: RegExp;
  private forbiddenCharsErrorMessage?: string;
  private specialChars?: RegExp;
  private minLength?: number;
  private maxLength?: number;

  constructor(options?: {
    forbiddenChars?: RegExp;
    forbiddenCharsErrorMessage?: string;
    specialChars?: RegExp;
    minLength?: number;
    maxLength?: number;
  }) {
    this.forbiddenChars = options?.forbiddenChars;
    this.forbiddenCharsErrorMessage = options?.forbiddenCharsErrorMessage;
    this.specialChars = options?.specialChars;
    this.minLength = options?.minLength;
    this.maxLength = options?.maxLength;
  }

  public static hasLowerCase(value: string): string | null {
    const hasLowerCase = value.search("[a-z]+") !== -1;
    return hasLowerCase
      ? null
      : "Password should have at least one lowercase letter from a to z.";
  }

  public static hasNoForbiddenChar(
    value: string,
    forbiddenChars: RegExp,
    errorMessage: string,
  ): string | null {
    const hasForbiddenChars = value.search(forbiddenChars) !== -1;
    return hasForbiddenChars ? errorMessage : null;
  }

  public static hasSpecialChar(
    value: string,
    specialChars: RegExp,
  ): string | null {
    const hasSpecialChars = value.search(specialChars) !== -1;
    return hasSpecialChars ? null : "Password must have 1 special character.";
  }

  public static hasUpperCase(value: string): string | null {
    const hasUpperCase = value.search("/(?=.*[A-Z]).*/g") !== -1;
    return hasUpperCase
      ? null
      : "Password should have at least one uppercase letter from A to Z.";
  }

  public static isNotEmpty(name: string): string | null {
    return name.trim() ? null : "Value cannot be empty.";
  }

  public static lengthRange(
    value: string,
    min: number,
    max: number,
  ): string | null {
    const inRange = value.length >= min && value.length <= max;
    return inRange
      ? null
      : `Length must be between ${min} and ${max} characters`;
  }

  public validateHasLowerCase(value: string): string | null {
    return ValidatorFunctions.hasLowerCase(value);
  }

  public validateHasNoForbiddenChar(value: string): string | null {
    if (!this.forbiddenChars || !this.forbiddenCharsErrorMessage) {
      throw new Error(
        "forbiddenChars and forbiddenCharsErrorMessage must be configured",
      );
    }
    return ValidatorFunctions.hasNoForbiddenChar(
      value,
      this.forbiddenChars,
      this.forbiddenCharsErrorMessage,
    );
  }

  public validateHasSpecialChar(value: string): string | null {
    if (!this.specialChars) {
      throw new Error("specialChars must be configured");
    }
    return ValidatorFunctions.hasSpecialChar(value, this.specialChars);
  }

  public validateHasUpperCase(value: string): string | null {
    return ValidatorFunctions.hasUpperCase(value);
  }

  public validateIsNotEmpty(name: string): string | null {
    return ValidatorFunctions.isNotEmpty(name);
  }

  public validateLengthRange(value: string): string | null {
    if (this.minLength === undefined || this.maxLength === undefined) {
      throw new Error("minLength and maxLength must be configured");
    }
    return ValidatorFunctions.lengthRange(
      value,
      this.minLength,
      this.maxLength,
    );
  }

  public static createHasLowerCaseRule(): IRule {
    return {
      validate: ValidatorFunctions.hasLowerCase,
    };
  }

  public static createHasNoForbiddenCharRule(
    forbiddenChars: RegExp,
    errorMessage: string,
  ): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.hasNoForbiddenChar(
          value,
          forbiddenChars,
          errorMessage,
        ),
    };
  }

  public static createHasSpecialCharRule(specialChars: RegExp): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.hasSpecialChar(value, specialChars),
    };
  }

  public static createHasUpperCaseRule(): IRule {
    return {
      validate: ValidatorFunctions.hasUpperCase,
    };
  }

  public static createIsNotEmptyRule(): IRule {
    return {
      validate: ValidatorFunctions.isNotEmpty,
    };
  }

  public static createLengthRangeRule(min: number, max: number): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.lengthRange(value, min, max),
    };
  }
}

// Backward compatibility exports
export const HasLowerCase = ValidatorFunctions.createHasLowerCaseRule();
export const HasNoForbiddenChar = (
  forbiddenChars: RegExp,
  errorMessage: string,
) =>
  ValidatorFunctions.createHasNoForbiddenCharRule(forbiddenChars, errorMessage);
export const HasSpecialChar = (specialChars: RegExp) =>
  ValidatorFunctions.createHasSpecialCharRule(specialChars);
export const HasUpperCase = ValidatorFunctions.createHasUpperCaseRule();
export const IsNotEmpty = ValidatorFunctions.createIsNotEmptyRule();
export const LengthRange = (min: number, max: number) =>
  ValidatorFunctions.createLengthRangeRule(min, max);
