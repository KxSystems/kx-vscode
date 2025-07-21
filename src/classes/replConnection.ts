/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import {
  getAutoFocusOutputOnEntrySetting,
  getQExecutablePath,
} from "../utils/core";
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

type Callable = () => void;

export class ReplConnection {
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
  private readonly process: ChildProcessWithoutNullStreams;

  private messages: string[] = [];
  private buffer: string[] = [];
  private input: string[] = [];
  private executions?: Callable[] = [];

  private _context = CTX.Q;
  private _namespace = ANSI.EMPTY;
  private columns = 0;
  private rows = 0;
  private maxInputIndex = 0;
  private inputIndex = 0;

  private serial = 0;
  private executing = 0;
  private exited = false;

  private constructor() {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.terminal = this.createTerminal();
    this.process = this.createProcess();
    this.connect();
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

  private get visibleInputIndex() {
    return this.input.length > this.maxInputIndex
      ? this.maxInputIndex
      : this.input.length;
  }

  private get inputText() {
    return this.input.join(ANSI.EMPTY);
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
    return spawn(getQExecutablePath(), {
      env: { ...process.env, QHOME: ext.REAL_QHOME },
    });
  }

  private connect() {
    this.process.on("error", this.handleError.bind(this));
    this.process.on("close", this.handleClose.bind(this));
    this.process.stdout.on("data", this.handleOutput.bind(this));
    this.process.stdout.on("error", this.handleError.bind(this));
    this.process.stderr.on("data", this.handleErrorOutput.bind(this));
    this.process.stderr.on("error", this.handleError.bind(this));
  }

  private executeCommand(data: string) {
    this.process.stdin.write(data + ANSI.CRLF);
  }

  private sendDimensions() {
    const LINES = process.env.LINES ?? this.rows.toString();
    let rows = parseInt(LINES.replace(/\D+/gs, "0") || "0");
    if (rows < 25) rows = 25;
    if (rows > 500) rows = 500;

    const COLUMNS = process.env.COLUMNS ?? this.columns.toString();
    let columns = parseInt(COLUMNS.replace(/\D+/gs, "") || "0");
    if (columns < 50) columns = 50;
    if (columns > 320) columns = 320;

    this.executeCommand(`\\c ${rows} ${columns}`);
  }

  private sendToProcess(data: string) {
    this.process.stdin.write(data + ANSI.CRLF, (error) => {
      if (error) {
        this.executing--;
      } else {
        this.process.stdin.write(
          "2 {x}" +
            ANSI.QUOTE +
            this.identity +
            ANSI.AT +
            this.serial++ +
            ANSI.AT +
            ANSI.QUOTE +
            (this.context === CTX.Q ? NS.Q : NS.K) +
            ";" +
            ANSI.CRLF,
        );
      }
    });
    this.executing++;
  }

  private sendToTerminal(data: string) {
    this.onDidWrite.fire(data);
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

  private showExecutionPrompt() {
    this.showPrompt(
      false,
      this.executing > 1 ? `execution-${this.executing}` : "execution",
    );
    this.sendToTerminal(ANSI.CRLF);
  }

  private showMessage(message: string) {
    if (this.executions) {
      this.messages.push(message);
    } else {
      this.sendToTerminal(message);
    }
  }

  private showOutput(decoded: string) {
    if (this.exited) {
      return;
    }
    const output = decoded.replace(/(?:\r\n|[\r\n])+/gs, ANSI.CRLF);

    if (this.executions) this.messages.push(output);
    else this.buffer.push(output);
  }

  private show() {
    if (getAutoFocusOutputOnEntrySetting()) this.terminal.show(true);
  }

  private recall(history?: HistoryItem) {
    const input = history?.input ?? ANSI.EMPTY;
    this.input = [...input];
    this.inputIndex = 0;
    this.updateInputIndex(input);
    this.showPrompt();
  }

  private handleError(error: Error) {
    this.showMessage(error.message + ANSI.CRLF);
  }

  private handleClose(code?: number) {
    const message = `${CONF.TITLE} exited with code (${code ?? 0}).${ANSI.CRLF}`;
    this.showMessage(message);
    this.exited = true;
  }

  private handleOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.showOutput(decoded);
  }

  private handleErrorOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.token.lastIndex = 0;
    const output = decoded.replace(this.token, ANSI.EMPTY);
    this.showOutput(output);

    this.token.lastIndex = 0;
    let match: RegExpMatchArray | null;

    while ((match = this.token.exec(decoded))) {
      if (match[0]) {
        this.namespace = match[2] ? `.${match[2]}` : ANSI.EMPTY;

        const serial = parseInt(match[1]);
        if (serial + 1 === this.serial) {
          const output = this.buffer.join(ANSI.EMPTY);
          this.sendToTerminal(output);
          this.buffer = [];
        }

        this.executing--;
        if (this.executing === 0) {
          this.input = [];
          this.inputIndex = 0;
          this.updateInputIndex();
          this.showPrompt(true);
        } else {
          this.showExecutionPrompt();
        }
      }
    }
  }

  private open(dimensions?: vscode.TerminalDimensions) {
    if (dimensions) {
      this.setDimensions(dimensions);
    }

    this.sendToTerminal(
      `${CONF.TITLE} Copyright (C) 1993-2025 KX Systems` + ANSI.CRLF.repeat(2),
    );

    this.messages.forEach((message) => this.sendToTerminal(message));
    this.messages = [];

    this.showPrompt(true);

    (this.executions || []).forEach((execution) => execution());
    this.executions = undefined;
  }

  private setDimensions(dimensions: vscode.TerminalDimensions) {
    this.rows = dimensions.rows;
    this.columns = dimensions.columns;
    this.updateMaxInputIndex();
    this.sendDimensions();
    if (!this.executions && !this.executing) this.showPrompt();
  }

  private close() {
    if (ReplConnection.instance === this) {
      ReplConnection.instance = undefined;
    }
    this.process.kill("SIGINT");
    this.process.kill("SIGTERM");
    this.onDidWrite.dispose();
    this.exited = true;
  }

  private handleInput(data: string) {
    if (this.exited) {
      return;
    }

    if (this.executing && data === KEY.CR) {
      this.sendToTerminal(ANSI.CRLF);
      return;
    }

    switch (data) {
      case KEY.CR:
        if (this.input.length > 0) {
          const input = this.inputText;
          this.sendToProcess(input);
          this.history.push(input);
          this.inputIndex = this.visibleInputIndex;
          this.showPrompt();
          if (/^(?:\\[\t ]|\\$)/m.test(input)) {
            this.context = this.context === CTX.K ? CTX.Q : CTX.K;
          }
        } else {
          this.sendToProcess(ANSI.EMPTY);
        }
        this.history.rewind();
        this.sendToTerminal(ANSI.CRLF);
        break;
      case KEY.CTRLC:
        if (this.executing) {
          this.process.kill("SIGINT");
        }
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
          this.executeQuery(data);
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

  executeQuery(text: string) {
    const execution = () => {
      this.sendToProcess(normalizeQuery(text));
      this.showExecutionPrompt();
      this.show();
    };
    if (this.executions) {
      this.executions.push(execution);
    } else {
      execution();
    }
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
