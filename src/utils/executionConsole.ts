import { OutputChannel, window } from "vscode";

export class ExecutionConsole {
  public static current: ExecutionConsole | undefined;
  private _console: OutputChannel;

  constructor(private console: OutputChannel) {
    this._console = console;
  }

  public static start(): ExecutionConsole {
    if (!ExecutionConsole.current) {
      const _console = window.createOutputChannel("q Console Output");
      ExecutionConsole.current = new ExecutionConsole(_console);
    }
    return ExecutionConsole.current;
  }

  public dispose(): void {
    ExecutionConsole.current = undefined;
    this._console.dispose();
  }

  public appendQuery(query: string): void {
    if (query.length > 0) {
      this._console.appendLine(query);
      this._console.appendLine("");
    }
  }

  public append(
    output: string | string[],
    query = "",
    serverName: string
  ): void {
    this._console.show(true);
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    this._console.appendLine(
      `>>> ${serverName}  @ ${date.toLocaleTimeString()} <<<`
    );
    this.appendQuery(query);
    if (Array.isArray(output)) {
      this._console.appendLine(output[0]);
      output.forEach((o) => this._console.appendLine(o));
    } else {
      this._console.appendLine(output);
    }
    this._console.appendLine(`<<<\n`);
  }

  public appendQueryError(
    query: string,
    isConnected: boolean,
    serverName: string
  ): void {
    this._console.show(true);
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    this._console.appendLine(
      `<<< ERROR -  ${serverName}  @ ${date.toLocaleTimeString()} >>>`
    );
    if (isConnected) {
      this._console.appendLine(`ERROR (Q): ${query}`);
    } else {
      this._console.appendLine(`Please connect to an kbd+ server`);
    }
    this._console.appendLine(`<<< >>>`);
  }

  // this to debug in case debug of extension doesn't work
  public appendQueryDebug(msg: string) {
    this._console.appendLine(msg);
  }
}
