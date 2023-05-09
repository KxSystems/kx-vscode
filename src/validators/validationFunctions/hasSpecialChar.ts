import { IRule } from "../rule";

export class HasSpecialChar implements IRule {
  constructor(private readonly specialChars: RegExp) {}

  public validate(value: string): string | null {
    const hasSpecialChars = value.search(this.specialChars) !== -1;
    return hasSpecialChars ? null : "Password must have 1 special character.";
  }
}
