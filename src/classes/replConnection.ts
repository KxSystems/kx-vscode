/*
 * Copyright (c) 1998-2025 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import kill from "tree-kill";
import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import {
  getAutoFocusOutputOnEntrySetting,
  getQExecutablePath,
} from "../utils/core";
import { Cancellable, Runner } from "../utils/notifications";
import { normalizeQuery } from "../utils/queryUtils";

const ANSI = {
  EMPTY: "",
  SPACE: " ",
  QUOTE: '"',
  AT: "@",
  CR: "\r",
  CRLF: "\r\n",
  DOWN: "\x1b[1B",
  SAVE: "\x1b[s",
  RESTORE: "\x1b[u",
  ERASETOEND: "\x1b[0J",
  LINESTART: "\x1b[0G",
  FAINTON: "\x1b[2m",
  FAINTOFF: "\x1b[22m",
};

const KEY = {
  CR: "\r",
  CTRLC: "\x03",
  BS: "\b",
  BSMAC: "\x7f",
  DEL: "\x1b[3~",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  HOME: "\x1b[H",
  HOMEMAC: "\x01",
  END: "\x1b[F",
  ENDMAC: "\x05",
  ALTHOME: "\x1b[1;5A",
  ALTEND: "\x1b[1;5B",
  SHIFTUP: "\x1b[1;2A",
  SHIFTDOWN: "\x1b[1;2B",
  SHIFTLEFT: "\x1b[1;2D",
  SHIFTRIGHT: "\x1b[1;2C",
};

const CTX = {
  Q: "q",
  K: "k",
};

const NS = {
  Q: ',string system"d"',
  K: ',$:."\\\\d"',
};

const CONF = {
  TITLE: `KX ${ext.REPL}`,
  PROMPT: ")",
  MAX_INPUT: 80 * 40,
};

interface Execution {
  token: vscode.CancellationToken;
  source: vscode.CancellationTokenSource;
  cancelled: boolean;
  lines: string[];
  line: string[];
  buffer: string[];
  done: RegExpExecArray[];
  index: number;
  reject: (reason?: any) => void;
  resolve: (value: Result) => void;
}

export interface Result {
  cancelled?: boolean;
  output?: string;
}

export class ReplConnection {
  private readonly posix = process.platform !== "win32";
  private readonly history = new History();
  private readonly identity = crypto.randomUUID();
  private readonly token = new RegExp(
    this.identity +
      ANSI.AT +
      "(\\d+)" +
      ANSI.AT +
      ".([0-9a-zA-Z_`]*)" +
      `[${ANSI.CRLF}]*`,
    "gs",
  );

  private readonly onDidWrite: vscode.EventEmitter<string>;
  private readonly decoder: TextDecoder;
  private readonly terminal: vscode.Terminal;
  private readonly executions: Execution[] = [];
  private process: ChildProcessWithoutNullStreams;

  private messages? = [
    `${CONF.TITLE} Copyright (C) 1993-2025 KX Systems` + ANSI.CRLF.repeat(2),
  ];

  private _context = CTX.Q;
  private _namespace = ANSI.EMPTY;
  private columns = 0;
  private rows = 0;
  private maxInputIndex = 0;
  private inputIndex = 0;
  private input: string[] = [];
  private serial = 0;
  private exited = false;
  private stopped = false;
  private executing?: Execution;
  private activate = "";

  private constructor() {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.terminal = this.createTerminal();
    this.process = this.createProcess();
    this.connect();
  }

  private get inputText() {
    return this.input.join(ANSI.EMPTY);
  }

  private set inputText(text: string) {
    this.input = [...text];
    this.inputIndex = this.visibleInputIndex;
  }

  private get visibleInputIndex() {
    return this.input.length > this.maxInputIndex
      ? this.maxInputIndex
      : this.input.length;
  }

  private get context() {
    return this._context;
  }

  private set context(context: string) {
    this._context = context;
    this.updateMaxInputIndex();
  }

  private get namespace() {
    return this._namespace;
  }

  private set namespace(namespace: string) {
    this._namespace = namespace;
    this.updateMaxInputIndex();
  }

  private createTerminal() {
    return vscode.window.createTerminal({
      pty: {
        open: this.open.bind(this),
        close: this.close.bind(this),
        setDimensions: this.setDimensions.bind(this),
        handleInput: this.handleInput.bind(this),
        onDidWrite: this.onDidWrite.event,
      },
      name: CONF.TITLE,
    });
  }

  private createProcess() {
    const q = getQExecutablePath();

    return spawn(this.activate ? `${this.activate};${q}` : q, ["-q"], {
      env: { ...process.env, QHOME: ext.REAL_QHOME },
      shell: !!this.activate,
    });
  }

  private connect() {
    let handler = this.handleError.bind(this);
    this.process.on("error", handler);
    this.process.stdin.on("error", handler);
    this.process.stdout.on("error", handler);
    this.process.stderr.on("error", handler);
    this.process.on("close", this.handleClose.bind(this));
    handler = this.handleOutput.bind(this);
    this.process.stdout.on("data", handler);
    this.process.stderr.on("data", handler);
  }

  private stub(query: string) {
    return query.replace(
      /(?<![A-Za-z0-9.])(?:read0(?![A-Za-z0-9.])|0::)/gs,
      '{$[x~0;"";0::[x]]}',
    );
  }

  private createToken(pipe: 1 | 2) {
    return (
      `${pipe} {x}` +
      ANSI.QUOTE +
      this.identity +
      ANSI.AT +
      this.serial +
      ANSI.AT +
      ANSI.QUOTE +
      (this.context === CTX.Q ? NS.Q : NS.K) +
      ";" +
      ANSI.CRLF
    );
  }

  private sendCommand(data: string) {
    this.process.stdin.write(data + ANSI.CRLF);
  }

  private sendToProcess(data: string) {
    this.process.stdin.write(
      this.stub(data) + ANSI.CRLF + this.createToken(1) + this.createToken(2),
    );
    this.serial++;
  }

  private stopExecution() {
    this.stopped = !this.posix;
    const signal = "SIGINT";
    if (this.activate) {
      if (this.process.pid) kill(this.process.pid, signal);
    } else this.process.kill(signal);
  }

  private stopProcess(restart = false) {
    this.stopped = restart;
    const signal = "SIGTERM";
    if (this.activate) {
      if (this.process.pid) kill(this.process.pid, signal);
    } else this.process.kill(signal);
  }

  private runQuery(data: string) {
    const runner = Runner.create((_, token) => this.executeQuery(data, token));
    runner.cancellable = Cancellable.EXECUTOR;
    runner.title = "Executing query on REPL.";
    runner.execute();
  }

  private getRows() {
    const LINES = process.env.LINES ?? this.rows.toString();
    let rows = parseInt(LINES.replace(/\D+/gs, "0") || "0");
    if (rows < 25) rows = 25;
    if (rows > 500) rows = 500;
    return rows;
  }

  private getColumns() {
    const COLUMNS = process.env.COLUMNS ?? this.columns.toString();
    let columns = parseInt(COLUMNS.replace(/\D+/gs, "") || "0");
    if (columns < 50) columns = 50;
    if (columns > 320) columns = 320;
    return columns;
  }

  private sendToTerminal(data: string) {
    if (this.messages) this.messages.push(data);
    else this.onDidWrite.fire(data);
  }

  private promptProperties(context?: string, index?: number) {
    const length =
      1 +
      (context ?? this.context).length +
      this.namespace.length +
      CONF.PROMPT.length +
      (index ?? this.visibleInputIndex);

    const lines = Math.ceil(length / this.columns);
    const column = length % this.columns;

    return { length, lines, column };
  }

  private updateInputIndex(data?: string) {
    this.inputIndex += data?.length ?? 0;

    if (this.inputIndex > this.maxInputIndex) {
      this.inputIndex = this.maxInputIndex - 1;
    }
  }

  private updateMaxInputIndex() {
    const { length } = this.promptProperties(this.context, 0);
    const max = this.columns * this.rows;
    this.maxInputIndex = (max > CONF.MAX_INPUT ? CONF.MAX_INPUT : max) - length;
    this.updateInputIndex();
  }

  private moveCursorToColumn(column: number) {
    return `\x1b[${column}G`;
  }

  private moveCursorToContext(context?: string, length?: number) {
    const { lines, column } = this.promptProperties(context, length);

    return (
      ANSI.RESTORE +
      ANSI.DOWN.repeat(lines - (column === 0 ? 0 : 1)) +
      this.moveCursorToColumn(column + 1)
    );
  }

  private showPrompt(create?: boolean, context?: string) {
    if (this.exited) {
      return;
    }
    this.sendToTerminal(
      (create ? ANSI.SAVE : ANSI.RESTORE) +
        ANSI.FAINTON +
        (context ?? this.context) +
        this.namespace +
        CONF.PROMPT +
        ANSI.SPACE +
        ANSI.FAINTOFF +
        this.input.slice(0, this.visibleInputIndex).join(ANSI.EMPTY) +
        ANSI.ERASETOEND +
        this.moveCursorToContext(context, this.inputIndex),
    );
  }

  private recall(history?: HistoryItem) {
    const input = history?.input ?? ANSI.EMPTY;
    this.input = [...input];
    this.inputIndex = 0;
    this.updateInputIndex(input);
    this.showPrompt();
  }

  private cancel(error?: Error) {
    if (this.executing) {
      if (error) this.executing.reject(error);
      this.executing.source.cancel();
    }
  }

  private executeNext() {
    if (!this.executing && !this.messages) {
      this.executing = this.executions.shift();
      if (this.executing) {
        this.sendToTerminal(ANSI.CRLF);
        this.sendToProcess(this.executing.lines[this.executing.index]);
      }
    }
  }

  private normalize(decoded: string) {
    return decoded.replace(/(?:\r\n|[\r\n])+/gs, ANSI.CRLF);
  }

  private push(data: any, buffer: string[]) {
    const c = this.executing;
    if (!c) return;
    const decoded = this.decoder.decode(data);
    this.token.lastIndex = 0;
    const output = this.normalize(decoded.replace(this.token, ANSI.EMPTY));
    if (output) {
      buffer.push(output);
      this.sendToTerminal(output);
      if (/^'\d{4}\.\d{2}\.\d{2}T/m.test(output)) c.cancelled = true;
    }
    this.token.lastIndex = 0;
    return this.token.exec(decoded);
  }

  private nextToken(token: RegExpExecArray) {
    const c = this.executing;
    if (!c) return;
    c.done.push(token);
    if (c.done.length % 2 === 0) {
      this.namespace = token[2] ? `.${token[2]}` : ANSI.EMPTY;
      const output = c.line.join(ANSI.EMPTY);
      c.buffer.push(output);
      if (c.cancelled || c.index >= c.lines.length - 1) {
        this.resolve();
      } else {
        c.index++;
        c.line = [];
        this.sendToProcess(c.lines[c.index]);
      }
    }
  }

  private resolve() {
    let c = this.executing;
    if (!c) return;
    this.executing = undefined;
    c.resolve({ cancelled: c.cancelled, output: c.buffer.join(ANSI.EMPTY) });
    if (!this.exited) this.showPrompt(true);
    if (c.cancelled)
      while ((c = this.executions.shift())) c.resolve({ cancelled: true });
    else this.executeNext();
  }

  private handleOutput(data: any) {
    const c = this.executing;
    if (c) {
      const token = this.push(data, c.line);
      if (token) this.nextToken(token);
    } else {
      this.sendToTerminal(this.normalize(this.decoder.decode(data)));
    }
  }

  private handleError(error: Error) {
    this.sendToTerminal(`${error.message}${ANSI.CRLF}`);
    this.cancel(error);
  }

  private handleClose(code?: number) {
    if (this.stopped) {
      this.stopped = false;
      this._context = CTX.Q;
      this._namespace = ANSI.EMPTY;
      this.resolve();
      this.process = this.createProcess();
      this.connect();
      return;
    }
    this.sendToTerminal(
      `${CONF.TITLE} exited with code (${code ?? 0}).${ANSI.CRLF}`,
    );
    this.exited = true;
    this.resolve();
  }

  private open(dimensions?: vscode.TerminalDimensions) {
    if (dimensions) this.setDimensions(dimensions);
    this.messages?.forEach((message) => this.onDidWrite.fire(message));
    this.messages = undefined;
    this.showPrompt(true);
    this.executeNext();
  }

  private close() {
    if (ReplConnection.instance === this) ReplConnection.instance = undefined;
    this.cancel();
    this.stopProcess();
    this.onDidWrite.dispose();
    this.exited = true;
  }

  private setDimensions(dimensions: vscode.TerminalDimensions) {
    this.rows = dimensions.rows;
    this.columns = dimensions.columns;
    this.updateMaxInputIndex();
    this.sendCommand(`\\c ${this.getRows()} ${this.getColumns()}`);
  }

  private handleInput(data: string) {
    if (this.exited) {
      return;
    }

    let inputText: string | undefined;

    switch (data) {
      case KEY.CR:
        if (this.executing) {
          this.sendToTerminal(ANSI.CRLF);
          break;
        }
        inputText = this.inputText;
        if (/^\\[\t ]*$/m.test(inputText)) {
          this.context = this.context === CTX.K ? CTX.Q : CTX.K;
          this.sendCommand("\\");
          this.sendToTerminal(ANSI.CRLF);
          this.inputText = ANSI.EMPTY;
          this.showPrompt(true);
          break;
        }
        this.history.push(inputText);
        this.history.rewind();
        this.runQuery(inputText);
        this.inputIndex = this.visibleInputIndex;
        this.showPrompt();
        this.sendToTerminal(ANSI.CRLF);
        this.inputText = ANSI.EMPTY;
        break;
      case KEY.CTRLC:
        if (this.posix) this.stopExecution();
        this.cancel();
        break;
      case KEY.BS:
      case KEY.BSMAC:
        if (this.inputIndex > 0 && this.input.splice(this.inputIndex - 1, 1)) {
          this.inputIndex--;
          this.showPrompt();
        }
        break;
      case KEY.DEL:
        if (this.input.splice(this.inputIndex, 1)) {
          this.showPrompt();
        }
        break;
      case KEY.HOME:
      case KEY.HOMEMAC:
        this.inputIndex = 0;
        this.showPrompt();
        break;
      case KEY.END:
      case KEY.ENDMAC:
        if (this.visibleInputIndex > 0) {
          this.inputIndex = this.visibleInputIndex - 1;
          this.showPrompt();
        }
        break;
      case KEY.ALTHOME:
      case KEY.SHIFTUP:
        if (this.inputIndex >= this.columns) {
          this.inputIndex -= this.columns;
          this.showPrompt();
        }
        break;
      case KEY.ALTEND:
      case KEY.SHIFTDOWN:
        if (this.inputIndex <= this.visibleInputIndex - this.columns) {
          this.inputIndex += this.columns;
          this.showPrompt();
        }
        break;
      case KEY.LEFT:
      case KEY.SHIFTLEFT:
        if (this.inputIndex > 0) {
          this.inputIndex--;
          this.showPrompt();
        }
        break;
      case KEY.RIGHT:
      case KEY.SHIFTRIGHT:
        if (this.inputIndex < this.visibleInputIndex) {
          this.inputIndex++;
          this.showPrompt();
        }
        break;
      case KEY.DOWN:
        this.recall(this.history.prev);
        break;
      case KEY.UP:
        this.recall(this.history.next);
        break;
      default:
        if (/(?:\r\n|[\r\n])/s.test(data)) {
          if (/\.venv[/\\]+(?:scripts|bin)[/\\]+/is.test(data)) {
            if (this.posix) {
              this.activate = data.replace(/(?:\r\n|[\r\n])/s, "");
              this.stopProcess(true);
            }
          } else {
            this.runQuery(data);
          }
          break;
        }
        if (data.length < CONF.MAX_INPUT) {
          const target = data.replace(/[^\P{Cc}]/gsu, ANSI.EMPTY);
          this.input.splice(this.inputIndex, 0, ...target);
          this.updateInputIndex(target);
          this.showPrompt();
        }
        break;
    }
  }

  clearHistory() {
    this.history.clear();
  }

  start() {
    this.terminal.show();
  }

  show() {
    if (getAutoFocusOutputOnEntrySetting()) this.terminal.show(true);
  }

  executeQuery(text: string, token: vscode.CancellationToken) {
    return new Promise<Result>((resolve, reject) => {
      const source = new vscode.CancellationTokenSource();

      const execution = {
        source,
        token,
        cancelled:
          token.isCancellationRequested || source.token.isCancellationRequested,
        lines: normalizeQuery(text).split(ANSI.CRLF),
        line: [],
        buffer: [],
        done: [],
        index: 0,
        reject,
        resolve,
      };

      [token, source.token].forEach((token) =>
        token.onCancellationRequested(() => {
          execution.cancelled = true;
          this.stopExecution();
        }),
      );

      if (execution.cancelled) {
        resolve({ cancelled: true });
      } else {
        this.executions.push(execution);
        this.executeNext();
      }
    });
  }

  private static instance?: ReplConnection;

  static getOrCreateInstance() {
    if (!this.instance || this.instance.exited) {
      this.instance = new ReplConnection();
    }
    return this.instance;
  }
}

class HistoryItem {
  prev?: HistoryItem;
  next?: HistoryItem;
  constructor(readonly input: string) {}
}

class History {
  private head?: HistoryItem;
  private item?: HistoryItem;

  push(input: string) {
    if (input === this.head?.input) {
      return;
    }
    const item = new HistoryItem(input);
    if (this.head) {
      item.next = this.head;
      this.head.prev = item;
    }
    this.head = item;
  }

  get next() {
    this.item = this.item === undefined ? this.head : this.item.next;
    return this.item;
  }

  get prev() {
    this.item = this.item?.prev;
    return this.item;
  }

  rewind() {
    this.item = undefined;
  }

  clear() {
    this.head = undefined;
    this.rewind();
  }
}
