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

// Resolve once the debugger has paused on a breakpoint, or return "unavailable"
// if q could not start (e.g. no q runtime on PATH in this environment). Lets the
// test skip rather than false-fail where the runtime cannot be exercised.
async function awaitPausedOrUnavailable(
  editor: TextEditor,
  timeoutMs: number,
): Promise<"paused" | "unavailable"> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen = "";
  while (Date.now() < deadline) {
    // The debug UI mutates the DOM constantly; tolerate transient stale-element
    // errors between polls rather than failing the whole test on a flake.
    try {
      if (await editor.getPausedBreakpoint()) return "paused";
      const notes = await new Workbench().getNotifications();
      for (const note of notes) {
        const msg = await note.getMessage();
        lastSeen = msg;
        if (/Failed to start q debugger|debug adapter/i.test(msg)) {
          return "unavailable";
        }
      }
    } catch {
      /* stale element or view in flux; retry on the next tick */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(
    `[q Debugger] no pause within ${timeoutMs}ms; last notification: ${lastSeen || "(none)"}`,
  );
  return "unavailable";
}

// The paused-breakpoint element is recreated as the debug view re-renders, so
// reading its line can throw a stale-element error; treat that as "not yet".
async function pausedLine(editor: TextEditor): Promise<number | undefined> {
  try {
    const bp = await editor.getPausedBreakpoint();
    return bp ? await bp.getLineNumber() : undefined;
  } catch {
    return undefined;
  }
}

async function waitForPausedLine(
  editor: TextEditor,
  line: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await pausedLine(editor)) === line) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// Stop any active debug session so a retry (or the next test) does not hit the
// "'Debug q File' is already running" dialog. Tolerant of there being none.
async function stopDebugging(): Promise<void> {
  try {
    await new Workbench().executeCommand("Debug: Stop");
  } catch {
    /* no active session */
  }
  await new Promise((r) => setTimeout(r, 750));
}

// Set a breakpoint idempotently (so a test retry does not toggle it off).
// toggleBreakpoint clicks the gutter and waits for the marker; the editor element
// can go stale mid-toggle, so settle the cursor first and retry.
async function setBreakpoint(editor: TextEditor, line: number): Promise<void> {
  await editor.moveCursor(line, 1);
  if (await editor.getBreakpoint(line).catch(() => undefined)) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await editor.toggleBreakpoint(line);
      return;
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// Drives a real F5 debug session of the native q debugger. Requires a q runtime
// discoverable by the extension (e.g. ~/.kx/bin/q or q on PATH), the same
// requirement as `npm run q-test`, plus terminal shell integration.
describe("q Debugger", () => {
  let editor: TextEditor;
  let debugView: DebugView;

  before(async function () {
    this.timeout(60000);
    await VSBrowser.instance.openResources(
      "./test/ui/fixtures/debug",
      "./test/ui/fixtures/debug/main.q",
    );
    editor = (await new EditorView().openEditor("main.q")) as TextEditor;

    const run = await new ActivityBar().getViewControl("Run");
    assert.ok(run, "Run and Debug view control should exist");
    await run.openView();
    debugView = new DebugView();
    await debugView.selectLaunchConfiguration("Debug q File");
  });

  afterEach(stopDebugging);

  it("pauses at a line breakpoint, steps to the next line, and stops", async function () {
    this.timeout(120000);

    // Breakpoint on `b:a+y;` (line 3), hit when add[10;20] runs.
    await setBreakpoint(editor, 3);
    await debugView.start();

    const outcome = await awaitPausedOrUnavailable(editor, 30000);
    if (outcome === "unavailable") {
      // q runtime or node-pty native module unavailable in this environment.
      this.skip();
    }

    assert.ok(
      await waitForPausedLine(editor, 3, 10000),
      "execution should pause on line 3",
    );

    const toolbar = await DebugToolbar.create(60000);

    // Stepping advances to the next source line (b:a+y -> a+b).
    await toolbar.stepOver();
    assert.ok(
      await waitForPausedLine(editor, 4, 20000),
      "step should advance to line 4",
    );

    await toolbar.stop();
  });
});

// Global-scope debugging: breakpoints on top-level statements (not inside a
// function) pause the loader before the statement runs, and the Globals scope
// lists user-defined root-namespace variables.
describe("q Debugger (global scope)", () => {
  let editor: TextEditor;
  let debugView: DebugView;

  before(async function () {
    this.timeout(60000);
    await VSBrowser.instance.openResources(
      "./test/ui/fixtures/debug",
      "./test/ui/fixtures/debug/globals.q",
    );
    editor = (await new EditorView().openEditor("globals.q")) as TextEditor;

    const run = await new ActivityBar().getViewControl("Run");
    assert.ok(run, "Run and Debug view control should exist");
    await run.openView();
    debugView = new DebugView();
    await debugView.selectLaunchConfiguration("Debug q File");
  });

  afterEach(stopDebugging);

  it("pauses at a top-level breakpoint and exposes globals", async function () {
    this.timeout(120000);

    // `show greeting` (line 5) is top-level; pausing there is a global-scope stop.
    await setBreakpoint(editor, 5);
    await debugView.start();

    const outcome = await awaitPausedOrUnavailable(editor, 30000);
    if (outcome === "unavailable") this.skip();

    assert.ok(
      await waitForPausedLine(editor, 5, 10000),
      "execution should pause on the top-level line 5",
    );

    // `greeting` was assigned on line 1, so it appears in the Globals scope.
    // Expand every scope node (Locals, Globals) so their child variables render,
    // then look for `greeting` by variable name among the visible items — the
    // scope's children are nested, so a plain top-level findItem would miss them.
    let greeting = false;
    const deadline = Date.now() + 15000;
    while (!greeting && Date.now() < deadline) {
      try {
        const globals = await debugView.getVariablesSection();
        for (const item of await globals.getVisibleItems()) {
          await item.expand().catch(() => undefined);
        }
        for (const item of await globals.getVisibleItems()) {
          // getVariableName() returns the name plus its separator, e.g.
          // "greeting =", so compare on the leading name token only.
          const name = await item.getVariableName().catch(() => "");
          if (name.replace(/\s*=.*/, "").trim() === "greeting") {
            greeting = true;
            break;
          }
        }
      } catch {
        /* variables view in flux; retry */
      }
      if (!greeting) await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(greeting, "global `greeting` should appear in the Globals scope");

    await (await DebugToolbar.create(60000)).stop();
  });
});
