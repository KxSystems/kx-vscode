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

import {
  getAutoFocusOutputOnEntrySetting,
  getConnShortName,
} from "../utils/core";

const ANSI = {
  CRLF: "\r\n",
  CLEAR: "\x1b[2J\x1b[3J\x1b[H",
  FAINTON: "\x1b[2m",
  FAINTOFF: "\x1b[22m",
  BOLDON: "\x1b[1m",
  BOLDOFF: "\x1b[22m",
};

const KEY = {
  CTRLL: "\x0c",
};

/**
 * Marker phrase written into the console as a clickable link. A
 * TerminalLinkProvider (see extension.ts) matches this text and opens the KDB
 * Results view — terminals do not allow `command:` hyperlinks directly.
 */
export const OPEN_RESULTS_HINT = "kdb Results View";

/**
 * An output-only pseudoterminal shown in the bottom-panel terminal list, one
 * per connected connection. Unlike {@link ReplConnection} it has no child
 * process, no input line, and no prompt/history — query results are pushed to
 * it via {@link append}/{@link appendLine}. It exposes {@link terminal} and
 * {@link exited} so the shared active-target tracker can treat it and REPL
 * terminals as one pool.
 */
export class ConnectionConsole {
  private readonly onDidWrite = new vscode.EventEmitter<string>();
  private readonly pty: vscode.Terminal;

  // Buffers output produced before the terminal is opened by VS Code; flushed
  // in open() and then left undefined so writes go straight to the emitter.
  private buffer?: string[] = [];
  private _exited = false;
  // True while we are tearing the console down programmatically (dispose), so
  // the pty close handler can tell a user-initiated close apart from our own.
  private disposing = false;

  /**
   * @param connLabel  the owning connection's label.
   * @param onClose    invoked when the user closes the terminal from the UI
   *                   (not when we dispose it ourselves) — used to disconnect.
   */
  constructor(
    readonly connLabel: string,
    private readonly onClose?: () => void,
  ) {
    this.pty = vscode.window.createTerminal({
      name: `KX ${getConnShortName(connLabel)}`,
      iconPath: new vscode.ThemeIcon("database"),
      isTransient: true,
      pty: {
        onDidWrite: this.onDidWrite.event,
        open: this.open.bind(this),
        close: this.close.bind(this),
        setDimensions: () => {},
        handleInput: this.handleInput.bind(this),
      },
    });
  }

  get terminal(): vscode.Terminal {
    return this.pty;
  }

  get exited(): boolean {
    return this._exited;
  }

  private normalize(text: string): string {
    return text.replace(/(?:\r\n|[\r\n])/gs, ANSI.CRLF);
  }

  private send(data: string): void {
    if (this.buffer) {
      this.buffer.push(data);
    } else {
      this.onDidWrite.fire(data);
    }
  }

  private open(): void {
    // Banner identifying which connection this output console belongs to.
    this.onDidWrite.fire(
      ANSI.BOLDON +
        `KX ${getConnShortName(this.connLabel)}` +
        ANSI.BOLDOFF +
        ANSI.CRLF +
        ANSI.CRLF,
    );
    this.buffer?.forEach((data) => this.onDidWrite.fire(data));
    this.buffer = undefined;
  }

  private close(): void {
    this._exited = true;
    this.onDidWrite.dispose();
    // Closing the terminal from the UI disconnects the connection; when we are
    // the ones disposing it (disconnect flow) the flag suppresses the callback.
    if (!this.disposing) {
      this.onClose?.();
    }
  }

  // Output-only: the only accepted key is Ctrl+L to clear the screen.
  private handleInput(data: string): void {
    if (data === KEY.CTRLL) {
      this.send(ANSI.CLEAR);
    }
  }

  append(text: string): void {
    this.send(this.normalize(text));
  }

  appendLine(text = ""): void {
    this.send(this.normalize(text) + ANSI.CRLF);
  }

  clear(): void {
    this.send(ANSI.CLEAR);
  }

  /**
   * Appends a faint pointer telling the user the query results went to the KDB
   * Results (grid) view, ending in a clickable phrase that opens it. Printed on
   * the result-write path when the global "show in view" toggle is on.
   */
  appendResultsPointer(): void {
    this.send(
      ANSI.FAINTON +
        "Query results are shown in " +
        ANSI.FAINTOFF +
        OPEN_RESULTS_HINT +
        " ↗" +
        ANSI.CRLF,
    );
  }

  /** Reveal (and focus) the console — used on connect so it becomes active. */
  reveal(): void {
    this.pty.show(false);
  }

  /** Reveal without stealing focus, honouring the auto-focus-on-entry setting. */
  show(): void {
    if (getAutoFocusOutputOnEntrySetting()) {
      this.pty.show(true);
    }
  }

  dispose(): void {
    this._exited = true;
    this.disposing = true;
    this.pty.dispose();
  }
}
