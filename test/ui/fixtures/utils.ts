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

import {
  ActivityBar,
  BottomBarPanel,
  By,
  ContentAssist,
  Editor,
  EditorView,
  Key,
  SideBarView,
  TextEditor,
  VSBrowser,
  WebElement,
  Workbench,
} from "vscode-extension-tester";

export function waitForEditor(title: string): Promise<Editor> {
  const editors = new EditorView();
  return VSBrowser.instance.driver.wait(
    () =>
      new Promise<Editor>((resolve) => {
        editors
          .openEditor(title)
          .then((editor) => resolve(editor))
          .catch(() => resolve(undefined));
      }),
    5000,
    title,
  );
}

// Closes every open editor except the one titled `keep` (the extension opens a
// Welcome webview on activation that otherwise steals focus).
export async function closeOtherEditors(keep: string): Promise<void> {
  const view = new EditorView();
  for (const title of await view.getOpenEditorTitles()) {
    if (title !== keep) {
      await view.closeEditor(title);
    }
  }
}

// Opens content assist at (line, column) in the `title` editor and returns the
// item labels. The editor/status-bar DOM re-renders during activation (e.g. the
// newsletter notification), staling element references and moveCursor's status
// bar reads — so we settle, then retry the whole interaction with a re-fetched
// editor. Coordinates are 1-based.
export async function completionLabelsAt(
  title: string,
  line: number,
  column: number,
): Promise<string[]> {
  const view = new EditorView();
  await VSBrowser.instance.driver.sleep(2000);
  for (let attempt = 0; ; attempt++) {
    try {
      const editor = (await view.openEditor(title)) as TextEditor;
      await editor.click();
      await editor.moveCursor(line, column);
      const assist = (await editor.toggleContentAssist(true)) as ContentAssist;
      const items = await assist.getItems();
      const labels = await Promise.all(items.map((item) => item.getLabel()));
      await editor.toggleContentAssist(false);
      return labels;
    } catch (error) {
      if (attempt >= 6) throw error;
      await VSBrowser.instance.driver.sleep(500);
    }
  }
}

// Types `typed` at the top of `title`, accepts the `pick` suggestion, and
// returns the resulting first line — used to assert a member completion is
// inserted cleanly (no duplicated prefix, e.g. `bar.bar.f`). The document is
// reset to its original text on each attempt so retries stay idempotent.
export async function acceptCompletion(
  title: string,
  typed: string,
  pick: string,
): Promise<string> {
  const view = new EditorView();
  await VSBrowser.instance.driver.sleep(2000);
  let original: string | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      const editor = (await view.openEditor(title)) as TextEditor;
      await editor.click();
      if (original === undefined) {
        original = await editor.getText();
      } else {
        await editor.setText(original);
      }
      await editor.moveCursor(1, 1);
      await editor.typeText(typed);
      const assist = (await editor.toggleContentAssist(true)) as ContentAssist;
      const item = await assist.getItem(pick);
      if (!item) {
        throw new Error(`no completion suggestion: ${pick}`);
      }
      await item.getDriver().actions().sendKeys(Key.ENTER).perform();
      const result = await editor.getTextAtLine(1);
      // Discard the edits so the dirty file doesn't trigger a "save changes?"
      // modal that would block later tests.
      await new Workbench().executeCommand("Revert File");
      return result;
    } catch (error) {
      if (attempt >= 6) throw error;
      await VSBrowser.instance.driver.sleep(500);
    }
  }
}

// Opens the bottom-panel terminal view and reads the text of the active
// terminal, retrying until it contains `contains`. The REPL command spawns a
// pseudo-terminal and focuses it, so the active terminal is the REPL; its
// banner/output streams in asynchronously, so a single read can race ahead of
// the content. (We read text rather than enumerate channel names because the
// channel-selector combo is not populated for terminals in modern VS Code.)
export async function waitForTerminalText(contains: string): Promise<string> {
  const terminal = await new BottomBarPanel().openTerminalView();
  return VSBrowser.instance.driver.wait(
    async () => {
      try {
        const text = await terminal.getText();
        return text.includes(contains) ? text : undefined;
      } catch {
        // Terminal DOM re-renders while it spawns/streams; retry.
        return undefined;
      }
    },
    15000,
    `terminal text: ${contains}`,
  );
}

// Opens the terminal view and waits until the active terminal's text no longer
// contains `absent` — used after keystrokes that remove content (Backspace,
// word-delete, Ctrl+L clear) so assertions don't race the re-render.
export async function waitForTerminalTextGone(absent: string): Promise<void> {
  const terminal = await new BottomBarPanel().openTerminalView();
  await VSBrowser.instance.driver.wait(
    async () => {
      try {
        const text = await terminal.getText();
        return !text.includes(absent);
      } catch {
        return false;
      }
    },
    15000,
    `terminal text gone: ${absent}`,
  );
}

// Reads the active terminal's text once (no polling).
export async function terminalText(): Promise<string> {
  const terminal = await new BottomBarPanel().openTerminalView();
  return terminal.getText();
}

// Returns the xterm input of the active terminal. Every terminal keeps an
// aria-hidden .xterm-helper-textarea in the DOM, but only the visible one (the
// terminal the REPL command revealed) has a non-zero size — the hidden ones are
// not interactable — so pick the sized one to type into.
async function replTextarea(): Promise<WebElement> {
  await new BottomBarPanel().openTerminalView();
  const inputs = await VSBrowser.instance.driver.findElements(
    By.className("xterm-helper-textarea"),
  );
  for (const input of inputs) {
    const { width, height } = await input.getRect();
    if (width > 0 && height > 0) {
      return input;
    }
  }
  throw new Error("no visible terminal input found");
}

// Sends raw keystrokes (text, arrows, control chords via Key.chord) straight
// through to the REPL's pseudo-terminal handler, typing into the active
// terminal's xterm input (the same element TerminalView.executeCommand uses).
export async function sendReplKeys(...keys: string[]): Promise<void> {
  const input = await replTextarea();
  await input.sendKeys(...keys);
}

// Empties the current REPL input line. Backspaces (delete-left) then forward
// deletes clear the line regardless of cursor position; overshooting past the
// ends is a no-op in the REPL, so a fixed, generous count is safe.
export async function clearReplInput(): Promise<void> {
  await sendReplKeys(
    ...Array(80).fill(Key.BACK_SPACE),
    ...Array(20).fill(Key.DELETE),
  );
}

// Runs "KX: Start REPL Here" from the explorer context menu of a top-level
// workspace item (a folder or file). That command is hidden from the command
// palette and only reachable via the menu, where it receives the item's URI —
// which is how it opens a folder-scoped REPL distinct from the default one.
export async function startReplHere(item: string): Promise<void> {
  const control = await new ActivityBar().getViewControl("Explorer");
  if (!control) {
    throw new Error("Explorer view control not found");
  }
  await control.openView();
  const [section] = await new SideBarView().getContent().getSections();
  const node = await section.findItem(item);
  if (!node) {
    throw new Error(`explorer item not found: ${item}`);
  }
  const menu = await node.openContextMenu();
  const entry = await menu.getItem("KX: Start REPL Here");
  if (!entry) {
    throw new Error("context menu item not found: KX: Start REPL Here");
  }
  await entry.select();
}

// Opens `resource` in the editor and runs "KX: Execute Entire File" on it. With
// no connection assigned, the run is routed to a REPL (see runActiveEditor →
// runOnRepl → ReplConnection.getOrCreateInstance), and autoFocusOutputOnEntry
// (on by default) reveals the REPL that ran it.
export async function executeEntireFile(resource: string): Promise<void> {
  await VSBrowser.instance.openResources(resource);
  await new Workbench().executeCommand("KX: Execute Entire File");
}
