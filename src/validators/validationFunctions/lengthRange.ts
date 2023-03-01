import { IRule } from '../rule';

export class LengthRange implements IRule {
  constructor(private readonly min: number, private readonly max: number) {}

  public validate(value: string): string | null {
    const inRange = value.length >= this.min && value.length <= this.max;
    return inRange ? null : `Length must be between ${this.min} and ${this.max} characters`;
  }
}
