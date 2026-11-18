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

import * as assert from "assert";
import { readFile } from "fs/promises";
import { join } from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

import { Structure } from "../../../server/src/structure";
import { QDebugSession } from "../../../src/debugger/debugSession";
import { getEnvironment } from "../../../src/utils/core";

export const FIXTURES = join(
  __dirname,
  "../../../../test/suite/server/fixtures/debugger",
);

export const DEBUG_HELPER_SCRIPT = join(
  __dirname,
  "../../../../resources/q/debug.q",
);

export function fixture(...parts: string[]): string {
  return join(FIXTURES, ...parts);
}

export function qAvailable(): boolean {
  try {
    return !!getEnvironment().qBinPath;
  } catch {
    return false;
  }
}

export function assertContains<T>(list: T[], expected: Partial<T>): void {
  assert.ok(
    list.some((item) =>
      Object.entries(expected).every(
        ([key, value]) => (item as Record<string, unknown>)[key] === value,
      ),
    ),
    `expected ${JSON.stringify(list)} to contain ${JSON.stringify(expected)}`,
  );
}

async function structureOf(path: string): Promise<Structure | undefined> {
  try {
    return new Structure(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

export function fakeLanguageClient(): LanguageClient {
  return {
    async sendRequest(method: string, params: any) {
      const structure = await structureOf(params.path);
      switch (method) {
        case "kdb.qls.topLevelStatements":
          return structure?.topLevelStatements() ?? [];
        case "kdb.qls.lambdaPath":
          return (
            structure?.lambdaPath(
              params.line,
              params.anonymous === true,
              params.column,
            ) ?? null
          );
        case "kdb.qls.statementLambdas":
          return structure?.statementLambdas(params.line, params.column) ?? [];
        case "kdb.qls.rootLambdas":
          return structure?.rootLambdas(params.startLine, params.endLine) ?? [];
        case "kdb.qls.statementSeparators":
          return structure?.statementSeparators(params.line) ?? [];
        case "kdb.qls.identifiersOnLines":
          return (
            structure?.identifiersOnLines(params.startLine, params.endLine) ??
            []
          );
        default:
          throw new Error(`unexpected request ${method}`);
      }
    },
  } as unknown as LanguageClient;
}

export class TerminalRecorder {
  private readonly outputs = new Map<vscode.Terminal, { text: string }>();
  private readonly ptys = new Map<vscode.Terminal, vscode.Pseudoterminal>();
  private last: vscode.Terminal | undefined;
  private stub: sinon.SinonStub | undefined;

  public install(): void {
    const original = vscode.window.createTerminal.bind(vscode.window);
    this.stub = sinon
      .stub(vscode.window, "createTerminal")
      .callsFake((options: any) => {
        const pty: vscode.Pseudoterminal | undefined = options?.pty;
        const output = { text: "" };
        pty?.onDidWrite((data) => {
          output.text += data;
        });
        const terminal = original(options);
        this.outputs.set(terminal, output);
        if (pty) this.ptys.set(terminal, pty);
        this.last = terminal;
        return terminal;
      });
  }

  public restore(): void {
    this.stub?.restore();
    this.stub = undefined;
    for (const terminal of this.outputs.keys()) terminal.dispose();
    this.outputs.clear();
    this.ptys.clear();
    this.last = undefined;
  }

  public get latest(): vscode.Terminal | undefined {
    return this.last;
  }

  public outputOf(terminal: vscode.Terminal | undefined): string {
    return (terminal && this.outputs.get(terminal)?.text) ?? "";
  }

  public ptyOf(
    terminal: vscode.Terminal | undefined,
  ): vscode.Pseudoterminal | undefined {
    return terminal ? this.ptys.get(terminal) : undefined;
  }

  public async waitFor(
    substring: string,
    terminal?: vscode.Terminal,
    timeoutMs = 10000,
  ): Promise<string> {
    const start = Date.now();
    for (;;) {
      const out = this.outputOf(terminal ?? this.last);
      if (out.includes(substring)) return out;
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          `timed out waiting for terminal output to include ${JSON.stringify(
            substring,
          )}; got ${JSON.stringify(out)}`,
        );
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
}

export class DapClient {
  private nextSeq = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly consumed = new Map<string, number>();
  public readonly events: Array<{ event: string; body: unknown }> = [];

  private constructor(private readonly session: QDebugSession) {
    session.onDidSendMessage((message: unknown) => this.handleMessage(message));
  }

  public static start(): DapClient {
    return new DapClient(
      new QDebugSession(() => fakeLanguageClient(), DEBUG_HELPER_SCRIPT),
    );
  }

  private handleMessage(message: any): void {
    if (message.type === "response") {
      const pending = this.pending.get(message.request_seq);
      if (!pending) return;
      this.pending.delete(message.request_seq);
      if (message.success) {
        pending.resolve(message.body);
      } else {
        pending.reject(new Error(message.message ?? "request failed"));
      }
    } else if (message.type === "event") {
      this.events.push({ event: message.event, body: message.body });
    }
  }

  public request<T = unknown>(command: string, args?: unknown): Promise<T> {
    const seq = this.nextSeq++;
    const message = { seq, type: "request", command, arguments: args };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(seq, {
        resolve: resolve as (result: unknown) => void,
        reject,
      });
      this.session.handleMessage(message as never);
    });
  }

  public async waitForEvent(event: string, timeoutMs = 10000): Promise<any> {
    const seen = this.consumed.get(event) ?? 0;
    const matching = () => this.events.filter((e) => e.event === event);
    const existing = matching()[seen];
    if (existing) {
      this.consumed.set(event, seen + 1);
      return existing.body;
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`timed out waiting for "${event}" event`)),
        timeoutMs,
      );
      const check = () => {
        const found = matching()[seen];
        if (found) {
          clearTimeout(timeout);
          this.consumed.set(event, seen + 1);
          resolve(found.body);
        } else {
          setTimeout(check, 25);
        }
      };
      check();
    });
  }

  public close(): void {
    this.session.dispose();
  }
}
