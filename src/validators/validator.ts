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

import { ValidatorFunctions } from "./validatorFunctions";
import { IRule } from "../models/rule";

export class Validator {
  private errors: Set<string> = new Set();

  constructor(private readonly value: string) {}

  public getErrors(): string | null {
    return Array.from(this.errors).join("\r\n") || null;
  }

  public isNotEmpty(): Validator {
    this.validateSync(ValidatorFunctions.createIsNotEmptyRule());
    return this;
  }

  public hasSpecialChar(specialChars: RegExp): Validator {
    this.validateSync(
      ValidatorFunctions.createHasSpecialCharRule(specialChars),
    );
    return this;
  }

  public hasNoForbiddenChar(
    forbiddenChars: RegExp,
    errorMessage: string,
  ): Validator {
    this.validateSync(
      ValidatorFunctions.createHasNoForbiddenCharRule(
        forbiddenChars,
        errorMessage,
      ),
    );
    return this;
  }

  public inLengthRange(min: number, max: number): Validator {
    this.validateSync(ValidatorFunctions.createLengthRangeRule(min, max));
    return this;
  }

  public hasLowerCase(): Validator {
    this.validateSync(ValidatorFunctions.createHasLowerCaseRule());
    return this;
  }

  public hasUpperCase(): Validator {
    this.validateSync(ValidatorFunctions.createHasUpperCaseRule());
    return this;
  }

  private validateSync(fn: IRule): void {
    const error = fn.validate(this.value) as string | null;
    if (error) {
      this.errors.add(error);
    }
  }
}
