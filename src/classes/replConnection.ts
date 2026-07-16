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

import { PythonExtension, ResolvedEnvironment } from "@vscode/python-extension";
import path from "node:path";
import * as vscode from "vscode";

import { QDebugDriver } from "./qDebugDriver";
import { showSetupError } from "../commands/setupCommand";
import { ext } from "../extensionVariables";
import {
  getAutoFocusOutputOnEntrySetting,
  getEnvironment,
} from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { normalizeQuery } from "../utils/queryUtils";
import { moduleSearchPath, selectRepl } from "../utils/replPath";
import { errorMessage } from "../utils/shared";
import { pickWorkspace } from "../utils/workspace";

const logger = "replConnection";

const CRLF = "\r\n";

const CONF = {
  DEFAULT: "default",
  TITLE: `KX ${ext.REPL}`,
};

const KEY = {
  CR: "\r",
  CTRLC: "\x03",
  CTRLD: "\x04",
  BS: "\b",
  BSMAC: "\x7f",
};

export interface Result {
  cancelled?: boolean;
  output?: string;
}

function notEnvironment(target: string) {
  return !/[/\\](?:scripts|bin)[/\\]/is.test(target);
}

/**
 * An interactive q session presented as a VS Code terminal.
 *
 * The session runs q over the shared {@link QDebugDriver} transport
 * (`KX_TTY=1`/`KX_LINE=0`), so q prints its own prompts (top level `q)`, inside a
 * namespace `q.foo)`) and its interactive debugger engages on demand. The same
 * live process therefore serves both the REPL and the q debugger — the debugger
 * borrows this connection's driver rather than spawning its own q. The debug
 * helper (`resources/q/debug.q`) is loaded at startup so the process is
 * debug-ready.
 *
 * This is a pseudoterminal whose backend is the extension: q's raw output is
 * mirrored to the terminal, and typed input is echoed locally and forwarded to q
 * one line at a time. Line-editing niceties (history, word navigation, cursor
 * movement, the k/q toggle) are intentionally minimal for now.
 */
export class ReplConnection {
  private readonly onDidWrite = new vscode.EventEmitter<string>();
  private readonly terminal: vscode.Terminal;
  private readonly driver = new QDebugDriver();
  private readonly ready: Promise<void>;

  private env: { [key: string]: string } = {};
  private activate = "";
  /** Display output buffered until the pseudoterminal's `open()` fires. */
  private pendingDisplay?: string[] = [];
  /** The current interactive input line (characters). */
  private input: string[] = [];
  private opened = false;
  private exited = false;

  private constructor(
    private readonly workspace?: vscode.WorkspaceFolder,
    private readonly venv?: ResolvedEnvironment,
    private readonly baseUri?: vscode.Uri,
  ) {
    this.createEnvironment();
    this.driver.on("data", (chunk: string) => this.render(chunk));
    this.driver.on("exited", () => this.handleExit());
    this.driver.on("reveal", () => this.terminal?.show(true));
    this.terminal = this.createTerminal();
    this.ready = this.startDriver();
  }

  private get key() {
    return this.baseUri?.toString() ?? CONF.DEFAULT;
  }

  private terminalLabel() {
    if (this.workspace) {
      if (
        !this.baseUri ||
        this.baseUri.toString() === this.workspace.uri.toString()
      ) {
        return this.workspace.name;
      }
      const rel = path.relative(this.workspace.uri.fsPath, this.baseUri.fsPath);
      return `${this.workspace.name}/${rel.split(path.sep).join("/")}`;
    }
    return this.baseUri ? path.basename(this.baseUri.fsPath) : CONF.DEFAULT;
  }

  private createTerminal() {
    return vscode.window.createTerminal({
      pty: {
        onDidWrite: this.onDidWrite.event,
        open: this.open.bind(this),
        close: this.close.bind(this),
        handleInput: this.handleInput.bind(this),
        setDimensions: this.setDimensions.bind(this),
      },
      name: `${CONF.TITLE} (${this.terminalLabel()})`,
      isTransient: true,
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

    const win32 = process.platform === "win32";
    this.activate = win32
      ? `"${path.join(bin, "activate.bat")}"`
      : `source "${path.join(bin, "activate")}"`;
  }

  /** Resolve the environment and start the q process over the shared transport. */
  private async startDriver(): Promise<void> {
    this.env = getEnvironment(this.workspace);
    if (!this.env.qBinPath) {
      showSetupError(this.workspace);
      return;
    }

    // Only KDB-X has a module system; classic kdb+ ignores QPATH.
    const base = this.baseUri?.fsPath;
    if (base && this.env.qBinKdbX) {
      this.env.QPATH = moduleSearchPath(base, this.env.QPATH, this.env.QHOME);
    }

    const cwd = this.baseUri?.fsPath ?? this.workspace?.uri.fsPath;
    const helper = path.join(
      ext.context.extensionPath,
      "resources",
      "q",
      "debug.q",
    );
    const commandPrefix = this.activate ? `${this.activate} && ` : "";

    try {
      await this.driver.start(
        this.env.qBinPath,
        this.env,
        cwd,
        helper,
        commandPrefix,
      );
    } catch (error) {
      this.render(`${errorMessage(error)}${CRLF}`);
    }
  }

  // ---- display ----

  private render(chunk: string) {
    const text = chunk.replace(/\r?\n/g, CRLF);
    if (this.pendingDisplay) this.pendingDisplay.push(text);
    else this.onDidWrite.fire(text);
  }

  private open(dimensions?: vscode.TerminalDimensions) {
    this.opened = true;
    const pending = this.pendingDisplay;
    this.pendingDisplay = undefined;
    pending?.forEach((text) => this.onDidWrite.fire(text));
    if (dimensions) this.syncConsoleSize(dimensions);
  }

  private setDimensions(dimensions: vscode.TerminalDimensions) {
    this.syncConsoleSize(dimensions);
  }

  /**
   * Keep q's console size (`\c rows cols`) in step with the terminal, so
   * displayed values wrap and elide at the real width instead of q's 25x80
   * default (q reads COLUMNS/LINES only at startup, and the extension-host pty
   * passes neither). The command runs quietly through the shared driver queue,
   * so it cannot interleave with an in-flight debugger operation, and `\c` is
   * depth-safe: it executes at a suspended `q))` prompt without disturbing the
   * suspension. Sizes are clamped to q's 10x10 minimum. Best effort — a busy
   * or exited q simply misses the resize.
   */
  private syncConsoleSize(dimensions: vscode.TerminalDimensions) {
    const rows = Math.max(10, dimensions.rows);
    const cols = Math.max(10, dimensions.columns);
    void this.ready
      .then(() => {
        if (this.exited || !this.driver.alive) return;
        return this.driver.run(`\\c ${rows} ${cols}`, false);
      })
      .catch(() => {
        /* best effort */
      });
  }

  // ---- interactive input (minimal) ----

  private handleInput(data: string) {
    if (this.exited) return;

    if (data === KEY.CTRLC) {
      this.driver.interrupt();
      return;
    }
    if (data === KEY.CTRLD) {
      // EOF/restart is deferred; ignore for now.
      return;
    }

    // Enter (and pasted multi-line input): submit each completed line.
    if (/[\r\n]/.test(data)) {
      const parts = data.split(/\r\n|\r|\n/);
      parts.forEach((part, i) => {
        if (part) {
          this.input.push(...part);
          this.onDidWrite.fire(part);
        }
        if (i < parts.length - 1) this.submit();
      });
      return;
    }

    if (data === KEY.BS || data === KEY.BSMAC) {
      if (this.input.length > 0) {
        this.input.pop();
        this.onDidWrite.fire("\b \b");
      }
      return;
    }

    // Echo printable input; ignore other control sequences (arrows, etc.) for now.
    if (![...data].some((c) => (c.codePointAt(0) ?? 0) < 32)) {
      this.input.push(...data);
      this.onDidWrite.fire(data);
    }
  }

  private submit() {
    const line = this.input.join("");
    this.input = [];
    this.onDidWrite.fire(CRLF);
    void this.driver.run(line).catch(() => {
      /* process gone or timed out; output already surfaced via the data event */
    });
  }

  // ---- public API ----

  clearHistory() {
    /* history is deferred in the prompt-based REPL */
  }

  start() {
    ReplConnection.active = this;
    this.terminal.show();
  }

  show() {
    if (getAutoFocusOutputOnEntrySetting()) this.terminal.show(true);
  }

  /** Bring the terminal to the foreground (used by the debugger on a stop). */
  reveal() {
    this.terminal.show(true);
  }

  /**
   * The shared q session transport backing this REPL. The debugger drives the
   * same live process through it, so debugging happens in this terminal.
   */
  async session(): Promise<QDebugDriver> {
    await this.ready;
    return this.driver;
  }

  /**
   * Run q source, one statement per line, returning the combined output. Display
   * is handled live via the driver's data event; this captures the parsed result
   * for callers (run-file, notebook cells).
   */
  async executeQuery(
    text: string,
    token: vscode.CancellationToken,
  ): Promise<Result> {
    await this.ready;
    if (this.exited || !this.driver.alive) return { output: "" };

    const lines = normalizeQuery(text)
      .split(CRLF)
      .filter((line) => line);

    let output = "";
    for (const line of lines) {
      if (token.isCancellationRequested) return { cancelled: true, output };
      if (this.opened) this.onDidWrite.fire(line + CRLF);
      try {
        const result = await this.driver.run(line);
        output += result.output;
      } catch {
        return { cancelled: true, output };
      }
    }
    return { output };
  }

  private handleExit() {
    if (this.exited) return;
    this.exited = true;
    if (ReplConnection.active === this) ReplConnection.active = undefined;
    ReplConnection.repls.delete(this.key);
    this.render(`${CONF.TITLE} exited.${CRLF}`);
  }

  private close() {
    if (this.exited) return;
    this.exited = true;
    if (ReplConnection.repls.get(this.key) === this) {
      ReplConnection.repls.delete(this.key);
    }
    if (ReplConnection.active === this) ReplConnection.active = undefined;
    this.driver.dispose();
    this.onDidWrite.dispose();
  }

  // ---- static routing (unchanged singleton model) ----

  private static readonly repls = new Map<string, ReplConnection>();

  // The REPL the user is actively working in, tracked from terminal focus.
  // Used to route "orphan" files (those not owned by any folder REPL) to the
  // REPL the user is looking at instead of spawning a new one.
  private static active?: ReplConnection;
  private static focusListener?: vscode.Disposable;

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

  private static async create(
    workspace?: vscode.WorkspaceFolder,
    baseUri?: vscode.Uri,
  ) {
    this.trackActiveTerminal();
    let venv: ResolvedEnvironment | undefined;
    try {
      const pythonApi = await PythonExtension.api();
      const envp = pythonApi.environments.getActiveEnvironmentPath(workspace);
      venv = await pythonApi.environments.resolveEnvironment(envp);
    } catch (error) {
      notify(errorMessage(error), MessageKind.DEBUG, { logger });
    }
    const repl = new ReplConnection(workspace, venv, baseUri);
    this.repls.set(repl.key, repl);
    return repl;
  }

  static async getOrCreateInstance(resource?: vscode.Uri) {
    if (resource) {
      // Executions always target the active REPL (the one the user last
      // started or focused) when it is live.
      if (this.active && !this.active.exited) {
        return this.active;
      }
      // No active REPL: fall back to the most-specific folder REPL that owns
      // the file, if any.
      const match = selectRepl(
        resource.fsPath,
        [...this.repls.values()].map((repl) => ({
          baseFsPath: repl.baseUri?.fsPath,
          exited: repl.exited,
          repl,
        })),
      );
      if (match) {
        return match.repl;
      }
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
