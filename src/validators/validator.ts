/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import { HasLowerCase } from "./validationFunctions/hasLowerCase";
import { HasNoForbiddenChar } from "./validationFunctions/hasNoForbiddenChar";
import { HasSpecialChar } from "./validationFunctions/hasSpecialChar";
import { IsNotEmpty } from "./validationFunctions/isNotEmpty";
import { LengthRange } from "./validationFunctions/lengthRange";

export class Validator {
  private errors: Set<string> = new Set();

  constructor(private readonly value: string) {}

  public getErrors(): string | null {
    return Array.from(this.errors).join("\r\n") || null;
  }

  public isNotEmpty(): Validator {
    this.validateSync(new IsNotEmpty());
    return this;
  }

  public hasSpecialChar(specialChars: RegExp): Validator {
    this.validateSync(new HasSpecialChar(specialChars));
    return this;
  }

  public hasNoForbiddenChar(
    forbiddenChars: RegExp,
    errorMessage: string
  ): Validator {
    this.validateSync(new HasNoForbiddenChar(forbiddenChars, errorMessage));
    return this;
  }

  public inLengthRange(min: number, max: number): Validator {
    this.validateSync(new LengthRange(min, max));
    return this;
  }

  public hasLowerCase(): Validator {
    this.validateSync(new HasLowerCase());
    return this;
  }

  private validateSync(fn: IRule): void {
    const error = fn.validate(this.value) as string | null;
    if (error) {
      this.errors.add(error);
    }
  }
}
