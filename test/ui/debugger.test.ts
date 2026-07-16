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
import {
  ActivityBar,
  DebugToolbar,
  DebugView,
  EditorView,
  TextEditor,
  VSBrowser,
  Workbench,
} from "vscode-extension-tester";

import { closeOtherEditors, waitForEditor } from "./fixtures/utils";

// Lines in fixtures/debugger/main.q. `ENTRY_LINE` is the first body line of the
// namespaced `.stats.summary`; `CALL_LINE` is where it calls its nested local
// lambda `bump` (`bumped:bump total;`), the site a Step Into descends through;
// `LAMBDA_LINE` is `bump`'s body (`x+1`), where the step-in lands.
const ENTRY_LINE = 30;
const CALL_LINE = 40;
const LAMBDA_LINE = 39;

// Starting a real debug session spins up a q process, injects the debug helpers
// and runs the program to the breakpoint, so the launch waits get a generous
// budget rather than the tester's default 5s.
const LAUNCH_TIMEOUT = 120000;
// Reading the paused line / locals happens only after a stop is already
// confirmed, so they settle in well under a second. Bound them tightly so a
// crashed session fails fast instead of spinning out the launch budget.
const POLL_TIMEOUT = 20000;

describe("Debugger", () => {
  let code: VSBrowser;
  let editor: TextEditor;
  let debugView: DebugView;
  let toolbar: DebugToolbar;

  // Re-fetches the `main.q` editor and toggles a breakpoint on `line`. The editor
  // DOM re-renders during activation (Welcome webview, newsletter notification),
  // staling element references — so settle, then retry with a fresh editor.
  async function toggleBreakpoint(line: number): Promise<void> {
    const view = new EditorView();
    await VSBrowser.instance.driver.sleep(2000);
    for (let attempt = 0; ; attempt++) {
      try {
        editor = (await view.openEditor("main.q")) as TextEditor;
        // Monaco virtualizes the margin, so a line below the fold has no
        // line-number element to click — scroll it into view first.
        await editor.moveCursor(line, 1);
        await editor.toggleBreakpoint(line);
        return;
      } catch (error) {
        if (attempt >= 6) throw error;
        await VSBrowser.instance.driver.sleep(500);
      }
    }
  }

  // Waits until the editor's paused marker settles on `expected`. Polling (not a
  // single read) matters after a step: the marker can briefly linger on the
  // previous line before the new stop lands, so a bare read races it.
  async function expectPausedLine(expected: number): Promise<void> {
    await VSBrowser.instance.driver.wait(
      async () => {
        const paused = await editor.getPausedBreakpoint().catch(() => undefined);
        if (!paused) return false;
        try {
          return (await paused.getLineNumber()) === expected;
        } catch {
          return false;
        }
      },
      POLL_TIMEOUT,
      `never paused at line ${expected}`,
    );
  }

  // Polls the Locals view — expanding its section and every row each round —
  // until some local label satisfies `match`. Returns the labels seen last.
  // Locals render as "name =" rows under the "Locals" scope; the tree fills in
  // asynchronously after a stop and its scopes may start collapsed.
  async function waitForLocal(match: (name: string) => boolean): Promise<string[]> {
    let names: string[] = [];
    await VSBrowser.instance.driver.wait(
      async () => {
        try {
          const section = await debugView.getVariablesSection();
          await section.expand().catch(() => undefined);
          for (const item of await section.getVisibleItems()) {
            await item.expand().catch(() => undefined);
          }
          names = await Promise.all(
            (await section.getVisibleItems()).map((item) => item.getLabel()),
          );
          return names.some(match);
        } catch {
          return false;
        }
      },
      POLL_TIMEOUT,
      `no matching local in [${names}]`,
    );
    return names;
  }

  before(async () => {
    code = VSBrowser.instance;
    // Open the fixture folder as the workspace root (it carries a `.vscode/
    // launch.json` with a "Debug q File" config) and the program under it.
    await code.openResources(
      "./test/ui/fixtures/debugger",
      "./test/ui/fixtures/debugger/main.q",
    );
    await waitForEditor("main.q");
    // The activation Welcome webview otherwise steals focus from the editor.
    await closeOtherEditors("main.q");
  });

  after(async () => {
    // Leave no session or breakpoint behind for later suites sharing the window.
    await toolbar?.stop().catch(() => undefined);
    await editor?.toggleBreakpoint(ENTRY_LINE).catch(() => undefined);
    await editor?.toggleBreakpoint(CALL_LINE).catch(() => undefined);
  });

  it("sets breakpoints inside a namespaced function", async () => {
    await toggleBreakpoint(ENTRY_LINE);
    await toggleBreakpoint(CALL_LINE);
    assert.ok(
      await editor.getBreakpoint(ENTRY_LINE),
      "expected a breakpoint on the entry line",
    );
    assert.ok(
      await editor.getBreakpoint(CALL_LINE),
      "expected a breakpoint on the call line",
    );
  });

  it("launches the q debugger and stops at the breakpoint", async () => {
    // Open the Run and Debug view so its Variables section is queryable later.
    const control = await new ActivityBar().getViewControl("Run and Debug");
    assert.ok(control);
    await control.openView();
    debugView = new DebugView();

    // Start the sole launch.json config ("Debug q File"). The launch-config
    // <select> the DebugView page object drives was removed in recent VS Code,
    // so drive the command instead — it runs the workspace's only config.
    await new Workbench().executeCommand("Debug: Start Debugging");

    toolbar = await DebugToolbar.create(LAUNCH_TIMEOUT);
    await toolbar.waitForBreakPoint(LAUNCH_TIMEOUT);
    await expectPausedLine(ENTRY_LINE);
  });

  it("shows the paused frame's locals", async () => {
    // At the entry of `summary` its parameter `xs` is already bound; the Locals
    // view resolves the qualified frame and lists it.
    const names = await waitForLocal((name) => name.startsWith("xs "));
    assert.ok(
      names.some((name) => name.startsWith("xs ")),
      `expected xs in locals [${names}]`,
    );
  });

  it("steps into a nested local lambda", async () => {
    // Continue to the `bumped:bump total;` call site, then Step Into. `bump` is
    // a lambda assigned inside `summary`, so descending into it raises q's frame
    // index; the debugger pauses on the lambda's body line.
    await toolbar.continue();
    await toolbar.waitForBreakPoint(LAUNCH_TIMEOUT);
    await expectPausedLine(CALL_LINE);

    await toolbar.stepInto();
    await expectPausedLine(LAMBDA_LINE);
  });

  it("shows the nested lambda frame's locals", async () => {
    // The top frame is now `bump` (`{ x+1 }`), whose only local is its implicit
    // parameter `x` — its appearance confirms the Locals view followed the
    // step-in into the nested lambda's frame.
    const names = await waitForLocal((name) => name.startsWith("x "));
    assert.ok(
      names.some((name) => name.startsWith("x ")),
      `expected the nested lambda's x in locals [${names}]`,
    );
  });
});
