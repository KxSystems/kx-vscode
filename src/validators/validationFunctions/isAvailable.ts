import { IRule } from "../rule";

export class IsAvailable implements IRule {
  constructor(
    private readonly checkAvailable: (name: string) => Promise<
      | {
          message: string | null;
          nameAvailable: boolean;
          reason: string;
        }
      | boolean
    >,
    private readonly errorMessage?: string
  ) {}

  public async validate(name: string): Promise<string | null> {
    if (!!name) {
      const response = (await this.checkAvailable(name)) as {
        message: string;
        nameAvailable: boolean;
        reason: string;
      };
      if (
        response &&
        !response.nameAvailable &&
        response.reason === "AlreadyExists"
      ) {
        return this.errorMessage || response.message;
      }
    }
    return null;
  }
}
