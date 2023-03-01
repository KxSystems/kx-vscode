import { OutputChannel, window } from 'vscode';

export class Output {
  public static output(label: string, message: string): void {
    this._outputChannel.append(this.formatMessage(label, message));
  }

  public static outputLine(label: string, message: string): void {
    this._outputChannel.appendLine(this.formatMessage(label, message));
  }

  public static show(): void {
    this._outputChannel.show();
  }

  public static hide(): void {
    this._outputChannel.hide();
  }

  public static dispose(): void {
    this._outputChannel.dispose();
  }

  public static _outputChannel: OutputChannel = window.createOutputChannel('kxdb-telemetry');

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  private static formatMessage(label: string = '', message: string = ''): string {
    return `${label ? `[${label}] ` : ''}${message}`;
  }
}
