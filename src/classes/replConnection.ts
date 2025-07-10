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
import path from "node:path";
import * as vscode from "vscode";

import { getPlatformFolder } from "../utils/core";
import { sanitizeQsqlQuery } from "../utils/queryUtils";

const ANSI = {
  EMPTY: "",
  CRLF: "\r\n",
  FAINTON: "\x1b[2m",
  FAINTOFF: "\x1b[22m",
  NORMAL: "\x1b[0m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
};

const ENC = {
  CR: "%0D",
  BSMAC: "%7F",
  BS: "%08",
  DEL: "%1B%5B3~",
  UP: "%1B%5BA",
  DOWN: "%1B%5BB",
  LEFT: "%1B%5BD",
  RIGHT: "%1B%5BC",
};

export class ReplConnection {
  private readonly onDidWrite: vscode.EventEmitter<string>;
  private readonly decoder: TextDecoder;
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly terminal: vscode.Terminal;

  private history: string[] = [];
  private input: string[] = [];
  private prompt = "q)";

  private historyIndex = 0;
  private inputIndex = 0;
  private columns = 0;
  private lines = 0;

  private constructor() {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.process = this.createProcess();
    this.terminal = this.createTerminal();
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
    const folder = getPlatformFolder(process.platform);
    if (!folder) {
      throw new Error(`Unsupported platform (${process.platform}).`);
    }
    const home = this.getHome();
    if (!home) {
      throw new Error(
        `Neither QHOME environment variable nor qHomeDirectory is set.`,
      );
    }
    const target = path.resolve(home, folder, "q");
    const child = spawn(target);
    child.on("exit", () => this.terminal.dispose());
    child.stdout.on("data", this.handleOutput.bind(this));
    child.stderr.on("data", this.handleError.bind(this));
    return child;
  }

  private getHome() {
    return (
      process.env.QHOME ||
      vscode.workspace.getConfiguration("kdb").get<string>("qHomeDirectory", "")
    );
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

  private open(dimensions: vscode.TerminalDimensions | undefined): void {
    if (dimensions) {
      this.setDimensions(dimensions);
    }
    this.showPrompt();
  }

  private setDimensions(dimensions: vscode.TerminalDimensions): void {
    this.columns = dimensions.columns;
    this.lines = dimensions.rows;
  }

  private close(): void {
    this.process.kill();
    ReplConnection.instance = undefined;
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

  private showOutput(decoded: string) {
    this.sendToTerminal(ANSI.CRLF + this.normalize(decoded));
    this.showPrompt();
  }

  private showPrompt(prompt?: string) {
    this.sendToTerminal(
      `\x1b[0G${ANSI.FAINTON}${prompt ? prompt : this.prompt} ${ANSI.FAINTOFF}${this.input.join(ANSI.EMPTY)}\x1b[K\x1b[${this.inputIndex + this.prompt.length + 2}G`,
    );
  }

  private recall() {
    const index = this.history.length - this.historyIndex;
    const command = this.history[index] ?? ANSI.EMPTY;
    this.input = [...command];
    this.inputIndex = command.length;
    this.showPrompt();
  }

  private handleInput(data: string): void {
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
    if (!this.instance) {
      this.instance = new ReplConnection();
    }
    return this.instance;
  }
}
