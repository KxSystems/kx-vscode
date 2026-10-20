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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ROW_LIMIT_PRESETS } from "../../../../src/services/notebookProviders";

describe("Notebook row limit toolbar", () => {
  const commands: any[] = JSON.parse(
    readFileSync(
      resolve(__dirname, "..", "..", "..", "..", "..", "package.json"),
      "utf8",
    ),
  ).contributes.commands.filter((cmd: any) =>
    cmd.command.startsWith("kdb.notebook.rowLimit"),
  );

  it("should have a command for every preset", () => {
    assert.deepStrictEqual(
      commands
        .map((cmd) => cmd.command.match(/^kdb\.notebook\.rowLimit\.(\d+)$/))
        .filter(Boolean)
        .map((match) => Number(match[1])),
      ROW_LIMIT_PRESETS,
    );
  });

  it("should disable every row limit command while the notebook runs on the REPL", () => {
    assert.strictEqual(commands.length, ROW_LIMIT_PRESETS.length + 3);
    for (const cmd of commands) {
      assert.strictEqual(cmd.enablement, "!kdb.notebookOnRepl", cmd.command);
    }
  });
});
