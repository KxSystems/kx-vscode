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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ConnectionConsole } from "../../../src/classes/connectionConsole";

const MAX_COLUMNS = 2000;
const CLEAR = "\x1b[2J\x1b[3J\x1b[H";
const FIT_COMMAND = "workbench.action.terminal.sizeToContentWidth";
// The size a pty is opened with, echoed back in the first report, and the
// layout the panel reports once it has laid the terminal out.
const OPENED = { columns: 80, rows: 30 };
const PANEL = { columns: 116, rows: 14 };

describe("ConnectionConsole", () => {
  let written: string[];
  let pty: vscode.Pseudoterminal;
  let revealed: boolean[];
  let executed: string[];

  beforeEach(() => {
    written = [];
    revealed = [];
    executed = [];
    sinon.stub(vscode.window, "createTerminal").callsFake((options: any) => {
      pty = options.pty;
      return <vscode.Terminal>(<any>{
        show(preserveFocus?: boolean) {
          revealed.push(!!preserveFocus);
        },
        dispose() {},
      });
    });
    sinon
      .stub(vscode.commands, "executeCommand")
      .callsFake((command: string) => {
        executed.push(command);
        return <any>Promise.resolve(undefined);
      });
  });

  afterEach(() => {
    sinon.restore();
  });

  // A console VS Code has not opened yet, for what it holds back to be watched.
  function create() {
    const console = new ConnectionConsole("connection");
    (<any>pty).onDidWrite((data: string) => written.push(data));
    return console;
  }

  // Opened, as VS Code opens a pty: with the size it reports before laying the
  // terminal out. Nothing is shown in the console yet.
  function open() {
    const console = create();
    pty.open(OPENED);
    return console;
  }

  // A report from the panel. The first echoes the size the pty was opened with;
  // the one after it is the layout, which sizes the console and starts it.
  async function report(dimensions = PANEL) {
    pty.setDimensions?.(dimensions);
    await new Promise((resolve) => globalThis.setImmediate(resolve));
  }

  // The reports a console gets in the common case: the echo, then the layout.
  async function layout(dimensions = PANEL) {
    await report(OPENED);
    await report(dimensions);
  }

  // A console sized and started, as it is for the rest of its life.
  async function started() {
    const console = open();
    await layout();
    written.length = 0;
    revealed.length = 0;
    executed.length = 0;
    return console;
  }

  function payload() {
    return written.join("");
  }

  it("should write the lines of a result as they are", async () => {
    const console = await started();
    console.appendResult(["a  b  ", "------", "1  2  "]);
    assert.strictEqual(payload(), "a  b  \r\n------\r\n1  2  \r\n");
  });

  it("should write a result in one write, not one per line", async () => {
    const console = await started();
    console.appendResult(["a  b  ", "------", "1  2  "]);
    assert.strictEqual(written.length, 1);
  });

  it("should write a line as wide as a result can be when it opens", () => {
    open();
    assert.ok(
      payload().startsWith(" ".repeat(MAX_COLUMNS) + "\r\n"),
      `the console did not write the wide line:\n${JSON.stringify(payload().slice(0, 40))}`,
    );
  });

  it("should reveal itself when it opens so the panel lays it out", () => {
    open();
    assert.deepStrictEqual(revealed, [true]);
  });

  it("should not size itself before the panel reports a layout", () => {
    open();
    assert.deepStrictEqual(executed, []);
    assert.ok(
      !payload().includes(CLEAR),
      `the console started before it was sized:\n${JSON.stringify(payload())}`,
    );
  });

  it("should not size itself against the size it was opened with", async () => {
    open();
    await report(OPENED);
    assert.deepStrictEqual(executed, []);
  });

  it("should size itself on the layout report, echo or no echo", async () => {
    open();
    await report({ columns: 116, rows: 14 });
    assert.deepStrictEqual(executed, [FIT_COMMAND]);
  });

  // A console opened into a panel that is already laid out is reported the
  // same size twice: the echo, then the layout.
  it("should size itself when the layout repeats the opened size", async () => {
    open();
    await report(OPENED);
    await report(OPENED);
    assert.deepStrictEqual(executed, [FIT_COMMAND]);
  });

  it("should size itself once the panel reports a layout", async () => {
    open();
    await layout();
    assert.deepStrictEqual(executed, [FIT_COMMAND]);
  });

  it("should size itself once, however many reports follow", async () => {
    open();
    await layout();
    await report({ columns: 200, rows: 20 });
    await report({ columns: 90, rows: 12 });
    assert.deepStrictEqual(executed, [FIT_COMMAND]);
  });

  // The command sizes whichever terminal is active, so the console has to
  // claim that before running it.
  it("should claim the active terminal for the sizing", async () => {
    open();
    revealed.length = 0;
    await layout();
    assert.deepStrictEqual(revealed, [true]);
  });

  it("should clear the line it was sized from, once it is sized", async () => {
    open();
    await layout();
    const shownAfterClear = payload().slice(payload().indexOf(CLEAR));
    assert.ok(
      !shownAfterClear.includes(" ".repeat(MAX_COLUMNS)),
      `the line was left on screen:\n${JSON.stringify(shownAfterClear)}`,
    );
    assert.ok(shownAfterClear.includes("KX connection"));
  });

  it("should clear the screen only after the sizing, never before", async () => {
    open();
    let clearedBeforeSizing = false;
    (<any>vscode.commands.executeCommand).callsFake((command: string) => {
      executed.push(command);
      clearedBeforeSizing = payload().includes(CLEAR);
      return <any>Promise.resolve(undefined);
    });
    await layout();
    assert.strictEqual(
      clearedBeforeSizing,
      false,
      "the wide line was cleared before the sizing could measure it",
    );
    assert.ok(payload().includes(CLEAR));
  });

  it("should hold back output written before it is sized", async () => {
    const console = open();
    console.appendResult(["a  b  "]);
    assert.ok(
      !payload().includes("a  b  "),
      "the result was written before the console was sized",
    );
    await layout();
    assert.ok(payload().indexOf("a  b  ") > payload().indexOf(CLEAR));
  });

  it("should start the console even when the sizing fails", async () => {
    open();
    (<any>vscode.commands.executeCommand).callsFake(
      () => <any>Promise.reject(new Error("no such command")),
    );
    await layout();
    assert.ok(
      payload().includes(CLEAR) && payload().includes("KX connection"),
      `the console never started:\n${JSON.stringify(payload())}`,
    );
  });

  it("should reveal itself without taking the caret", async () => {
    const console = await started();
    console.reveal();
    assert.deepStrictEqual(revealed, [true]);
  });

  it("should write a row wider than the console as it is", async () => {
    const console = await started();
    console.appendResult(["x".repeat(3000)]);
    assert.strictEqual(payload(), "x".repeat(3000) + "\r\n");
  });

  it("should write every row of a result as it is", async () => {
    const console = await started();
    console.appendResult(["a".repeat(3000), "b", "-".repeat(3000)]);
    assert.deepStrictEqual(payload().split("\r\n"), [
      "a".repeat(3000),
      "b",
      "-".repeat(3000),
      "",
    ]);
  });

  it("should not size a console disposed before the panel reports a layout", async () => {
    const console = open();
    console.dispose();
    await layout();
    assert.deepStrictEqual(executed, []);
    assert.ok(
      !payload().includes(CLEAR),
      `the console started after it was disposed:\n${JSON.stringify(payload())}`,
    );
  });
});
