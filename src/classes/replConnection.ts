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

import { getQExecutablePath } from "../utils/core";
import { sanitizeQsqlQuery } from "../utils/queryUtils";

const ANSI = {
  EMPTY: "",
  CRLF: "\r\n",
  LINESTART: "\x1b[0G",
  FAINTON: "\x1b[2m",
  FAINTOFF: "\x1b[22m",
};

const ENC = {
  CR: "%0D",
  BS: "%08",
  BSMAC: "%7F",
  DEL: "%1B%5B3~",
  UP: "%1B%5BA",
  DOWN: "%1B%5BB",
  LEFT: "%1B%5BD",
  RIGHT: "%1B%5BC",
};

export class ReplConnection {
  private readonly onDidWrite: vscode.EventEmitter<string>;
  private readonly decoder: TextDecoder;
  private readonly terminal: vscode.Terminal;
  private readonly process: ChildProcessWithoutNullStreams;

  private buffer: string[] = [];
  private history: string[] = [];
  private input: string[] = [];

  private prompt = "q)";
  private opened = false;
  private exited = false;

  private historyIndex = 0;
  private inputIndex = 0;
  private columns = 0;
  private lines = 0;

  private constructor() {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.terminal = this.createTerminal();
    this.process = this.createProcess();
  }

  private createTerminal() {
    const opts: vscode.ExtensionTerminalOptions = {
      name: "q REPL",
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
    const child = spawn(getQExecutablePath());
    child.on("error", this.onError.bind(this));
    child.on("close", this.onClose.bind(this));
    child.stdout.on("data", this.handleOutput.bind(this));
    child.stdout.on("error", this.onError.bind(this));
    child.stderr.on("data", this.handleError.bind(this));
    child.stderr.on("error", this.onError.bind(this));
    return child;
  }

  private sendToProcess(data: string) {
    this.process.stdin.write(data);
  }

  private sendToTerminal(data: string) {
    this.onDidWrite.fire(data);
  }

  private normalize(data: string) {
    return data.replace(/\r?\n/gs, ANSI.CRLF);
  }

  private showOutput(decoded: string) {
    const output = ANSI.CRLF + this.normalize(decoded);

    if (this.opened) {
      this.sendToTerminal(output);
      this.showPrompt();
    } else {
      this.buffer.push(output);
    }
  }

  private showPrompt(prompt?: string) {
    prompt = prompt === undefined ? this.prompt : prompt;

    this.sendToTerminal(
      `\x1b[0G${ANSI.FAINTON}${prompt} ${ANSI.FAINTOFF}${this.input.join(ANSI.EMPTY)}\x1b[K\x1b[${this.inputIndex + prompt.length + 2}G`,
    );
  }

  private recall(): void {
    const index = this.history.length - this.historyIndex;
    const command = this.history[index] ?? ANSI.EMPTY;
    this.input = [...command];
    this.inputIndex = command.length;
    this.showPrompt();
  }
  private dispose(): void {
    this.exited = true;
    ReplConnection.instance = undefined;
  }

  private onError(error: Error) {
    this.showPrompt("spawn)");
    this.showOutput(error.message);
  }

  private onClose(code?: number) {
    this.showPrompt("exit)");
    this.showOutput(`q process exited with code (${code}).${ANSI.CRLF}`);
    this.showPrompt(ANSI.EMPTY);
    this.sendToTerminal(ANSI.LINESTART);
    this.dispose();
  }

  private open(dimensions: vscode.TerminalDimensions | undefined): void {
    if (dimensions) {
      this.setDimensions(dimensions);
    }

    if (this.buffer.length > 0) {
      this.sendToTerminal(this.buffer.join(ANSI.EMPTY) + ANSI.CRLF);
      this.buffer = [];
    }
    this.opened = true;

    if (this.exited) {
      return;
    }
    this.showPrompt();
  }

  private setDimensions(dimensions: vscode.TerminalDimensions): void {
    this.columns = dimensions.columns;
    this.lines = dimensions.rows;
  }

  private close(): void {
    this.process.kill();
  }

  private handleOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.showPrompt("result)");
    this.showOutput(decoded);
  }

  private handleError(data: any) {
    const decoded = this.decoder.decode(data);
    this.showPrompt("error)");
    this.showOutput(decoded);
  }

  private handleInput(data: string): void {
    if (this.exited) {
      return;
    }
    const encoded = encodeURIComponent(data);

    let command: string;

    switch (encoded) {
      case ENC.CR:
        if (this.input.length > 0) {
          command = this.input.join(ANSI.EMPTY);
          this.sendToProcess(command + ANSI.CRLF);
          this.history.push(command);
          this.input = [];
          this.historyIndex = 0;
          this.inputIndex = 0;
        }
        this.sendToTerminal(ANSI.CRLF);
        this.showPrompt();
        break;
      case ENC.BS:
      case ENC.BSMAC:
        if (this.input.pop()) {
          this.inputIndex--;
          this.showPrompt();
        }
        break;
      case ENC.RIGHT:
        if (this.inputIndex < this.input.length) {
          // TODO
        }
        break;
      case ENC.LEFT:
        if (this.inputIndex > 0) {
          // TODO
        }
        break;
      case ENC.UP:
        if (this.historyIndex < this.history.length) {
          this.historyIndex++;
          this.recall();
        }
        break;
      case ENC.DOWN:
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.recall();
        }
        break;
      default:
        if (!/[^\P{Cc}]/gsu.test(data)) {
          this.input.splice(this.inputIndex, 0, data);
          this.inputIndex++;
          this.showPrompt();
        }
        break;
    }
  }

  show() {
    this.terminal.show();
  }

  executeQuery(text: string) {
    const code = sanitizeQsqlQuery(text);
    this.sendToProcess(code);
    this.sendToProcess(ANSI.CRLF);
    this.show();
  }

  private static instance?: ReplConnection;

  static getOrCreateInstance() {
    if (!this.instance || this.instance.exited) {
      this.instance = new ReplConnection();
    }
    return this.instance;
  }
}
