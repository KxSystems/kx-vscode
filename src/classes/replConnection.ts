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
import { getQExecutablePath, updateTheWorkspaceSettings } from "../utils/core";
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

const CTRL = {
  CR: "%0D",
  BS: "%08",
  BSMAC: "%7F",
  DEL: "%1B%5B3~",
  UP: "%1B%5BA",
  DOWN: "%1B%5BB",
  LEFT: "%1B%5BD",
  RIGHT: "%1B%5BC",
  HOME: "%01",
  END: "%05",
};

const CTX = {
  Q: "q",
  K: "k",
};

const NS = {
  Q: ',string system"d"',
  K: ',$:."\\\\d"',
};

const MAX_INPUT = 80 * 40;

type Callable = () => void;

export class ReplConnection {
  private readonly identity = crypto.randomUUID();
  private readonly token = new RegExp(
    ANSI.QUOTE +
      this.identity +
      ANSI.AT +
      "(\\d+)" +
      ANSI.AT +
      ".([0-9a-zA-Z_`]*)" +
      ANSI.QUOTE +
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
  private history: string[] = [];
  private executions?: Callable[] = [];

  private context = CTX.Q;
  private namespace = ANSI.EMPTY;
  private prompt = ")";

  private historyIndex = 0;
  private maxInputIndex = 0;
  private inputIndex = 0;
  private columns = 0;
  private rows = 0;
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

  private get visibleInputIndex() {
    return this.input.length > this.maxInputIndex
      ? this.maxInputIndex
      : this.input.length;
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
      name: `kdb+ ${ext.REPL}`,
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

  private sendToProcess(data: string) {
    this.process.stdin.write(data + ANSI.CRLF, (error) => {
      if (error) {
        this.executing--;
      } else {
        this.process.stdin.write(
          ANSI.QUOTE +
            this.identity +
            ANSI.AT +
            this.serial++ +
            ANSI.AT +
            ANSI.QUOTE +
            (this.context === CTX.Q ? NS.Q : NS.K) +
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
      (context === undefined ? this.context : context).length +
      this.namespace.length +
      this.prompt.length +
      (index === undefined ? this.visibleInputIndex : index);

    const lines = Math.ceil(length / this.columns);
    const column = length % this.columns;

    return { length, lines, column };
  }

  private updateInputIndex(data?: string) {
    this.inputIndex += data?.length || 0;

    if (this.inputIndex > this.maxInputIndex) {
      this.inputIndex = this.maxInputIndex;
    }
  }

  private updateMaxInputIndex() {
    const { length } = this.promptProperties(this.context, 0);
    const max = this.columns * this.rows;
    this.maxInputIndex = (max > MAX_INPUT ? MAX_INPUT : max) - length;
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
        (context === undefined ? this.context : context) +
        this.namespace +
        this.prompt +
        ANSI.SPACE +
        ANSI.FAINTOFF +
        this.input.slice(0, this.visibleInputIndex).join(ANSI.EMPTY) +
        ANSI.ERASETOEND +
        this.moveCursorToContext(context, this.inputIndex),
    );
  }

  private showExecutionPrompt() {
    const prompt =
      this.executing > 1 ? `execution-${this.executing}` : "execution";
    this.showPrompt(false, prompt);
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

    this.token.lastIndex = 0;
    const output = decoded
      .replace(this.token, ANSI.EMPTY)
      .replace(/(?:\r\n|[\r\n])+/gs, ANSI.CRLF);

    if (this.executions) {
      this.messages.push(output);
      return;
    }
    this.buffer.push(output);

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
          this.showPrompt(true);
        } else {
          this.showExecutionPrompt();
        }
      }
    }
  }

  private show() {
    updateTheWorkspaceSettings();
    if (ext.autoFocusOutputOnEntry) {
      this.terminal.show();
    }
  }

  private recall() {
    const index = this.history.length - this.historyIndex;
    const command = this.history[index] ?? ANSI.EMPTY;
    this.input = [...command];
    this.inputIndex = this.visibleInputIndex;
    this.showPrompt();
  }

  private handleError(error: Error) {
    this.showMessage(error.message + ANSI.CRLF);
  }

  private handleClose(code: number | null) {
    const message = `kdb+ exited with code (${code || 0}).${ANSI.CRLF}`;
    this.showMessage(message);
    this.exited = true;
  }

  private handleOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.showOutput(decoded);
  }

  private handleErrorOutput(data: any) {
    this.handleOutput(data);
  }

  private open(dimensions?: vscode.TerminalDimensions) {
    if (dimensions) {
      this.setDimensions(dimensions);
    }

    this.sendToTerminal(
      "kdb+ REPL Copyright (C) 1993-2025 KX Systems" + ANSI.CRLF.repeat(2),
    );

    this.messages.forEach((message) => this.sendToTerminal(message));
    this.messages = [];

    this.showPrompt(true);

    (this.executions || []).forEach((execution) => execution());
    this.executions = undefined;
  }

  private setDimensions(dimensions: vscode.TerminalDimensions) {
    this.columns = dimensions.columns;
    this.rows = dimensions.rows;
    this.updateMaxInputIndex();
    if (!this.executions && !this.executing) this.showPrompt();
  }

  private close() {
    if (ReplConnection.instance === this) {
      ReplConnection.instance = undefined;
    }
    this.exited = true;
    this.process.kill();
    this.onDidWrite.dispose();
  }

  private handleInput(data: string) {
    if (this.exited) {
      return;
    }
    if (this.executing) {
      if (data === ANSI.CR) {
        this.sendToTerminal(ANSI.CRLF);
      }
      return;
    }
    if (data.length > 1 && /(?:\r\n|[\r\n])/s.test(data)) {
      this.executeQuery(data);
      return;
    }

    const encoded = encodeURIComponent(data);

    let command: string;

    switch (encoded) {
      case CTRL.CR:
        if (this.input.length > 0) {
          command = this.input.join(ANSI.EMPTY);
          if (/^(?:\\[\t ]|\\$)/m.exec(command)) {
            this.context = this.context === CTX.K ? CTX.Q : CTX.K;
          }
          this.sendToProcess(command);
          this.history.push(command);
          this.inputIndex = this.visibleInputIndex;
          this.showPrompt();
          this.input = [];
          this.historyIndex = this.inputIndex = 0;
        } else {
          this.sendToProcess(ANSI.EMPTY);
        }
        this.sendToTerminal(ANSI.CRLF);
        break;
      case CTRL.BS:
      case CTRL.BSMAC:
        if (this.inputIndex > 0 && this.input.splice(this.inputIndex - 1, 1)) {
          this.inputIndex--;
          this.showPrompt();
        }
        break;
      case CTRL.DEL:
        if (this.input.splice(this.inputIndex, 1)) {
          this.showPrompt();
        }
        break;
      case CTRL.HOME:
        this.inputIndex = 0;
        this.showPrompt();
        break;
      case CTRL.END:
        this.inputIndex = this.visibleInputIndex;
        this.showPrompt();
        break;
      case CTRL.LEFT:
        if (this.inputIndex > 0) {
          this.inputIndex--;
          this.showPrompt();
        }
        break;
      case CTRL.RIGHT:
        if (this.inputIndex < this.visibleInputIndex) {
          this.inputIndex++;
          this.showPrompt();
        }
        break;
      case CTRL.DOWN:
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.recall();
        }
        break;
      case CTRL.UP:
        if (this.historyIndex < this.history.length) {
          this.historyIndex++;
          this.recall();
        }
        break;
      default:
        if (data.length < MAX_INPUT) {
          const target = data.replace(/[^\P{Cc}]/gsu, "");
          this.input.splice(this.inputIndex, 0, ...target);
          this.updateInputIndex(target);
          this.showPrompt();
        }
        break;
    }
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
