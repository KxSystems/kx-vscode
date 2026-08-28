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

import * as assert from "node:assert";
import * as vscode from "vscode";

import { activate, file, focus, until } from "./utils";
import { Webview, webview } from "./utils/webview";

/**
 * The welcome page, in both halves: the panel kdb.show.welcome opens, which is
 * all the extension host exposes of it, and the page inside that panel, mounted
 * separately because webview content cannot be reached into from out here — see
 * test/e2e/utils/webview.ts.
 *
 * The extension also opens this panel by itself on activation, through
 * checkLocalInstall, so the tests here close whatever is open first rather than
 * counting on a clean window.
 */
describe("Welcome", () => {
  before(async () => {
    await activate();
  });

  describe("panel", () => {
    // The view type the panel is created with, which VS Code reports on the
    // tab prefixed with its own marker.
    const panels = () =>
      vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .filter(
          (tab) =>
            tab.input instanceof vscode.TabInputWebview &&
            tab.input.viewType.includes("kdbWelcomeView"),
        );

    const open = async () => {
      await vscode.commands.executeCommand("kdb.show.welcome");
      await until(
        () => panels()[0]?.isActive === true,
        "the welcome panel to open",
      );
      return panels()[0];
    };

    beforeEach(async () => {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await until(() => panels().length === 0, "the editors to be closed");
    });

    after(async () => {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });

    it("opens the welcome panel", async () => {
      const panel = await open();

      assert.strictEqual(panel.label, "Welcome to KDB-X");
      assert.strictEqual(panel.isActive, true);
    });

    it("reveals the panel already open rather than a second one", async () => {
      await open();

      // Opening a file in the same column is what pushes the panel into the
      // background; the command has to bring that same tab back.
      await focus(file("main.q"));
      await until(
        () => panels()[0]?.isActive === false,
        "the welcome panel to lose focus",
      );

      await vscode.commands.executeCommand("kdb.show.welcome");
      await until(
        () => panels()[0]?.isActive === true,
        "the welcome panel to be revealed",
      );

      assert.strictEqual(panels().length, 1);
    });
  });

  describe("page", () => {
    let view: Webview;

    const VIEW = "kdb-welcome-view >>> ";

    // What showWelcome passes the element: the bundled image, whether the
    // startup checkbox is ticked, and the theme the icons are drawn for.
    const IMAGE = "https://example.com/kx_welcome.png";

    const DARK = "#CCCCCC";
    const LIGHT = "#404651";

    const show = (attributes: Record<string, string> = {}) =>
      webview("kdb-welcome-view", {
        image: IMAGE,
        checked: "true",
        dark: "dark",
        ...attributes,
      }).then((mounted) => (view = mounted));

    afterEach(() => {
      view.dispose();
    });

    it("lists the steps and shows the image it is given", async () => {
      await show();

      const shown = await view.eval((root: string) => {
        const container = __find(`${root}.container`);
        return {
          heading: __find(`${root}h1`).textContent.trim(),
          // The step titles are the direct children of each step; the one
          // inside a step's text, naming the REPL command, is not.
          steps: [...container.querySelectorAll(".row > strong")].map(
            (step: any) => step.textContent.trim(),
          ),
          image: __find(`${root}img`).getAttribute("src"),
        };
      }, VIEW);

      assert.deepStrictEqual(shown, {
        heading: "Welcome to KDB-X",
        steps: [
          "Log in or create an account",
          "Retrieve your license key",
          "Activate in VS Code",
          "Start coding",
        ],
        image: IMAGE,
      });
    });

    // The panel rebuilds the page whenever the color theme changes, and the
    // theme reaches the icons as this attribute alone.
    const fills = () =>
      view.eval(
        (root: string) => [
          ...new Set(
            [
              ...__find(`${root}.container`).querySelectorAll(
                ".icon path[fill]",
              ),
            ].map((path: any) => path.getAttribute("fill")),
          ),
        ],
        VIEW,
      );

    it("draws the step icons for a dark theme", async () => {
      await show({ dark: "dark" });

      const drawn = await fills();

      assert.deepStrictEqual(
        { dark: drawn.includes(DARK), light: drawn.includes(LIGHT) },
        { dark: true, light: false },
      );
    });

    it("draws the step icons for a light theme", async () => {
      await show({ dark: "" });

      const drawn = await fills();

      assert.deepStrictEqual(
        { dark: drawn.includes(DARK), light: drawn.includes(LIGHT) },
        { dark: false, light: true },
      );
    });

    it("asks for the install when the install button is clicked", async () => {
      await show();

      const posted = await view.eval((root: string) => {
        __find(`${root}sl-button[variant="primary"]`).click();
        return __posted;
      }, VIEW);

      assert.deepStrictEqual(posted, ["install"]);
    });

    const startup = () =>
      view.eval(async (root: string) => {
        const checkbox = __find(`${root}.footer sl-checkbox`);
        const before = checkbox.checked;
        __find(`${root}.footer sl-checkbox >>> input[type="checkbox"]`).click();
        await checkbox.updateComplete;
        return { before, posted: __posted };
      }, VIEW);

    it("reports the startup checkbox being unticked", async () => {
      await show({ checked: "true" });

      assert.deepStrictEqual(await startup(), {
        before: true,
        posted: [false],
      });
    });

    it("reports the startup checkbox being ticked back on", async () => {
      await show({ checked: "false" });

      assert.deepStrictEqual(await startup(), {
        before: false,
        posted: [true],
      });
    });
  });
});
