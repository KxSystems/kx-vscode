import { ExtensionContext, SecretStorage } from "vscode";

export default class AuthSettings {
  private static _instance: AuthSettings;

  constructor(private secretStorage: SecretStorage) {}

  static init(context: ExtensionContext): void {
    AuthSettings._instance = new AuthSettings(context.secrets);
  }

  static get instance(): AuthSettings {
    return AuthSettings._instance;
  }

  async storeAuthData(tokenKey: string, tokenValue: string): Promise<void> {
    this.secretStorage.store(tokenKey, tokenValue);
  }

  async getAuthData(tokenKey: string): Promise<string | undefined> {
    const result = await this.secretStorage.get(tokenKey);
    return result;
  }
}
