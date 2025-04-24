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
import { VSBrowser, ActivityBar } from "vscode-extension-tester";

describe("ActivityBar", () => {
  let browser: VSBrowser;
  let activityBar: ActivityBar;

  before(async () => {
    browser = VSBrowser.instance;
    activityBar = new ActivityBar();
  });

  it("should contain KX tab", async () => {
    const controls = await activityBar.getViewControls();
    let kx = "";
    for (const control of controls) {
      const id = await control.getTitle();
      if (id === "KX") {
        kx = id;
        break;
      }
    }
    assert.strictEqual(kx, "KX");
  });

  it("should open basic workspace", async () => {
    await browser.openResources("./test/ui/fixtures/basic");
  });
});
