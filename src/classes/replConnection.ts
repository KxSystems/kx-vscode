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
  CRLF: "\r\n",
  ERASELINE: "\x1b[2K",
  LINESTART: "\x1b[1G",
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
  private promptFromInput = false;

  private h = 0;
  private i = 0;
  private c = 0;
  private r = 0;
  private dc = 0;
  private dr = 0;

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

  private clearPrompt() {
    this.sendToTerminal(ANSI.ERASELINE);
    this.sendToTerminal(ANSI.LINESTART);
  }

  private showPrompt(command: string = "") {
    this.sendToTerminal(`${ANSI.FAINTON}q)${ANSI.FAINTOFF} ${command}`);
  }

  private normalize(data: string) {
    return data.replace(/\r?\n/gs, ANSI.CRLF);
  }

  private open(dimensions: vscode.TerminalDimensions | undefined): void {
    if (dimensions) {
      this.dc = dimensions.columns;
      this.dr = dimensions.rows;
    }
    this.showPrompt();
  }

  private setDimensions(dimensions: vscode.TerminalDimensions): void {
    this.dc = dimensions.columns;
    this.dr = dimensions.rows;
  }

  private close(): void {
    this.process.kill();
    ReplConnection.instance = undefined;
  }

  private handleOutput(data: any) {
    const decoded = this.decoder.decode(data);
    this.showOutput(decoded);
  }

  private handleError(data: any) {
    const decoded = this.decoder.decode(data);
    this.showOutput(ANSI.CYAN + decoded + ANSI.NORMAL);
  }

  private showOutput(decoded: string) {
    if (this.promptFromInput) {
      this.clearPrompt();
      this.promptFromInput = false;
      this.sendToTerminal(this.normalize(decoded));
    } else {
      this.sendToTerminal(ANSI.CRLF + this.normalize(decoded));
    }
    this.showPrompt();
  }

  private recall() {
    const index = this.history.length - this.h;
    const command = this.history[index] ?? "";
    this.input = [...command];
    this.clearPrompt();
    this.showPrompt(command);
    this.i = command.length;
  }

  private handleInput(data: string): void {
    const encoded = encodeURIComponent(data);
    let command: string;

    switch (encoded) {
      case ENC.CR:
        if (this.input.length > 0) {
          command = this.input.join("");
          this.sendToProcess(command + ANSI.CRLF);
          this.history.push(command);
          this.input = [];
          this.promptFromInput = true;
          this.h = 0;
          this.i = 0;
        }
        this.sendToTerminal(ANSI.CRLF);
        this.showPrompt();
        break;
      case ENC.BS:
      case ENC.BSMAC:
        if (this.input.pop()) {
          this.clearPrompt();
          this.showPrompt(this.input.join(""));
          this.i--;
        }
        break;
      case ENC.UP:
        if (this.h < this.history.length) {
          this.h++;
          this.recall();
        }
        break;
      case ENC.DOWN:
        if (this.h > 0) {
          this.h--;
          this.recall();
        }
        break;
      case ENC.RIGHT:
        if (this.i < this.input.length) {
          this.i++;
          this.sendToTerminal(data);
        }
        break;
      case ENC.LEFT:
        if (this.i > 0) {
          this.i--;
          this.sendToTerminal(data);
        }
        break;
      default:
        if (!/[^\P{Cc}]/gsu.test(data)) {
          this.input.splice(this.i, 0, data);
          const inserted = this.input.slice(this.i).join("");
          this.sendToTerminal(
            inserted.length > 1
              ? `${inserted}\x1b[${inserted.length - 1}D`
              : inserted,
          );
          this.i++;
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
