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

import * as cp from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export const Q_PIPE_ENV = { KX_TTY: "1", KX_LINE: "0" };

export type StopReason = "breakpoint" | "exception";

const PROMPT_RE = /(?:^|\n|(?<=[^\n\w.]))(q([.\w]*)(\)+))[ \t]*$/;

const FIRST_PROMPT_RE = /(?:^|\n|(?<=[^\n\w.]))(q([.\w]*)(\)+))[ \t]*/;

const FRAME_LINE_RE = /^(?:>>|\s\s)\[\d+\]\s/;

function findStopMarker(
  output: string,
): { kind: StopReason; signal?: string } | undefined {
  const lines = output.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (!(line.startsWith("'") || /^#\d+\s*$/.test(line))) continue;
    if (!FRAME_LINE_RE.test(lines[i + 1])) continue;
    return line.startsWith("'")
      ? { kind: "exception", signal: line.slice(1).trimEnd() }
      : { kind: "breakpoint" };
  }
  return undefined;
}

export function stripPrompt(text: string): string {
  const m = PROMPT_RE.exec(text);
  return m ? text.slice(0, m.index) : text;
}

const KILL_ESCALATION_MS = 300;

const PROMPT_TAIL = "(q([.\\w]*)(\\)+))[ \\t]*";

interface Sync {
  entry: QueueEntry;
  output: string;
}

export interface QCommandResult {
  output: string;

  depth: number;

  namespace: string;

  errored: boolean;
}

interface QueueEntry {
  command?: string;

  sent: boolean;
  resolve: (r: QCommandResult) => void;
  reject: (e: Error) => void;

  echo: boolean;

  echoPrompt: boolean;

  onChunk?: (text: string) => void;
}

export class QProcess extends EventEmitter {
  private readonly proc: cp.ChildProcess;

  private readonly grouped = process.platform !== "win32";

  public verbose = false;

  public atLineStart = true;

  private buffer = "";
  private depth = 1;
  private ns = "";
  private exitedFlag = false;
  private lastStop: StopReason | undefined;

  private lastErrorMsg: string | undefined;

  private readonly queue: QueueEntry[] = [];

  private readonly syncToken = `kdbdbg-${randomUUID()}`;
  private readonly syncRe = new RegExp(
    `(?<=^|[\\n)])${this.syncToken}-(\\d+)\\n${PROMPT_TAIL}`,
    "g",
  );
  private syncSeq = 0;
  private typedAhead = false;
  private sync: Sync | undefined;

  public readonly ready: Promise<void>;

  public constructor(
    executable: string,
    args: string[],
    cwd: string | undefined,
    env?: NodeJS.ProcessEnv,
  ) {
    super();
    const inner =
      [executable, ...args].map((s) => this.quote(s)).join(" ") + " 2>&1";

    this.proc = cp.spawn(`exec ${inner}`, {
      cwd,

      env: { ...process.env, ...env, ...Q_PIPE_ENV },
      shell: "bash",
      detached: this.grouped,
    });

    this.proc.on("error", (err) => this.handleSpawnError(err));
    this.proc.on("exit", (code) => this.handleExit(code));

    this.proc.stdin?.on("error", () => undefined);
    this.proc.stdout?.on("data", (data: Buffer) =>
      this.onData(data.toString()),
    );

    this.on("data", (text: string) => {
      if (text.length > 0) this.atLineStart = /[\r\n]$/.test(text);
    });

    this.ready = this.enqueue(undefined, true, true).then(() => undefined);
  }

  public get exited(): boolean {
    return this.exitedFlag;
  }

  public get suspended(): boolean {
    return this.depth >= 2;
  }

  public get busy(): boolean {
    const head = this.queue[0];
    return head?.sent === true;
  }

  public get promptDepth(): number {
    return this.depth;
  }

  public get namespace(): string {
    return this.ns;
  }

  public get prompt(): string {
    return `q${this.ns}${")".repeat(this.depth)}`;
  }

  public get stopReason(): StopReason | undefined {
    return this.suspended ? this.lastStop : undefined;
  }

  public get errorMessage(): string | undefined {
    return this.suspended && this.lastStop === "exception"
      ? this.lastErrorMsg
      : undefined;
  }

  public restoreStopReason(reason: StopReason | undefined): void {
    this.lastStop = reason;
  }

  public sendCommand(
    command: string,
    echo = true,
    echoPrompt = true,
    onChunk?: (text: string) => void,
  ): Promise<QCommandResult> {
    if (this.exitedFlag) {
      return Promise.reject(new Error("q process is not running"));
    }
    return this.enqueue(command, echo, echoPrompt, onChunk);
  }

  public write(text: string): void {
    if (this.busy) this.typedAhead = true;
    this.proc.stdin?.write(text);
  }

  public interrupt(): void {
    this.kill("SIGINT");
  }

  public kill(signal?: NodeJS.Signals): void {
    if (this.exitedFlag) return;
    this.signal(signal ?? "SIGTERM");

    if (signal === undefined) {
      const timer = setTimeout(() => {
        if (!this.exitedFlag) this.signal("SIGKILL");
      }, KILL_ESCALATION_MS);
      timer.unref?.();
    }
  }

  private signal(signal: NodeJS.Signals): void {
    const pid = this.proc.pid;
    if (!this.grouped || pid === undefined) {
      this.proc.kill(signal);
      return;
    }
    try {
      process.kill(-pid, signal);
    } catch {
      this.proc.kill(signal);
    }
  }

  private quote(s: string): string {
    return `'${s.replace(/'/g, "'\\''")}'`;
  }

  private handleSpawnError(error: Error): void {
    this.emit("data", `Failed to start q: ${error.message}\n`);
    this.handleExit(null);
  }

  private handleExit(code: number | null): void {
    if (this.exitedFlag) return;
    this.exitedFlag = true;
    this.sync = undefined;
    const err = new Error("q process exited");
    while (this.queue.length > 0) {
      this.queue.shift()!.reject(err);
    }
    this.emit("exit", code ?? 0);
  }

  private enqueue(
    command: string | undefined,
    echo: boolean,
    echoPrompt: boolean,
    onChunk?: (text: string) => void,
  ): Promise<QCommandResult> {
    return new Promise<QCommandResult>((resolve, reject) => {
      this.queue.push({
        command,
        sent: false,
        resolve,
        reject,
        echo,
        echoPrompt,
        onChunk,
      });
      this.pump();
      this.drain();
    });
  }

  private pump(): void {
    const head = this.queue[0];
    if (!head || head.sent) return;
    head.sent = true;
    if (head.command !== undefined && !this.exitedFlag) {
      this.proc.stdin?.write(head.command + "\n");
    }
  }

  private onData(data: string): void {
    const head = this.queue[0];
    const dataStart = this.buffer.length;
    this.buffer += data;

    if (this.sync) {
      this.scanSync();
      return;
    }

    const m = this.promptRe().exec(this.buffer);
    const upTo = (end: number) => data.slice(0, Math.max(0, end - dataStart));
    const output = upTo(m ? m.index : this.buffer.length);
    const withPrompt =
      m && this.typedAhead ? upTo(m.index + m[0].length) : data;

    if (head?.onChunk) {
      if (output.length > 0) head.onChunk(output);
    } else if (this.verbose || (head?.echo ?? true)) {
      const visible =
        this.verbose || (head?.echoPrompt ?? true) ? withPrompt : output;
      if (visible.length > 0) this.emit("data", visible);
    }
    this.drain();
  }

  private drain(): void {
    for (;;) {
      if (this.sync) return;
      const head = this.queue[0];

      if (!head?.sent) return;
      const m = this.promptRe().exec(this.buffer);
      if (!m) return;

      const raw = this.buffer.slice(0, m.index);
      this.buffer = this.buffer.slice(m.index + m[0].length);

      this.ns = m[2] ?? "";
      this.depth = (m[3] ?? ")").length;

      const output = raw.replace(/^\n+/, "").replace(/\n+$/, "");

      if (this.depth >= 2) {
        const marker = findStopMarker(output);
        const body = output.trimStart();
        if (marker) {
          this.lastStop = marker.kind;
          if (marker.signal !== undefined) this.lastErrorMsg = marker.signal;
        } else if (body.startsWith("#")) this.lastStop = "breakpoint";
        else if (body.startsWith("'")) {
          this.lastStop = "exception";

          this.lastErrorMsg = body.slice(1).split("\n", 1)[0].trimEnd();
        }
      }

      if (this.typedAhead) {
        this.sync = { entry: head, output };
        this.typedAhead = false;
        this.sendMarker();
        this.scanSync();
        return;
      }

      this.queue.shift();
      this.settle(head, output);
    }
  }

  private promptRe(): RegExp {
    return this.typedAhead ? FIRST_PROMPT_RE : PROMPT_RE;
  }

  private settle(entry: QueueEntry, output: string): void {
    entry.resolve({
      output,
      depth: this.depth,
      namespace: this.ns,
      errored: output.trimStart().startsWith("'"),
    });
    this.pump();
  }

  private sendMarker(): void {
    this.syncSeq++;
    this.proc.stdin?.write(`-1 "${this.syncToken}-${this.syncSeq}";\n`);
  }

  private scanSync(): void {
    const sync = this.sync;
    if (!sync) return;
    const buffer = this.buffer;
    let visible = "";
    let last = 0;
    let latest = false;
    this.syncRe.lastIndex = 0;
    for (let m = this.syncRe.exec(buffer); m; m = this.syncRe.exec(buffer)) {
      visible += buffer.slice(last, m.index);
      last = m.index + m[0].length;
      this.ns = m[3] ?? "";
      this.depth = (m[4] ?? ")").length;
      latest = Number(m[1]) === this.syncSeq && last === buffer.length;
    }
    const rest = buffer.slice(last);
    const hold = this.partialMarker(rest);
    const tail = rest.slice(0, hold);
    visible += tail;
    this.buffer = rest.slice(hold);

    if (visible.length > 0) this.emit("data", visible);

    if (latest) {
      if (this.typedAhead) {
        this.typedAhead = false;
        this.sendMarker();
        return;
      }
      this.sync = undefined;
      this.queue.shift();
      this.settle(sync.entry, sync.output);
      this.drain();
      return;
    }

    const prompt = PROMPT_RE.exec(tail);
    if (prompt && this.buffer.length === 0) {
      this.ns = prompt[2] ?? "";
      this.depth = (prompt[3] ?? ")").length;
      this.typedAhead = false;
      this.sendMarker();
    }
  }

  private partialMarker(text: string): number {
    const token = `${this.syncToken}-`;
    const shape = new RegExp(`^${token}\\d*(\\n(q[.\\w]*\\)*)?)?$`);
    for (let i = 0; i < text.length; i++) {
      if (i > 0 && text[i - 1] !== "\n" && text[i - 1] !== ")") continue;
      const tail = text.slice(i);
      if (token.startsWith(tail) || shape.test(tail)) return i;
    }
    return text.length;
  }
}
