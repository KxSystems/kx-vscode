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

import { PythonExtension, ResolvedEnvironment } from "@vscode/python-extension";
import { DotenvPopulateInput } from "dotenv";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import kill from "tree-kill";
import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import {
  getAutoFocusOutputOnEntrySetting,
  getEnvironment,
} from "../utils/core";
import {
  Cancellable,
  MessageKind,
  notify,
  Runner,
} from "../utils/notifications";
import { normalizeQuery } from "../utils/queryUtils";
import { errorMessage } from "../utils/shared";
import { pickWorkspace } from "../utils/workspace";

const logger = "replConnection";

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
  CTRLD: "\x04",
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
  DEFAULT: "default",
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

function notEnvironment(target: string) {
  return !/[/\\](?:scripts|bin)[/\\]/is.test(target);
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

export class ReplConnection {
  private readonly win32 = process.platform === "win32";
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

  private env: DotenvPopulateInput = {};
  private activate = "";
  private prefix = ANSI.EMPTY;
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

  private constructor(
    private readonly workspace?: vscode.WorkspaceFolder,
    private readonly venv?: ResolvedEnvironment,
  ) {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.terminal = this.createTerminal();
    this.createEnvironment();
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
        close: this.close.bind(this),
        open: this.open.bind(this),
        setDimensions: this.setDimensions.bind(this),
        handleInput: this.handleInput.bind(this),
        onDidWrite: this.onDidWrite.event,
      },
      name: `${CONF.TITLE} (${this.workspace ? this.workspace.name : CONF.DEFAULT})`,
    });
  }

  private createEnvironment() {
    if (!this.workspace || !this.venv) return;
    const env = this.venv.environment;
    if (!env || env.type !== "VirtualEnvironment") return;
    const target = this.venv.path;
    if (notEnvironment(target)) return;
    const name = env.name;
    if (!name) return;

    const bin = path.dirname(target);
    const dir = path.basename(path.dirname(bin));
    if (name !== dir) return;

    this.activate = this.win32
      ? `"${path.join(bin, "activate.bat")}"`
      : `source "${path.join(bin, "activate")}"`;
    this.prefix = `(${name}) `;
  }

  private createProcess() {
    this.env = getEnvironment(this.workspace?.uri);

    return spawn(
      `${this.activate ? this.activate + " && " : ""}"${this.env.QPATH}"`,
      {
        env: { ...process.env, ...this.env },
        shell: this.win32 ? "cmd.exe" : "bash",
        windowsHide: true,
      },
    );
  }

  private connect() {
    let handler = this.handleError.bind(this);
    this.process.on("error", handler);
    this.process.stdin.on("error", handler);
    this.process.stdout.on("error", handler);
    this.process.stderr.on("error", handler);
    this.process.on("exit", this.handleExit.bind(this));
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
    this.stopped = this.win32;
    if (this.process.pid) kill(this.process.pid, "SIGINT");
  }

  private stopProcess(restart = false) {
    this.stopped = restart;
    if (this.process.pid) kill(this.process.pid, "SIGKILL");
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
      this.prefix.length +
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
        this.prefix +
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

  private restart() {
    this.cancel();
    this.stopProcess(true);
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

  private clean(decoded: string) {
    return decoded.replace(/(?:\r\n|[\r\n])+/gs, "");
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
    if (!this.exited || !this.stopped) this.showPrompt(true);
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

  private handleExit(code?: number) {
    if (this.stopped) {
      this.stopped = false;
      this.resolve();
      this.process = this.createProcess();
      this.connect();
      this._context = CTX.Q;
      this._namespace = ANSI.EMPTY;
      this.inputText = ANSI.EMPTY;
      this.updateMaxInputIndex();
      this.sendToTerminal(ANSI.CRLF);
      this.showPrompt(true);
      return;
    }
    this.exited = true;
    this.sendToTerminal(
      `${CONF.TITLE} exited with code (${code ?? 0}).${ANSI.CRLF}`,
    );
    this.resolve();
  }

  private close() {
    const key = this.workspace?.uri.toString() ?? CONF.DEFAULT;
    if (ReplConnection.repls.get(key) === this) {
      ReplConnection.repls.delete(key);
    }
    this.exited = true;
    this.cancel();
    this.stopProcess();
    this.onDidWrite.dispose();
  }

  private open(dimensions?: vscode.TerminalDimensions) {
    if (dimensions) this.setDimensions(dimensions);
    this.messages?.forEach((message) => this.onDidWrite.fire(message));
    this.messages = undefined;
    this.showPrompt(true);
    this.executeNext();
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
        ReplConnection.history.push(inputText);
        ReplConnection.history.rewind();
        this.inputIndex = this.visibleInputIndex;
        this.showPrompt();
        this.inputText = ANSI.EMPTY;
        this.runQuery(inputText);
        break;
      case KEY.CTRLC:
        this.cancel();
        break;
      case KEY.CTRLD:
        this.restart();
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
        this.recall(ReplConnection.history.prev);
        break;
      case KEY.UP:
        this.recall(ReplConnection.history.next);
        break;
      default:
        if (/(?:\r\n|[\r\n])/s.test(data)) {
          if (notEnvironment(data)) {
            if (path.isAbsolute(data))
              this.runQuery(
                `\\l ${path.relative(path.resolve(this.env.QPATH, ".."), this.clean(data))}`,
              );
            else this.runQuery(data);
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
    ReplConnection.history.clear();
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

  private static readonly history = new History();
  private static readonly repls = new Map<string, ReplConnection>();

  static async getOrCreateInstance(resource?: vscode.Uri) {
    const workspace =
      (resource && vscode.workspace.getWorkspaceFolder(resource)) ||
      (await pickWorkspace());

    const key = workspace?.uri.toString() ?? CONF.DEFAULT;

    let repl = this.repls.get(key);
    if (!repl || repl.exited) {
      let venv: ResolvedEnvironment | undefined;
      try {
        const pythonApi = await PythonExtension.api();
        const envp = pythonApi.environments.getActiveEnvironmentPath(workspace);
        venv = await pythonApi.environments.resolveEnvironment(envp);
      } catch (error) {
        notify(errorMessage(error), MessageKind.DEBUG, { logger });
      }
      repl = new ReplConnection(workspace, venv);
      this.repls.set(key, repl);
    }

    return repl;
  }
}
