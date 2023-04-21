import { OutputChannel, window } from 'vscode';

export class QueryConsole {
  public static current: QueryConsole | undefined;
  private _console: OutputChannel;
  
  constructor(private console: OutputChannel){
    this._console = console;
  }

  public static createOrGet(): QueryConsole {
        if (!QueryConsole.current) {
            const _console = window.createOutputChannel('q Console Output');
            QueryConsole.current = new QueryConsole(_console);
        }
        return QueryConsole.current;
    }

  public appendQuery(query: string):void{
    if(query.length > 0){
      this._console.appendLine('<<< Query  >>>');
      this._console.appendLine(query);
      this._console.appendLine('');
      this._console.appendLine('<<< Results >>>');
    }
  }

  public append(output:string | string[], time = 0, uniqLabel: string, query = ''): void{
    this._console.show(true);
    this._console.clear();
    const date = new Date();
    this._console.appendLine(`>>> ${uniqLabel} @ ${date.toLocaleTimeString()} ---- ${time}(ms) elapsed <<<`);
    this.appendQuery(query);
    if (Array.isArray(output)) {
        output.forEach(o => this._console.appendLine(o));
    } else {
        this._console.appendLine(output);
    }
    this._console.appendLine('<<<\n');
  }
}