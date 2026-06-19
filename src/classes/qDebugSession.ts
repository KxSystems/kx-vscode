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
  Breakpoint,
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
import { readFileSync, writeFileSync } from "fs";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { createInterface } from "node:readline";

import { instrumentQSource } from "./qInstrumenter";
import { getEnvironment } from "../utils/core";

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  qBinPath?: string;
  stopOnEntry?: boolean;
}

interface QDebugEvent {
  event: string;
  [key: string]: unknown;
}

const THREAD_ID = 1;
const LOCALS_REF = 1;
const GLOBALS_REF = 2;

export class QDebugSession extends LoggingDebugSession {
  private process?: ChildProcessWithoutNullStreams;
  private ready = false;
  private launched = false;

  private breakpoints = new Map<string, number[]>();
  private pausedFile = "";
  private pausedLine = 0;
  private pendingProgram: string | undefined;
  private configDone = false;

  private readonly tmpDir = tmpdir();
  private readonly shimPath: string;

  private readonly pendingResponses = new Map<
    string,
    ((msg: QDebugEvent) => void)[]
  >();

  constructor(extensionPath: string) {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(false);
    this.shimPath = join(extensionPath, "resources", "q", "debug.q");
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
  ): void {
    response.body = {
      supportsConfigurationDoneRequest: true,
      supportsEvaluateForHovers: true,
      supportsSingleThreadExecutionRequests: false,
    };
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: LaunchRequestArguments,
  ): void {
    const program = args.program;

    const env = getEnvironment();
    const qBin = args.qBinPath || env.qBinPath || "q";

    this.process = spawn(qBin, [this.shimPath, "-q"], {
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.process.stderr.on("data", (data: Buffer) => {
      this.sendEvent(new OutputEvent(data.toString(), "stderr"));
    });

    this.process.on("exit", () => {
      if (this.launched) {
        this.sendEvent(new TerminatedEvent());
      }
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on("line", (line) => this.handleQLine(line));

    this.pendingProgram = program;
    this.sendResponse(response);
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): void {
    this.sendResponse(response);
    this.configDone = true;
    this.tryLaunchQ();
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    const filePath = args.source.path ?? "";
    const requestedLines = (args.breakpoints ?? []).map((b) => b.line);

    this.breakpoints.set(filePath, requestedLines);

    if (this.ready) {
      this.sendBreakpointsForFile(filePath, requestedLines);
    }

    response.body = {
      breakpoints: requestedLines.map(
        (line) =>
          new Breakpoint(
            true,
            line,
            undefined,
            new Source(basename(filePath), filePath),
          ),
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
    _args: DebugProtocol.StackTraceArguments,
  ): void {
    this.sendToQ({ cmd: "stackTrace" });

    this.waitForResponse("q:stackTrace").then((_msg) => {
      const frame = new StackFrame(
        0,
        this.pausedFile ? basename(this.pausedFile) : "q",
        new Source(
          this.pausedFile ? basename(this.pausedFile) : "",
          this.pausedFile,
        ),
        this.pausedLine,
      );
      response.body = { stackFrames: [frame], totalFrames: 1 };
      this.sendResponse(response);
    });
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    _args: DebugProtocol.ScopesArguments,
  ): void {
    response.body = {
      scopes: [
        new Scope("Locals", LOCALS_REF, false),
        new Scope("Globals", GLOBALS_REF, true),
      ],
    };
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): void {
    this.sendToQ({ cmd: "variables" });

    this.waitForResponse("q:variables").then((msg) => {
      const isLocals = args.variablesReference === LOCALS_REF;
      const dict = isLocals
        ? (msg.locals as Record<string, string>)
        : (msg.globals as Record<string, string>);

      response.body = {
        variables: Object.entries(dict ?? {}).map(
          ([name, value]) => new Variable(name, String(value)),
        ),
      };
      this.sendResponse(response);
    });
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    _args: DebugProtocol.ContinueArguments,
  ): void {
    response.body = { allThreadsContinued: true };
    this.sendResponse(response);
    this.sendToQ({ cmd: "continue" });
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    _args: DebugProtocol.NextArguments,
  ): void {
    this.sendResponse(response);
    this.sendToQ({ cmd: "stepOver" });
  }

  protected evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ): void {
    this.sendToQ({ cmd: "evaluate", expression: args.expression });

    this.waitForResponse("q:evaluate").then((msg) => {
      response.body = {
        result: String(msg.result ?? ""),
        variablesReference: 0,
      };
      this.sendResponse(response);
    });
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): void {
    this.process?.kill();
    this.sendResponse(response);
  }

  // ---- Internal ----

  private sendToQ(cmd: object): void {
    const line = JSON.stringify(cmd) + "\n";
    this.process?.stdin.write(line);
  }

  private handleQLine(line: string): void {
    if (line.startsWith("__DBG__:")) {
      try {
        const msg = JSON.parse(line.slice(8)) as QDebugEvent;
        this.handleQEvent(msg);
      } catch {
        this.sendEvent(new OutputEvent(line + "\n", "stdout"));
      }
    } else {
      this.sendEvent(new OutputEvent(line + "\n", "stdout"));
    }
  }

  private handleQEvent(msg: QDebugEvent): void {
    switch (msg.event) {
      case "ready":
        this.ready = true;
        this.emit("q:ready");
        this.tryLaunchQ();
        break;

      case "stopped":
        this.pausedFile = String(msg.file ?? "");
        this.pausedLine = Number(msg.line ?? 0);
        this.sendEvent(
          new StoppedEvent(String(msg.reason ?? "breakpoint"), THREAD_ID),
        );
        break;

      case "terminated":
        this.launched = false;
        this.sendEvent(new TerminatedEvent());
        break;

      case "variables":
        this.resolveResponse("q:variables", msg);
        break;

      case "stackTrace":
        this.resolveResponse("q:stackTrace", msg);
        break;

      case "evaluate":
        this.resolveResponse("q:evaluate", msg);
        break;

      case "setBreakpointsResponse":
        this.resolveResponse("q:setBreakpointsResponse", msg);
        break;

      case "runtimeError":
        this.sendEvent(new OutputEvent(String(msg.msg ?? ""), "stderr"));
        break;

      case "log":
        this.sendEvent(
          new OutputEvent(String(msg.msg ?? "") + "\n", "console"),
        );
        break;

      case "launched":
        this.sendEvent(new OutputEvent(`Launched: ${msg.data}\n`, "console"));
        break;
    }
  }

  private waitForResponse(eventName: string): Promise<QDebugEvent> {
    return new Promise<QDebugEvent>((resolve) => {
      const queue = this.pendingResponses.get(eventName) ?? [];
      queue.push(resolve);
      this.pendingResponses.set(eventName, queue);
    });
  }

  private resolveResponse(eventName: string, msg: QDebugEvent): void {
    const resolver = this.pendingResponses.get(eventName)?.shift();
    resolver?.(msg);
  }

  private tryLaunchQ(): void {
    if (!this.pendingProgram || !this.ready || !this.configDone) return;
    const program = this.pendingProgram;
    this.pendingProgram = undefined;
    this.sendBreakpointsToQ();
    const instrumented = this.instrumentAndWriteTemp(program);
    this.sendToQ({ cmd: "launch", file: instrumented });
    this.launched = true;
  }

  private sendBreakpointsToQ(): void {
    for (const [file, lines] of this.breakpoints.entries()) {
      this.sendBreakpointsForFile(file, lines);
    }
  }

  private sendBreakpointsForFile(file: string, lines: number[]): void {
    // Use the original path — the instrumented .debug.bp calls reference it.
    this.sendToQ({ cmd: "setBreakpoints", file, lines });
  }

  private instrumentedPathFor(originalPath: string): string {
    return join(this.tmpDir, `kx_debug_${basename(originalPath)}`);
  }

  private instrumentAndWriteTemp(originalPath: string): string {
    const source = readFileSync(originalPath, "utf-8");
    const tempPath = this.instrumentedPathFor(originalPath);
    const instrumented = instrumentQSource(source, originalPath);
    writeFileSync(tempPath, instrumented, "utf-8");
    return tempPath;
  }
}
