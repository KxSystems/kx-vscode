import { IRule } from '../rule';

export class IsNotEmpty implements IRule {
  public validate(name: string): string | null {
    return !!name.trim() ? null : 'Value cannot be empty.';
  }
}
