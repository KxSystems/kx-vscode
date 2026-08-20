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

  it("should write the lines of a result as they are", () => {
    const console = open(10);
    console.appendResult(["a  b  ", "------", "0123456789abcdef"]);
    assert.deepStrictEqual(
      written.map((line) => line.replace(/\r\n/g, "")),
      ["a  b  ", "------", "0123456789abcdef"],
    );
  });

  it("should report the width the terminal was given", () => {
    assert.strictEqual(open(40).columns, 40);
  });

  it("should report no width until the terminal is measured", () => {
    assert.strictEqual(open(0).columns, 0);
  });
});
