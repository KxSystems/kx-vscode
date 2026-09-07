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

import { getConnShortName } from "../utils/core";

const ANSI = {
  CRLF: "\r\n",
  CLEAR: "\x1b[2J\x1b[3J\x1b[H",
  SAVE_CURSOR: "\x1b7",
  RESTORE_CURSOR: "\x1b8",
  TO_RIGHT_MARGIN: "\x1b[999C",
  REPORT_CURSOR: "\x1b[6n",
  FAINT_ON: "\x1b[2m",
  FAINT_OFF: "\x1b[22m",
  BOLD_ON: "\x1b[1m",
  BOLD_OFF: "\x1b[22m",
};

const KEY = {
  CTRL_L: "\x0c",
};

/**
 * Marker phrase written into the console as a clickable link. A
 * TerminalLinkProvider (see extension.ts) matches this text and opens the KDB
 * Results view — terminals do not allow `command:` hyperlinks directly.
 */
export const OPEN_RESULTS_HINT = "kdb Results View";

// The widest a q process renders its console to, and so the widest a result
// can arrive.
const MAX_COLUMNS = 2000;

const CUT = "..";

const WIDTH_QUERY =
  ANSI.SAVE_CURSOR +
  ANSI.TO_RIGHT_MARGIN +
  ANSI.REPORT_CURSOR +
  ANSI.RESTORE_CURSOR;

const CURSOR_POSITION = /\[\d+;(\d+)R/;

const SIZE_TO_CONTENT = "workbench.action.terminal.sizeToContentWidth";

const LAYOUT_TIMEOUT = 1000;

// A terminal's dimensions as a value that can be compared. VS Code reports a
// placeholder size (80x30) before the panel has laid the terminal out, so the
// first report carrying anything else is the layout it can be sized against.
const layout = (dimensions?: vscode.TerminalDimensions): string =>
  dimensions ? `${dimensions.columns}x${dimensions.rows}` : "";

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

  // Buffers output produced before the console has been sized; flushed in
  // begin() and then left undefined so writes go straight to the emitter.
  private buffer?: { text: string; fit: boolean }[] = [];
  private _exited = false;
  // The size the terminal was opened with, whether the report echoing it has
  // arrived, and whether the one sizing has been started — see {@link resize}.
  private opened = "";
  private echoed = false;
  private sizing = false;
  private waiting?: NodeJS.Timeout;
  private _columns = 0;
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
        setDimensions: this.resize.bind(this),
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

  private fit(text: string): string {
    const width = this._columns;
    if (!width) {
      return text;
    }
    return text
      .split(ANSI.CRLF)
      .map((line) =>
        line.length <= width
          ? line
          : line.slice(0, Math.max(0, width - CUT.length)) + CUT,
      )
      .join(ANSI.CRLF);
  }

  private send(data: string, fit = false): void {
    if (this.buffer) {
      this.buffer.push({ text: data, fit });
    } else {
      this.onDidWrite.fire(fit ? this.fit(data) + WIDTH_QUERY : data);
    }
  }

  /**
   * Writes a blank line {@link MAX_COLUMNS} wide as the console opens, wide
   * enough for any result a q process can render. Nothing is shown in the
   * console until it has been sized.
   */
  private open(dimensions?: vscode.TerminalDimensions): void {
    this.opened = layout(dimensions);
    this.onDidWrite.fire(" ".repeat(MAX_COLUMNS) + ANSI.CRLF);
    this.waiting = setTimeout(() => this.start(), LAYOUT_TIMEOUT);
  }

  /**
   * Sizes the console to the wide line, once, as soon as the panel reports the
   * layout it has given the terminal — the moment the line can be measured.
   * The first report only echoes the size {@link open} was given, the terminal
   * as it was before the panel laid it out, and sizing against that has no
   * effect; the report after it is the layout.
   */
  private resize(dimensions: vscode.TerminalDimensions): void {
    if (this.sizing || this._exited) {
      return;
    }
    if (!this.echoed && layout(dimensions) === this.opened) {
      this.echoed = true;
      return;
    }
    this.start();
  }

  private start(): void {
    if (this.sizing || this._exited) {
      return;
    }
    this.sizing = true;
    clearTimeout(this.waiting);
    this.waiting = undefined;
    void this.size();
  }

  /**
   * Runs the sizing and then starts the console. `sizeToContentWidth` sizes
   * whichever terminal is active. The screen is cleared only once the sizing
   * is done, the wide line being what it measures.
   */
  private async size(): Promise<void> {
    try {
      if (vscode.window.activeTerminal === this.pty) {
        await vscode.commands.executeCommand(SIZE_TO_CONTENT);
      }
    } finally {
      this.begin();
    }
  }

  // Clears the screen the wide line was written to and identifies the
  // connection it belongs to, then releases everything held back until now.
  private begin(): void {
    if (this._exited) {
      return;
    }
    this.onDidWrite.fire(
      ANSI.CLEAR +
        ANSI.BOLD_ON +
        `KX ${getConnShortName(this.connLabel)}` +
        ANSI.BOLD_OFF +
        ANSI.CRLF +
        ANSI.CRLF,
    );
    this.buffer?.forEach(({ text, fit }) =>
      this.onDidWrite.fire(fit ? this.fit(text) + WIDTH_QUERY : text),
    );
    this.buffer = undefined;
    this.measure();
  }

  private measure(): void {
    if (!this._exited) {
      this.onDidWrite.fire(WIDTH_QUERY);
    }
  }

  private close(): void {
    this._exited = true;
    clearTimeout(this.waiting);
    this.waiting = undefined;
    this.onDidWrite.dispose();
    // Closing the terminal from the UI disconnects the connection; when we are
    // the ones disposing it (disconnect flow) the flag suppresses the callback.
    if (!this.disposing) {
      this.onClose?.();
    }
  }

  // Output-only: the only accepted key is Ctrl+L to clear the screen.
  private handleInput(data: string): void {
    const position = CURSOR_POSITION.exec(data);
    if (position) {
      this._columns = parseInt(position[1], 10);
    } else if (data === KEY.CTRL_L) {
      this.send(ANSI.CLEAR);
    }
  }

  /**
   * Writes text with no line of its own. Nothing outside the console uses it.
   */
  append(text: string): void {
    this.send(this.normalize(text));
  }

  appendLine(text = ""): void {
    this.write(text);
  }

  /** Writes the lines of a result. */
  appendResult(lines: string[]): void {
    this.send(this.normalize(lines.join("\n")) + ANSI.CRLF, true);
  }

  /** Writes whole rows, each on a line of its own. */
  private write(text: string): void {
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
      ANSI.FAINT_ON +
        "Query results are shown in " +
        ANSI.FAINT_OFF +
        OPEN_RESULTS_HINT +
        " ↗" +
        ANSI.CRLF,
    );
  }

  /**
   * Reveal the console without taking the caret — used on connect. The active
   * target is set by the connect flow itself, so the console does not need
   * focus to become the target unassigned files run on.
   */
  reveal(): void {
    this.pty.show(true);
  }

  dispose(): void {
    this._exited = true;
    this.disposing = true;
    clearTimeout(this.waiting);
    this.waiting = undefined;
    this.pty.dispose();
  }
}
