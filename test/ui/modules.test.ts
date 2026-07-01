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
import { VSBrowser } from "vscode-extension-tester";

import {
  acceptCompletion,
  closeOtherEditors,
  completionLabelsAt,
  waitForEditor,
} from "./fixtures/utils";

describe("Modules", () => {
  let code: VSBrowser;

  before(async () => {
    code = VSBrowser.instance;
    // Open the folder as a workspace root (with a sibling `mod/` directory) so
    // it mirrors a real q modules layout: main.q importing bar/stats via `use`.
    await code.openResources(
      "./test/ui/fixtures/modules",
      "./test/ui/fixtures/modules/main.q",
    );
  });

  describe("Workspace", () => {
    it("should open main.q", async () => {
      const editor = await waitForEditor("main.q");
      assert.ok(editor);
    });
  });

  describe("Module files", () => {
    it("should open the bar module", async () => {
      await code.openResources("./test/ui/fixtures/modules/mod/bar.q");
      const editor = await waitForEditor("bar.q");
      assert.ok(editor);
    });

    it("should open the stats module", async () => {
      await code.openResources("./test/ui/fixtures/modules/mod/stats.q");
      const editor = await waitForEditor("stats.q");
      assert.ok(editor);
    });
  });

  describe("Completion", () => {
    it("should offer bar members (incl. h) after `bar.`", async () => {
      await waitForEditor("main.q");
      await closeOtherEditors("main.q");
      // line 7: `r1:bar.f[10]` — caret right after `bar.`
      const labels = await completionLabelsAt("main.q", 7, 8);
      for (const name of ["bar.f", "bar.g", "bar.h"]) {
        assert.ok(labels.includes(name), `expected ${name} in [${labels}]`);
      }
    });

    it("should insert `bar.f` without duplicating the `bar.` prefix", async () => {
      await waitForEditor("main.q");
      await closeOtherEditors("main.q");
      const line = await acceptCompletion("main.q", "t:bar.", "bar.f");
      assert.ok(line.includes("bar.f"), `expected bar.f in ${line}`);
      assert.ok(!line.includes("bar.bar"), `duplicated prefix: ${line}`);
    });
  });
});
