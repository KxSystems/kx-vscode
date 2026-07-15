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

import kill from "kill-sync";
import {
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
  spawn,
} from "node:child_process";
import { EventEmitter } from "node:events";
import * as vscode from "vscode";

import { QFrame, parseBacktrace } from "../utils/qBacktrace";

export type { QFrame } from "../utils/qBacktrace";

/** Result of running a single command at the (possibly nested) q prompt. */
export interface QCommandResult {
  /** Output emitted between the command and the next prompt (prompt stripped). */
  output: string;
  /** Number of trailing `)` in the resulting prompt. 1 == `q)` (top level), >=2 == suspended in debugger. */
  depth: number;
  /** True when the command produced a q error (output begins with a `'` signal). */
  errored: boolean;
}

/**
 * Matches the q prompt at the very end of accumulated output. q prints `q)` at top
 * level and adds one `)` per nested debugger suspension (`q))`, `q)))`, ...). The
 * prompt is emitted with no trailing newline while q waits for input; the driver
 * consumes each prompt as it arrives, so the next prompt starts a fresh buffer.
 */
const PROMPT_RE = /(?:^|\n)(q(\)+))[ \t]*$/;

/** ANSI CSI/OSC escape sequences to strip before parsing q's text output. */
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][0-9A-Za-z]/g;

const DEFAULT_COMMAND_TIMEOUT = 15000;
const START_TIMEOUT = 30000;

const CRLF = "\r\n";

/**
 * Drives q's native interactive debugger over a plain piped child process — the
 * same transport the REPL uses (see src/classes/replConnection.ts), no native
 * module and no terminal shell integration required. The trick is `KX_TTY=1`,
 * which makes q behave as if attached to a tty (so its interactive debugger and
 * the `q))` suspend prompt engage) even though stdio is piped; `KX_LINE=0`
 * disables q's own readline echo so the stream stays clean and line-based.
 *
 * The child's output is mirrored into a VS Code `Pseudoterminal` so the user
 * watches the live session, while the driver reads the same stream to track the
 * prompt depth (whether q is suspended) and parse backtraces. Commands the
 * debugger issues are written straight to the child's stdin.
 */
export class QDebugDriver extends EventEmitter {
  private readonly win32 = process.platform === "win32";
  private proc?: ChildProcessWithoutNullStreams;
  private terminal?: vscode.Terminal;
  private readonly onDidWrite = new vscode.EventEmitter<string>();
  private readonly decoder = new TextDecoder("utf8");

  private buffer = "";
  private depth = 1;
  private exited = false;
  private lastStop: "breakpoint" | "exception" | undefined;
  /** Display output buffered until the pseudoterminal's `open()` fires. */
  private pending?: string[] = [];
  private readonly disposables: vscode.Disposable[] = [];

  private readonly queue: {
    resolve: (r: QCommandResult) => void;
    reject: (e: Error) => void;
    match: (buf: string) => RegExpMatchArray | null;
    timer: NodeJS.Timeout;
  }[] = [];

  /**
   * Launch q interactively over a piped child process.
   * @param qBinPath absolute path to the q executable
   * @param env process environment (typically from getEnvironment); KX_TTY=1 and KX_LINE=0 are forced on
   * @param cwd working directory for the q process
   * @param startupScript q script loaded at startup (the debug helper), before the user program
   */
  async start(
    qBinPath: string,
    env: { [key: string]: string },
    cwd?: string,
    startupScript?: string,
  ): Promise<void> {
    // KX_TTY=1 engages q's interactive debugger over pipes; KX_LINE=0 turns off
    // q's readline echo so the stream is clean, line-based output.
    const childEnv = { ...env, KX_TTY: "1", KX_LINE: "0" };
    const command = startupScript
      ? `${quote(qBinPath)} ${quote(startupScript)}`
      : quote(qBinPath);

    const proc = this.createProcess(command, {
      env: childEnv,
      cwd,
      windowsHide: true,
      shell: this.win32 ? "cmd.exe" : "bash",
    });
    this.proc = proc;

    const onExit = () => this.handleClosed();
    proc.on("error", (e) => this.handleSpawnError(e));
    proc.on("exit", onExit);
    proc.stdout.on("data", (d) => this.onData(this.decoder.decode(d)));
    proc.stderr.on("data", (d) => this.onData(this.decoder.decode(d)));

    // Mirror the session into a visible pseudoterminal, exactly like the REPL:
    // VS Code owns the terminal UI, the extension is its backend, and the q
    // child stays on plain pipes that the driver controls.
    this.terminal = vscode.window.createTerminal({
      name: "q Debug",
      pty: {
        onDidWrite: this.onDidWrite.event,
        open: () => this.flushPending(),
        close: () => this.dispose(),
        handleInput: (data: string) => this.proc?.stdin.write(data),
      },
      isTransient: true,
    });
    this.terminal.show(true);
    this.disposables.push(
      vscode.window.onDidCloseTerminal((t) => {
        if (t === this.terminal) this.handleClosed();
      }),
    );

    // Wait for q's initial `q)` prompt before accepting commands.
    await this.waitForPrompt(START_TIMEOUT);
  }

  /** Bring the q terminal to the foreground so the user sees the live session. */
  reveal(): void {
    this.terminal?.show(true);
  }

  /** True when q is currently suspended in the debugger (prompt depth >= 2). */
  get suspended(): boolean {
    return this.depth >= 2;
  }

  /** Current prompt depth (1 == top level). */
  get promptDepth(): number {
    return this.depth;
  }

  /** Why the debugger is currently suspended (undefined when running). */
  get stopReason(): "breakpoint" | "exception" | undefined {
    return this.suspended ? this.lastStop : undefined;
  }

  /**
   * Send a command and resolve once q returns to a prompt. q (KX_LINE=0) does not
   * echo input, so the returned output is exactly what q printed in response.
   */
  async run(
    command: string,
    timeout = DEFAULT_COMMAND_TIMEOUT,
  ): Promise<QCommandResult> {
    if (!this.proc || this.exited) {
      throw new Error("q process is not running");
    }
    const result = this.enqueue((buf) => buf.match(PROMPT_RE), timeout);
    this.proc.stdin.write(command + "\n");
    return result;
  }

  /**
   * Evaluate an expression in the current (possibly suspended) frame. Errors nest a
   * further debugger level; we pop back to the original depth with `\` so the frame
   * context is preserved for subsequent operations.
   */
  async evaluate(expr: string): Promise<QCommandResult> {
    const before = this.depth;
    const reason = this.lastStop;
    const result = await this.run(expr);
    if (result.depth > before) {
      await this.popTo(before);
      result.depth = this.depth;
      // A transient error from the evaluated expression (e.g. referencing a
      // not-yet-assigned local) is not why execution is suspended; restore it.
      this.lastStop = reason;
    }
    return result;
  }

  /** Single-step one bytecode instruction (native debugger `>` command). */
  async step(): Promise<QCommandResult> {
    return this.run(">");
  }

  /** Move the debugger's current frame up (towards the outer/entry call). */
  async up(): Promise<void> {
    await this.run("`");
  }

  /** Move the debugger's current frame down (towards the innermost call). */
  async down(): Promise<void> {
    await this.run(".");
  }

  /** Fetch and parse the current backtrace via `.Q.bt[]`. */
  async frames(): Promise<QFrame[]> {
    const result = await this.run(".Q.bt[]");
    return parseBacktrace(result.output);
  }

  /**
   * Resume from a breakpoint. `:` continues execution; the breakpoint auto-re-arms,
   * so this returns once q either hits the next breakpoint or runs to completion.
   */
  async continueFromBreakpoint(): Promise<QCommandResult> {
    return this.run(":");
  }

  /**
   * Abort out of every debugger level back to the top-level `q)` prompt, letting the
   * suspended computation unwind. Used for DAP "continue" when stopped on an error.
   */
  async abortToTop(): Promise<void> {
    let guard = 0;
    while (this.depth > 1 && !this.exited && guard++ < 64) {
      await this.run("\\");
    }
  }

  /** Load a q script into the running process. */
  async load(fsPath: string): Promise<QCommandResult> {
    return this.run(`\\l ${fsPath}`);
  }

  /** Terminate the q process and its terminal. */
  dispose(): void {
    if (this.exited) return;
    this.exited = true;
    this.failPending(new Error("q process exited"));
    for (const d of this.disposables.splice(0)) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    const pid = this.proc?.pid;
    if (pid) {
      try {
        kill(pid, "SIGKILL", true);
      } catch {
        /* already gone */
      }
    }
    this.proc = undefined;
    try {
      this.terminal?.dispose();
    } catch {
      /* already gone */
    }
    this.terminal = undefined;
  }

  // ---- internals ----

  /** Spawn the piped q child (isolated so tests can stub the process). */
  private createProcess(
    command: string,
    options: SpawnOptionsWithoutStdio,
  ): ChildProcessWithoutNullStreams {
    return spawn(command, options);
  }

  private handleSpawnError(error: Error): void {
    this.writeDisplay(`Failed to start q: ${error.message}${CRLF}`);
    this.handleClosed();
  }

  private handleClosed(): void {
    if (this.exited) return;
    this.exited = true;
    this.failPending(new Error("q process exited"));
    this.emit("exited", 0);
  }

  private async popTo(target: number): Promise<void> {
    let guard = 0;
    while (this.depth > target && !this.exited && guard++ < 64) {
      await this.run("\\");
    }
  }

  private waitForPrompt(
    timeout = DEFAULT_COMMAND_TIMEOUT,
  ): Promise<QCommandResult> {
    return this.enqueue((buf) => buf.match(PROMPT_RE), timeout);
  }

  private enqueue(
    match: (buf: string) => RegExpMatchArray | null,
    timeout: number,
  ): Promise<QCommandResult> {
    return new Promise<QCommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((q) => q.timer === timer);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new Error("Timed out waiting for q prompt"));
      }, timeout);
      this.queue.push({ resolve, reject, match, timer });
      // A prompt may already be buffered (e.g. queued right after start).
      this.drain();
    });
  }

  private onData(data: string): void {
    // Show the raw q output to the user (as CRLF for the terminal), and feed a
    // cleaned copy (no ANSI, no CR) to the prompt/backtrace parser.
    this.writeDisplay(data.replace(/\r?\n/g, CRLF));
    this.buffer += data.replace(ANSI_RE, "").replace(/\r/g, "");
    this.drain();
  }

  private writeDisplay(text: string): void {
    if (this.pending) this.pending.push(text);
    else this.onDidWrite.fire(text);
  }

  private flushPending(): void {
    const pending = this.pending;
    this.pending = undefined;
    pending?.forEach((t) => this.onDidWrite.fire(t));
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const head = this.queue[0];
      const m = head.match(this.buffer);
      if (!m || m.index === undefined) return;

      const prompt = m[1];
      const consumedEnd = m.index + m[0].length;
      const raw = this.buffer.slice(0, m.index);
      this.buffer = this.buffer.slice(consumedEnd);

      this.depth = countTrailing(prompt, ")");

      const output = raw.replace(/^\n+/, "").replace(/\n+$/, "");
      // Record why execution is suspended from the markers q prints: `#<index>`
      // for a breakpoint hit, a leading `'` signal for an error. Update on every
      // suspended result (an error can arrive without deepening the prompt, e.g.
      // when continuing from a breakpoint straight into a signal).
      if (this.depth >= 2) {
        const body = output.trimStart();
        if (body.startsWith("#")) this.lastStop = "breakpoint";
        else if (body.startsWith("'")) this.lastStop = "exception";
      }

      this.queue.shift();
      clearTimeout(head.timer);
      head.resolve({
        output,
        depth: this.depth,
        errored: isError(output),
      });
    }
  }

  private failPending(err: Error): void {
    while (this.queue.length > 0) {
      const head = this.queue.shift()!;
      clearTimeout(head.timer);
      head.reject(err);
    }
  }
}

function countTrailing(s: string, ch: string): number {
  let n = 0;
  for (let i = s.length - 1; i >= 0 && s[i] === ch; i--) n++;
  return n;
}

function isError(output: string): boolean {
  return output.trimStart().startsWith("'");
}

/** Quote a path for the shell if it contains spaces. */
function quote(p: string): string {
  return /\s/.test(p) ? `"${p}"` : p;
}
