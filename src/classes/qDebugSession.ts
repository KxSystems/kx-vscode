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
  InitializedEvent,
  LoggingDebugSession,
  OutputEvent,
  Scope,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread,
  Variable,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import * as vscode from "vscode";

import { QCommandResult, QDebugDriver, QFrame } from "./qDebugDriver";
import { ReplConnection } from "./replConnection";
import {
  QSeparator,
  functionAt,
  lambdaStatementSeparators,
} from "../utils/qLocals";
import { splitTopLevelStatements, QStatement } from "../utils/qStatements";

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  qBinPath?: string;
  stopOnEntry?: boolean;
}

const THREAD_ID = 1;
// Variables references encode the frame index they belong to (offset avoids 0).
const VAR_REF_BASE = 1000;
// Distinct reference for the Globals scope (frame refs are >= VAR_REF_BASE).
const GLOBALS_REF = 999;

export class QDebugSession extends LoggingDebugSession {
  // Only one debug session may drive a (possibly shared) q process at a time.
  // A new launch takes over, cancelling any previous session so its statement
  // loop stops touching the driver.
  private static current?: QDebugSession;

  /** The shared q session borrowed from the program's REPL (assigned on launch). */
  private driver!: QDebugDriver;
  private repl?: ReplConnection;
  private onExited?: () => void;
  private cancelled = false;
  private program = "";
  private configDone = false;
  private started = false;
  private launched = false;
  private launchArgs?: LaunchRequestArguments;

  /** Absolute path of the program being debugged. */
  private programPath = "";
  /** Top-level statements of the program, executed one at a time. */
  private statements: QStatement[] = [];
  /** Index of the next statement to execute. */
  private stmtIndex = 0;
  /** Highest source line loaded so far (functions defined up to here are armable). */
  private loadedThroughLine = 0;
  /** Requested breakpoint lines, keyed by absolute source path. */
  private readonly requestedBreakpoints = new Map<string, number[]>();
  /**
   * Native breakpoints currently set on the shared q process, keyed by
   * `name\0index`. Tracked so they can be removed (`.Q.bd`) when the session
   * ends — leaving `0xff` traps in the REPL's functions would corrupt them.
   */
  private readonly armedTraps = new Map<string, { name: string; index: number }>();
  /** Temp dir holding per-statement load files; their frames map back to programPath. */
  private tempDir?: string;
  private tempSeq = 0;

  /** Frames of the current suspension, outermost-last as reported by q. */
  private currentFrames: QFrame[] = [];
  /** The frame index q's debugger currently points at (its `>>` frame). */
  private qCurrentIndex = 0;
  /** Cache of source file contents, keyed by absolute path. */
  private readonly sourceCache = new Map<string, string>();

  constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(false);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
  ): void {
    response.body = {
      supportsConfigurationDoneRequest: true,
      supportsEvaluateForHovers: true,
      supportsTerminateRequest: true,
      supportsSingleThreadExecutionRequests: false,
    };
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): Promise<void> {
    this.launchArgs = args;
    this.program = args.program;

    // Take over from any previous session so it stops driving the shared process.
    const previous = QDebugSession.current;
    QDebugSession.current = this;
    if (previous && previous !== this) previous.cancelled = true;

    try {
      // Debug the same live q process as the program's REPL: borrow its shared
      // session (already running with KX_TTY=1 and the .dbg.* helpers loaded).
      this.repl = await ReplConnection.getOrCreateInstance(
        vscode.Uri.file(this.program),
      );
      this.driver = await this.repl.session();
      if (!this.driver.alive) {
        throw new Error("the q session is not running");
      }
      // Start from a clean debugger state on the shared process.
      await this.driver.reset();
    } catch (err) {
      this.sendErrorResponse(response, {
        id: 1001,
        format: `Failed to start q debugger: ${errText(err)}`,
      });
      return;
    }

    this.onExited = () => this.sendEvent(new TerminatedEvent());
    this.driver.on("exited", this.onExited);

    this.started = true;
    this.sendResponse(response);
    await this.tryRun();
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): void {
    this.sendResponse(response);
    this.configDone = true;
    void this.tryRun();
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    const file = args.source.path ?? "";
    const lines = (args.breakpoints ?? []).map((b) => b.line);
    this.requestedBreakpoints.set(file, lines);
    // The native q debugger suspends only inside functions, so a breakpoint is
    // supported only when its line falls within a lambda body; top-level
    // (global-scope) lines are reported unverified. In-function breakpoints are
    // armed as their enclosing function is defined during the statement load.
    const text = this.readSource(file);
    response.body = {
      breakpoints: lines.map((line) =>
        text !== undefined && functionAt(text, line) !== undefined
          ? { verified: true, line }
          : {
              verified: false,
              line,
              message: "Only breakpoints inside functions are supported.",
            },
      ),
    };
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(THREAD_ID, "q main thread")] };
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
  ): void {
    const stackFrames = this.currentFrames.map((f) => {
      const file = this.mapToProgram(f.file);
      const src =
        file !== undefined ? new Source(basename(file), file) : undefined;
      const frame = new StackFrame(f.index, frameName(f), src, f.line ?? 0);
      frame.presentationHint = src ? "normal" : "subtle";
      return frame;
    });
    response.body = {
      stackFrames,
      totalFrames: stackFrames.length,
    };
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): void {
    // frameId is the q frame index; encode it into the variables reference.
    // Globals are the same in every frame, so one shared reference.
    response.body = {
      scopes: [
        new Scope("Locals", VAR_REF_BASE + args.frameId, false),
        new Scope("Globals", GLOBALS_REF, true),
      ],
    };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): Promise<void> {
    let variables: DebugProtocol.Variable[] = [];

    if (args.variablesReference === GLOBALS_REF) {
      variables = await this.readGlobals();
    } else {
      const frameIndex = args.variablesReference - VAR_REF_BASE;
      const frame = this.currentFrames.find((f) => f.index === frameIndex);
      if (frame) {
        const names = await this.localNamesForFrame(frame);
        if (names.length > 0) {
          await this.navigateTo(frameIndex);
          variables = await this.readLocals(names);
        }
      }
    }

    response.body = { variables };
    this.sendResponse(response);
  }

  protected async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): Promise<void> {
    if (!this.driver.suspended) {
      this.sendErrorResponse(response, {
        id: 1002,
        format: "Not paused: cannot evaluate.",
      });
      return;
    }
    if (args.frameId !== undefined) {
      await this.navigateTo(args.frameId);
    }
    const res = await this.driver.evaluate(args.expression);
    response.body = {
      result: res.output.trim(),
      variablesReference: 0,
    };
    this.sendResponse(response);
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
  ): Promise<void> {
    response.body = { allThreadsContinued: true };
    this.sendResponse(response);
    await this.resume();
  }

  protected async nextRequest(
    response: DebugProtocol.NextResponse,
  ): Promise<void> {
    this.sendResponse(response);
    await this.step();
  }

  protected async stepInRequest(
    response: DebugProtocol.StepInResponse,
  ): Promise<void> {
    // Step in/over/out are all mapped to next-source-line for now.
    this.sendResponse(response);
    await this.step();
  }

  protected async stepOutRequest(
    response: DebugProtocol.StepOutResponse,
  ): Promise<void> {
    this.sendResponse(response);
    await this.step();
  }

  /** Step over/into/out are all mapped to next-statement in the native debugger. */
  private async step(): Promise<void> {
    await this.stepStatement();
  }

  protected async terminateRequest(
    response: DebugProtocol.TerminateResponse,
  ): Promise<void> {
    await this.release();
    this.sendResponse(response);
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): Promise<void> {
    await this.release();
    this.sendResponse(response);
  }

  /**
   * End the debug session without killing the shared q process: detach the
   * exit listener and return q to a clean top-level prompt so the REPL (and the
   * next debug session) can keep using the same instance.
   */
  private async release(): Promise<void> {
    this.cancelled = true;
    if (QDebugSession.current === this) QDebugSession.current = undefined;
    if (this.onExited && this.driver) {
      this.driver.off("exited", this.onExited);
      this.onExited = undefined;
    }
    if (this.driver?.alive) {
      try {
        await this.driver.reset();
      } catch {
        /* best effort */
      }
      // Remove every native trap this session set, so the shared process the
      // REPL keeps using is left with clean (un-patched) function bytecode.
      for (const { name, index } of this.armedTraps.values()) {
        try {
          await this.driver.evaluate(`.Q.bd[${name};${index}]`);
        } catch {
          /* best effort */
        }
      }
    }
    this.armedTraps.clear();
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
      this.tempDir = undefined;
    }
  }

  // ---- internals ----

  /** Begin execution once both launch and configuration are done. */
  private async tryRun(): Promise<void> {
    if (
      this.launched ||
      !this.started ||
      !this.configDone ||
      this.launchArgs === undefined
    ) {
      return;
    }
    this.launched = true;

    const program = this.program;
    const text = this.readSource(program);
    if (text === undefined) {
      this.sendEvent(
        new OutputEvent(`Cannot read program: ${program}\n`, "stderr"),
      );
      this.sendEvent(new TerminatedEvent());
      return;
    }
    this.programPath = program;
    this.tempDir = mkdtempSync(join(tmpdir(), "kx-debug-"));
    this.statements = splitTopLevelStatements(text);
    this.stmtIndex = 0;
    await this.runStatements();
  }

  /**
   * Execute program statements in order, arming breakpoints as functions become
   * defined. Pauses (returns) when a statement suspends the debugger, so the DAP
   * "continue"/"next" handlers can resume the loop later.
   */
  private async runStatements(): Promise<void> {
    try {
      while (this.stmtIndex < this.statements.length) {
        // A newer debug session has taken over the shared process; stop here.
        if (this.cancelled) return;
        const stmt = this.statements[this.stmtIndex];
        this.stmtIndex++;

        // Arm breakpoints for functions defined by previously-loaded statements,
        // so a call in this statement stops correctly.
        await this.armBreakpoints(this.loadedThroughLine);

        await this.loadStatement(stmt);
        this.loadedThroughLine = Math.max(this.loadedThroughLine, stmt.endLine);
        // q's output is shown live in the debug terminal, so it is not echoed
        // to the Debug Console.

        if (this.driver.suspended) {
          if (await this.handleSuspension()) return;
        }
      }
      this.sendEvent(new TerminatedEvent());
    } catch (err) {
      this.sendEvent(
        new OutputEvent(`Debugger error: ${errText(err)}\n`, "stderr"),
      );
      this.sendEvent(new TerminatedEvent());
    }
  }

  /**
   * Load one statement from a line-padded temp file (blank lines up to its
   * original start line) so multi-line definitions parse correctly and the
   * debugger reports the original file's line numbers. The temp path is later
   * mapped back to the program path in stack traces.
   */
  private loadStatement(stmt: QStatement): Promise<QCommandResult> {
    const padded = "\n".repeat(stmt.startLine - 1) + stmt.text;
    const file = join(this.tempDir!, `s${this.tempSeq++}.q`);
    writeFileSync(file, padded, "utf-8");
    return this.driver.load(file);
  }

  /** Read user-defined data globals (root namespace) for the Globals scope. */
  private async readGlobals(): Promise<DebugProtocol.Variable[]> {
    const res = await this.driver.evaluate(".dbg.globals[]");
    const parsed = parseJsonDict(res.output);
    if (!parsed) return [];
    return Object.entries(parsed).map(
      ([name, value]) => new Variable(name, formatValue(value)),
    );
  }

  /** Resume after a stop: continue past a breakpoint, or unwind an exception. */
  private async resume(): Promise<void> {
    if (this.driver.stopReason === "breakpoint") {
      // Run freely until the next stop (a later entry trap, an error, or the
      // end of the program). The entry trap re-arms itself across calls, so a
      // breakpoint in a loop body stops once per call, not once per iteration.
      await this.driver.continueFromBreakpoint();
      if (this.driver.suspended && (await this.handleSuspension())) return;
      await this.runStatements();
    } else {
      // Exception: unwind the failed statement, then carry on with the rest.
      await this.driver.abortToTop();
      await this.runStatements();
    }
  }

  /**
   * Step to the next statement. Single-steps the native debugger (`>`, one
   * bytecode) until the current position leaves the starting statement — either
   * a different source line, or a different `;`-separated statement on the SAME
   * line — skipping the function's brace/param line. This gives true per-statement
   * stepping even for one-liners like `a:1;b:2`. Falls through to the loader when
   * the function returns, and reports an exception if one surfaces mid-step.
   */
  private async stepStatement(): Promise<void> {
    if (!this.driver.suspended) {
      await this.runStatements();
      return;
    }
    const start = await this.driver.position();
    const startLine = start?.line;
    const file = this.mapToProgram(start?.file);
    const text = file ? this.readSource(file) : undefined;
    const braceLine =
      text && startLine !== undefined
        ? functionAt(text, startLine)?.startLine
        : undefined;
    // `;` separators of the enclosing lambda, to tell statements on one line apart.
    const separators =
      text && startLine !== undefined
        ? lambdaStatementSeparators(text, startLine)
        : [];
    const startId = statementId(separators, startLine, start?.col);

    // Bound the steps: a single statement spans only a handful of bytecodes, so
    // if the position never leaves it (e.g. sitting on an unconditional `'signal`,
    // or a single-line loop) give up and let the line run rather than spin.
    let guard = 0;
    while (this.driver.suspended && guard++ < 256) {
      await this.driver.step();
      if (!this.driver.suspended) break;
      if (this.driver.stopReason === "exception") {
        await this.reportStopped();
        return;
      }
      const pos = await this.driver.position();
      const line = pos?.line;
      if (line === undefined || line === braceLine) continue;
      const id = statementId(separators, line, pos?.col);
      if (line !== startLine || id !== startId) {
        await this.reportStopped();
        return;
      }
    }
    if (this.driver.suspended) {
      // Could not advance by stepping (e.g. sitting on an unconditional `'signal`).
      // Let the line run so its effect surfaces (typically an error), then report.
      await this.driver.continueFromBreakpoint();
      if (this.driver.suspended) {
        await this.reportStopped();
      } else {
        await this.runStatements();
      }
    } else {
      // The function/program finished while stepping; keep loading statements.
      await this.runStatements();
    }
  }

  /**
   * Handle a fresh suspension. Returns true if execution should stay paused (a
   * DAP stopped event was emitted), false if the loader should keep running.
   */
  private async handleSuspension(): Promise<boolean> {
    if (this.driver.stopReason === "exception") {
      await this.reportStopped();
      return true;
    }
    // Entry trap fired: single-step until q reports a requested breakpoint line.
    const outcome = await this.advanceToBreakpoint();
    if (outcome === "exited") return false;
    await this.reportStopped();
    return true;
  }

  /**
   * After the entry trap fires, single-step (`>`) until q's reported current line
   * is a requested breakpoint line. The reported line comes from `.Q.bt` and is
   * reliable across control constructs, unlike a static bytecode->line map. Returns
   * "breakpoint" when a requested line is reached (or stepping is capped while
   * still suspended), "exception" on an error, or "exited" if the function returns
   * before any requested line (e.g. a branch not taken).
   */
  private async advanceToBreakpoint(): Promise<
    "breakpoint" | "exception" | "exited"
  > {
    let guard = 0;
    while (this.driver.suspended && guard++ < 100000) {
      if (this.driver.stopReason === "exception") return "exception";
      const pos = await this.driver.position();
      if (this.isBreakpointLine(this.mapToProgram(pos?.file), pos?.line)) {
        return "breakpoint";
      }
      await this.driver.step();
    }
    return this.driver.suspended ? "breakpoint" : "exited";
  }

  /** True when `line` in `file` carries a requested breakpoint. */
  private isBreakpointLine(file: string | undefined, line?: number): boolean {
    if (file === undefined || line === undefined) return false;
    return (this.requestedBreakpoints.get(file) ?? []).includes(line);
  }

  /**
   * Map a temp load-file path back to the original program path. Matches on the
   * unique temp-dir name rather than an exact path, since q may canonicalize it
   * (e.g. macOS /var -> /private/var symlink resolution).
   */
  private mapToProgram(file?: string): string | undefined {
    if (file === undefined) return undefined;
    if (this.tempDir && file.includes(basename(this.tempDir))) {
      return this.programPath;
    }
    return file;
  }

  /** Capture frames for the current suspension and emit a DAP stopped event. */
  private async reportStopped(): Promise<void> {
    // Drop the synthetic `\l <temp>` loader frame at the base of the stack.
    this.currentFrames = (await this.driver.frames()).filter(
      (f) => !/^\\l\s/.test(f.text),
    );
    this.qCurrentIndex =
      this.currentFrames.find((f) => f.current)?.index ??
      this.currentFrames[0]?.index ??
      0;
    const reason = this.driver.stopReason === "breakpoint" ? "breakpoint" : "exception";
    // Surface the live q terminal (where the debugger prompt is) on each stop.
    this.driver.reveal();
    this.sendEvent(new StoppedEvent(reason, THREAD_ID));
  }

  /**
   * Arm breakpoints for functions defined up to `throughLine`. A trap is set at
   * the function ENTRY (`.Q.bs[f;0]` - index 0 is always a valid stop). When it
   * fires we single-step to the requested source line (advanceToBreakpoint) using
   * q's own reported line, so placement is correct even inside if/while/do/$
   * constructs (a static bytecode-offset map does not reliably predict the line q
   * reports). The entry trap is recorded in `armedTraps` for removal on session end.
   */
  private async armBreakpoints(throughLine: number): Promise<void> {
    for (const [file, lines] of this.requestedBreakpoints) {
      const text = this.readSource(file);
      if (text === undefined) continue;
      for (const line of lines) {
        const fn = functionAt(text, line);
        if (!fn || fn.startLine > throughLine) continue;
        if (this.armedTraps.has(fn.name)) continue;
        await this.driver.evaluate(`.Q.bs[${fn.name};0]`);
        this.armedTraps.set(fn.name, { name: fn.name, index: 0 });
      }
    }
  }

  /** Move q's current debugger frame to the given index. */
  private async navigateTo(index: number): Promise<void> {
    let guard = 0;
    while (this.qCurrentIndex > index && guard++ < 128) {
      await this.driver.up(); // ` moves towards the outer/entry frame (lower index)
      this.qCurrentIndex--;
    }
    while (this.qCurrentIndex < index && guard++ < 128) {
      await this.driver.down(); // . moves towards the innermost frame (higher index)
      this.qCurrentIndex++;
    }
  }

  /**
   * Local variable names (params + locals) for a frame, obtained from q itself:
   * `.dbg.locals` reads them out of `value f`. Only named frames can be resolved
   * (the name comes from the backtrace); anonymous lambdas yield no locals.
   */
  private async localNamesForFrame(frame: QFrame): Promise<string[]> {
    const name = frameFuncName(frame);
    if (!name) return [];
    const res = await this.driver.evaluate(`.dbg.locals \`${name}`);
    return parseJsonNames(res.output);
  }

  private readSource(file: string): string | undefined {
    const cached = this.sourceCache.get(file);
    if (cached !== undefined) return cached;
    try {
      const text = readFileSync(file, "utf-8");
      this.sourceCache.set(file, text);
      return text;
    } catch {
      return undefined;
    }
  }

  /** Query a set of local names in the current frame and format as DAP variables. */
  private async readLocals(names: string[]): Promise<DebugProtocol.Variable[]> {
    const symList = names.map((n) => "`" + n).join("");
    const valList = names.join(";");
    // A bare expression evaluates in the suspended frame's scope (a lambda would
    // not see the frame locals). `.j.j` renders the dict as JSON we can parse.
    const res = await this.driver.evaluate(`.j.j ${symList}!(${valList})`);
    const parsed = parseJsonDict(res.output);
    if (parsed) {
      return Object.entries(parsed).map(
        ([name, value]) => new Variable(name, formatValue(value)),
      );
    }
    // Fallback: query each name individually, skipping ones that error (unset).
    const vars: DebugProtocol.Variable[] = [];
    for (const name of names) {
      const r = await this.driver.evaluate(name);
      if (!r.errored) {
        vars.push(new Variable(name, r.output.trim()));
      }
    }
    return vars;
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Index of the `;`-separated statement containing a 0-based (line, col) position:
 * the count of lambda separators that precede it. Two positions in the same
 * statement share an id; crossing a `;` increments it. Used to detect when a step
 * has moved to the next statement on the same line.
 */
function statementId(
  separators: QSeparator[],
  line?: number,
  col?: number,
): number {
  if (line === undefined) return -1;
  const c = col ?? 0;
  let id = 0;
  for (const s of separators) {
    // Separator sits at 0-based (s.line, s.column - 1); count those before pos.
    if (s.line < line || (s.line === line && s.column - 1 < c)) id++;
  }
  return id;
}

function frameName(f: QFrame): string {
  // Prefer the assigned function name (e.g. `g` from `g:{...}`), else the text.
  const m = f.text.match(/^([.a-zA-Z][a-zA-Z0-9_.]*)\s*:/);
  return m ? m[1] : f.text.slice(0, 40);
}

/**
 * The frame's function name only when it is a resolvable q identifier (a
 * `name:{...}` definition), suitable for `` `name `` in a q expression. Anonymous
 * lambdas return undefined (no locals can be looked up by name).
 */
function frameFuncName(f: QFrame): string | undefined {
  const m = f.text.match(/^([.a-zA-Z][a-zA-Z0-9_.]*)\s*:/);
  return m ? m[1] : undefined;
}

/** Parse the JSON string array `.dbg.locals` prints (`.j.j`, quoted by q). */
function parseJsonNames(output: string): string[] {
  const jsonText = unquoteQString(output.trim());
  if (jsonText === undefined) return [];
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Parse the JSON string q's `.j.j` prints (it is wrapped in double quotes). */
export function parseJsonDict(
  output: string,
): Record<string, unknown> | undefined {
  const trimmed = output.trim();
  const jsonText = unquoteQString(trimmed);
  if (jsonText === undefined) return undefined;
  try {
    const parsed = JSON.parse(jsonText);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** q prints a string as `"...\"...\""`; unwrap the outer quotes and unescape. */
function unquoteQString(s: string): string | undefined {
  if (s.length < 2 || !s.startsWith('"') || !s.endsWith('"')) return undefined;
  const inner = s.slice(1, -1);
  return inner.replace(/\\(["\\/])/g, "$1");
}

function formatValue(value: unknown): string {
  if (value === null) return "::";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
