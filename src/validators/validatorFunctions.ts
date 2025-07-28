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

import { IRule } from "../models/rule";

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

  public static hasLowerCase(
    value: string,
    errorMessage: string = "Password should have at least one lowercase letter from a to z.",
  ): string | null {
    const hasLowerCase = value.search("[a-z]+") !== -1;
    return hasLowerCase ? null : errorMessage;
  }

  public static hasNoForbiddenChar(
    value: string,
    forbiddenChars: RegExp,
    errorMessage: string = "Contains forbidden characters",
  ): string | null {
    const hasForbiddenChars = value.search(forbiddenChars) !== -1;
    return hasForbiddenChars ? errorMessage : null;
  }

  public static hasSpecialChar(
    value: string,
    specialChars: RegExp,
    errorMessage: string = "Password must have 1 special character.",
  ): string | null {
    const hasSpecialChars = value.search(specialChars) !== -1;
    return hasSpecialChars ? null : errorMessage;
  }

  public static hasUpperCase(
    value: string,
    errorMessage: string = "Password should have at least one uppercase letter from A to Z.",
  ): string | null {
    const hasUpperCase = value.search("[A-Z]+") !== -1;
    return hasUpperCase ? null : errorMessage;
  }

  public static isNotEmpty(
    value: string,
    errorMessage: string = "Value cannot be empty.",
  ): string | null {
    return value.trim() ? null : errorMessage;
  }

  public static lengthRange(
    value: string,
    min: number,
    max: number,
    errorMessage?: string,
  ): string | null {
    const inRange = value.length >= min && value.length <= max;
    const defaultMessage = `Length must be between ${min} and ${max} characters`;
    return inRange ? null : errorMessage || defaultMessage;
  }

  public validateHasLowerCase(
    value: string,
    errorMessage?: string,
  ): string | null {
    return ValidatorFunctions.hasLowerCase(value, errorMessage);
  }

  public validateHasNoForbiddenChar(
    value: string,
    errorMessage?: string,
  ): string | null {
    if (!this.forbiddenChars) {
      return "forbiddenChars must be configured";
    }
    const defaultMessage =
      this.forbiddenCharsErrorMessage || "Contains forbidden characters";
    return ValidatorFunctions.hasNoForbiddenChar(
      value,
      this.forbiddenChars,
      errorMessage || defaultMessage,
    );
  }

  public validateHasSpecialChar(
    value: string,
    errorMessage?: string,
  ): string | null {
    if (!this.specialChars) {
      return "specialChars must be configured";
    }
    return ValidatorFunctions.hasSpecialChar(
      value,
      this.specialChars,
      errorMessage,
    );
  }

  public validateHasUpperCase(
    value: string,
    errorMessage?: string,
  ): string | null {
    return ValidatorFunctions.hasUpperCase(value, errorMessage);
  }

  public validateIsNotEmpty(
    value: string,
    errorMessage?: string,
  ): string | null {
    return ValidatorFunctions.isNotEmpty(value, errorMessage);
  }

  public validateLengthRange(
    value: string,
    errorMessage?: string,
  ): string | null {
    if (this.minLength === undefined || this.maxLength === undefined) {
      return "minLength and maxLength must be configured";
    }
    return ValidatorFunctions.lengthRange(
      value,
      this.minLength,
      this.maxLength,
      errorMessage,
    );
  }

  public static createHasLowerCaseRule(errorMessage?: string): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.hasLowerCase(value, errorMessage),
    };
  }

  public static createHasNoForbiddenCharRule(
    forbiddenChars: RegExp,
    errorMessage: string = "Contains forbidden characters",
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

  public static createHasSpecialCharRule(
    specialChars: RegExp,
    errorMessage?: string,
  ): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.hasSpecialChar(value, specialChars, errorMessage),
    };
  }

  public static createHasUpperCaseRule(errorMessage?: string): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.hasUpperCase(value, errorMessage),
    };
  }

  public static createIsNotEmptyRule(errorMessage?: string): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.isNotEmpty(value, errorMessage),
    };
  }

  public static createLengthRangeRule(
    min: number,
    max: number,
    errorMessage?: string,
  ): IRule {
    return {
      validate: (value: string) =>
        ValidatorFunctions.lengthRange(value, min, max, errorMessage),
    };
  }
}

// Backward compatibility exports
export const HasLowerCase = ValidatorFunctions.createHasLowerCaseRule();
export const HasNoForbiddenChar = (
  forbiddenChars: RegExp,
  errorMessage: string = "Contains forbidden characters",
) =>
  ValidatorFunctions.createHasNoForbiddenCharRule(forbiddenChars, errorMessage);
export const HasSpecialChar = (specialChars: RegExp, errorMessage?: string) =>
  ValidatorFunctions.createHasSpecialCharRule(specialChars, errorMessage);
export const HasUpperCase = ValidatorFunctions.createHasUpperCaseRule();
export const IsNotEmpty = ValidatorFunctions.createIsNotEmptyRule();
export const LengthRange = (min: number, max: number, errorMessage?: string) =>
  ValidatorFunctions.createLengthRangeRule(min, max, errorMessage);
