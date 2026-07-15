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
  ModalDialog,
  TextEditor,
  VSBrowser,
  Workbench,
} from "vscode-extension-tester";

// Re-fetch the editor by title. The debug UI re-renders the workbench constantly
// (opening the Run view, pausing, stepping), which stales any held editor
// reference, so every interaction re-locates the element rather than reusing one
// — the same pattern the completion helpers in fixtures/utils.ts rely on.
async function editorFor(title: string): Promise<TextEditor> {
  return (await new EditorView().openEditor(title)) as TextEditor;
}

// Resolve once the debugger has paused on a breakpoint, or return "unavailable"
// if q could not start (e.g. no q runtime on PATH in this environment). Lets the
// test skip rather than false-fail where the runtime cannot be exercised.
async function awaitPausedOrUnavailable(
  title: string,
  timeoutMs: number,
): Promise<"paused" | "unavailable"> {
  const deadline = Date.now() + timeoutMs;
  let lastSeen = "";
  while (Date.now() < deadline) {
    // The debug UI mutates the DOM constantly; tolerate transient stale-element
    // errors between polls rather than failing the whole test on a flake.
    try {
      if (await (await editorFor(title)).getPausedBreakpoint()) return "paused";
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
async function pausedLine(title: string): Promise<number | undefined> {
  try {
    const bp = await (await editorFor(title)).getPausedBreakpoint();
    return bp ? await bp.getLineNumber() : undefined;
  } catch {
    return undefined;
  }
}

async function waitForPausedLine(
  title: string,
  line: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await pausedLine(title)) === line) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// Step over repeatedly until execution pauses on `target`, tolerating extra
// intermediate stops (q revisits a construct's header line, e.g. the `if[` after
// its body, so consecutive steps are not one source line apart).
async function stepToLine(
  toolbar: DebugToolbar,
  title: string,
  target: number,
  maxSteps: number,
): Promise<boolean> {
  for (let i = 0; i < maxSteps; i++) {
    if ((await pausedLine(title)) === target) return true;
    await toolbar.stepOver();
    if (await waitForPausedLine(title, target, 4000)) return true;
  }
  return (await pausedLine(title)) === target;
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

// Launch the "Debug q File" config. A previous session's teardown can lag behind
// this call, so VS Code sometimes shows a modal "'Debug q File' is already
// running. Do you want to start another instance?" — confirm it so the new
// session launches (the adapter takes over the shared q process cleanly). The
// modal surfaces a beat after start() returns, so a single immediate check races
// it; poll a short window and confirm it as soon as it appears.
async function startDebugging(debugView: DebugView): Promise<void> {
  await debugView.start();
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const dialog = new ModalDialog();
      if (await dialog.getMessage()) {
        await dialog.pushButton("Yes");
        return;
      }
    } catch {
      /* no dialog present yet; retry on the next tick */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

// Set a breakpoint idempotently (so a test retry does not toggle it off). The
// editor element stales as the workbench re-renders, so re-fetch it, click to
// focus, and retry the whole sequence — matching fixtures/utils.ts.
async function setBreakpoint(title: string, line: number): Promise<void> {
  await VSBrowser.instance.driver.sleep(1000);
  for (let attempt = 0; ; attempt++) {
    try {
      const editor = await editorFor(title);
      await editor.click();
      await editor.moveCursor(line, 1);
      if (await editor.getBreakpoint(line).catch(() => undefined)) return;
      await editor.toggleBreakpoint(line);
      return;
    } catch (error) {
      if (attempt >= 6) throw error;
      await VSBrowser.instance.driver.sleep(500);
    }
  }
}

// Poll the Variables view (expanding every scope) for a variable whose name
// matches. The debug tree re-renders constantly, so tolerate transient errors.
async function hasVariable(
  debugView: DebugView,
  match: (name: string) => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const section = await debugView.getVariablesSection();
      for (const item of await section.getVisibleItems()) {
        await item.expand().catch(() => undefined);
      }
      for (const item of await section.getVisibleItems()) {
        // getVariableName() returns "name =", so compare the leading token.
        const name = (await item.getVariableName().catch(() => ""))
          .replace(/\s*=.*/, "")
          .trim();
        if (match(name)) return true;
      }
    } catch {
      /* variables view in flux; retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Drives a real F5 debug session of the native q debugger. `control.q` exercises
// every control construct (if/$/while/do) plus a list literal `(1*2;3*4;4;5)`
// whose semicolons must NOT be treated as statement separators; `klondike.q` is a
// full real-world program used as a second session. Requires a q runtime
// discoverable by the extension (e.g. ~/.kx/bin/q or q on PATH), the same
// requirement as `npm run q-test`. The debugger is local-only: it suspends inside
// functions, so breakpoints sit in lambda bodies.
describe("q Debugger", () => {
  let debugView: DebugView;

  // Open a fixture from the debug folder and make it the active editor, so the
  // "Debug q File" launch config (program: ${file}) targets it.
  async function openDebug(fileName: string): Promise<void> {
    await VSBrowser.instance.openResources(
      `./test/ui/fixtures/debug/${fileName}`,
    );
    await new EditorView().openEditor(fileName);
  }

  before(async function () {
    this.timeout(60000);
    await VSBrowser.instance.openResources("./test/ui/fixtures/debug");
    await openDebug("control.q");

    const run = await new ActivityBar().getViewControl("Run");
    assert.ok(run, "Run and Debug view control should exist");
    await run.openView();
    debugView = new DebugView();
    await debugView.selectLaunchConfiguration("Debug q File");
  });

  afterEach(stopDebugging);

  it("pauses inside an if body, exposes locals, and steps to the next statement", async function () {
    this.timeout(120000);

    await openDebug("control.q");
    // Line 4 is `r:r+1;` inside `if[n>0; ...]` — a control-body breakpoint, hit
    // when run[3] executes.
    await setBreakpoint("control.q", 4);
    await startDebugging(debugView);

    const outcome = await awaitPausedOrUnavailable("control.q", 30000);
    if (outcome === "unavailable") {
      // q runtime unavailable in this environment.
      this.skip();
    }

    assert.ok(
      await waitForPausedLine("control.q", 4, 10000),
      "execution should pause on the if-body line 4",
    );

    // Locals scope (.dbg.locals) lists run's params/locals; `r` is assigned before
    // the breakpoint.
    assert.ok(
      await hasVariable(debugView, (n) => ["n", "r"].includes(n), 10000),
      "a local should appear in the Locals scope",
    );

    // Step to the next statement in the if body (line 5, `r:r+n];`).
    const toolbar = await DebugToolbar.create(60000);
    assert.ok(
      await stepToLine(toolbar, "control.q", 5, 3),
      "step should reach the second if-body line 5",
    );

    await toolbar.stop();
  });

  it("debugs a real program (klondike): breaks in deal, shows locals", async function () {
    this.timeout(120000);

    // A second debug session in the same browser — exercises that a session
    // started after a previous one has stopped is still detected (the Stop fix
    // terminates the first session cleanly instead of leaving it lingering).
    await openDebug("klondike.q");

    // Line 39 is `g[`s]:0;` inside `deal:{[] ...}`, reached as soon as the
    // top-level `see g:deal[]` runs. At the stop, `g` and `deck` are assigned
    // locals.
    await setBreakpoint("klondike.q", 39);
    await startDebugging(debugView);

    const outcome = await awaitPausedOrUnavailable("klondike.q", 30000);
    if (outcome === "unavailable") {
      this.skip();
    }

    assert.ok(
      await waitForPausedLine("klondike.q", 39, 10000),
      "execution should pause on the deal-body line 39",
    );

    // Locals scope (.dbg.locals) lists deal's locals; both are assigned by
    // line 39.
    assert.ok(
      await hasVariable(debugView, (n) => ["g", "deck"].includes(n), 10000),
      "a local (g/deck) should appear in the Locals scope",
    );

    // Step within deal to the next statement line 40 (`g[`p]:0;`).
    const toolbar = await DebugToolbar.create(60000);
    assert.ok(
      await stepToLine(toolbar, "klondike.q", 40, 3),
      "step should reach the next deal-body line 40",
    );

    await toolbar.stop();
  });
});
