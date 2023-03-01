export interface IRule {
  validate(value: string): string | null | Promise<string | null>;
}
