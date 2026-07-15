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
import { realpathSync } from "node:fs";
import { relative } from "node:path";

import {
  QFrame,
  QPosition,
  parseBacktrace,
  parseCurrentPosition,
} from "../utils/qBacktrace";

export type { QFrame, QPosition } from "../utils/qBacktrace";

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
 * Matches the q prompt at the very end of accumulated output. Under `KX_TTY=1` q
 * prints its own prompt: `q)` at top level, `q.ns)` inside a namespace, and one
 * extra `)` per nested debugger suspension (`q))`, `q.ns))`, ...). The prompt is
 * emitted with no trailing newline while q waits for input; the driver consumes
 * each prompt as it arrives, so the next prompt starts a fresh buffer.
 *   group 1 = whole prompt, group 2 = namespace (".foo" or ""), group 3 = the `)`s
 */
const PROMPT_RE = /(?:^|\n)(q([.\w]*)(\)+))[ \t]*$/;

/** ANSI CSI/OSC escape sequences to strip before parsing q's text output. */
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][0-9A-Za-z]/g;

const DEFAULT_COMMAND_TIMEOUT = 15000;
const START_TIMEOUT = 30000;

/**
 * Drives q over a plain piped child process — the transport shared by the REPL
 * ({@link ../classes/replConnection}) and the debugger. No native module and no
 * terminal shell integration: `KX_TTY=1` makes q behave as if attached to a tty
 * (so it prints prompts and its interactive debugger's `q))` suspend engages)
 * even though stdio is piped, and `KX_LINE=0` disables q's readline echo so the
 * stream stays clean and line-based.
 *
 * This class owns only the q process and the prompt state machine. It does NOT
 * own a terminal: q's raw output is emitted as a `data` event for a consumer
 * (the REPL's pseudoterminal) to display, and commands the caller issues are
 * written straight to the child's stdin. Tracking the prompt reveals the current
 * namespace and whether q is suspended (depth >= 2).
 *
 * Events: `data` (string chunk of q output), `exited` (code), `reveal` (a
 * request to surface the owning terminal).
 */
export class QDebugDriver extends EventEmitter {
  private readonly win32 = process.platform === "win32";
  private proc?: ChildProcessWithoutNullStreams;
  private readonly decoder = new TextDecoder("utf8");

  private buffer = "";
  private depth = 1;
  private ns = "";
  private exited = false;
  private lastStop: "breakpoint" | "exception" | undefined;

  private readonly queue: {
    resolve: (r: QCommandResult) => void;
    reject: (e: Error) => void;
    match: (buf: string) => RegExpMatchArray | null;
    timer: NodeJS.Timeout;
    /** Whether this command's q output is mirrored to the display consumer. */
    echo: boolean;
  }[] = [];

  /**
   * Launch q interactively over a piped child process.
   * @param qBinPath absolute path to the q executable
   * @param env process environment (typically from getEnvironment); KX_TTY=1 and KX_LINE=0 are forced on
   * @param cwd working directory for the q process
   * @param startupScript q script loaded at startup (the debug helper), before any user input
   * @param commandPrefix shell text run before q (e.g. a venv `source …/activate && `)
   */
  async start(
    qBinPath: string,
    env: { [key: string]: string },
    cwd?: string,
    startupScript?: string,
    commandPrefix = "",
  ): Promise<void> {
    // KX_TTY=1 engages q's tty mode (prompts + interactive debugger) over pipes;
    // KX_LINE=0 turns off q's readline echo so the stream is clean line output.
    const childEnv = { ...env, KX_TTY: "1", KX_LINE: "0" };
    const command =
      commandPrefix +
      (startupScript
        ? `${quote(qBinPath)} ${quote(startupScript)}`
        : quote(qBinPath));

    const proc = this.createProcess(command, {
      env: childEnv,
      cwd,
      windowsHide: true,
      shell: this.win32 ? "cmd.exe" : "bash",
    });
    this.proc = proc;

    proc.on("error", (e) => this.handleSpawnError(e));
    proc.on("exit", () => this.handleClosed());
    proc.stdout.on("data", (d) => this.onData(this.decoder.decode(d)));
    proc.stderr.on("data", (d) => this.onData(this.decoder.decode(d)));

    // Wait for q's initial `q)` prompt before accepting commands.
    await this.waitForPrompt(START_TIMEOUT);
  }

  /** Ask the owning terminal (if any) to surface itself. */
  reveal(): void {
    this.emit("reveal");
  }

  /** True while the q process is running. */
  get alive(): boolean {
    return !!this.proc && !this.exited;
  }

  /** True when q is currently suspended in the debugger (prompt depth >= 2). */
  get suspended(): boolean {
    return this.depth >= 2;
  }

  /** Current prompt depth (1 == top level). */
  get promptDepth(): number {
    return this.depth;
  }

  /** Current namespace as shown in the prompt (".foo", or "" at root). */
  get namespace(): string {
    return this.ns;
  }

  /** Why the debugger is currently suspended (undefined when running). */
  get stopReason(): "breakpoint" | "exception" | undefined {
    return this.suspended ? this.lastStop : undefined;
  }

  /**
   * Send a command and resolve once q returns to a prompt. q (KX_LINE=0) does not
   * echo input, so the returned output is exactly what q printed in response.
   *
   * `echo` controls whether q's output for this command is mirrored to the display
   * consumer (the REPL terminal). The debugger's own control traffic — backtraces,
   * single-steps, frame navigation, breakpoint (un)arming, locals probes — is run
   * with `echo=false` so it does not flood the shared terminal; only the user
   * program's own output (loads, continues) is left visible.
   */
  async run(
    command: string,
    echo = true,
    timeout = DEFAULT_COMMAND_TIMEOUT,
  ): Promise<QCommandResult> {
    if (!this.proc || this.exited) {
      throw new Error("q process is not running");
    }
    const result = this.enqueue((buf) => buf.match(PROMPT_RE), timeout, echo);
    this.proc.stdin.write(command + "\n");
    return result;
  }

  /**
   * Evaluate an expression in the current (possibly suspended) frame. If the
   * expression errors and nests a further debugger level, pop back to the original
   * depth with `\` so the frame context is preserved for subsequent operations.
   *
   * A side-query (locals, watch, hover) NEVER changes why execution is suspended,
   * so the stop reason is always restored afterwards — including when the error did
   * not deepen the prompt. Otherwise a transient `'` signal (e.g. a not-yet-assigned
   * local, or a malformed locals probe) would leave `lastStop` stuck at "exception"
   * and the next stop would be mislabelled as an exception.
   */
  async evaluate(expr: string): Promise<QCommandResult> {
    const before = this.depth;
    const reason = this.lastStop;
    const result = await this.run(expr, false);
    if (result.depth > before) {
      await this.popTo(before);
      result.depth = this.depth;
    }
    this.lastStop = reason;
    return result;
  }

  /**
   * Single-step one bytecode instruction (native debugger `>` command) and return
   * the resulting execution position in one round-trip. q's `>` echoes the current
   * frame (file:line + `^` caret) exactly as `.Q.bt[]` would, so a separate
   * backtrace call is unnecessary. Returns undefined when the step left the
   * debugger (the function returned) or no position could be parsed; callers check
   * {@link suspended}/{@link stopReason} for why.
   *
   * The `>` command runs with echo off (it is debugger control traffic), but the
   * stepped instruction may itself print (`show`, `0N!`, handle writes) — or, when
   * the step lets the function finish, the pending statement's result may print.
   * That output belongs to the user, so everything before the frame echo (all of
   * the output, if no frame follows) is re-emitted to the display consumer; only
   * the frame dump stays suppressed.
   */
  async stepPosition(): Promise<QPosition | undefined> {
    const result = await this.run(">", false);
    const preamble = programOutput(result.output);
    if (preamble.trim().length > 0) this.emit("data", preamble + "\n");
    return this.suspended ? parseCurrentPosition(result.output) : undefined;
  }

  /** Move the debugger's current frame up (towards the outer/entry call). */
  async up(): Promise<void> {
    await this.run("`", false);
  }

  /** Move the debugger's current frame down (towards the innermost call). */
  async down(): Promise<void> {
    await this.run(".", false);
  }

  /** Fetch and parse the current backtrace via `.Q.bt[]`. */
  async frames(): Promise<QFrame[]> {
    const result = await this.run(".Q.bt[]", false);
    return parseBacktrace(result.output);
  }

  /** Current execution position (file/line/caret column) of the suspended frame. */
  async position(): Promise<QPosition | undefined> {
    const result = await this.run(".Q.bt[]", false);
    return parseCurrentPosition(result.output);
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
      await this.run("\\", false);
    }
  }

  /** Reset debugger state for reuse by a new session: unwind any suspension. */
  async reset(): Promise<void> {
    if (this.alive) await this.abortToTop();
    this.lastStop = undefined;
  }

  /**
   * Load a q script into the running process. q's `\l` cannot parse a path
   * containing spaces (it signals `'nyi`, with or without quoting), so a
   * space-free argument is derived: the absolute path when it already has no
   * spaces, otherwise the path relative to q's current directory — which drops
   * the common prefix that usually carries the spaces (e.g. a Windows profile
   * dir like `C:\Users\John Doe` shared by the workspace and `%TEMP%`).
   * Backslashes become forward slashes on Windows (q's own path convention).
   */
  async load(fsPath: string): Promise<QCommandResult> {
    let arg = this.win32 ? fsPath.replace(/\\/g, "/") : fsPath;
    if (/\s/.test(arg)) {
      const cwd = await this.currentDir();
      // Resolve symlinks on both sides before relativizing (e.g. macOS /tmp ->
      // /private/tmp): q reports its cwd canonicalized, and a mismatched prefix
      // would defeat the common-prefix drop the relative path relies on.
      const rel = cwd ? relative(realPath(cwd), realPath(fsPath)) : "";
      const relArg = this.win32 ? rel.replace(/\\/g, "/") : rel;
      if (relArg.length > 0 && !/\s/.test(relArg)) {
        arg = relArg;
      } else {
        throw new Error(
          `cannot load "${fsPath}": q's \\l does not support paths containing spaces`,
        );
      }
    }
    return this.run(`\\l ${arg}`);
  }

  /** q's current working directory (`system "cd"`), or undefined if unreadable. */
  private async currentDir(): Promise<string | undefined> {
    const res = await this.run('system "cd"', false);
    const dir = unquoteOutput(res.output);
    return res.errored || dir.length === 0 ? undefined : dir;
  }

  /** Interrupt a running computation (SIGINT), e.g. from a REPL Ctrl+C. */
  interrupt(): void {
    const pid = this.proc?.pid;
    if (pid) {
      try {
        kill(pid, "SIGINT", true);
      } catch {
        /* nothing to interrupt */
      }
    }
  }

  /** Terminate the q process. */
  dispose(): void {
    if (this.exited) return;
    this.exited = true;
    this.failPending(new Error("q process exited"));
    const pid = this.proc?.pid;
    if (pid) {
      try {
        kill(pid, "SIGKILL", true);
      } catch {
        /* already gone */
      }
    }
    this.proc = undefined;
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
    this.emit("data", `Failed to start q: ${error.message}\n`);
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
      await this.run("\\", false);
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
    echo = true,
  ): Promise<QCommandResult> {
    return new Promise<QCommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((q) => q.timer === timer);
        if (idx !== -1) this.queue.splice(idx, 1);
        reject(new Error("Timed out waiting for q prompt"));
      }, timeout);
      this.queue.push({ resolve, reject, match, timer, echo });
      // A prompt may already be buffered (e.g. queued right after start).
      this.drain();
    });
  }

  private onData(data: string): void {
    // Mirror the raw output to the display consumer (the REPL terminal) unless the
    // in-flight command opted out (debugger control traffic). Commands are awaited
    // one at a time, so output arriving now belongs to the head of the queue; with
    // no command in flight (spontaneous output) it is shown. A cleaned copy (no
    // ANSI, no CR) always feeds the prompt/backtrace parser.
    if (this.queue[0]?.echo ?? true) this.emit("data", data);
    this.buffer += data.replace(ANSI_RE, "").replace(/\r/g, "");
    this.drain();
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const head = this.queue[0];
      const m = head.match(this.buffer);
      if (!m || m.index === undefined) return;

      const consumedEnd = m.index + m[0].length;
      const raw = this.buffer.slice(0, m.index);
      this.buffer = this.buffer.slice(consumedEnd);

      this.ns = m[2] ?? "";
      this.depth = (m[3] ?? ")").length;

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

function isError(output: string): boolean {
  return output.trimStart().startsWith("'");
}

/** Matches a backtrace frame line (`>>[n]  ...` or `  [n]  ...`). */
const FRAME_LINE_RE = /^(?:>>|\s\s)\[\d+\]\s/;

/**
 * The program's own output within a step echo: everything before the first
 * backtrace frame line (or all of it, when the step left the debugger and no
 * frame was echoed).
 */
function programOutput(output: string): string {
  const lines = output.split("\n");
  const idx = lines.findIndex((line) => FRAME_LINE_RE.test(line));
  return (idx === -1 ? lines : lines.slice(0, idx)).join("\n");
}

/** Canonical path with symlinks resolved; the path itself if that fails. */
function realPath(p: string): string {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

/** Strip the surrounding quotes q's display puts around a returned string. */
function unquoteOutput(output: string): string {
  const t = output.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"')
    ? t.slice(1, -1)
    : t;
}

/**
 * Quote a path for the shell the q child is spawned through. cmd.exe: double
 * quotes (a `"` is illegal in Windows paths, so no escaping is needed). POSIX
 * (bash): single quotes with embedded ones escaped, so spaces, `$`, backticks
 * and `\` in the path are never shell-interpreted.
 */
function quote(p: string): string {
  return process.platform === "win32"
    ? `"${p}"`
    : `'${p.replace(/'/g, "'\\''")}'`;
}
