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
import { Key, VSBrowser, Workbench } from "vscode-extension-tester";

import {
  clearReplInput,
  executeEntireFile,
  sendReplKeys,
  startReplHere,
  terminalText,
  waitForTerminalText,
  waitForTerminalTextGone,
} from "./fixtures/utils";

describe("REPL", () => {
  let code: VSBrowser;

  before(async () => {
    code = VSBrowser.instance;
    await code.openResources("./test/ui/fixtures/repl");
  });

  describe("Start REPL command", () => {
    it("should open a KX REPL terminal with its banner", async () => {
      await new Workbench().executeCommand("KX: Start REPL");
      // The banner is emitted by the pseudo-terminal itself, so it is present
      // regardless of whether a q runtime is installed in the environment.
      // Spawning the q process is slower than the local echo the default
      // timeout is tuned for, so allow more time here.
      const text = await waitForTerminalText("KX REPL Copyright", 5000);
      assert.ok(
        text.includes("KX REPL Copyright"),
        `expected the REPL banner in terminal text, got: ${text}`,
      );
    });
  });

  // The REPL implements its own line editing inside the pseudo-terminal (see
  // ReplConnection.handleInput), so these drive raw keystrokes at the xterm and
  // assert on what the prompt line re-renders. They require a live REPL, which
  // the "Start REPL" test above establishes and which needs a q runtime on PATH
  // (as does `npm run q-test`). `terminal.integrated.sendKeybindingsToShell` is
  // enabled in the fixture settings so control chords reach the REPL.
  // Inputs use only unshifted characters (letters, digits, spaces): Selenium's
  // sendKeys mis-maps shifted symbols under this keyboard layout (e.g. "+"
  // arrives as "$"), which would be a test artifact, not a REPL behaviour.
  describe("Keyboard shortcuts", () => {
    it("echoes typed input at the prompt", async () => {
      await sendReplKeys("abc123");
      const text = await waitForTerminalText("abc123");
      assert.ok(text.includes("abc123"), `expected typed input, got: ${text}`);
      await clearReplInput();
    });

    it("removes a character with Backspace", async () => {
      await sendReplKeys("98765");
      await waitForTerminalText("98765");
      await sendReplKeys(Key.BACK_SPACE, Key.BACK_SPACE);
      await waitForTerminalTextGone("98765");
      const text = await terminalText();
      assert.ok(text.includes("987"), `expected 987, got: ${text}`);
      await clearReplInput();
    });

    it("removes a word with ctrl/⌥+Backspace", async () => {
      await sendReplKeys("alpha beta");
      await waitForTerminalText("alpha beta");
      await sendReplKeys(Key.chord(Key.ALT, Key.BACK_SPACE));
      await waitForTerminalTextGone("beta");
      const text = await terminalText();
      assert.ok(text.includes("alpha"), `expected alpha, got: ${text}`);
      await clearReplInput();
    });

    it("clears the screen with Ctrl+L", async () => {
      // The startup banner stays on screen until something clears it.
      await waitForTerminalText("KX REPL Copyright", 5000);
      await sendReplKeys(Key.chord(Key.CONTROL, "l"));
      await waitForTerminalTextGone("Copyright");
    });

    it("recalls a previous entry with the Up arrow", async () => {
      // Submit two entries, then clear the screen so the recalled marker is the
      // only place it can appear (executing it also echoes it).
      await sendReplKeys("recallaaa", Key.ENTER);
      await waitForTerminalText("recallaaa");
      await sendReplKeys("recallbbb", Key.ENTER);
      await waitForTerminalText("recallbbb");
      await sendReplKeys(Key.chord(Key.CONTROL, "l"));
      await waitForTerminalTextGone("recallbbb");
      await sendReplKeys(Key.ARROW_UP);
      const text = await waitForTerminalText("recallbbb");
      assert.ok(
        text.includes("recallbbb"),
        `expected the most recent entry recalled, got: ${text}`,
      );
      await clearReplInput();
    });
  });

  // "Start REPL Here" opens a REPL scoped to a specific folder, so a workspace
  // can have several REPLs at once (see ReplConnection.openInFolder, keyed by
  // folder URI). The fixture workspace has sibling folders A and B for this.
  describe("Start REPL Here (multiple REPLs)", () => {
    it("opens a folder-scoped REPL from the explorer context menu", async () => {
      await startReplHere("A");
      const text = await waitForTerminalText("KX REPL Copyright", 5000);
      assert.ok(
        text.includes("KX REPL Copyright"),
        `expected a REPL for folder A, got: ${text}`,
      );
    });

    it("runs each folder's REPL as an independent q process", async () => {
      // Define a variable in A's REPL (the one just opened and focused). The
      // custom prompt handler echoes the assigned value, so it shows 11111.
      await sendReplKeys("kxvar:11111", Key.ENTER);
      await waitForTerminalText("11111");

      // Open a second REPL in folder B — a separate q process — and clear its
      // fresh banner so the read below only sees this REPL's own output.
      await startReplHere("B");
      await waitForTerminalText("KX REPL Copyright", 5000);
      await sendReplKeys(Key.chord(Key.CONTROL, "l"));
      await waitForTerminalTextGone("Copyright");

      // B does not share A's state: referencing kxvar raises an undefined-name
      // error (a '<timestamp> kxvar line plus a "[1] kxvar" backtrace frame)
      // rather than resolving to 11111. Wait for the backtrace frame, which is
      // emitted only on error, then confirm the value never appeared.
      await sendReplKeys("kxvar", Key.ENTER);
      await waitForTerminalText("[1]");
      const text = await terminalText();
      assert.ok(
        !text.includes("11111"),
        `folder B's REPL leaked folder A's state: ${text}`,
      );
      await clearReplInput();
    });
  });

  // Executions follow the active REPL — the one last started or focused —
  // regardless of which folder owns the file, and only fall back to the folder
  // rule when no REPL is active (see ReplConnection.getOrCreateInstance). The
  // root file c.q prints its REPL process's working directory via `\pwd`, which
  // identifies the folder-scoped REPL that actually ran it.
  describe("Execution routing", () => {
    it("routes a run to the active REPL, overriding the folder rule", async () => {
      // Two folder REPLs; B is started last, so it becomes the active REPL.
      await startReplHere("A");
      await startReplHere("B");
      // c.q sits at the workspace root, so the folder rule would pick the
      // workspace REPL — but the active REPL (B) wins.
      await executeEntireFile("./test/ui/fixtures/repl/c.q");
      const text = await waitForTerminalText("repl/B");
      assert.ok(text.includes("repl/B"), `expected run on B, got: ${text}`);
      assert.ok(!text.includes("repl/A"), `run leaked to A: ${text}`);
    });

    it("redirects runs after a different REPL becomes active", async () => {
      // Re-starting A's REPL makes it the active one again; clear its screen so
      // the read below only sees this run's `\pwd`.
      await startReplHere("A");
      await sendReplKeys(Key.chord(Key.CONTROL, "l"));
      await waitForTerminalTextGone("repl/");
      await executeEntireFile("./test/ui/fixtures/repl/c.q");
      const text = await waitForTerminalText("repl/A");
      assert.ok(text.includes("repl/A"), `expected run on A, got: ${text}`);
      assert.ok(!text.includes("repl/B"), `run leaked to B: ${text}`);
    });
  });
});
