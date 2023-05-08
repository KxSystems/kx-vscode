import { IRule } from "../rule";

export class HasUpperCase implements IRule {
  public validate(value: string): string | null {
    const hasUpperCase = value.search("/(?=.*[A-Z]).*/g") !== -1;
    return hasUpperCase
      ? null
      : "Password should have at least one uppercase letter from A to Z.";
  }
}
