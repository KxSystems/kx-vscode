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
import {
  VSBrowser,
  ActivityBar,
  SideBarView,
  ViewSection,
} from "vscode-extension-tester";

import { waitForEditor } from "./fixtures/utils";

describe("Start Up", () => {
  let code: VSBrowser;
  let activityBar: ActivityBar;
  let sideBar: SideBarView;

  before(async () => {
    code = VSBrowser.instance;
    await code.openResources("./test/ui/fixtures/startup");
    activityBar = new ActivityBar();
    sideBar = new SideBarView();
    const control = await activityBar.getViewControl("KX");
    assert.ok(control);
    await control.click();
  });

  describe("Connections Section", () => {
    let section: ViewSection;

    before(async () => {
      section = await sideBar.getContent().getSection("Connections");
      assert.ok(section);
    });

    it("should open new connection view", async () => {
      const welcome = await section.findWelcomeContent();
      assert.ok(welcome);
      const button = await welcome.getButton("Add Connection");
      assert.ok(button);
      await button.click();
      const editor = await waitForEditor("New Connection");
      assert.ok(editor);
    });
  });

  describe("Datasources Section", () => {
    let section: ViewSection;

    before(async () => {
      section = await sideBar.getContent().getSection("Datasources");
    });

    it("should exist", async () => {
      assert.ok(section);
    });
  });

  describe("Workbooks Section", () => {
    let section: ViewSection;

    before(async () => {
      section = await sideBar.getContent().getSection("Workbooks");
    });

    it("should exist", async () => {
      assert.ok(section);
    });
  });

  describe("Query History Section", () => {
    let section: ViewSection;

    before(async () => {
      section = await sideBar.getContent().getSection("Query History");
    });

    it("should exist", async () => {
      assert.ok(section);
    });
  });
});
