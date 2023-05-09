import { IRule } from "./rule";
import { HasLowerCase } from "./validationFunctions/hasLowerCase";
import { HasNoForbiddenChar } from "./validationFunctions/hasNoForbiddenChar";
import { HasSpecialChar } from "./validationFunctions/hasSpecialChar";
import { IsAvailable } from "./validationFunctions/isAvailable";
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

  public async isAvailable(
    checkAvailable: (
      name: string
    ) => Promise<
      | { message: string | null; nameAvailable: boolean; reason: string }
      | boolean
    >,
    errorMessage: string
  ): Promise<Validator> {
    await this.validate(new IsAvailable(checkAvailable, errorMessage));
    return this;
  }

  private validateSync(fn: IRule): void {
    const error = fn.validate(this.value) as string | null;
    if (error) {
      this.errors.add(error);
    }
  }

  private async validate(fn: IRule): Promise<void> {
    const error = await fn.validate(this.value);
    if (error) {
      this.errors.add(error);
    }
  }
}
