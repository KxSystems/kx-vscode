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
import { sanitizeQsqlQuery } from "../utils/queryUtils";

const ANSI = {
  EMPTY: "",
  SPACE: " ",
  QUOTE: '"',
  CR: "\r",
  CRLF: "\r\n",
  LINESTART: "\x1b[0G",
  ERASEINLINE: "\x1b[K",
  FAINTON: "\x1b[2m",
  FAINTOFF: "\x1b[22m",
};

const CONTROL = {
  CR: "%0D",
  BS: "%08",
  BSMAC: "%7F",
  DEL: "%1B%5B3~",
  UP: "%1B%5BA",
  DOWN: "%1B%5BB",
  LEFT: "%1B%5BD",
  RIGHT: "%1B%5BC",
};

const CTX = {
  Q: "q",
  K: "k",
};

type Execution = () => void;

export class ReplConnection {
  private readonly serial = crypto.randomUUID();
  private readonly token =
    ANSI.QUOTE +
    this.serial +
    ".([a-zA-Z_.]*)" +
    ANSI.QUOTE +
    `[${ANSI.CRLF}]*`;

  private readonly onDidWrite: vscode.EventEmitter<string>;
  private readonly decoder: TextDecoder;
  private readonly terminal: vscode.Terminal;
  private readonly process: ChildProcessWithoutNullStreams;

  private history: string[] = [];
  private input: string[] = [];
  private errors: string[] = [];
  private executions?: Execution[] = [];

  private exited = false;
  private context = CTX.Q;
  private namespace = ANSI.EMPTY;
  private prompt = ")";

  private historyIndex = 0;
  private inputIndex = 0;
  private columns = 0;
  private rows = 0;
  private executing = 0;

  private constructor() {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.terminal = this.createTerminal();
    this.process = this.createProcess();
  }

  private createTerminal() {
    const opts: vscode.ExtensionTerminalOptions = {
      name: `kdb+ ${ext.REPL}`,
      pty: {
        open: this.open.bind(this),
        close: this.close.bind(this),
        setDimensions: this.setDimensions.bind(this),
        handleInput: this.handleInput.bind(this),
        onDidWrite: this.onDidWrite.event,
      },
    };
    return vscode.window.createTerminal(opts);
  }

  private createProcess() {
    const child = spawn(getQExecutablePath(), {
      env: { ...process.env, QHOME: ext.REAL_QHOME },
    });
    child.on("error", this.handleError.bind(this));
    child.on("close", this.handleClose.bind(this));
    child.stdout.on("data", this.handleOutput.bind(this));
    child.stdout.on("error", this.handleError.bind(this));
    child.stderr.on("data", this.handleErrorOutput.bind(this));
    child.stderr.on("error", this.handleError.bind(this));
    return child;
  }

  private sendToProcess(data: string) {
    this.process.stdin.write(data + ANSI.CRLF, (error) => {
      if (error) {
        this.executing--;
      } else {
        this.process.stdin.write(
          ANSI.QUOTE +
            this.serial +
            ANSI.QUOTE +
            (this.context === CTX.Q ? ',string system"d"' : ',$:."\\\\d"') +
            ANSI.CRLF,
        );
      }
    });
    this.executing++;
  }

  private sendToTerminal(data: string) {
    this.onDidWrite.fire(data);
  }

  private normalize(data: string) {
    return data.replace(/\r?\n/gs, ANSI.CRLF);
  }

  private ansiMoveCursorToColumn(column: number) {
    return `\x1b[${column}G`;
  }

  private recall() {
    const index = this.history.length - this.historyIndex;
    const command = this.history[index] ?? ANSI.EMPTY;
    this.input = [...command];
    this.inputIndex = command.length;
    this.showPrompt();
  }

  private showOutput(decoded: string) {
    if (this.executions) {
      this.errors.push(decoded);
      return;
    }
    if (this.exited) {
      return;
    }
    const regex = new RegExp(this.token);
    this.sendToTerminal(this.normalize(decoded.replace(regex, "")));

    const res = regex.exec(decoded);
    if (res?.[0]) {
      this.executing--;
      this.namespace = res[1] ? `.${res[1]}` : "";
      if (this.executing === 0) {
        this.showPrompt();
      }
    }
  }

  private showPrompt(context?: string) {
    if (this.exited) {
      return;
    }

    const prompt =
      (context === undefined ? this.context : context) +
      this.namespace +
      this.prompt +
      ANSI.SPACE;

    this.sendToTerminal(
      ANSI.LINESTART +
        ANSI.FAINTON +
        prompt +
        ANSI.FAINTOFF +
        this.input.join(ANSI.EMPTY) +
        ANSI.ERASEINLINE +
        this.ansiMoveCursorToColumn(this.inputIndex + prompt.length + 1),
    );
  }

  private show() {
    updateTheWorkspaceSettings();
    if (ext.autoFocusOutputOnEntry) {
      this.terminal.show();
    }
  }

  private dispose() {
    this.exited = true;
    ReplConnection.instance = undefined;
  }

  private handleError(error: Error) {
    this.showPrompt("error");
    this.showOutput(error.message + ANSI.CRLF);
  }

  private handleClose(code: number | null) {
    const message = `Process exited with code (${code || 0}).${ANSI.CRLF}`;
    this.showOutput(message);
    this.showPrompt(ANSI.EMPTY);
    this.sendToTerminal(ANSI.LINESTART);
    this.dispose();
  }

  private handleOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.showOutput(decoded);
  }

  private handleErrorOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.showOutput(decoded);
  }

  private open(dimensions: vscode.TerminalDimensions | undefined) {
    if (dimensions) {
      this.setDimensions(dimensions);
    }

    this.sendToTerminal(
      "kdb+ REPL Copyright (C) 1993-2025 KX Systems" + ANSI.CRLF.repeat(2),
    );

    if (this.errors.length > 0) {
      this.errors.forEach((error) => this.sendToTerminal(error + ANSI.CRLF));
      this.errors = [];
    }

    if (this.executions) {
      if (this.executions.length > 0) {
        this.executions.forEach((execution) => execution());
      } else {
        this.showPrompt();
      }
      this.executions = undefined;
    }
  }

  private setDimensions(dimensions: vscode.TerminalDimensions) {
    this.columns = dimensions.columns;
    this.rows = dimensions.rows;
  }

  private close() {
    this.dispose();
    this.process.kill();
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
    if (data.length > 1 && /(?:\r\n|[\r\n])/gs.test(data)) {
      this.executeQuery(data);
      return;
    }
    const encoded = encodeURIComponent(data);

    let command: string;

    switch (encoded) {
      case CONTROL.CR:
        if (this.input.length > 0) {
          command = this.input.join(ANSI.EMPTY);
          if (command === "\\") {
            this.context = this.context === CTX.K ? CTX.Q : CTX.K;
          }
          this.sendToProcess(command);
          this.history.push(command);
          this.input = [];
          this.historyIndex = 0;
          this.inputIndex = 0;
        } else {
          this.sendToProcess(ANSI.EMPTY);
        }
        this.sendToTerminal(ANSI.CRLF);
        break;
      case CONTROL.BS:
      case CONTROL.BSMAC:
        if (this.input.pop()) {
          this.inputIndex--;
          this.showPrompt();
        }
        break;
      case CONTROL.DEL:
        // TODO
        break;
      case CONTROL.LEFT:
        if (this.inputIndex > 0) {
          // TODO
        }
        break;
      case CONTROL.RIGHT:
        if (this.inputIndex < this.input.length) {
          // TODO
        }
        break;
      case CONTROL.DOWN:
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.recall();
        }
        break;
      case CONTROL.UP:
        if (this.historyIndex < this.history.length) {
          this.historyIndex++;
          this.recall();
        }
        break;
      default:
        if (!/[^\P{Cc}]/gsu.test(data)) {
          this.input.splice(this.inputIndex, 0, data);
          this.inputIndex += data.length;
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
      this.sendToProcess(sanitizeQsqlQuery(text));
      this.showPrompt(`execution:${this.executing}`);
      this.sendToTerminal(ANSI.CRLF);
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
