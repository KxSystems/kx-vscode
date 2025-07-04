/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import { Editor, VSBrowser, Workbench } from "vscode-extension-tester";

import { waitForEditor } from "./fixtures/utils";

describe("Notebook", () => {
  let code: VSBrowser;
  let workbench: Workbench;

  before(async () => {
    code = VSBrowser.instance;
    await code.openResources(
      "./test/ui/fixtures/notebook",
      "./test/ui/fixtures/notebook/simple.kxnb",
    );
    workbench = new Workbench();
  });

  describe("Existing notebook", () => {
    let editor: Editor;

    before(async () => {
      editor = await waitForEditor("simple.kxnb");
    });

    it("should exist", async () => {
      assert.ok(editor);
    });
  });

  describe("New notebook", () => {
    let editor: Editor;

    before(async () => {
      await workbench.executeCommand("KX: Create new notebook");
      editor = await waitForEditor("notebook-1.kxnb");
    });

    it("should exist", async () => {
      assert.ok(editor);
    });
  });
});
