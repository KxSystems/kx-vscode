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

describe("ConnectionConsole", () => {
  let written: string[];
  let pty: vscode.Pseudoterminal;

  beforeEach(() => {
    written = [];
    sinon.stub(vscode.window, "createTerminal").callsFake((options: any) => {
      pty = options.pty;
      return <vscode.Terminal>{ show() {}, dispose() {} };
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  function open(columns: number) {
    const console = new ConnectionConsole("connection");
    (<any>pty).onDidWrite((data: string) => written.push(data));
    pty.open(undefined);
    if (columns) {
      pty.setDimensions?.({ columns, rows: 20 });
    }
    written.length = 0;
    return console;
  }

  it("should leave a result that fits alone", () => {
    const console = open(40);
    console.appendResult(["a  b  ", "------", "1  2  "]);
    assert.deepStrictEqual(
      written.map((line) => line.replace(/\r\n/g, "")),
      ["a  b  ", "------", "1  2  "],
    );
  });

  it("should cut a row that would wrap", () => {
    const console = open(10);
    console.appendResult(["0123456789abcdef"]);
    assert.deepStrictEqual(
      written.map((line) => line.replace(/\r\n/g, "")),
      ["01234567.."],
    );
  });

  it("should leave every row alone until the width is known", () => {
    const console = open(0);
    console.appendResult(["0123456789abcdef"]);
    assert.deepStrictEqual(
      written.map((line) => line.replace(/\r\n/g, "")),
      ["0123456789abcdef"],
    );
  });

  it("should not cut a line carrying escape sequences", () => {
    const console = open(10);
    const line = "[1mheading that is far too wide[0m";
    console.appendResult([line]);
    assert.deepStrictEqual(
      written.map((value) => value.replace(/\r\n/g, "")),
      [line],
    );
  });
});
