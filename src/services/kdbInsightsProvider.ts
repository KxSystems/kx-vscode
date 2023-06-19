import { Disposable, Event, EventEmitter, Memento, StatusBarItem, window } from "vscode";
import { ext } from "../extensionVariables";
import { IToken, refreshToken, signIn, signOut } from "./kdbInsights/codeFlowLogin";

interface IInsightsUserData {
  id: string;
}

interface IInsightsCache {
  user: IInsightsUserData;
  tokens: IToken;
}

class KdbInsightProvider {
  private globalState?: Memento;
  private readonly disposables: Disposable[];
  private statusBarItem?: StatusBarItem;
  private readonly eventEmitter: EventEmitter<string | undefined>;
  private readonly onCacheChange: Event<string | undefined>;
  private readonly showDataFromInsights = 'showInsightsObjects';

  constructor() {
    this.disposables = [];
    this.eventEmitter = new EventEmitter<string | undefined>();
    this.onCacheChange = this.eventEmitter.event;
  }

  public async initialize(globalState: Memento): Promise<void> {
    await this.dispose();

    this.globalState = globalState;
    this.statusBarItem = window.createStatusBarItem();
    this.statusBarItem.command = this.showDataFromInsights;

    this.onCacheChange(this.updateStatusBar, this, this.disposables);
    this.signInSilently();
  }

  public async signIn() {
    this.eventEmitter.fire(ext.insightsSigningIn);
    try {
      const token = await signIn();
      await this.updateCredentials({}, token);
    } catch (error) {
      this.eventEmitter.fire(undefined);
      throw error;
    }
  }

  public async isSignedIn(): Promise<boolean> {
    const insightsCache = this.getInsightsCache();

    if (insightsCache && insightsCache.tokens) {
      const isTokenExpired = insightsCache.tokens.accessTokenExpirationDate < new Date();
      if (isTokenExpired) {
        return this.signInSilently();
      } else {
        return true;
      }
    }

    return false;
  }

  public async signOut() {
    const insightsCache = this.getInsightsCache();
    if (insightsCache && insightsCache.tokens && insightsCache.tokens.accessToken) {
      await signOut(insightsCache.tokens.accessToken);
    }

    this.cleanCredentials();
  }

  private getInsightsCache(): IInsightsCache | undefined {
    return this.globalState ? this.globalState.get<IInsightsCache>(ext.globalStateKeys.insightsCredentialsCacheKey) : undefined;
  }

  private updateInsightsCache(newInsightsCache?: IInsightsCache): Promise<void> {
    if (this.globalState) {
      await this.globalState.update(ext.globalStateKeys.insightsCredentialsCacheKey, newInsightsCache);
    }
  }

  private async updateCredentials(user: any, tokens: IToken): Promise<void> {
    await this.updateInsightsCache({ user, tokens });

    if (tokens) {
      this.eventEmitter.fire(ext.insightsSigningIn);
    } else {
      this.eventEmitter.fire(undefined);
    }
  }

  private async cleanCredentials(): Promise<void> {
    await this.updateInsightsCache();
    this.eventEmitter.fire(undefined);
  }

  private async signInSilently(): Promise<boolean> {
    const insightsCache = this.getInsightsCache();
     
    if (insightsCache && insightsCache.tokens && insightsCache.tokens.refreshToken) {
      try {
        this.eventEmitter.fire(ext.insightsSigningIn);
        const newToken = await refreshToken(insightsCache.tokens.refreshToken);
        this.updateCredentials({}, newToken);
      } catch (error) {
        await this.cleanCredentials();
        return false;
      }
    }
    return false;
  }

  private updateStatusBar(event?: string): void {
    if (this.statusBarItem) {
      switch (event) {
        case ext.insightsSigningIn:
          this.statusBarItem.text = "Insights: Signing in...";
          this.statusBarItem.show();
          break;
        default:
          const insightsCache = this.
      }
    }
  }

  public async dispose(): Promise<void> {
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }

    this.globalState = undefined;
    this.statusBarItem = undefined;
  }
}
