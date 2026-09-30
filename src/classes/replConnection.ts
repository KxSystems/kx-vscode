/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import {
  PythonEnvironment,
  PythonEnvironments,
} from "@vscode/python-environments";
import kill from "kill-sync";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import * as vscode from "vscode";

import { showSetupError } from "../commands/setupCommand";
import { ext } from "../extensionVariables";
import {
  getAutoFocusOutputOnEntrySetting,
  getEnvironment,
  getHideDetailedConsoleQueryOutputSetting,
} from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { normalizeQuery } from "../utils/queryUtils";
import { moduleSearchPath } from "../utils/replPath";
import { activationCommand, quote } from "../utils/replPython";
import { errorMessage } from "../utils/shared";
import { pickWorkspace } from "../utils/workspace";

const logger = "replConnection";

const ANSI = {
  EMPTY: "",
  SPACE: " ",
  QUOTE: '"',
  SEMI: ";",
  AT: "@",
  CR: "\r",
  CRLF: "\r\n",
  DOWN: "\x1b[1B",
  SAVE: "\x1b[s",
  RESTORE: "\x1b[u",
  ERASETOEND: "\x1b[0J",
  CLEAR: "\x1b[2J\x1b[3J\x1b[H",
  LINESTART: "\x1b[0G",
  FAINTON: "\x1b[2m",
  FAINTOFF: "\x1b[22m",
  PASTEON: "\x1b[?2004h",
};

const KEY = {
  CR: "\r",
  CTRLC: "\x03",
  CTRLD: "\x04",
  CTRLL: "\x0c",
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
  CTRLLEFT: "\x1b[1;5D",
  CTRLRIGHT: "\x1b[1;5C",
  ALTLEFT: "\x1b[1;3D",
  ALTRIGHT: "\x1b[1;3C",
  METALEFT: "\x1bb",
  METARIGHT: "\x1bf",
  DELWORDLEFT: "\x17",
  DELWORDLEFTMETA: "\x1b\x7f",
  DELWORDRIGHT: "\x1bd",
  DELWORDRIGHTCTRL: "\x1b[3;5~",
  DELWORDRIGHTALT: "\x1b[3;3~",
  PASTESTART: "\x1b[200~",
  PASTEEND: "\x1b[201~",
};

const CTX = {
  Q: "q",
  K: "k",
};

const NS = {
  Q: ',string[system"d"],',
  K: ',$:[."\\\\d"],',
};

const CONF = {
  DEFAULT: "default",
  TITLE: `KX ${ext.REPL}`,
  PROMPT: ")",
  MAX_INPUT: 80 * 40,
};

interface Execution {
  source: vscode.CancellationTokenSource;
  cancelled: boolean;
  lines: string[];
  output: string[];
  echo: boolean;
  echoed: number;
  display?: string;
  done: RegExpExecArray[];
  index: number;
  reject: (reason?: any) => void;
  resolve: (value: Result) => void;
}

export interface Result {
  cancelled?: boolean;
  output?: string;
}

export class QNotFoundError extends Error {}

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
    this.identity + ANSI.AT + ".([^@\\r\\n]*)" + ANSI.AT,
    "gs",
  );
  private readonly inactive = this.identity + "!";
  private readonly inactiveToken = new RegExp(
    this.inactive + "[\\t ]*(?:\\r\\n|[\\r\\n])?",
  );
  private readonly onDidWrite: vscode.EventEmitter<string>;
  private readonly decoder: TextDecoder;
  private readonly terminal: vscode.Terminal;
  private readonly executions: Execution[] = [];

  private messages? = [
    `${CONF.TITLE} Copyright (C) 1993-${new Date().getFullYear()} KX Systems` +
      ANSI.CRLF.repeat(2),
  ];

  private env: { [key: string]: string } = {};
  private process: ChildProcessWithoutNullStreams;
  private prefix = ANSI.EMPTY;
  private _context = CTX.Q;
  private _namespace = ANSI.EMPTY;
  private columns = 0;
  private rows = 0;
  private maxInputIndex = 0;
  private inputIndex = 0;
  private input: string[] = [];
  private pasting?: string;
  private block?: string;
  private exited = false;
  private stopped = false;
  private executing?: Execution;
  private failure?: Error;

  private constructor(
    private readonly workspace?: vscode.WorkspaceFolder,
    private venv?: PythonEnvironment,
    private readonly baseUri?: vscode.Uri,
  ) {
    this.onDidWrite = new vscode.EventEmitter<string>();
    this.decoder = new TextDecoder("utf8");
    this.process = this.createProcess();
    this.connect();
    this.terminal = this.createTerminal();
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
    if (context === CTX.K) this.sendToProcess("\\x .z.pi" + ANSI.CRLF + "\\");
    else this.sendToProcess("\\" + ANSI.CRLF + this.createHandler());
    this.inputText = ANSI.EMPTY;
    this.updateMaxInputIndex();
    this.sendToTerminal(ANSI.CRLF);
    this.showPrompt(true);
  }

  private get namespace() {
    return this._namespace;
  }

  private set namespace(namespace: string) {
    this._namespace = namespace;
    this.updateMaxInputIndex();
  }

  private get key() {
    return this.baseUri?.toString() ?? CONF.DEFAULT;
  }

  private get cwd() {
    return this.baseUri?.fsPath ?? this.workspace?.uri.fsPath;
  }

  // `\l` resolves against the working directory the process was started in and
  // only understands forward slashes.
  private loadPath(target: string) {
    const base = this.cwd;
    const relative = base ? path.relative(base, target) : target;
    return (path.isAbsolute(relative) || !relative ? target : relative)
      .split(path.sep)
      .join("/");
  }

  private terminalLabel() {
    if (this.workspace) {
      const name = ReplConnection.folderLabel(this.workspace);
      if (
        !this.baseUri ||
        this.baseUri.toString() === this.workspace.uri.toString()
      ) {
        return name;
      }
      const rel = path.relative(this.workspace.uri.fsPath, this.baseUri.fsPath);
      return `${name}/${rel.split(path.sep).join("/")}`;
    }
    return this.baseUri
      ? path.basename(this.baseUri.fsPath) || this.baseUri.fsPath
      : CONF.DEFAULT;
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
      name: `${CONF.TITLE} (${this.terminalLabel()})`,
      isTransient: true,
    });
  }

  private createProcess() {
    this.env = getEnvironment(this.workspace);
    if (!this.env.qBinPath) {
      showSetupError(this.workspace);
      throw new QNotFoundError(
        `${CONF.TITLE} cannot start: no q was found${this.workspace ? ` for workspace ${this.workspace.name}` : ""}.`,
      );
    }

    // Only KDB-X has a module system; classic kdb+ ignores QPATH.
    const base = this.baseUri?.fsPath;
    if (base && this.env.qBinKdbX) {
      this.env.QPATH = moduleSearchPath(base, this.env.QPATH, this.env.QHOME);
    }

    const shell = this.win32 ? "cmd" : "bash";
    const activate = this.venv
      ? activationCommand(this.venv, shell, this.env)
      : ANSI.EMPTY;

    const python = this.venv?.execInfo.run.executable;
    if (activate && python && !/\s/.test(python) && !this.env.PYKX_EXECUTABLE) {
      this.env.PYKX_EXECUTABLE = python;
    }

    const name = this.venv?.name.replace(/\s*\([^()]*\)$/, ANSI.EMPTY);
    this.prefix = activate ? `(${name}) ` : ANSI.EMPTY;
    const q = quote(this.env.qBinPath, shell, this.env);

    let command = q;
    if (activate) {
      command = this.win32
        ? `(${activate}) 2>nul || echo ${this.inactive} & ${q}`
        : `{ ${activate}; } 2>/dev/null || echo ${this.inactive}; ${q}`;
    }

    return spawn(command, {
      env: this.env,
      cwd: this.cwd,
      windowsHide: true,
      shell: this.win32 ? "cmd.exe" : "bash",
    });
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
    this.process.on("spawn", () => this.sendToProcess(this.createHandler()));
  }

  private createToken(pipe: 1 | 2) {
    return (
      `${pipe} {x}` +
      ANSI.QUOTE +
      this.identity +
      ANSI.AT +
      ANSI.QUOTE +
      (this.context === CTX.Q ? NS.Q : NS.K) +
      ANSI.QUOTE +
      ANSI.AT +
      ANSI.QUOTE +
      ANSI.SEMI
    );
  }

  private createHandler() {
    return normalizeQuery(
      `.z.pi:{show value x;${this.createToken(1)}${this.createToken(2)}};`,
    );
  }

  private stub(query: string) {
    return query.replace(
      /(?<![A-Za-z0-9.])(?:read0(?![A-Za-z0-9.])|0::)/gs,
      '{$[x~0;"";0::[x]]}',
    );
  }

  private sendToProcess(data: string) {
    this.process.stdin.write(
      this.context === CTX.Q
        ? data + ANSI.CRLF
        : this.stub(data) +
            ANSI.CRLF +
            this.createToken(1) +
            this.createToken(2) +
            ANSI.CRLF,
    );
  }

  // Killing an already exited process throws on Windows, where the tree kill
  // shells out to taskkill, so failures are logged instead of propagated.
  private killProcess(signal: string) {
    if (!this.process.pid) return;
    try {
      kill(this.process.pid, signal, true);
    } catch (error) {
      notify(errorMessage(error), MessageKind.DEBUG, { logger });
    }
  }

  private stopExecution() {
    this.stopped = this.win32;
    this.killProcess("SIGINT");
  }

  private stopProcess(restart = false) {
    this.stopped = restart;
    this.killProcess("SIGKILL");
  }

  private runQuery(data: string) {
    // Errors are written to the terminal by handleError before the promise
    // rejects, so there is nothing left to report here.
    this.executeQuery(data, false).catch((error) => {
      if (error === this.failure) return;
      this.sendToTerminal(ANSI.CRLF + errorMessage(error) + ANSI.CRLF);
      if (!this.executing) this.showInput(true);
    });
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

  private promptText(context?: string) {
    return (
      ANSI.FAINTON +
      this.prefix +
      (context ?? this.context) +
      this.namespace +
      CONF.PROMPT +
      ANSI.SPACE +
      ANSI.FAINTOFF
    );
  }

  private showPrompt(create?: boolean, context?: string) {
    if (this.exited) {
      return;
    }
    this.sendToTerminal(
      (create ? ANSI.PASTEON + ANSI.SAVE : ANSI.RESTORE) +
        this.promptText(context) +
        this.input.slice(0, this.visibleInputIndex).join(ANSI.EMPTY) +
        ANSI.ERASETOEND +
        this.moveCursorToContext(context, this.inputIndex),
    );
  }

  private isWordChar(index: number) {
    const char = this.input[index];
    return char !== undefined && /\w/.test(char);
  }

  private wordLeft() {
    let index = this.inputIndex;
    while (index > 0 && !this.isWordChar(index - 1)) index--;
    while (index > 0 && this.isWordChar(index - 1)) index--;
    return index;
  }

  private wordRight() {
    const max = this.visibleInputIndex;
    let index = this.inputIndex;
    while (index < max && !this.isWordChar(index)) index++;
    while (index < max && this.isWordChar(index)) index++;
    return index;
  }

  private deleteWordLeft() {
    const index = this.wordLeft();
    if (index < this.inputIndex) {
      this.input.splice(index, this.inputIndex - index);
      this.inputIndex = index;
      this.showPrompt();
    }
  }

  private deleteWordRight() {
    const index = this.wordRight();
    if (index > this.inputIndex) {
      this.input.splice(this.inputIndex, index - this.inputIndex);
      this.showPrompt();
    }
  }

  private showBlock(create?: boolean) {
    if (this.exited) {
      return;
    }
    this.sendToTerminal(
      (create ? ANSI.SAVE : ANSI.RESTORE) +
        this.promptText() +
        this.normalize(this.block ?? ANSI.EMPTY) +
        ANSI.ERASETOEND,
    );
  }

  private showInput(create?: boolean) {
    if (this.block === undefined) this.showPrompt(create);
    else this.showBlock(create);
  }

  private clear() {
    this.sendToTerminal(ANSI.CLEAR);
    if (!this.executing) this.showInput(true);
  }

  private insert(data: string) {
    if (data.length < CONF.MAX_INPUT) {
      const target = data.replace(/[^\P{Cc}]/gsu, ANSI.EMPTY);
      this.input.splice(this.inputIndex, 0, ...target);
      this.updateInputIndex(target);
      if (this.executing) this.sendToTerminal(target);
      else this.showPrompt();
    }
  }

  private paste(text: string) {
    const lines = text
      .replace(/(?![\t\r\n])\p{Cc}/gsu, ANSI.EMPTY)
      .replace(/(?<![\r\n])[\r\n]+$/, ANSI.EMPTY)
      .split(/\r\n|[\r\n]/s);
    const pasted = lines.join("\n");

    if (this.block !== undefined) {
      this.block += "\n" + pasted;
      this.sendToTerminal(ANSI.CRLF + this.normalize(pasted));
    } else if (lines.length > 1 || pasted.length >= CONF.MAX_INPUT) {
      const after = this.input.slice(this.inputIndex).join(ANSI.EMPTY);
      this.block =
        this.input.slice(0, this.inputIndex).join(ANSI.EMPTY) + pasted + after;
      this.inputText = ANSI.EMPTY;
      if (this.executing) this.sendToTerminal(this.normalize(pasted + after));
      else this.showBlock();
    } else this.insert(pasted.replace(/\t/g, ANSI.SPACE));
  }

  private handleBlockInput(data: string) {
    switch (data) {
      case KEY.CR: {
        const block = this.block ?? ANSI.EMPTY;
        this.block = undefined;
        this.runQuery(block);
        break;
      }
      case KEY.CTRLC:
        this.block = undefined;
        this.sendToTerminal(ANSI.CRLF);
        if (this.executing) this.cancel();
        else this.showPrompt(true);
        break;
      case KEY.CTRLD:
        this.block = undefined;
        this.stopProcess(true);
        break;
      case KEY.CTRLL:
        this.clear();
        break;
    }
  }

  private recall(history?: HistoryItem) {
    const input = history?.input ?? ANSI.EMPTY;
    this.input = [...input];
    this.inputIndex = 0;
    this.updateInputIndex(input);
    this.showPrompt();
  }

  // Stops the running query, the same way Ctrl+C does from the terminal.
  // Notebook cells call this from their own interrupt button.
  cancel(error?: Error) {
    if (this.executing) {
      if (error) this.executing.reject(error);
      this.executing.source.cancel();
    }
  }

  private normalize(decoded: string) {
    return decoded.replace(/[\r\n]+/g, ANSI.CRLF);
  }

  private clean(decoded: string) {
    return decoded.replace(/[\r\n]+/g, "");
  }

  private executeNext() {
    if (!this.executing && !this.messages) {
      this.executing = this.executions.shift();
      if (this.executing) {
        const line = this.executing.lines[this.executing.index];
        this.sendToTerminal(
          this.executing.echo
            ? ANSI.RESTORE +
                this.promptText() +
                this.normalize(this.executing.display ?? line) +
                ANSI.ERASETOEND +
                ANSI.CRLF
            : ANSI.CRLF,
        );
        this.sendToProcess(line);
      }
    }
  }

  private echo(c: Execution) {
    const tail = c.output.slice(c.echoed).join(ANSI.EMPTY);
    c.echoed = c.output.length;
    this.sendToTerminal(
      (tail && !tail.endsWith(ANSI.CRLF) ? ANSI.CRLF : ANSI.EMPTY) +
        this.promptText() +
        c.lines[c.index] +
        ANSI.CRLF,
    );
  }

  private resolve() {
    const c = this.executing;
    if (!c) return;
    this.executing = undefined;
    const output = c.output.join(ANSI.EMPTY);
    const tail = c.output.slice(c.echoed).join(ANSI.EMPTY);
    if (tail && !tail.endsWith(ANSI.CRLF)) this.sendToTerminal(ANSI.CRLF);
    c.resolve({ cancelled: c.cancelled, output });
    if (!this.exited || !this.stopped) this.showInput(true);
    if (c.cancelled) this.drain();
    else this.executeNext();
  }

  private drain() {
    let c: Execution | undefined;
    while ((c = this.executions.shift())) c.resolve({ cancelled: true });
  }

  private handleOutput(data: any) {
    let chunk = this.decoder.decode(data);
    if (this.prefix && chunk.includes(this.inactive)) {
      chunk = chunk.replace(this.inactiveToken, ANSI.EMPTY);
      this.prefix = ANSI.EMPTY;
      this.updateMaxInputIndex();
      if (!this.executing && !this.messages) this.showInput();
    }
    this.token.lastIndex = 0;
    const output = this.normalize(chunk.replace(this.token, ANSI.EMPTY));
    if (output) this.sendToTerminal(output);

    const c = this.executing;
    if (!c) return;
    if (output) c.output.push(output);

    if (/'\d{4}\.\d{2}\.\d{2}T/m.test(c.output.join(ANSI.EMPTY))) {
      c.cancelled = true;
      this.resolve();
      return;
    }

    this.token.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = this.token.exec(chunk))) c.done.push(match);

    if (c.done.length === (c.index + 1) * 2) {
      match = c.done[c.done.length - 1];
      this.namespace = match[1] ? `.${match[1]}` : ANSI.EMPTY;
      if (c.index < c.lines.length - 1) {
        c.index++;
        if (c.echo && c.display === undefined) this.echo(c);
        this.sendToProcess(c.lines[c.index]);
      } else this.resolve();
    }
  }

  private handleError(error: Error) {
    this.failure = error;
    this.sendToTerminal(`${error.message}${ANSI.CRLF}`);
    this.cancel(error);
  }

  private handleExit(code?: number) {
    const queued = this.executions.splice(0);
    this.block = undefined;
    this.pasting = undefined;
    if (this.stopped) {
      this.stopped = false;
      this.resolve();
      queued.forEach((c) => c.resolve({ cancelled: true }));
      try {
        this.process = this.createProcess();
      } catch {
        this.handleExit(code);
        return;
      }
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
    if (ReplConnection.active === this) ReplConnection.active = undefined;
    this.sendToTerminal(
      `${CONF.TITLE} exited with code (${code ?? 0}).${ANSI.CRLF}`,
    );
    this.resolve();
    queued.forEach((c) => c.resolve({ cancelled: true }));
  }

  private close() {
    if (ReplConnection.repls.get(this.key) === this) {
      ReplConnection.repls.delete(this.key);
    }
    if (ReplConnection.active === this) ReplConnection.active = undefined;
    this.exited = true;
    this.cancel();
    this.stopProcess();
    this.onDidWrite.dispose();
  }

  private open(dimensions?: vscode.TerminalDimensions) {
    if (dimensions) this.setDimensions(dimensions);
    this.messages?.forEach((message) => this.onDidWrite.fire(message));
    this.messages = undefined;
    this.sendToTerminal(ANSI.PASTEON);
    this.showPrompt(true);
    this.executeNext();
  }

  private setDimensions(dimensions: vscode.TerminalDimensions) {
    this.rows = dimensions.rows;
    this.columns = dimensions.columns;
    this.updateMaxInputIndex();
  }

  private handleInput(data: string) {
    if (this.exited) {
      return;
    }

    if (this.pasting !== undefined || data.startsWith(KEY.PASTESTART)) {
      this.pasting = (this.pasting ?? ANSI.EMPTY) + data;
      const end = this.pasting.indexOf(KEY.PASTEEND);
      if (end === -1) return;
      const text = this.pasting.slice(KEY.PASTESTART.length, end);
      const rest = this.pasting.slice(end + KEY.PASTEEND.length);
      this.pasting = undefined;
      this.paste(text);
      if (rest) this.handleInput(rest);
      return;
    }

    if (this.block !== undefined) {
      this.handleBlockInput(data);
      return;
    }

    let inputText: string | undefined;

    switch (data) {
      case KEY.CR:
        inputText = this.inputText;
        if (this.executing) {
          this.sendToTerminal(ANSI.CRLF);
          this.sendToProcess(inputText);
          this.executing.output.push(inputText + ANSI.CRLF);
          this.inputText = ANSI.EMPTY;
          break;
        }
        if (!inputText) {
          this.sendToTerminal(ANSI.CRLF);
          this.showPrompt(true);
          break;
        }
        if (/^\\[\t ]*$/m.test(inputText)) {
          this.context = this.context === CTX.K ? CTX.Q : CTX.K;
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
        this.stopProcess(true);
        break;
      case KEY.CTRLL:
        this.clear();
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
      case KEY.DELWORDLEFT:
      case KEY.DELWORDLEFTMETA:
        this.deleteWordLeft();
        break;
      case KEY.DELWORDRIGHT:
      case KEY.DELWORDRIGHTCTRL:
      case KEY.DELWORDRIGHTALT:
        this.deleteWordRight();
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
      case KEY.CTRLLEFT:
      case KEY.ALTLEFT:
      case KEY.METALEFT: {
        const index = this.wordLeft();
        if (index !== this.inputIndex) {
          this.inputIndex = index;
          this.showPrompt();
        }
        break;
      }
      case KEY.CTRLRIGHT:
      case KEY.ALTRIGHT:
      case KEY.METARIGHT: {
        const index = this.wordRight();
        if (index !== this.inputIndex) {
          this.inputIndex = index;
          this.showPrompt();
        }
        break;
      }
      case KEY.DOWN:
        this.recall(ReplConnection.history.prev);
        break;
      case KEY.UP:
        this.recall(ReplConnection.history.next);
        break;
      default:
        if (/(?:\r\n|[\r\n])/s.test(data)) {
          if (notEnvironment(data)) {
            const target = this.clean(data);
            if (path.isAbsolute(target) && existsSync(target))
              this.runQuery(`\\l ${this.loadPath(target)}`);
            else this.runQuery(data);
          }
          break;
        }
        this.insert(data);
        break;
    }
  }

  clearHistory() {
    ReplConnection.history.clear();
  }

  start() {
    ReplConnection.active = this;
    this.terminal.show();
  }

  show() {
    if (getAutoFocusOutputOnEntrySetting()) this.terminal.show(true);
  }

  executeQuery(
    text: string,
    echo = !getHideDetailedConsoleQueryOutputSetting(),
    display?: string,
  ) {
    return new Promise<Result>((resolve, reject) => {
      const source = new vscode.CancellationTokenSource();

      const execution = {
        source,
        cancelled: false,
        lines: normalizeQuery(text)
          .split(ANSI.CRLF)
          .filter((line) => line),
        output: [],
        echo,
        echoed: 0,
        display: display?.replace(/(?<![\r\n])[\r\n]+$/, ANSI.EMPTY),
        done: [],
        index: 0,
        reject,
        resolve,
      };

      let retry = 0;

      const requestCancellation = () => {
        if (this.executing) {
          if (retry < 50) {
            retry++;
            this.stopExecution();
            setTimeout(requestCancellation, 50);
          } else {
            this.stopProcess(true);
          }
        }
      };

      // Cancellation is driven from the terminal (Ctrl+C) through this source.
      source.token.onCancellationRequested(requestCancellation);

      if (execution.lines.length === 0) {
        // Blank lines, comments and exit comments all normalize away, so there
        // is nothing to run. Queueing it would send lines[0] (undefined) to the
        // process.
        resolve({ output: ANSI.EMPTY });
      } else {
        this.executions.push(execution);
        this.executeNext();
      }
    });
  }

  private static readonly history = new History();
  private static readonly repls = new Map<string, ReplConnection>();
  private static readonly bases = new Map<string, vscode.Uri | undefined>();
  private static readonly pending = new Map<string, Promise<ReplConnection>>();
  private static environmentListener?: vscode.Disposable;

  // The REPL the user is actively working in, tracked from terminal focus.
  // Every execution routed to the REPL runs here, so a file follows the REPL
  // the user is looking at rather than the folder it happens to live in.
  private static current?: ReplConnection;
  private static focusListener?: vscode.Disposable;
  private static readonly activeChanged = new vscode.EventEmitter<void>();

  static readonly onDidChangeActive = ReplConnection.activeChanged.event;

  private static get active() {
    return this.current;
  }

  private static set active(repl: ReplConnection | undefined) {
    if (this.current === repl) return;
    this.current = repl;
    this.activeChanged.fire();
  }

  get label() {
    return this.terminalLabel();
  }

  static get activeLabel() {
    const active = this.active;
    return active && !active.exited ? active.label : undefined;
  }

  static labels() {
    return [...this.repls.values()]
      .filter((repl) => !repl.exited)
      .map((repl) => repl.label)
      .sort((a, b) => a.localeCompare(b));
  }

  private static folderLabel(folder: vscode.WorkspaceFolder) {
    const index = (vscode.workspace.workspaceFolders ?? [])
      .filter((item) => item.name === folder.name)
      .findIndex((item) => item.uri.toString() === folder.uri.toString());
    return index > 0 ? `${folder.name} [${index + 1}]` : folder.name;
  }

  static async forLabel(label: string) {
    for (const repl of this.repls.values()) {
      if (!repl.exited && repl.label === label) return repl;
    }
    const folders = vscode.workspace.workspaceFolders ?? [];
    const match = folders
      .map((folder) => ({ folder, name: this.folderLabel(folder) }))
      .filter(({ name }) => label === name || label.startsWith(`${name}/`))
      .sort((a, b) => b.name.length - a.name.length)[0];
    const within = (folder: vscode.WorkspaceFolder, rest: string) =>
      rest ? vscode.Uri.joinPath(folder.uri, ...rest.split("/")) : folder.uri;
    let base: vscode.Uri | undefined;
    if (match) {
      base = within(match.folder, label.slice(match.name.length + 1));
    } else if (this.bases.has(label)) {
      base = this.bases.get(label);
      if (!base) return this.create();
    } else if (folders.length === 1) {
      base = within(folders[0], label.split("/").slice(1).join("/"));
    } else {
      throw new Error(
        `${CONF.TITLE} (${label}) cannot be started: there is no workspace folder named ${label.split("/")[0]}.`,
      );
    }
    try {
      await vscode.workspace.fs.stat(base);
    } catch {
      throw new Error(
        `${CONF.TITLE} (${label}) cannot be started: ${base.fsPath} does not exist.`,
      );
    }
    return this.openInFolder(base);
  }

  // Read-only check used by the shared active-target tracker to tell a REPL
  // terminal apart from a connection console or an unrelated terminal.
  static isReplTerminal(terminal: vscode.Terminal): boolean {
    for (const repl of this.repls.values()) {
      if (repl.terminal === terminal && !repl.exited) {
        return true;
      }
    }
    return false;
  }

  private static trackActiveTerminal() {
    if (this.focusListener) return;
    this.focusListener = vscode.window.onDidChangeActiveTerminal((terminal) => {
      if (!terminal) return;
      for (const repl of this.repls.values()) {
        if (repl.terminal === terminal && !repl.exited) {
          this.active = repl;
          return;
        }
      }
      // A non-REPL terminal was focused; keep the current active REPL.
    });
  }

  private static async selectEnvironment(scope?: vscode.Uri) {
    try {
      const pythonApi = await PythonEnvironments.api();
      this.environmentListener ??= pythonApi.onDidChangeEnvironment?.(() => {
        for (const repl of this.repls.values()) {
          if (!repl.exited) void repl.refreshEnvironment();
        }
      });
      const selected = await pythonApi.getEnvironment(scope);
      if (!selected?.error) return selected;
    } catch (error) {
      notify(errorMessage(error), MessageKind.DEBUG, { logger });
    }
    return undefined;
  }

  private async refreshEnvironment() {
    this.venv = await ReplConnection.selectEnvironment(
      this.baseUri ?? this.workspace?.uri,
    );
  }

  private static create(
    workspace?: vscode.WorkspaceFolder,
    baseUri?: vscode.Uri,
  ) {
    const key = baseUri?.toString() ?? CONF.DEFAULT;
    let pending = this.pending.get(key);
    if (!pending) {
      pending = this.launch(workspace, baseUri).finally(() =>
        this.pending.delete(key),
      );
      this.pending.set(key, pending);
    }
    return pending;
  }

  private static async launch(
    workspace?: vscode.WorkspaceFolder,
    baseUri?: vscode.Uri,
  ) {
    this.trackActiveTerminal();
    const venv = await this.selectEnvironment(baseUri ?? workspace?.uri);
    const repl = new ReplConnection(workspace, venv, baseUri);
    this.repls.set(repl.key, repl);
    this.bases.set(repl.label, baseUri);
    return repl;
  }

  static async getOrCreateInstance(resource?: vscode.Uri) {
    // Executions always target the active REPL (the one the user last started
    // or focused) when it is live, the same way they target the active
    // connection. Where the file sits on disk plays no part.
    if (resource && this.active && !this.active.exited) {
      return this.active;
    }

    const workspace =
      (resource && vscode.workspace.getWorkspaceFolder(resource)) ||
      (await pickWorkspace());

    const key = workspace?.uri.toString() ?? CONF.DEFAULT;
    const existing = this.repls.get(key);
    if (existing && !existing.exited) {
      return existing;
    }
    return this.create(workspace, workspace?.uri);
  }

  static async openInFolder(base: vscode.Uri) {
    const existing = this.repls.get(base.toString());
    if (existing && !existing.exited) {
      return existing;
    }
    return this.create(vscode.workspace.getWorkspaceFolder(base), base);
  }
}
