import { IRule } from "../rule";

export class HasLowerCase implements IRule {
  public validate(value: string): string | null {
    const hasLowerCase = value.search("/(?=.*[a-z]).*/g") !== -1;
    return hasLowerCase
      ? null
      : "Password should have at least one lowercase letter from a to z.";
  }
}
