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

import { QCommandResult, QDebugDriver, QFrame } from "./qDebugDriver";
import { getEnvironment } from "../utils/core";
import { functionAt, functionLocalsAt } from "../utils/qLocals";
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
  private readonly driver = new QDebugDriver();
  private readonly helperPath: string;
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
  /** Functions whose breakpoints have been armed, to avoid re-arming. */
  private readonly armed = new Set<string>();
  /** Temp dir holding per-statement load files; their frames map back to programPath. */
  private tempDir?: string;
  private tempSeq = 0;

  /** True while paused (synthetically) before a top-level statement, not in q's debugger. */
  private pausedAtTopLevel = false;
  /** Set when resuming a top-level pause, so the loader runs (not re-pauses) that statement. */
  private resumingTopLevel = false;

  /** Frames of the current suspension, outermost-last as reported by q. */
  private currentFrames: QFrame[] = [];
  /** The frame index q's debugger currently points at (its `>>` frame). */
  private qCurrentIndex = 0;
  /** Cache of source file contents, keyed by absolute path. */
  private readonly sourceCache = new Map<string, string>();

  constructor(extensionPath: string) {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(false);
    this.helperPath = join(extensionPath, "resources", "q", "debug.q");
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

    const env = getEnvironment();
    const qBin = args.qBinPath || env.qBinPath || "q";

    this.driver.on("exited", () => this.sendEvent(new TerminatedEvent()));

    try {
      // Load the .dbg.* helpers at q startup rather than via a separate \l.
      await this.driver.start(qBin, env, undefined, this.helperPath);
    } catch (err) {
      this.sendErrorResponse(response, {
        id: 1001,
        format: `Failed to start q debugger: ${errText(err)}`,
      });
      return;
    }

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
    // Breakpoints are armed as their enclosing function is defined during the
    // statement-by-statement load; report them verified optimistically.
    response.body = {
      breakpoints: lines.map((line) => ({ verified: true, line })),
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
        const names = this.localNamesForFrame(frame);
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
    if (!this.driver.suspended && !this.pausedAtTopLevel) {
      this.sendErrorResponse(response, {
        id: 1002,
        format: "Not paused: cannot evaluate.",
      });
      return;
    }
    // Navigate to the requested frame only in q's debugger (not at a top-level
    // pause, where q is at the normal prompt and there are no frames to walk).
    if (this.driver.suspended && args.frameId !== undefined) {
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
    if (this.pausedAtTopLevel) {
      await this.continueTopLevel();
    } else {
      await this.resume();
    }
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

  /** Route a step to the top-level loader or q's in-frame stepping. */
  private async step(): Promise<void> {
    if (this.pausedAtTopLevel) {
      await this.stepTopLevel();
    } else {
      await this.stepLine();
    }
  }

  protected async terminateRequest(
    response: DebugProtocol.TerminateResponse,
  ): Promise<void> {
    this.cleanup();
    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): void {
    this.cleanup();
    this.sendResponse(response);
  }

  private cleanup(): void {
    this.driver.dispose();
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
        const stmt = this.statements[this.stmtIndex];

        // Pause before a top-level (global-scope) breakpoint statement. q is not
        // in its debugger here, so this is a synthetic stop the loader controls.
        if (!this.resumingTopLevel) {
          const bpLine = this.topLevelBreakpointLine(stmt);
          if (bpLine !== undefined) {
            this.pauseAtTopLevel(stmt, bpLine);
            return;
          }
        }
        this.resumingTopLevel = false;
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

  // ---- top-level (global-scope) debugging ----

  /**
   * The lowest requested breakpoint line that falls inside a statement's range and
   * is genuinely top-level (not inside any function), or undefined if none.
   */
  private topLevelBreakpointLine(stmt: QStatement): number | undefined {
    const text = this.readSource(this.programPath);
    if (text === undefined) return undefined;
    const lines = this.requestedBreakpoints.get(this.programPath) ?? [];
    const hits = lines
      .filter((l) => l >= stmt.startLine && l <= stmt.endLine)
      .filter((l) => functionAt(text, l) === undefined)
      .sort((a, b) => a - b);
    return hits[0];
  }

  /** Synthetic stop before a top-level statement (q is idle at its normal prompt). */
  private pauseAtTopLevel(stmt: QStatement, line: number): void {
    this.pausedAtTopLevel = true;
    this.currentFrames = [
      {
        index: 0,
        file: this.programPath,
        line,
        text: stmt.text.split("\n")[0],
        current: true,
      },
    ];
    this.qCurrentIndex = 0;
    this.driver.reveal();
    this.sendEvent(new StoppedEvent("breakpoint", THREAD_ID));
  }

  /** Continue from a top-level pause: run the pending statement, then carry on. */
  private async continueTopLevel(): Promise<void> {
    this.pausedAtTopLevel = false;
    this.resumingTopLevel = true;
    await this.runStatements();
  }

  /** Step from a top-level pause: run the pending statement, pause before the next. */
  private async stepTopLevel(): Promise<void> {
    this.pausedAtTopLevel = false;
    try {
      const stmt = this.statements[this.stmtIndex];
      this.stmtIndex++;
      await this.armBreakpoints(this.loadedThroughLine);
      await this.loadStatement(stmt);
      this.loadedThroughLine = Math.max(this.loadedThroughLine, stmt.endLine);
      if (this.driver.suspended) {
        if (await this.handleSuspension()) return;
      }
      const next = this.statements[this.stmtIndex];
      if (next) {
        this.pauseAtTopLevel(next, next.startLine);
      } else {
        this.sendEvent(new TerminatedEvent());
      }
    } catch (err) {
      this.sendEvent(
        new OutputEvent(`Debugger error: ${errText(err)}\n`, "stderr"),
      );
      this.sendEvent(new TerminatedEvent());
    }
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
      // end of the program). The entry trap re-arms itself across calls.
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
   * Step to the next source line. Single-steps the native debugger until the
   * current frame moves to a different source line (skipping repeats and the
   * function's brace line), then reports stopped. Falls through to the loader if
   * the function returns, and reports an exception if one surfaces mid-step.
   */
  private async stepLine(): Promise<void> {
    if (!this.driver.suspended) {
      await this.runStatements();
      return;
    }
    const start = await this.currentFrame();
    const startLine = start?.line;
    const file = this.mapToProgram(start?.file);
    const text = file ? this.readSource(file) : undefined;
    const braceLine =
      text && startLine !== undefined
        ? functionAt(text, startLine)?.startLine
        : undefined;

    // Bound the steps: a single source line spans only a handful of bytecodes,
    // so if the line never advances (e.g. sitting on an unconditional `'signal`)
    // give up and stay put rather than spin.
    let guard = 0;
    while (this.driver.suspended && guard++ < 64) {
      await this.driver.step();
      if (!this.driver.suspended) break;
      if (this.driver.stopReason === "exception") {
        await this.reportStopped();
        return;
      }
      const line = (await this.currentFrame())?.line;
      if (line !== undefined && line !== startLine && line !== braceLine) {
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

  /** The frame the debugger currently points at. */
  private async currentFrame(): Promise<QFrame | undefined> {
    const frames = await this.driver.frames();
    return frames.find((f) => f.current) ?? frames[0];
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
    // Entry breakpoint fired: single-step to the requested line.
    const outcome = await this.advanceToBreakpoint();
    if (outcome === "exited") return false;
    await this.reportStopped();
    return true;
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
    this.pausedAtTopLevel = false;
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
   * Arm breakpoints for functions whose definition ends at or before the given
   * line. Breakpoints are set at the function ENTRY (`.Q.bs[f;0]`) — index 0 is
   * always a valid trap position, whereas computed mid-function indices can be
   * mid-instruction and crash q. When the entry trap fires we single-step to the
   * requested line (see advanceToBreakpoint).
   */
  private async armBreakpoints(throughLine: number): Promise<void> {
    for (const [file, lines] of this.requestedBreakpoints) {
      const text = this.readSource(file);
      if (text === undefined) continue;
      for (const line of lines) {
        const fn = functionAt(text, line);
        if (!fn || fn.startLine > throughLine) continue;
        if (this.armed.has(fn.name)) continue;
        await this.driver.evaluate(`.Q.bs[${fn.name};0]`);
        this.armed.add(fn.name);
      }
    }
  }

  /** True when `line` in `file` carries a requested breakpoint. */
  private isBreakpointLine(file: string | undefined, line?: number): boolean {
    if (file === undefined || line === undefined) return false;
    return (this.requestedBreakpoints.get(file) ?? []).includes(line);
  }

  /**
   * After an entry breakpoint fires, single-step until the current frame reaches
   * a requested breakpoint line. Returns how execution ended:
   *  - "breakpoint": stopped on a requested line
   *  - "exception": an error surfaced while stepping
   *  - "exited": the function returned without hitting a requested line
   */
  private async advanceToBreakpoint(): Promise<
    "breakpoint" | "exception" | "exited"
  > {
    let guard = 0;
    while (this.driver.suspended && guard++ < 10000) {
      if (this.driver.stopReason === "exception") return "exception";
      const frames = await this.driver.frames();
      const cur = frames.find((f) => f.current) ?? frames[0];
      if (this.isBreakpointLine(this.mapToProgram(cur?.file), cur?.line)) {
        return "breakpoint";
      }
      await this.driver.step();
    }
    return this.driver.suspended ? "breakpoint" : "exited";
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
   * Local variable names for a frame, recovered from the frame's source file via
   * the q parser (the backtrace only prints a display excerpt, so it cannot be
   * relied on for multi-line functions).
   */
  private localNamesForFrame(frame: QFrame): string[] {
    const file = this.mapToProgram(frame.file);
    if (!file) return [];
    const text = this.readSource(file);
    if (text === undefined) return [];
    return functionLocalsAt(text, frameName(frame), frame.line);
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

function frameName(f: QFrame): string {
  // Prefer the assigned function name (e.g. `g` from `g:{...}`), else the text.
  const m = f.text.match(/^([.a-zA-Z][a-zA-Z0-9_.]*)\s*:/);
  return m ? m[1] : f.text.slice(0, 40);
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
