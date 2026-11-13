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

import * as vscode from "vscode";

import { QProcess } from "./qProcess";
import { QNotFoundError } from "../classes/replConnection";
import { showSetupError } from "../commands/setupCommand";
import { getEnvironment } from "../utils/core";
import { moduleSearchPath } from "../utils/replPath";

const ENTER = "\r";
const BACKSPACE = "\x7f";
const CTRL_C = "\x03";
const ESC = "\x1b";

export interface DebugTerminal {
  process: QProcess;
  terminal: vscode.Terminal;
  ready: Promise<void>;
  cwd: string;
  executable: string;
}

class DebugPty implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<number>();
  public readonly onDidWrite = this.writeEmitter.event;
  public readonly onDidClose = this.closeEmitter.event;

  private lineBuffer = "";
  private opened = false;
  private backlog: string[] = [];
  private prevCharWasCR = false;

  public constructor(private readonly qProcess: QProcess) {
    this.qProcess.on("data", (text: string) => this.handleOutput(text));
    this.qProcess.on("exit", (code: number | null) =>
      this.closeEmitter.fire(code ?? 0),
    );
  }

  private handleOutput(text: string): void {
    if (this.opened) {
      this.writeOutput(text);
    } else {
      this.backlog.push(text);
    }
  }

  public open(): void {
    this.opened = true;
    for (const text of this.backlog) this.writeOutput(text);
    this.backlog = [];
  }

  public close(): void {
    this.qProcess.kill();
  }

  public handleInput(data: string): void {
    if (this.qProcess.exited) return;

    if (data === CTRL_C) {
      this.qProcess.interrupt();
      return;
    }

    if (data.startsWith(ESC)) return;

    for (const ch of data) {
      if (ch === "\n" && this.prevCharWasCR) {
        this.prevCharWasCR = false;
        continue;
      }
      this.prevCharWasCR = ch === ENTER;

      if (ch === ENTER || ch === "\n") {
        this.writeOutput("\r\n");
        if (this.qProcess.busy) {
          this.qProcess.write(this.lineBuffer + "\n");
        } else {
          void this.qProcess
            .sendCommand(this.lineBuffer)
            .catch(() => undefined);
        }
        this.lineBuffer = "";
      } else if (ch === BACKSPACE) {
        if (this.lineBuffer.length > 0) {
          this.lineBuffer = this.lineBuffer.slice(0, -1);
          this.writeOutput("\b \b");
        }
      } else {
        this.lineBuffer += ch;
        this.writeOutput(ch);
      }
    }
  }

  private writeOutput(text: string): void {
    this.writeEmitter.fire(text.replace(/(?<!\r)\n/g, "\r\n"));
  }
}

let current: DebugTerminal | undefined;

function debugEnvironment(cwd: string) {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(cwd));
  const { qBinPath, qBinKdbX, ...env } = getEnvironment(folder);
  if (qBinKdbX) {
    env.QPATH = moduleSearchPath(cwd, env.QPATH, env.QHOME);
  }
  return { qBinPath, env, folder };
}

export function getOrCreateDebugTerminal(
  cwd: string,
  qExecutable?: string,
): DebugTerminal {
  const { qBinPath, env, folder } = debugEnvironment(cwd);
  const executable = qExecutable || qBinPath;
  if (!executable) {
    void showSetupError(folder);
    throw new QNotFoundError("no q was found.");
  }

  if (
    current &&
    !current.process.exited &&
    current.cwd === cwd &&
    current.executable === executable
  ) {
    return current;
  }
  current?.process.kill();

  const qProcess = new QProcess(executable, [], cwd, env);
  const terminal = vscode.window.createTerminal({
    name: "q Debug",
    pty: new DebugPty(qProcess),
    isTransient: true,
  });
  const session: DebugTerminal = {
    process: qProcess,
    terminal,
    ready: qProcess.ready,
    cwd,
    executable,
  };
  current = session;
  qProcess.on("exit", () => {
    if (current === session) current = undefined;
  });
  return session;
}

export function killDebugTerminal(): void {
  current?.process.kill();
  current = undefined;
}
