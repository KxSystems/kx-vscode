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
  DebugSession,
  InitializedEvent,
  StoppedEvent,
  TerminatedEvent,
  ExitedEvent,
  OutputEvent,
  Thread,
  StackFrame,
  Scope,
  Source,
  Variable,
} from "@vscode/debugadapter";
import type { DebugProtocol } from "@vscode/debugprotocol";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import type * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

import {
  debugWorkingDirectory,
  getOrCreateDebugTerminal,
} from "./debugTerminal";
import {
  FRAME_LINE_RE,
  funcName,
  isCaretLine,
  parseBacktrace,
  parseCurrentPosition,
  SUSPEND_MARKER_RE,
  type QFrame,
  type QPosition,
} from "./qBacktrace";
import { QProcess, type QCommandResult } from "./qProcess";
import type {
  LambdaSpan,
  LineIdentifier,
  StatementSeparator,
  StructureRequests,
} from "../../server/src/protocol";

const THREAD_ID = 1;

const VAR_REF_BASE = 1000;

const GLOBALS_VAR_REF = 999;

const MAX_STEPS = 100000;

const MAX_FRAME_MOVES = 128;

const MAX_POPS = 64;

const STOP_GRACE_MS = 2000;

interface QLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  cwd?: string;
  qExecutable?: string;

  verboseTrace?: boolean;
}

interface QLambdaTarget {
  name: string;
  descentPath: number[];

  backtraceName?: string;
}

interface QStatement {
  startLine: number;
  startColumn: number;
  endLine: number;
  text: string;

  namespace: string;
}

const SAFE_LOOKUP_RE = /^[.a-zA-Z][\w.]*$/;
function isSafeLookup(expression: string): boolean {
  return SAFE_LOOKUP_RE.test(expression.trim());
}

const CAPTURE = ".dbg.v::(";

function qText(value: string): string {
  return `(),"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")}"`;
}

const HEADER_RE = /^((?:>>|\s\s)\[\d+\]\s\s?)(.*?):(\d+):\s(.*)$/;

function shiftCaret(lines: string[], at: number, delta: number, from: number) {
  const next = lines[at + 1];
  if (delta === 0 || next === undefined || !isCaretLine(next)) return;
  const caret = next.indexOf("^");
  if (caret < from) return;
  lines[at + 1] = " ".repeat(Math.max(from, caret - delta)) + next.slice(caret);
}

const EXCEPTION_WIDTH = 100;

function wrapLine(line: string, width: number): string[] {
  const parts: string[] = [];
  for (let at = 0; at < line.length; at += width) {
    parts.push(line.slice(at, at + width));
  }
  return parts.length > 0 ? parts : [""];
}

interface ProgramCounter {
  index: number;
  length: number;
  depth: number;
  position: number;
}

function isPhantomStep(
  prev: ProgramCounter | undefined,
  next: ProgramCounter | undefined,
): boolean {
  return (
    prev !== undefined &&
    next !== undefined &&
    prev.depth === next.depth &&
    next.length > 3 &&
    next.index === next.length - 3 &&
    next.index - prev.index > 2
  );
}

const ANON_PREFIX = ".dbg.a";

function anonKey(line: number, column: number): string {
  return `${line}:${column}`;
}

function offsetIn(
  stmt: { startLine: number; startColumn: number; text: string },
  line: number,
  column: number,
): number {
  const lines = stmt.text.split("\n");
  const row = line - stmt.startLine;
  let offset = 0;
  for (let i = 0; i < row; i++) offset += lines[i].length + 1;
  return offset + (row === 0 ? column - stmt.startColumn : column);
}

function sliceLines(lines: string[], span: LambdaSpan): string {
  if (span.line === span.endLine) {
    return lines[span.line - 1].slice(span.column, span.endColumn);
  }
  return [
    lines[span.line - 1].slice(span.column),
    ...lines.slice(span.line, span.endLine - 1),
    lines[span.endLine - 1].slice(0, span.endColumn),
  ].join("\n");
}

function blankOut(text: string, replacement: string): string {
  return text
    .split("\n")
    .map((part, i) =>
      i === 0 ? replacement.padEnd(part.length) : " ".repeat(part.length),
    )
    .join("\n");
}

function qLongList(nums: number[]): string {
  return `\`long$(${nums.join(";")})`;
}

function qSymbolVector(names: string[]): string {
  if (names.length === 0) return "`symbol$()";
  if (names.length === 1) return `enlist \`${names[0]}`;
  return "`" + names.join("`");
}
function qIdentVector(names: string[]): string {
  if (names.length === 1) return `enlist ${names[0]}`;
  return `(${names.join(";")})`;
}

function trapKeyOf(target: QLambdaTarget): string {
  return `${target.name}#${target.descentPath.join(",")}`;
}

function dbgCall(fn: string, target: QLambdaTarget): string {
  return `.dbg.${fn}[\`${target.name};${qLongList(target.descentPath)}]`;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatValue(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

function couldBeSuspendPrefix(text: string): boolean {
  return (
    text === "" ||
    /^#\d*\s*$/.test(text) ||
    /^>{1,2}(\[\d*\]?\s?)?$/.test(text) ||
    /^ {1,2}(\[\d*\]?\s?)?$/.test(text)
  );
}

function emitOnNewLine(driver: QProcess, text: string): void {
  driver.emit("data", (driver.atLineStart ? "" : "\n") + text);
}

class LiveOutputForwarder {
  private holding = "";
  private lineDecidedSafe = false;
  private stopped = false;
  private sawContent = false;

  public constructor(
    private readonly stopAt: RegExp[],
    private readonly driver: QProcess,
  ) {}

  private matchesStop(line: string): boolean {
    return this.stopAt.some((re) => re.test(line));
  }

  public push(chunk: string): void {
    if (this.stopped) return;
    let i = 0;
    for (;;) {
      const newlineIdx = chunk.indexOf("\n", i);
      if (newlineIdx === -1) {
        const segment = chunk.slice(i);
        if (segment.length === 0) return;
        if (this.lineDecidedSafe) {
          this.emit(segment);
          return;
        }
        this.holding += segment;
        if (!couldBeSuspendPrefix(this.holding)) {
          this.lineDecidedSafe = true;
          this.emit(this.holding);
          this.holding = "";
        }
        return;
      }
      const segment = chunk.slice(i, newlineIdx);
      i = newlineIdx + 1;
      if (this.lineDecidedSafe) {
        this.emit(segment + "\n");
      } else {
        this.holding += segment;
        if (this.matchesStop(this.holding)) {
          this.stopped = true;
          return;
        }
        this.emit(this.holding + "\n");
      }
      this.holding = "";
      this.lineDecidedSafe = false;
    }
  }

  public finish(): void {
    if (this.stopped || this.holding.length === 0) return;
    if (this.matchesStop(this.holding)) {
      this.stopped = true;
      return;
    }
    this.emit(this.holding);
    this.holding = "";
  }

  private emit(text: string): void {
    if (!this.sawContent) {
      const stripped = text.replace(/^\n+/, "");
      if (stripped.length === 0) return;

      this.sawContent = true;
      emitOnNewLine(this.driver, stripped);
      return;
    }
    this.driver.emit("data", text);
  }
}

function stripLeadingDots(name: string): string {
  return name.replace(/^\.+/, "");
}

function statementAt(
  statements: QStatement[],
  line: number,
): QStatement | undefined {
  return statements.find((s) => line >= s.startLine && line <= s.endLine);
}

function frameDisplayName(frame: QFrame, mappedFile?: string): string {
  const name = funcName(frame.text);
  if (name?.startsWith(ANON_PREFIX)) return "<lambda>";
  return name ?? (mappedFile ? path.basename(mappedFile) : frame.text);
}

function statementId(
  seps: StatementSeparator[],
  line: number | undefined,
  col: number | undefined,
): number {
  if (line === undefined) return 0;
  let id = 0;
  for (const s of seps) {
    if (s.line < line || (s.line === line && s.column <= (col ?? 0))) id++;
  }
  return id;
}

function statementStart(
  seps: StatementSeparator[],
  lineText: string,
  line: number,
  col: number,
): number {
  let start = 0;
  for (const s of seps) {
    const before = s.line < line || (s.line === line && s.column < col);
    if (!before) continue;
    start = s.line === line ? s.column + 1 : 0;
  }
  while (
    start < lineText.length &&
    (lineText[start] === " " || lineText[start] === "\t")
  ) {
    start++;
  }
  return start;
}

class QDebugSession extends DebugSession {
  private static current?: QDebugSession;

  public static get activeSession(): QDebugSession | undefined {
    return QDebugSession.current;
  }

  private static releasing?: Promise<void>;

  private driver: QProcess | undefined;
  private terminal: vscode.Terminal | undefined;

  private verboseTrace = false;
  private onExited: ((code: number) => void) | undefined;
  private cancelled = false;
  private released = false;
  private configDone = false;
  private started = false;
  private launched = false;
  private launchArgs: QLaunchRequestArguments | undefined;

  private programPath = "";

  private programCwd = "";

  private statements: QStatement[] = [];
  private stmtIndex = 0;

  private loadedThroughLine = 0;

  private readonly requestedBreakpoints = new Map<string, number[]>();

  private topLevelPaused: QStatement | undefined;

  private readonly armedTraps = new Map<string, QLambdaTarget>();

  private readonly stepInTraps = new Map<string, QLambdaTarget>();

  private static readonly tempDirPrograms = new Map<string, string>();

  private tempDir: string | undefined;
  private tempSeq = 0;

  private readonly tempStatements = new Map<string, QStatement>();

  private currentNamespace = ".";

  private currentFrames: QFrame[] = [];

  private qCurrentIndex = 0;

  private qExecIndex = 0;

  private currentMarker: { line: number; col: number } | undefined;
  private readonly sourceCache = new Map<string, string>();

  private readonly virtualSourceText = new Map<number, string>();
  private readonly virtualSourceRef = new Map<string, number>();
  private nextSourceRef = 1;
  private frameVirtual = new Map<number, { ref: number; line: number }>();

  private lastExceptionMessage: string | undefined;

  private pendingValue = false;

  private readonly anonAliases = new Map<string, string>();
  private readonly capturedFiles = new Set<string>();
  private anonSeq = 0;
  private stepIntoRoots = false;

  private pendingOp: Promise<unknown> = Promise.resolve();

  public constructor(
    private readonly getClient: () => LanguageClient | undefined,
    private readonly debugHelperScript: string,
  ) {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(false);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
  ): void {
    response.body = response.body ?? {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsEvaluateForHovers = true;
    response.body.supportsTerminateRequest = true;

    response.body.supportsExceptionInfoRequest = true;
    response.body.exceptionBreakpointFilters = [
      { filter: "uncaught", label: "Uncaught Errors", default: true },
    ];
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected setExceptionBreakPointsRequest(
    response: DebugProtocol.SetExceptionBreakpointsResponse,
  ): void {
    this.sendResponse(response);
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    this.respond(response, () => this.onSetBreakPoints(response, args));
  }

  private async onSetBreakPoints(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): Promise<void> {
    const file = args.source.path ?? "";
    const lines = (args.breakpoints ?? []).map((b) => b.line);
    this.requestedBreakpoints.set(file, lines);

    const [lambdas, statements] = await Promise.all([
      Promise.all(lines.map((line) => this.lambdaPathAt(file, line))),
      this.topLevelStatements(file),
    ]);
    response.body = {
      breakpoints: lines.map((line, i) =>
        lambdas[i] || statementAt(statements, line)
          ? { verified: true, line }
          : {
              verified: false,
              line,
              message:
                "Breakpoint must be inside a function or on a top-level statement.",
            },
      ),
    };
    this.sendResponse(response);

    if (this.driver?.suspended) {
      await this.settle(async () => {
        if (!this.driver?.suspended) return;
        const onStack = await this.onStackTrapKeys();
        await this.syncBreakpoints(this.loadedThroughLine, {
          armOnly: true,
          skipKeys: onStack,
        });
      });
    }
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(THREAD_ID, "q")] };
    this.sendResponse(response);
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: QLaunchRequestArguments,
  ): void {
    this.respond(response, () => this.onLaunch(response, args));
  }

  private async onLaunch(
    response: DebugProtocol.LaunchResponse,
    args: QLaunchRequestArguments,
  ): Promise<void> {
    this.launchArgs = args;

    const previous = QDebugSession.current;
    QDebugSession.current = this;
    if (previous && previous !== this) previous.cancelled = true;
    await QDebugSession.releasing?.catch(() => undefined);

    try {
      const cwd = debugWorkingDirectory(args.program, args.cwd);
      this.programCwd = cwd;

      const session = getOrCreateDebugTerminal(cwd, args.qExecutable);
      this.terminal = session.terminal;
      this.driver = session.process;

      this.verboseTrace = args.verboseTrace === true;
      this.driver.verbose = this.verboseTrace;

      session.terminal.show(true);
      await session.ready;
      if (this.driver.exited) {
        throw new Error("the q session is not running");
      }

      await this.abortToTop();
      await this.driver.sendCommand(`\\l ${this.debugHelperScript}`, false);
    } catch (err) {
      this.sendErrorResponse(response, {
        id: 1001,
        format: `Failed to start q debugger: ${errText(err)}`,
      });
      return;
    }

    this.onExited = (code: number) => {
      this.sendEvent(new TerminatedEvent());
      this.sendEvent(new ExitedEvent(code));

      QDebugSession.releasing = this.release();
    };
    this.driver.on("exit", this.onExited);

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

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
  ): void {
    if (this.topLevelPaused) {
      const stmt = this.topLevelPaused;
      const src =
        this.programPath.length > 0
          ? new Source(path.basename(this.programPath), this.programPath)
          : undefined;
      const frame = new StackFrame(
        0,
        "<top level>",
        src,
        stmt.startLine,
        this.convertDebuggerColumnToClient(stmt.startColumn),
      );
      frame.presentationHint = src ? "normal" : "subtle";
      response.body = { stackFrames: [frame], totalFrames: 1 };
      this.sendResponse(response);
      return;
    }
    const stackFrames: DebugProtocol.StackFrame[] = this.currentFrames.map(
      (f) => {
        const file = this.mapToProgram(f.file);

        const virtual = this.frameVirtual.get(f.index);
        let src: Source | undefined;
        let line = f.line ?? 0;
        if (virtual) {
          src = new Source(
            `${funcName(f.text) ?? "source"}.q`,
            undefined,
            virtual.ref,
          );
          line = virtual.line;
        } else if (file !== undefined) {
          src = new Source(path.basename(file), file);
        }
        const frame = new StackFrame(
          f.index,
          frameDisplayName(f, file),
          src,
          line,
        );
        const marker = this.currentMarker;
        if (!virtual && f.current && marker && marker.line === f.line) {
          frame.column = this.convertDebuggerColumnToClient(marker.col);
        }
        frame.presentationHint = src ? "normal" : "subtle";
        return frame;
      },
    );
    response.body = { stackFrames, totalFrames: stackFrames.length };
    this.sendResponse(response);
  }

  protected sourceRequest(
    response: DebugProtocol.SourceResponse,
    args: DebugProtocol.SourceArguments,
  ): void {
    const ref = args.sourceReference ?? args.source?.sourceReference;
    const content =
      ref !== undefined ? this.virtualSourceText.get(ref) : undefined;
    response.body = { content: content ?? "", mimeType: "text/x-q" };
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ): void {
    response.body = {
      scopes: this.topLevelPaused
        ? [new Scope("Globals", GLOBALS_VAR_REF, false)]
        : [new Scope("Locals", VAR_REF_BASE + args.frameId, false)],
    };
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): void {
    this.respond(response, () => this.onVariables(response, args));
  }

  private async onVariables(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): Promise<void> {
    if (args.variablesReference === GLOBALS_VAR_REF) {
      const variables =
        (await this.settle(async () => {
          if (!this.topLevelPaused) return [];
          return this.readGlobals();
        })) ?? [];
      response.body = { variables };
      this.sendResponse(response);
      return;
    }
    let variables: DebugProtocol.Variable[] = [];
    const frameIndex = args.variablesReference - VAR_REF_BASE;
    const frame = this.currentFrames.find((f) => f.index === frameIndex);
    if (frame) {
      variables =
        (await this.settle(async () => {
          if (!this.driver?.suspended) return [];
          const names = await this.localNamesForFrame(frame);
          if (names.length === 0) return [];
          await this.navigateTo(frameIndex);
          return this.readValues(names);
        })) ?? [];
    }
    response.body = { variables };
    this.sendResponse(response);
  }

  protected evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): void {
    this.respond(response, () => this.onEvaluate(response, args));
  }

  private async onEvaluate(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): Promise<void> {
    const expression = args.expression.trim();
    if (expression.length === 0) {
      response.body = { result: "", variablesReference: 0 };
      this.sendResponse(response);
      return;
    }

    if (args.context === "hover") {
      const value = isSafeLookup(expression)
        ? await this.settle(() => this.hoverValue(expression, args.frameId))
        : undefined;
      response.body = { result: value ?? "", variablesReference: 0 };
      this.sendResponse(response);
      return;
    }

    const topLevel = this.topLevelPaused !== undefined;
    const res =
      topLevel || this.driver?.suspended
        ? await this.settle(async () => {
            if (!topLevel) {
              if (!this.driver?.suspended) return undefined;
              if (args.frameId !== undefined) {
                await this.navigateTo(args.frameId);
              }
            }
            return this.evaluateLines(expression);
          })
        : undefined;
    if (res === undefined) {
      this.sendErrorResponse(response, {
        id: 1002,
        format: "Not paused: cannot evaluate.",
      });
      return;
    }
    response.body = { result: res.output.trim(), variablesReference: 0 };
    this.sendResponse(response);

    if (!topLevel && !this.driver?.suspended && !this.topLevelPaused) {
      this.sendEvent(new TerminatedEvent());
    }
  }

  protected continueRequest(response: DebugProtocol.ContinueResponse): void {
    this.respond(response, () => this.onContinue(response));
  }

  private async onContinue(
    response: DebugProtocol.ContinueResponse,
  ): Promise<void> {
    response.body = { allThreadsContinued: true };
    this.sendResponse(response);
    await this.settle(() => this.resume());
  }

  protected nextRequest(response: DebugProtocol.NextResponse): void {
    this.respond(response, () => this.onNext(response));
  }

  private async onNext(response: DebugProtocol.NextResponse): Promise<void> {
    this.sendResponse(response);
    await this.settle(() => this.stepStatement());
  }

  protected stepInRequest(response: DebugProtocol.StepInResponse): void {
    this.respond(response, () => this.onStepIn(response));
  }

  private async onStepIn(
    response: DebugProtocol.StepInResponse,
  ): Promise<void> {
    this.sendResponse(response);
    await this.settle(() => this.stepInto());
  }

  protected stepOutRequest(response: DebugProtocol.StepOutResponse): void {
    this.respond(response, () => this.onStepOut(response));
  }

  private async onStepOut(
    response: DebugProtocol.StepOutResponse,
  ): Promise<void> {
    this.sendResponse(response);
    await this.settle(() => this.stepOut());
  }

  protected terminateRequest(response: DebugProtocol.TerminateResponse): void {
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

  private async release(): Promise<void> {
    if (this.released) return;
    this.released = true;
    this.cancelled = true;
    if (QDebugSession.current === this) QDebugSession.current = undefined;
    if (this.onExited && this.driver) {
      this.driver.off("exit", this.onExited);
      this.onExited = undefined;
    }
    if (this.driver && !this.driver.exited) {
      await this.interruptRunning(this.driver);
    }
    if (this.driver && !this.driver.exited) {
      const driver = this.driver;
      await this.abortToTop().catch(() => undefined);

      for (const target of [
        ...this.armedTraps.values(),
        ...this.stepInTraps.values(),
      ]) {
        await driver
          .sendCommand(dbgCall("bu", target), false)
          .catch(() => undefined);
      }

      await driver.sendCommand("\\d .", false).then(
        () => (this.currentNamespace = "."),
        () => undefined,
      );

      driver.emit("data", "\n");
      await driver.sendCommand("").catch(() => undefined);
    }

    if (this.driver) this.driver.verbose = false;
    this.armedTraps.clear();
    this.stepInTraps.clear();
    if (this.tempDir) {
      await rm(this.tempDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      this.tempDir = undefined;
    }
  }

  private async interruptRunning(driver: QProcess): Promise<void> {
    if (!driver.busy) return;
    driver.interrupt();
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), STOP_GRACE_MS);
    });
    const idle = Promise.all([
      this.pendingOp,
      driver.sendCommand("", false, false).catch(() => undefined),
    ]).then(() => false);
    const timedOut = await Promise.race([idle, expired]);
    clearTimeout(timer);
    if (timedOut) driver.kill();
  }

  private respond(
    response: DebugProtocol.Response,
    op: () => Promise<void>,
  ): void {
    op().catch((err) =>
      this.sendErrorResponse(response, { id: 1003, format: errText(err) }),
    );
  }

  private serialized<T>(op: () => Promise<T>): Promise<T> {
    const result = this.pendingOp.then(op);
    this.pendingOp = result.catch(() => undefined);
    return result;
  }

  private async settle<T>(op: () => Promise<T>): Promise<T | undefined> {
    try {
      return await this.serialized(op);
    } catch {
      return undefined;
    }
  }

  private async tryRun(): Promise<void> {
    if (
      this.launched ||
      !this.started ||
      !this.configDone ||
      this.launchArgs === undefined ||
      this.driver === undefined
    ) {
      return;
    }
    this.launched = true;

    this.driver.emit("data", "\n");

    const args = this.launchArgs;
    const programPath = path.resolve(this.programCwd, args.program);
    const text = this.readSource(programPath);
    if (text === undefined) {
      this.sendEvent(
        new OutputEvent(`Cannot read program: ${programPath}\n`, "stderr"),
      );
      this.sendEvent(new TerminatedEvent());
      return;
    }
    this.programPath = programPath;
    this.tempDir = mkdtempSync(path.join(tmpdir(), "kdb-debug-"));

    QDebugSession.tempDirPrograms.set(path.basename(this.tempDir), programPath);
    this.statements = await this.topLevelStatements(programPath);
    this.stmtIndex = 0;

    this.currentNamespace = ".";
    await this.driver.sendCommand("\\d .", false);

    await this.serialized(() => this.runStatements());
  }

  private async runStatements(): Promise<void> {
    if (!this.driver) return;
    try {
      while (this.stmtIndex < this.statements.length) {
        if (this.cancelled) return;
        await this.flushValue();
        const stmt = this.statements[this.stmtIndex];

        if (
          this.topLevelPaused !== stmt &&
          (await this.hasRequestedTopLevelBreakpoint(stmt))
        ) {
          this.reportTopLevelStopped(stmt);
          return;
        }
        await this.advanceStatement(stmt);
        if (this.cancelled) return;

        if (this.driver.suspended) {
          if (await this.handleSuspension()) return;
        }
      }
      await this.flushValue();
      this.sendEvent(new TerminatedEvent());
    } catch (err) {
      if (this.cancelled) return;
      this.sendEvent(
        new OutputEvent(`Debugger error: ${errText(err)}\n`, "stderr"),
      );
      this.sendEvent(new TerminatedEvent());
    }
  }

  private async hasRequestedTopLevelBreakpoint(
    stmt: QStatement,
  ): Promise<boolean> {
    const lines = (
      this.requestedBreakpoints.get(this.programPath) ?? []
    ).filter((line) => line >= stmt.startLine && line <= stmt.endLine);
    for (const line of lines) {
      if (!(await this.lambdaPathAt(this.programPath, line))) return true;
    }
    return false;
  }

  private reportTopLevelStopped(
    stmt: QStatement,
    reason: "breakpoint" | "step" = "breakpoint",
  ): void {
    this.topLevelPaused = stmt;
    this.currentFrames = [];
    this.qCurrentIndex = 0;
    this.currentMarker = { line: stmt.startLine, col: stmt.startColumn };

    this.terminal?.show(true);
    this.sendEvent(new StoppedEvent(reason, THREAD_ID));
  }

  private async pauseAfterStep(): Promise<void> {
    await this.flushValue();
    if (this.stmtIndex < this.statements.length) {
      this.reportTopLevelStopped(this.statements[this.stmtIndex], "step");
    } else {
      await this.runStatements();
    }
  }

  private async advanceStatement(
    stmt: QStatement,
    stepInto = false,
  ): Promise<void> {
    this.topLevelPaused = undefined;
    this.stmtIndex++;
    await this.syncBreakpoints(this.loadedThroughLine);
    if (!stepInto) await this.recoverStepInTraps();
    this.stepIntoRoots = stepInto;
    try {
      await this.loadStatement(stmt);
    } finally {
      this.stepIntoRoots = false;
    }
    this.loadedThroughLine = Math.max(this.loadedThroughLine, stmt.endLine);
  }

  private async stepOverTopLevel(stmt: QStatement): Promise<void> {
    if (!this.driver) return;
    await this.advanceStatement(stmt);

    if (this.driver.suspended) {
      if (await this.handleSuspension()) return;
    }
    await this.pauseAfterStep();
  }

  private async stepIntoTopLevel(stmt: QStatement): Promise<void> {
    if (!this.driver) return;
    await this.armStepInTraps(
      this.programPath,
      stmt.startLine,
      stmt.endLine,
      undefined,
    );
    await this.advanceStatement(stmt, true);

    if (this.driver.suspended) {
      if (this.driver.stopReason === "exception") {
        await this.reportStopped("exception");
        return;
      }

      const trace = await this.backtrace();
      await this.recoverStepInTraps(parseBacktrace(trace));
      const pos = parseCurrentPosition(trace);
      const file = this.mapToProgram(pos?.file);
      const lambda =
        file !== undefined && pos?.line !== undefined
          ? await this.lambdaPathAt(file, pos.line)
          : undefined;
      if (lambda && this.armedTraps.has(trapKeyOf(lambda))) {
        const outcome = await this.advanceToBreakpoint();
        if (outcome === "exited") {
          await this.pauseAfterStep();
        } else {
          await this.reportStopped(outcome);
        }
        return;
      }

      await this.reportStopped("step");
      return;
    }

    await this.recoverStepInTraps();
    await this.pauseAfterStep();
  }

  private async loadStatement(stmt: QStatement): Promise<QCommandResult> {
    if (!this.driver || !this.tempDir) {
      return Promise.reject(new Error("no active debug session"));
    }
    await this.enterNamespace(stmt.namespace);
    const text = await this.hoistRootLambdas(stmt);
    const capture = await this.capturesValue(text);
    const body = capture ? `${CAPTURE}${text})` : text;
    const padded = "\n".repeat(stmt.startLine - 1) + body;
    this.pendingValue = capture;
    const file = path.join(this.tempDir, `s${this.tempSeq++}.q`);
    if (capture) this.capturedFiles.add(path.basename(file));
    writeFileSync(file, padded, "utf-8");

    this.tempStatements.set(path.basename(file), stmt);

    return this.sendForwarded(`\\l ${file}`);
  }

  private async sendForwarded(command: string): Promise<QCommandResult> {
    if (!this.driver) throw new Error("no active debug session");
    const forwarder = new LiveOutputForwarder(
      this.verboseTrace ? [] : [SUSPEND_MARKER_RE, FRAME_LINE_RE],
      this.driver,
    );
    const result = await this.driver.sendCommand(
      command,
      false,
      true,
      (chunk) => forwarder.push(chunk),
    );
    forwarder.finish();
    return result;
  }

  private async hoistRootLambdas(stmt: QStatement): Promise<string> {
    const source = this.readSource(this.programPath);
    if (!this.driver || !this.tempDir || source === undefined) {
      return stmt.text;
    }
    const spans = await this.rootLambdas(
      this.programPath,
      stmt.startLine,
      stmt.endLine,
    );
    if (spans.length === 0) return stmt.text;
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const aliases: string[] = [];
    let text = stmt.text;
    for (const span of [...spans].reverse()) {
      const alias = `${ANON_PREFIX}${this.anonSeq++}`;
      const assign = `${alias}:`;
      const head =
        assign.length <= span.column
          ? assign + " ".repeat(span.column - assign.length)
          : assign;
      const file = path.join(this.tempDir, `a${this.tempSeq++}.q`);
      writeFileSync(
        file,
        "\n".repeat(span.line - 1) + head + sliceLines(lines, span),
        "utf-8",
      );
      const res = await this.driver.sendCommand(`\\l ${file}`, false);
      if (this.driver.suspended || res.errored) {
        await this.abortToTop();
        continue;
      }
      this.anonAliases.set(anonKey(span.line, span.column), alias);
      aliases.push(alias);
      const from = offsetIn(stmt, span.line, span.column);
      const to = offsetIn(stmt, span.endLine, span.endColumn);
      text =
        text.slice(0, from) +
        blankOut(text.slice(from, to), `(${alias})`) +
        text.slice(to);
    }
    await this.syncBreakpoints(stmt.endLine, { armOnly: true });
    if (this.stepIntoRoots) {
      for (const alias of aliases) {
        await this.armStepInTrap({ name: alias, descentPath: [] });
      }
    }
    return text;
  }

  private async capturesValue(statement: string): Promise<boolean> {
    const text = statement.trimEnd();
    if (text.endsWith(";") || text.startsWith("\\") || /^[kps]\)/.test(text)) {
      return false;
    }
    const res = await this.evaluate(`.dbg.wraps ${qText(text)}`);
    return !res.errored && res.output.trim() === "1b";
  }

  private async flushValue(): Promise<void> {
    if (!this.pendingValue || !this.driver || this.driver.suspended) return;
    this.pendingValue = false;
    const res = await this.driver.sendCommand(".dbg.pop[]", false);
    if (!res.errored && res.output.length > 0) {
      emitOnNewLine(this.driver, `${res.output}\n`);
    }
  }

  private async enterNamespace(ns: string): Promise<void> {
    if (!this.driver) return;
    const target = ns.length > 0 ? ns : ".";
    if (target === this.currentNamespace) return;
    await this.driver.sendCommand(`\\d ${target}`, false);
    this.currentNamespace = target;
  }

  private async resume(): Promise<void> {
    if (!this.driver) return;
    if (this.topLevelPaused) {
      await this.runStatements();
      return;
    }
    await this.resetFramePointer();
    if (this.driver.stopReason === "breakpoint") {
      const resumeLine = await this.pausedLambdaLine();
      if (resumeLine !== undefined) {
        const outcome = await this.advanceToBreakpoint(resumeLine);
        if (outcome === "exited") {
          await this.runStatements();
        } else {
          await this.reportStopped(outcome);
        }
        return;
      }

      await this.continueFromBreakpoint();
      if (this.driver.suspended && (await this.handleSuspension())) return;
      await this.runStatements();
    } else {
      await this.abortToTop();
      await this.runStatements();
    }
  }

  private async pausedLambdaLine(): Promise<number | undefined> {
    const pos = await this.position();
    const file = this.mapToProgram(pos?.file);
    if (file === undefined || pos?.line === undefined) return undefined;
    const here = await this.lambdaPathAt(file, pos.line);
    if (!here) return undefined;
    return pos.line;
  }

  private async beginStep(
    topLevel: (stmt: QStatement) => Promise<void>,
  ): Promise<boolean> {
    if (this.topLevelPaused) {
      await topLevel(this.topLevelPaused);
      return false;
    }
    if (!this.driver?.suspended) {
      await this.runStatements();
      return false;
    }
    await this.resetFramePointer();
    return true;
  }

  private async stepOrigin() {
    const start = await this.position();
    if (start?.file === undefined) await this.ensureVirtualSource(start?.name);
    const startLine = this.lineOf(start);
    const file = this.mapToProgram(start?.file);
    const lambda =
      file && startLine !== undefined
        ? await this.lambdaPathAt(file, startLine, this.programColumn(start))
        : undefined;
    const separators =
      file && startLine !== undefined
        ? await this.statementSeparators(file, startLine)
        : [];
    let prevId = statementId(separators, startLine, start?.col);
    const leftStatement = (pos: QPosition | undefined): boolean => {
      const line = this.lineOf(pos);
      if (line === undefined || line === lambda?.startLine) return false;
      const id = statementId(separators, line, pos?.col);
      if (line !== startLine || id !== prevId) return true;
      prevId = id;
      return false;
    };
    return { start, startLine, file, lambda, leftStatement };
  }

  private async stepUntil(
    stops: (pos: QPosition | undefined) => boolean,
    skipPhantoms = true,
  ): Promise<boolean> {
    if (!this.driver) return false;
    let pc = skipPhantoms ? await this.programCounter() : undefined;
    let guard = 0;
    while (this.driver.suspended && guard++ < MAX_STEPS) {
      const pos = await this.stepPosition();
      if (!this.driver.suspended) break;
      if (this.driver.stopReason === "exception") {
        await this.reportStopped("exception");
        return true;
      }
      if (skipPhantoms) {
        const prevPc = pc;
        pc = await this.programCounter();
        if (isPhantomStep(prevPc, pc) || (pc && pc.position < 0)) continue;
      }
      if (stops(pos)) {
        await this.reportStopped("step");
        return true;
      }
    }
    return false;
  }

  private async finishStep(): Promise<void> {
    if (this.driver?.suspended) {
      await this.continueFromBreakpoint();
      if (this.driver.suspended) {
        await this.reportStopped(
          this.driver.stopReason === "exception" ? "exception" : "breakpoint",
        );
        return;
      }
    }
    await this.pauseAfterStep();
  }

  private async stepStatement(): Promise<void> {
    if (!(await this.beginStep((stmt) => this.stepOverTopLevel(stmt)))) return;
    const { leftStatement } = await this.stepOrigin();
    if (await this.stepUntil(leftStatement)) return;
    await this.finishStep();
  }

  private async stepInto(): Promise<void> {
    if (!(await this.beginStep((stmt) => this.stepIntoTopLevel(stmt)))) return;
    const { start, startLine, file, lambda, leftStatement } =
      await this.stepOrigin();
    await this.armStepInTraps(
      file,
      startLine,
      startLine,
      lambda?.name || undefined,
      this.programColumn(start),
    );
    const startIndex = start?.index;
    const descended = (pos: QPosition | undefined) =>
      pos?.index !== undefined &&
      startIndex !== undefined &&
      pos.index > startIndex;
    if (await this.stepUntil((pos) => descended(pos) || leftStatement(pos))) {
      return;
    }
    await this.recoverStepInTraps();
    await this.finishStep();
  }

  private async stepOut(): Promise<void> {
    if (!(await this.beginStep((stmt) => this.stepOverTopLevel(stmt)))) return;
    const startIndex = (await this.position())?.index;
    const returned = (pos: QPosition | undefined) =>
      pos?.index !== undefined &&
      startIndex !== undefined &&
      pos.index < startIndex;
    if (await this.stepUntil(returned, false)) return;
    await this.recoverStepInTraps();
    if (this.driver?.suspended) {
      await this.reportStopped("step");
    } else {
      await this.pauseAfterStep();
    }
  }

  private async armStepInTraps(
    file: string | undefined,
    startLine: number | undefined,
    endLine: number | undefined,
    enclosingFn: string | undefined,
    column?: number,
  ): Promise<void> {
    if (file === undefined || startLine === undefined) return;

    const names = await this.identifiersOnLines(
      file,
      startLine,
      endLine ?? startLine,
    );
    for (const { name, canon } of names) {
      if (canon === enclosingFn) continue;
      const target =
        (await this.resolveLocalStepInTarget(enclosingFn, name)) ??
        (await this.resolveGlobalStepInTarget(canon));
      if (target) await this.armStepInTrap(target);
    }
    if (enclosingFn === undefined || column === undefined) return;
    for (const target of await this.statementLambdas(file, startLine, column)) {
      await this.armStepInTrap(target);
    }
  }

  private async armStepInTrap(target: QLambdaTarget): Promise<void> {
    const key = trapKeyOf(target);
    if (this.stepInTraps.has(key) || this.armedTraps.has(key)) return;
    const res = await this.evaluate(dbgCall("bs", target));
    if (!res.errored) this.stepInTraps.set(key, target);
  }

  private async disarm(target: QLambdaTarget): Promise<void> {
    await this.evaluate(dbgCall("bu", target));
  }

  private programColumn(pos: QPosition | undefined): number | undefined {
    if (pos?.col === undefined) return undefined;
    const owner = pos.file
      ? this.tempStatements.get(path.basename(pos.file))
      : undefined;
    return owner && pos.line === owner.startLine
      ? pos.col + owner.startColumn
      : pos.col;
  }

  private async resolveLocalStepInTarget(
    enclosingFn: string | undefined,
    name: string,
  ): Promise<QLambdaTarget | undefined> {
    if (enclosingFn === undefined) return undefined;
    const res = await this.evaluate(
      `.dbg.childIndex[\`${enclosingFn};${name}]`,
    );
    if (res.errored || !/^\d+$/.test(res.output.trim())) return undefined;
    return { name: enclosingFn, descentPath: [Number(res.output.trim())] };
  }

  private async resolveGlobalStepInTarget(
    name: string,
  ): Promise<QLambdaTarget | undefined> {
    const res = await this.evaluate(
      `100h~type ${dbgCall("nested", { name, descentPath: [] })}`,
    );
    if (res.errored || res.output.trim() !== "1b") return undefined;

    return {
      name,
      descentPath: [],
      backtraceName: await this.evaluateName(
        dbgCall("traceName", { name, descentPath: [] }),
      ),
    };
  }

  private async evaluateJson(expr: string): Promise<unknown> {
    const res = await this.evaluate(expr);
    if (res.errored) return undefined;
    try {
      return JSON.parse(res.output);
    } catch {
      return undefined;
    }
  }

  private async evaluateName(expr: string): Promise<string | undefined> {
    const name = await this.evaluateJson(expr);
    return typeof name === "string" && name.length > 0 ? name : undefined;
  }

  private async evaluateNames(expr: string): Promise<string[]> {
    const names = await this.evaluateJson(expr);
    return Array.isArray(names)
      ? names.filter((n): n is string => typeof n === "string" && n !== "")
      : [];
  }

  private async recoverStepInTraps(frames?: QFrame[]): Promise<void> {
    if (this.stepInTraps.size === 0) return;
    const onStack = new Set<string>();
    if (this.driver?.suspended) {
      for (const f of frames ?? (await this.frames())) {
        const name = funcName(f.text);
        if (name) onStack.add(stripLeadingDots(name));
      }
    }
    for (const [key, target] of [...this.stepInTraps]) {
      if (
        onStack.has(stripLeadingDots(target.name)) ||
        (target.backtraceName !== undefined &&
          onStack.has(stripLeadingDots(target.backtraceName)))
      ) {
        continue;
      }
      await this.disarm(target);
      this.stepInTraps.delete(key);
    }
  }

  private async handleSuspension(): Promise<boolean> {
    if (!this.driver) return false;
    if (this.driver.stopReason === "exception") {
      await this.reportStopped("exception");
      return true;
    }

    const outcome = await this.advanceToBreakpoint();
    if (outcome === "exited") return false;
    await this.reportStopped(outcome);
    return true;
  }

  private async advanceToBreakpoint(
    resumeLine?: number,
  ): Promise<"breakpoint" | "exception" | "pause" | "exited"> {
    if (!this.driver) return "exited";
    let pos =
      resumeLine === undefined
        ? await this.position()
        : await this.stepPosition();
    let leftResumeLine = false;
    let pc = await this.programCounter();
    let prevPc: ProgramCounter | undefined;
    const step = async () => {
      const next = await this.stepPosition();
      prevPc = pc;
      pc = await this.programCounter();
      return next;
    };
    let guard = 0;
    while (this.driver.suspended && guard++ < MAX_STEPS) {
      if (this.driver.stopReason === "exception") return "exception";
      if (resumeLine !== undefined && pos?.line === resumeLine) {
        if (!leftResumeLine) {
          pos = await step();
          continue;
        }
      } else if (resumeLine !== undefined) {
        leftResumeLine = true;
      }
      if (
        this.isBreakpointLine(this.mapToProgram(pos?.file), pos?.line) &&
        !isPhantomStep(prevPc, pc)
      ) {
        return "breakpoint";
      }
      pos = await step();
      if (pos === undefined && this.driver.suspended) {
        return "exception";
      }
    }
    if (this.driver.suspended) {
      this.sendEvent(
        new OutputEvent(
          `Stopped searching for a breakpoint after ${MAX_STEPS} steps.\n`,
          "console",
        ),
      );
      return "pause";
    }
    return "exited";
  }

  private isBreakpointLine(file: string | undefined, line?: number): boolean {
    if (file === undefined || line === undefined) return false;
    return (this.requestedBreakpoints.get(file) ?? []).includes(line);
  }

  private mapToProgram(file?: string): string | undefined {
    if (file === undefined) return undefined;
    for (const [dir, program] of QDebugSession.tempDirPrograms) {
      if (file.includes(dir)) return program;
    }
    return file;
  }

  private isTempLoaderFrame(f: QFrame): boolean {
    const m = /^\\l\s+(\S+)/.exec(f.text);
    if (!m || this.tempDir === undefined) return false;
    return m[1].includes(path.basename(this.tempDir));
  }

  private async reportStopped(
    reason: "breakpoint" | "step" | "exception" | "pause",
  ): Promise<void> {
    if (this.cancelled) return;
    const exceptionText =
      reason === "exception" ? this.driver?.errorMessage : undefined;
    this.lastExceptionMessage = exceptionText;
    const trace = await this.backtrace();
    const allFrames = parseBacktrace(trace);

    this.currentFrames = allFrames.filter((f) => !this.isTempLoaderFrame(f));
    this.qCurrentIndex =
      this.currentFrames.find((f) => f.current)?.index ??
      this.currentFrames[0]?.index ??
      0;

    this.qExecIndex = this.qCurrentIndex;

    await this.recoverStepInTraps(this.currentFrames);
    await this.captureMarker(parseCurrentPosition(trace));
    await this.resolveVirtualSources();
    if (reason === "exception") this.emitExceptionReport();

    this.terminal?.show(true);

    this.sendEvent(new StoppedEvent(reason, THREAD_ID));
  }

  private emitExceptionReport(): void {
    if (!this.driver || this.verboseTrace) return;
    const lines = this.backtraceReportLines();
    if (lines.length === 0) return;

    emitOnNewLine(this.driver, lines.join("\n") + "\n");
  }

  private backtraceReportLines(): string[] {
    const lines: string[] = [];
    for (const f of this.currentFrames) {
      const head = `${f.current ? ">>" : "  "}[${f.index}]  `;
      const mapped = this.mapToProgram(f.file);
      const loc =
        mapped !== undefined ? `${this.relPath(mapped)}:${f.line ?? 0}: ` : "";
      const text = f.text.replace(/^\.dbg\.a\d+:/, (alias) =>
        " ".repeat(alias.length),
      );
      lines.push(`${head}${loc}${text}`);
      if (f.column !== undefined) {
        lines.push(" ".repeat(head.length + loc.length + f.column) + "^");
        lines.push(...f.block.slice(1));
      } else {
        lines.push(...f.block);
      }
    }
    return lines;
  }

  private relPath(abs: string): string {
    if (this.programCwd === "") return abs;
    const rel = path.relative(this.programCwd, abs);

    if (rel === "" || path.isAbsolute(rel)) return abs;
    return rel;
  }

  protected exceptionInfoRequest(
    response: DebugProtocol.ExceptionInfoResponse,
  ): void {
    const signal = this.lastExceptionMessage ?? "error";

    const report = [
      ...wrapLine("'" + signal, EXCEPTION_WIDTH),
      ...this.backtraceReportLines(),
    ];
    response.body = {
      exceptionId: "",
      breakMode: "unhandled",
      details: {
        stackTrace: report.join("\n"),
      },
    };
    this.sendResponse(response);
  }

  private async resolveVirtualSources(): Promise<void> {
    this.frameVirtual = new Map();
    for (const f of this.currentFrames) {
      const mapped = this.mapToProgram(f.file);
      if (mapped !== undefined && this.readSource(mapped) !== undefined)
        continue;
      const name = funcName(f.text);
      if (name === undefined) continue;
      const text = await this.fetchSource(name);
      if (text === undefined || text.length === 0) continue;
      let ref = this.virtualSourceRef.get(name);
      if (ref === undefined) {
        ref = this.nextSourceRef++;
        this.virtualSourceRef.set(name, ref);
      }

      this.virtualSourceText.set(ref, text);
      this.frameVirtual.set(f.index, {
        ref,
        line: this.matchSourceLine(text, f),
      });
    }
  }

  private async fetchSource(name: string): Promise<string | undefined> {
    const text = await this.evaluateJson(
      dbgCall("src", { name, descentPath: [] }),
    );
    return typeof text === "string" ? text : undefined;
  }

  private matchSourceLine(source: string, frame: QFrame): number {
    const raw = frame.file !== undefined ? frame.text : frame.sourceLine;
    return this.lineInSource(source, raw) ?? 1;
  }

  private lineInSource(
    source: string,
    rawLine: string | undefined,
  ): number | undefined {
    const needle = rawLine?.trim();
    if (!needle) return undefined;
    const idx = source.split("\n").findIndex((l) => l.trim() === needle);
    return idx >= 0 ? idx + 1 : undefined;
  }

  private lineOf(pos: QPosition | undefined): number | undefined {
    if (!pos || pos.file !== undefined) return pos?.line;
    if (pos.name === undefined) return pos.line;
    const ref = this.virtualSourceRef.get(pos.name);
    const text =
      ref !== undefined ? this.virtualSourceText.get(ref) : undefined;
    if (text === undefined) return pos.line;
    return this.lineInSource(text, pos.sourceLine) ?? pos.line;
  }

  private async ensureVirtualSource(name: string | undefined): Promise<void> {
    if (name === undefined || this.virtualSourceRef.has(name)) return;
    const text = await this.fetchSource(name);
    if (text === undefined || text.length === 0) return;
    const ref = this.nextSourceRef++;
    this.virtualSourceRef.set(name, ref);
    this.virtualSourceText.set(ref, text);
  }

  private async captureMarker(pos: QPosition | undefined): Promise<void> {
    this.currentMarker = undefined;
    const col = this.programColumn(pos);
    if (pos?.line === undefined || col === undefined) return;

    const file = this.mapToProgram(pos.file);
    const text = file !== undefined ? this.readSource(file) : undefined;
    if (text === undefined || file === undefined) return;
    const separators = await this.statementSeparators(file, pos.line);
    const lineText = text.split("\n")[pos.line - 1] ?? "";
    this.currentMarker = {
      line: pos.line,
      col: statementStart(separators, lineText, pos.line, col),
    };
  }

  private async syncBreakpoints(
    throughLine: number,
    opts: { armOnly?: boolean; skipKeys?: Set<string> } = {},
  ): Promise<void> {
    const wanted = new Set<string>();
    for (const [file, lines] of this.requestedBreakpoints) {
      const isProgram = file === this.programPath;
      for (const line of lines) {
        const lambda = await this.lambdaPathAt(file, line);
        if (!lambda || lambda.name === "") continue;

        let name = lambda.name;
        if (!isProgram) {
          const resolved = await this.evaluateName(
            `.dbg.resolveName[${qText(file)};${qText(lambda.name)}]`,
          );
          if (resolved === undefined) continue;
          name = resolved;
        }
        const target = { name, descentPath: lambda.descentPath };
        const key = trapKeyOf(target);
        wanted.add(key);

        if (isProgram && lambda.rootLine > throughLine) continue;
        if (this.armedTraps.has(key)) {
          const stillTrapped = await this.evaluate(dbgCall("trapped", target));
          if (!stillTrapped.errored && stillTrapped.output.trim() === "1b") {
            continue;
          }
          this.armedTraps.delete(key);
        }

        if (opts.skipKeys?.has(key)) continue;
        const res = await this.evaluate(dbgCall("bs", target));
        if (!res.errored) this.armedTraps.set(key, target);
      }
    }

    if (opts.armOnly) return;
    for (const [key, target] of [...this.armedTraps]) {
      if (wanted.has(key)) continue;
      await this.disarm(target);
      this.armedTraps.delete(key);
    }
  }

  private async onStackTrapKeys(): Promise<Set<string>> {
    const keys = new Set<string>();
    for (const frame of this.currentFrames) {
      const lambda = await this.frameLambda(frame);
      if (lambda) keys.add(trapKeyOf(lambda));
    }
    return keys;
  }

  private async navigateTo(index: number): Promise<void> {
    let guard = 0;
    while (this.qCurrentIndex > index && guard++ < MAX_FRAME_MOVES) {
      await this.frameUp();
      this.qCurrentIndex--;
    }
    while (this.qCurrentIndex < index && guard++ < MAX_FRAME_MOVES) {
      await this.frameDown();
      this.qCurrentIndex++;
    }
  }

  private async resetFramePointer(): Promise<void> {
    if (this.driver?.suspended && this.qCurrentIndex !== this.qExecIndex) {
      await this.navigateTo(this.qExecIndex);
    }
  }

  private async localNamesForFrame(frame: QFrame): Promise<string[]> {
    const target = await this.frameLambda(frame);
    if (!target) return [];
    return this.evaluateNames(dbgCall("locals", target));
  }

  private async frameLambda(frame: QFrame): Promise<QLambdaTarget | undefined> {
    const file = this.mapToProgram(frame.file);
    if (file !== undefined && frame.line !== undefined) {
      const lam = await this.lambdaPathAt(file, frame.line);
      if (lam && lam.name !== "") {
        return { name: lam.name, descentPath: lam.descentPath };
      }
    }
    const name = funcName(frame.text);
    return name ? { name, descentPath: [] } : undefined;
  }

  private async readValues(names: string[]): Promise<DebugProtocol.Variable[]> {
    if (names.length === 0) return [];
    const expr = `.dbg.vals[(${qSymbolVector(names)})!(${qIdentVector(names)})]`;
    const values = (await this.evaluateJson(expr)) as
      | Record<string, unknown>
      | undefined;
    if (values) {
      return names.map((name) => new Variable(name, formatValue(values[name])));
    }
    const variables: DebugProtocol.Variable[] = [];
    for (const name of names) {
      const r = await this.evaluate(name);
      variables.push(
        new Variable(name, r.errored ? "<error>" : r.output.trim()),
      );
    }
    return variables;
  }

  private async readGlobals(): Promise<DebugProtocol.Variable[]> {
    return this.readValues(await this.globalNames());
  }

  private globalNames(): Promise<string[]> {
    return this.evaluateNames(
      `.dbg.globalNames[${qText(this.currentNamespace)}]`,
    );
  }

  private async hoverValue(
    name: string,
    frameId: number | undefined,
  ): Promise<string | undefined> {
    if (this.topLevelPaused) {
      const target = this.inScopeSpelling(name, await this.globalNames());
      if (target === undefined) return undefined;
      return (await this.readValues([target]))[0]?.value;
    }
    if (!this.driver?.suspended || frameId === undefined) return undefined;
    const frame = this.currentFrames.find((f) => f.index === frameId);
    if (!frame) return undefined;
    await this.navigateTo(frameId);
    const target = this.inScopeSpelling(name, [
      ...(await this.localNamesForFrame(frame)),
      ...(await this.globalNames()),
    ]);
    if (target === undefined) return undefined;
    return (await this.readValues([target]))[0]?.value;
  }

  private inScopeSpelling(name: string, inScope: string[]): string | undefined {
    const names = new Set(inScope);
    if (names.has(name)) return name;
    if (this.currentNamespace === "." || name.startsWith(".")) return undefined;
    const qualified = `${this.currentNamespace}.${name}`;
    return names.has(qualified) ? qualified : undefined;
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

  private async abortToTop(): Promise<void> {
    if (!this.driver) return;
    let guard = 0;
    while (this.driver.suspended && !this.driver.exited && guard++ < MAX_POPS) {
      if (
        this.driver.stopReason === "breakpoint" &&
        (await this.programCounter())?.index === 0
      ) {
        await this.driver.sendCommand(">", false);
        continue;
      }
      await this.driver.sendCommand("\\", false);
    }
  }

  private async popTo(target: number): Promise<void> {
    if (!this.driver) return;
    let guard = 0;
    while (
      this.driver.promptDepth > target &&
      !this.driver.exited &&
      guard++ < MAX_POPS
    ) {
      await this.driver.sendCommand("\\", false);
    }
  }

  private async evaluate(expr: string): Promise<QCommandResult> {
    if (!this.driver) throw new Error("no active debug session");
    const before = this.driver.promptDepth;
    const reason = this.driver.stopReason;
    const result = await this.driver.sendCommand(expr, false);
    if (result.depth >= before) {
      if (result.depth > before) await this.popTo(before);
      this.driver.restoreStopReason(reason);
    }
    return result;
  }

  private async evaluateLines(text: string): Promise<QCommandResult> {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    const outputs: string[] = [];
    let result: QCommandResult | undefined;
    for (const line of lines) {
      result = await this.evaluate(line);
      if (result.output.length > 0) outputs.push(result.output);
    }
    return { ...result!, output: outputs.join("\n") };
  }

  private cleanBacktrace(text: string): string {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = HEADER_RE.exec(lines[i]);
      if (!m) continue;
      const [, head, file, lineText] = m;
      let body = m[4];
      const start = head.length + file.length + lineText.length + 3;
      const line = Number(lineText);
      const name = path.basename(file);
      const owner = this.tempStatements.get(name);
      if (owner && this.capturedFiles.has(name)) {
        if (line === owner.startLine && body.startsWith(CAPTURE)) {
          body = body.slice(CAPTURE.length);
          shiftCaret(lines, i, CAPTURE.length, start);
        }
        if (line === owner.endLine && body.endsWith(")")) {
          body = body.slice(0, -1);
        }
      }
      if (owner && body.includes(`(${ANON_PREFIX}`)) {
        const source = this.readSource(this.programPath)?.split("\n");
        const original = source?.[line - 1];
        if (original !== undefined) {
          body =
            line === owner.startLine
              ? original.slice(owner.startColumn)
              : original;
        }
      }
      lines[i] = `${head}${file}:${lineText}: ${body}`;
    }
    return lines.join("\n");
  }

  private async programCounter(): Promise<ProgramCounter | undefined> {
    if (!this.driver?.suspended) return undefined;
    const value = (await this.evaluateJson(".dbg.pc[]")) as
      | number[]
      | undefined;
    if (!value || value.length !== 4 || value[0] < 0) return undefined;
    return {
      index: value[0],
      length: value[1],
      depth: value[2],
      position: value[3],
    };
  }

  private async stepPosition(): Promise<QPosition | undefined> {
    if (!this.driver) return undefined;
    const result = await this.sendForwarded(">");
    return this.driver.suspended
      ? parseCurrentPosition(this.cleanBacktrace(result.output))
      : undefined;
  }

  private async frameUp(): Promise<void> {
    await this.evaluate("`");
  }

  private async frameDown(): Promise<void> {
    await this.evaluate(".");
  }

  private async backtrace(): Promise<string> {
    if (!this.driver) return "";
    const result = await this.driver.sendCommand(".Q.bt[]", false);
    return this.cleanBacktrace(result.output);
  }

  private async frames(): Promise<QFrame[]> {
    return parseBacktrace(await this.backtrace());
  }

  private async position(): Promise<QPosition | undefined> {
    return parseCurrentPosition(await this.backtrace());
  }

  private continueFromBreakpoint(): Promise<QCommandResult> {
    return this.sendForwarded(":");
  }

  private async request<M extends keyof StructureRequests>(
    method: M,
    params: StructureRequests[M][0],
    fallback: StructureRequests[M][1],
  ): Promise<StructureRequests[M][1]> {
    const client = this.getClient();
    if (!client) return fallback;
    try {
      return await client.sendRequest<StructureRequests[M][1]>(method, params);
    } catch {
      return fallback;
    }
  }

  private async lambdaPathAt(
    file: string,
    line1Based: number,
    column?: number,
  ): Promise<
    (QLambdaTarget & { startLine: number; rootLine: number }) | undefined
  > {
    const result = await this.request(
      "kdb.qls.lambdaPath",
      { path: file, line: line1Based - 1, anonymous: true, column },
      null,
    );
    if (!result) return undefined;
    return {
      name: this.resolveName(
        file,
        result.name,
        result.rootLine,
        result.rootColumn,
      ),
      descentPath: result.path,
      startLine: result.startLine + 1,
      rootLine: result.rootLine + 1,
    };
  }

  private resolveName(
    file: string,
    name: string,
    rootLine: number,
    rootColumn: number | undefined,
  ): string {
    if (name !== "" || file !== this.programPath) return name;
    return this.anonAliases.get(anonKey(rootLine + 1, rootColumn ?? 0)) ?? "";
  }

  private async statementLambdas(
    file: string,
    line1Based: number,
    column: number,
  ): Promise<QLambdaTarget[]> {
    const result = await this.request(
      "kdb.qls.statementLambdas",
      { path: file, line: line1Based - 1, column },
      [],
    );
    return result
      .map((target) => ({
        name: this.resolveName(
          file,
          target.name,
          target.rootLine,
          target.rootColumn,
        ),
        descentPath: target.path,
      }))
      .filter((target) => target.name !== "");
  }

  private async rootLambdas(
    file: string,
    startLine1Based: number,
    endLine1Based: number,
  ): Promise<LambdaSpan[]> {
    const result = await this.request(
      "kdb.qls.rootLambdas",
      {
        path: file,
        startLine: startLine1Based - 1,
        endLine: endLine1Based - 1,
      },
      [],
    );
    return result.map((span) => ({
      ...span,
      line: span.line + 1,
      endLine: span.endLine + 1,
    }));
  }

  private async topLevelStatements(file: string): Promise<QStatement[]> {
    const result = await this.request(
      "kdb.qls.topLevelStatements",
      { path: file },
      [],
    );
    return result.map((s) => ({
      startLine: s.startLine + 1,
      startColumn: s.startChar,
      endLine: s.endLine + 1,
      text: s.text,
      namespace: s.namespace,
    }));
  }

  private async statementSeparators(
    file: string,
    line1Based: number,
  ): Promise<StatementSeparator[]> {
    const result = await this.request(
      "kdb.qls.statementSeparators",
      { path: file, line: line1Based - 1 },
      [],
    );
    return result.map((s) => ({ line: s.line + 1, column: s.column }));
  }

  private identifiersOnLines(
    file: string,
    startLine1Based: number,
    endLine1Based: number,
  ): Promise<LineIdentifier[]> {
    return this.request(
      "kdb.qls.identifiersOnLines",
      {
        path: file,
        startLine: startLine1Based - 1,
        endLine: endLine1Based - 1,
      },
      [],
    );
  }
}

export { QDebugSession };
