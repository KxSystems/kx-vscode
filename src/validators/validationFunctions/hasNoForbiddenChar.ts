import { IRule } from '../rule';

export class HasNoForbiddenChar implements IRule {
  constructor(private readonly forbiddenChars: RegExp, private readonly errorMessage: string) {}

  public validate(value: string): string | null {
    const hasForbiddenChars = value.search(this.forbiddenChars) !== -1;
    return hasForbiddenChars ? this.errorMessage : null;
  }
}
