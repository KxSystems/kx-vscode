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
      this._console.appendLine(`<<< Query  >>>`);
      this._console.appendLine(query);
      this._console.appendLine("");
      this._console.appendLine(`<<< Results >>>`);
    }
  }

  public append(
    output: string | string[],
    uniqLabel: string,
    query = "",
    time = 0
  ): void {
    this._console.show(true);
    this._console.clear();
    const date = new Date();
    this._console.appendLine(
      `>>> ${uniqLabel} @ ${date.toLocaleTimeString()} ---- ${time}(ms) elapsed <<<`
    );
    this.appendQuery(query);
    if (Array.isArray(output)) {
      output.forEach((o) => this._console.appendLine(o));
    } else {
      this._console.appendLine(output);
    }
    this._console.appendLine(`<<<\n`);
  }

  public appendQueryError(error: string, serverName: string): void {
    this._console.show(true);
    if (error.length > 0) {
      this._console.appendLine(
        `<<< ERROR WITH QUERY EXECUTED AT SERVER: ${serverName}  >>>`
      );
      this._console.appendLine(error);
      this._console.appendLine(`<<< >>>`);
    }
  }
}
