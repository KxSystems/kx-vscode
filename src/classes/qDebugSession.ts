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
  QLambdaPath,
  QSeparator,
  lambdaPathAt,
  lambdaStatementSeparators,
} from "../utils/qLocals";
import { splitTopLevelStatements, QStatement } from "../utils/qStatements";

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
}

const THREAD_ID = 1;
// Variables references encode the frame index they belong to (offset avoids 0).
const VAR_REF_BASE = 1000;
// Ceiling on single-steps taken to reach a breakpoint line from a function entry
// trap. A breakpoint only reachable after this many instructions is treated as
// unsteppable rather than spinning indefinitely.
const MAX_BREAKPOINT_STEPS = 100000;

export class QDebugSession extends LoggingDebugSession {
  // Only one debug session may drive a (possibly shared) q process at a time.
  // A new launch takes over, cancelling any previous session so its statement
  // loop stops touching the driver.
  private static current?: QDebugSession;
  // In-flight cleanup of the session being torn down. Termination is reported to
  // VS Code immediately (so the session ends promptly and a new launch is not
  // blocked by the "already running" dialog), but the actual unwind runs after;
  // the next launch awaits this so its driver.reset() cannot race the unwind on
  // the shared q process.
  private static releasing?: Promise<void>;

  /** The shared q session borrowed from the program's REPL (assigned on launch). */
  private driver!: QDebugDriver;
  private repl?: ReplConnection;
  private onExited?: () => void;
  private cancelled = false;
  private released = false;
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
   * {@link trapKey} (function name + nested-lambda path). Tracked so they can be
   * recovered (`.dbg.bu`) when the session ends or the breakpoint is removed —
   * leaving `0xff` traps in the REPL's functions would corrupt them.
   */
  private readonly armedTraps = new Map<
    string,
    { name: string; path: number[] }
  >();
  /** Temp dir holding per-statement load files; their frames map back to programPath. */
  private tempDir?: string;
  private tempSeq = 0;

  /** Frames of the current suspension, outermost-last as reported by q. */
  private currentFrames: QFrame[] = [];
  /** The frame index q's debugger currently points at (its `>>` frame). */
  private qCurrentIndex = 0;
  /**
   * The start of the statement about to execute in the current frame. Reported as
   * the top stack frame's column so VS Code marks the statement, not just the line.
   * q's `^` caret lands at an inconsistent sub-token offset, so we use it only to
   * pick which statement, then snap to that statement's start via the parser.
   */
  private currentMarker?: { line: number; col: number };
  /** Cache of source file contents, keyed by absolute path. */
  private readonly sourceCache = new Map<string, string>();

  /**
   * Tail of the chain serializing driver-touching operations. DAP requests
   * arrive concurrently (watch/hover evaluations, Variables for several frames,
   * a step while watches refresh) and each is a multi-command sequence on the
   * one shared q prompt (navigate frames, evaluate, pop back); interleaving two
   * would evaluate in the wrong frame and desync {@link qCurrentIndex}, so every
   * such operation runs through {@link serialized}.
   */
  private pendingOp: Promise<unknown> = Promise.resolve();

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
    // Wait for a previous session's unwind to finish so our reset() below does
    // not interleave commands with it on the shared driver.
    await QDebugSession.releasing?.catch(() => undefined);

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
    // supported only when its line falls within a lambda body (nested lambdas
    // included); top-level (global-scope) lines are reported unverified.
    // In-function breakpoints are armed as their enclosing function is defined
    // during the statement load.
    const text = this.readSource(file);
    response.body = {
      breakpoints: lines.map((line) =>
        text !== undefined && lambdaPathAt(text, line) !== undefined
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
      // Mark the statement in the frame where execution is paused. `marker.col` is
      // a 0-based source index (setDebuggerColumnsStartAt1(false)); the debug
      // adapter library does not auto-convert StackFrame columns, so convert to the
      // client's 1-based convention explicitly — otherwise the marker lands one
      // column to the left.
      const marker = this.currentMarker;
      if (f.current && marker && marker.line === f.line) {
        frame.column = this.convertDebuggerColumnToClient(marker.col);
      }
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
    response.body = {
      scopes: [new Scope("Locals", VAR_REF_BASE + args.frameId, false)],
    };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): Promise<void> {
    let variables: DebugProtocol.Variable[] = [];

    const frameIndex = args.variablesReference - VAR_REF_BASE;
    const frame = this.currentFrames.find((f) => f.index === frameIndex);
    if (frame) {
      variables = await this.serialized(async () => {
        // Re-checked under the lock: a queued continue/step may have resumed
        // execution while this request waited its turn.
        if (!this.driver.suspended) return [];
        const names = await this.localNamesForFrame(frame);
        if (names.length === 0) return [];
        await this.navigateTo(frameIndex);
        return this.readLocals(names);
      });
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
    // Hovering must not mutate the debuggee: q evaluates whatever text is sent, so
    // restrict hover to a bare name/index lookup (no assignment `:`, no `;`). Watch
    // and REPL expressions are entered deliberately and left unrestricted.
    if (args.context === "hover" && !isReadOnlyExpression(args.expression)) {
      this.sendErrorResponse(response, {
        id: 1003,
        format: "Hover evaluation is limited to simple lookups.",
      });
      return;
    }
    // The suspension can end while this request waits its turn (a queued
    // continue/step ran first), so the paused check is repeated under the lock.
    const res = await this.serialized(async () => {
      if (!this.driver.suspended) return undefined;
      if (args.frameId !== undefined) {
        await this.navigateTo(args.frameId);
      }
      return this.driver.evaluate(args.expression);
    });
    if (res === undefined) {
      this.sendErrorResponse(response, {
        id: 1002,
        format: "Not paused: cannot evaluate.",
      });
      return;
    }
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
    await this.serialized(() => this.resume());
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
    await this.serialized(() => this.stepStatement());
  }

  protected terminateRequest(response: DebugProtocol.TerminateResponse): void {
    // Report termination FIRST, then unwind. release() unwinds the debugger and
    // removes traps but keeps the shared q process alive, so nothing else signals
    // the session is over — and its abort commands can take a moment. Answering
    // up front ends the session immediately (one Stop click, no lingering session
    // that would block the next launch with the "already running" dialog).
    this.sendResponse(response);
    this.sendEvent(new TerminatedEvent());
    QDebugSession.releasing = this.release();
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): void {
    this.sendResponse(response);
    QDebugSession.releasing = this.release();
  }

  /**
   * End the debug session without killing the shared q process: detach the
   * exit listener and return q to a clean top-level prompt so the REPL (and the
   * next debug session) can keep using the same instance.
   */
  private async release(): Promise<void> {
    // VS Code sends both terminate and disconnect; unwind the shared process once.
    if (this.released) return;
    this.released = true;
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
      // `.dbg.bu` recovers the original bytecode (`.Q.bd` is unreliable on
      // current KDB-X builds — its `.Q.BP` bookkeeping signals `'length`).
      // Recovery is only safe at top level, which reset()/abortToTop() ensures.
      for (const { name, path } of this.armedTraps.values()) {
        try {
          await this.driver.evaluate(`.dbg.bu[\`${name};${qList(path)}]`);
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

  /**
   * Run a driver-touching operation after every previously queued one has
   * finished, so multi-command sequences never interleave on the shared prompt.
   * The chain survives a failed operation (e.g. a command timeout): the failure
   * propagates to that operation's caller only.
   */
  private serialized<T>(op: () => Promise<T>): Promise<T> {
    const result = this.pendingOp.then(op);
    this.pendingOp = result.catch(() => undefined);
    return result;
  }

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
    await this.serialized(() => this.runStatements());
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
        // so a call in this statement stops correctly (and disarm any the user
        // has since removed). Runs at a top-level statement boundary, where trap
        // recovery is safe.
        await this.syncBreakpoints(this.loadedThroughLine);

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

  /** Resume after a stop: continue past a breakpoint, or unwind an exception. */
  private async resume(): Promise<void> {
    if (this.driver.stopReason === "breakpoint") {
      // The native debugger only traps at function ENTRY; the first breakpoint
      // in a function is reached by single-stepping from there (advanceToBreakpoint).
      // So when the current function carries a further requested breakpoint line,
      // step to it rather than running freely (`:` would skip every in-function
      // breakpoint past the first). The step resumes from the current line.
      const resumeLine = await this.currentFunctionResumeLine();
      if (resumeLine !== undefined) {
        const outcome = await this.advanceToBreakpoint(resumeLine);
        if (outcome === "exited") {
          // The function returned before another breakpoint line: fall back to
          // the loader (execution is back at the top level).
          await this.runStatements();
        } else {
          await this.reportStopped(outcome);
        }
        return;
      }
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
   * The current source line when the lambda the debugger is suspended in still
   * carries a requested breakpoint line besides the one at that position — the
   * signal that resuming should single-step to the next in-lambda breakpoint
   * (returning the line to step off from), rather than run freely. Undefined when
   * this is the lambda's only breakpoint, so a free continue is used. Identity is
   * the trap key (function name + nested path), so a breakpoint in a sibling or
   * nested lambda does not count as "the same lambda".
   */
  private async currentFunctionResumeLine(): Promise<number | undefined> {
    const pos = await this.driver.position();
    const file = this.mapToProgram(pos?.file);
    if (file === undefined || pos?.line === undefined) return undefined;
    const text = this.readSource(file);
    if (text === undefined) return undefined;
    const here = lambdaPathAt(text, pos.line);
    if (!here) return undefined;
    const key = trapKey(here);
    const lines = this.requestedBreakpoints.get(file) ?? [];
    const inLambda = lines.filter((line) => {
      const lp = lambdaPathAt(text, line);
      return lp !== undefined && trapKey(lp) === key;
    });
    return inLambda.length > 1 ? pos.line : undefined;
  }

  /**
   * Step to the next statement. Single-steps the native debugger (`>`, one
   * bytecode) until the current position leaves the starting statement, stopping
   * on either a different source line or a FORWARD move to a later `;`-separated
   * statement on the same line. A loop back-edge (the caret jumping back to an
   * earlier same-line statement, e.g. a `do`/`while` counter/condition) is skipped
   * rather than stopped on, so stepping a one-liner like `do[3; r:r+10]` stops on
   * the body once per iteration instead of bouncing on the loop control each pass.
   * Falls through to the loader when the function returns, and reports an exception
   * if one surfaces mid-step.
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
        ? lambdaPathAt(text, startLine)?.startLine
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
    // `prevId` tracks the last position so a same-line move is only a stop when it
    // advances to a LATER statement (id increases); a jump back to an earlier
    // same-line statement is a loop back-edge and is stepped over silently.
    let prevId = startId;
    let guard = 0;
    while (this.driver.suspended && guard++ < 256) {
      const pos = await this.driver.stepPosition();
      if (!this.driver.suspended) break;
      if (this.driver.stopReason === "exception") {
        await this.reportStopped("exception");
        return;
      }
      const line = pos?.line;
      if (line === undefined || line === braceLine) continue;
      const id = statementId(separators, line, pos?.col);
      if (line !== startLine || id > prevId) {
        await this.reportStopped("step");
        return;
      }
      prevId = id;
    }
    if (this.driver.suspended) {
      // Could not advance by stepping (e.g. sitting on an unconditional `'signal`).
      // Let the line run so its effect surfaces (typically an error), then report.
      await this.driver.continueFromBreakpoint();
      if (this.driver.suspended) {
        // Reason reflects the fresh stop from the continue (a signal, or another
        // breakpoint), captured now before any other command can perturb it.
        await this.reportStopped(
          this.driver.stopReason === "exception" ? "exception" : "breakpoint",
        );
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
      await this.reportStopped("exception");
      return true;
    }
    // Entry trap fired: single-step until q reports a requested breakpoint line.
    const outcome = await this.advanceToBreakpoint();
    if (outcome === "exited") return false;
    await this.reportStopped(outcome);
    return true;
  }

  /**
   * After the entry trap fires, single-step (`>`) until q's reported current line
   * is a requested breakpoint line. The reported line comes from `.Q.bt` and is
   * reliable across control constructs, unlike a static bytecode->line map. Returns
   * "breakpoint" when a requested line is reached (or stepping is capped while
   * still suspended), "exception" on an error, or "exited" if the function returns
   * before any requested line (e.g. a branch not taken).
   *
   * When `resumeLine` is given the search starts one step later (used on resume,
   * where execution already sits on a breakpoint line): that line is not treated
   * as a match again until execution has left it and come back — a loop back-edge
   * stops, but the bytecodes still on the resume line do not.
   */
  private async advanceToBreakpoint(
    resumeLine?: number,
  ): Promise<"breakpoint" | "exception" | "exited"> {
    // Read the entry position once, then step-and-read in a single round-trip per
    // instruction (q's `>` echoes the new position), rather than a separate
    // `.Q.bt[]` before every step.
    let pos =
      resumeLine === undefined
        ? await this.driver.position()
        : await this.driver.stepPosition();
    let leftResumeLine = false;
    let guard = 0;
    while (this.driver.suspended && guard++ < MAX_BREAKPOINT_STEPS) {
      if (this.driver.stopReason === "exception") return "exception";
      // Don't re-stop on the line we resumed from until execution has moved off
      // it; only a genuine loop back to it (after leaving) counts as a hit.
      if (resumeLine !== undefined && pos?.line === resumeLine) {
        if (!leftResumeLine) {
          pos = await this.driver.stepPosition();
          continue;
        }
      } else if (resumeLine !== undefined) {
        leftResumeLine = true;
      }
      if (this.isBreakpointLine(this.mapToProgram(pos?.file), pos?.line)) {
        return "breakpoint";
      }
      pos = await this.driver.stepPosition();
    }
    if (this.driver.suspended) {
      // Hit the step ceiling while still running: stop here rather than silently
      // stepping forever, and say so (a breakpoint reachable only after this many
      // instructions is effectively unsteppable through the native debugger).
      this.sendEvent(
        new OutputEvent(
          `Stopped searching for a breakpoint after ${MAX_BREAKPOINT_STEPS} steps.\n`,
          "console",
        ),
      );
      return "breakpoint";
    }
    return "exited";
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

  /**
   * Capture frames for the current suspension and emit a DAP stopped event with an
   * explicit reason. The reason is decided by the caller at the moment it chooses
   * to stop — it must NOT be re-derived here from `driver.stopReason`, which is
   * mutable: capturing the backtrace, or a concurrent hover/watch/variables
   * evaluate that momentarily deepens the prompt, can flip it between the stop
   * decision and this event, mislabelling a breakpoint/step pause as an exception.
   */
  private async reportStopped(
    reason: "breakpoint" | "step" | "exception",
  ): Promise<void> {
    // Drop the synthetic `\l <temp>` loader frame at the base of the stack.
    this.currentFrames = (await this.driver.frames()).filter(
      (f) => !/^\\l\s/.test(f.text),
    );
    this.qCurrentIndex =
      this.currentFrames.find((f) => f.current)?.index ??
      this.currentFrames[0]?.index ??
      0;
    await this.captureMarker();
    // Surface the live q terminal (where the debugger prompt is) on each stop.
    this.driver.reveal();
    this.sendEvent(new StoppedEvent(reason, THREAD_ID));
  }

  /**
   * Record the start column of the statement at q's `^` caret, for the top frame's
   * marker. The caret picks the statement; `statementStart` snaps to its first
   * token using the parser's `;` separators (so a caret anywhere in `a:1; b:2` or
   * inside a `(…;…)` list resolves to the right statement's start).
   */
  private async captureMarker(): Promise<void> {
    this.currentMarker = undefined;
    const pos = await this.driver.position();
    if (pos?.line === undefined || pos.col === undefined) return;
    const file = this.mapToProgram(pos.file);
    const text = file ? this.readSource(file) : undefined;
    if (text === undefined) return;
    const separators = lambdaStatementSeparators(text, pos.line);
    const lineText = text.split("\n")[pos.line - 1] ?? "";
    this.currentMarker = {
      line: pos.line,
      col: statementStart(separators, lineText, pos.line, pos.col),
    };
  }

  /**
   * Reconcile native traps with the requested breakpoints, for functions defined
   * up to `throughLine`. A trap is set at the ENTRY (bytecode 0 — always a valid
   * stop) of the lambda enclosing each breakpoint: the top-level function itself,
   * or, for a breakpoint inside a NESTED lambda, that nested lambda (reached via
   * `.dbg.bs` from the outer function's name and a source-order descent path,
   * since `>` single-stepping does not descend into nested calls). When the trap
   * fires we single-step to the requested source line (advanceToBreakpoint) using
   * q's own reported line, so placement is correct even inside if/while/do/$
   * constructs (a static bytecode-offset map does not reliably predict the line q
   * reports). Traps whose breakpoints were all removed are recovered (`.dbg.bu`)
   * here, at a top-level boundary where that is safe; the rest are recorded in
   * `armedTraps` for removal on session end.
   */
  private async syncBreakpoints(throughLine: number): Promise<void> {
    // Trap keys that still carry at least one requested breakpoint line.
    const wanted = new Set<string>();
    for (const [file, lines] of this.requestedBreakpoints) {
      const text = this.readSource(file);
      if (text === undefined) continue;
      // `throughLine` tracks load progress through THE PROGRAM file only, so
      // the "defined yet?" line gate applies only there. Functions in other
      // files (e.g. loaded via \l from inside the program) are armed as soon as
      // their name resolves; until then the failed `.dbg.bs` below is simply
      // retried at the next statement boundary.
      const gated = file === this.programPath;
      for (const line of lines) {
        const lambda = lambdaPathAt(text, line);
        if (!lambda) continue;
        const key = trapKey(lambda);
        wanted.add(key);
        // Gate on the OUTERMOST function's definition: a nested lambda only
        // exists (as a constant) once its whole enclosing function has loaded,
        // which happens atomically as one top-level statement.
        if (gated && lambda.rootLine > throughLine) continue;
        if (this.armedTraps.has(key)) continue;
        // The function may not be defined yet (loaded, but its assignment not
        // reached, or resolved via a name the process does not know). Only record
        // the trap when `.dbg.bs` succeeds, so a failed arm is retried at the next
        // statement boundary rather than left as a phantom trap.
        const res = await this.driver.evaluate(
          `.dbg.bs[\`${lambda.name};${qList(lambda.path)}]`,
        );
        if (!res.errored) {
          this.armedTraps.set(key, { name: lambda.name, path: lambda.path });
        }
      }
    }
    // Recover lambdas whose breakpoints were all removed, so their calls stop
    // firing the entry trap (which would otherwise single-step to no purpose).
    for (const [key, { name, path }] of [...this.armedTraps]) {
      if (wanted.has(key)) continue;
      await this.driver.evaluate(`.dbg.bu[\`${name};${qList(path)}]`);
      this.armedTraps.delete(key);
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
    // A no-argument lambda's param slot is a single empty symbol, which surfaces
    // as an empty name; drop it so it never enters a `` `a`b!(…) `` locals probe
    // (an empty key would make the dict malformed and signal `'length`).
    return parseJsonNames(res.output).filter((n) => n.length > 0);
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
    // The dict is built as a bare expression so it evaluates in the suspended
    // frame's scope (a lambda would not see the frame locals); `.dbg.vals`
    // renders it as JSON — writing to stdout to dodge console-width elision,
    // and summarizing any value over its size cap so a huge table/vector is
    // never serialized in full (see resources/q/debug.q).
    const res = await this.driver.evaluate(`.dbg.vals ${symList}!(${valList})`);
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
 * Whether an expression is safe to evaluate on hover: a bare (optionally dotted)
 * name, optionally with a single simple index like `t[0]`, `d[`k]` or `x[-1]`.
 * The index may contain only names, numbers, symbols, dots and `-` — no spaces,
 * strings or operators, since those admit function application (`t[f x]`,
 * `t[system "..."]`), which could mutate the debuggee when VS Code
 * auto-evaluates a hovered token. Assignment (`:`) and statement separators
 * (`;`) are likewise excluded.
 */
export function isReadOnlyExpression(expression: string): boolean {
  return /^\s*[.a-zA-Z][a-zA-Z0-9_.]*\s*(\[[\w.`-]*\])?\s*$/.test(expression);
}

/**
 * Index of the `;`-separated statement containing a 0-based (line, col) position:
 * the count of lambda separators that precede it. Two positions in the same
 * statement share an id; crossing a `;` increments it. Used to detect when a step
 * has moved to the next statement on the same line.
 */
export function statementId(
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

/**
 * The 0-based start column of the statement containing a 0-based caret column on
 * `line`: just after the nearest same-line statement `;` before the caret (or the
 * line start), skipping leading whitespace. `separators` are the lambda/control
 * `;` from the parser, so list/application/param `;` never split a statement.
 */
export function statementStart(
  separators: QSeparator[],
  lineText: string,
  line: number,
  col: number,
): number {
  let start = 0;
  for (const s of separators) {
    // A `;` at 1-based column s.column sits at 0-based index s.column - 1; the
    // statement after it starts at 0-based index s.column.
    if (s.line === line && s.column - 1 < col && s.column > start) {
      start = s.column;
    }
  }
  while (start < lineText.length && /\s/.test(lineText[start])) start++;
  return start;
}

/**
 * Stable identity of a native trap: the outermost function name and its
 * nested-lambda descent path. Two breakpoints share a trap iff they resolve to
 * the same lambda. The space joiner cannot occur in a q name, so `f`+`[]` and `f`+`[0]`
 * never collide.
 */
export function trapKey(lambda: QLambdaPath): string {
  return `${lambda.name} [${lambda.path.join(",")}]`;
}

/**
 * Render a descent path as a q int-list literal for `.dbg.bs`/`.dbg.bu`: `()`
 * for the function itself (empty path), else space-separated indices (`.dbg`
 * coerces a scalar to a list, so a single index is fine as-is).
 */
export function qList(path: number[]): string {
  return path.length === 0 ? "()" : path.join(" ");
}

export function frameName(f: QFrame): string {
  // Prefer the assigned function name (e.g. `g` from `g:{...}`), else the text.
  const m = f.text.match(/^([.a-zA-Z][a-zA-Z0-9_.]*)\s*:/);
  return m ? m[1] : f.text.slice(0, 40);
}

/**
 * The frame's function name only when it is a resolvable q identifier (a
 * `name:{...}` definition), suitable for `` `name `` in a q expression. Anonymous
 * lambdas return undefined (no locals can be looked up by name).
 */
export function frameFuncName(f: QFrame): string | undefined {
  const m = f.text.match(/^([.a-zA-Z][a-zA-Z0-9_.]*)\s*:/);
  return m ? m[1] : undefined;
}

/**
 * The JSON text within q output: raw when q WROTE it via a handle (`neg[1]`,
 * the untruncated path locals use), q-quoted when q DISPLAYED the string at the
 * prompt (kept for compatibility, e.g. a `.j.j` result surfacing via display).
 */
function jsonPayload(output: string): string | undefined {
  const trimmed = output.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.startsWith('"') ? unquoteQString(trimmed) : trimmed;
}

/** Parse the JSON string array `.dbg.locals` emits. */
export function parseJsonNames(output: string): string[] {
  const jsonText = jsonPayload(output);
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

/** Parse the JSON dict text a `.j.j` query emits. */
export function parseJsonDict(
  output: string,
): Record<string, unknown> | undefined {
  const jsonText = jsonPayload(output);
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
export function unquoteQString(s: string): string | undefined {
  if (s.length < 2 || !s.startsWith('"') || !s.endsWith('"')) return undefined;
  const inner = s.slice(1, -1);
  return inner.replace(/\\(["\\/])/g, "$1");
}

export function formatValue(value: unknown): string {
  if (value === null) return "::";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
