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
  ContentAssist,
  Editor,
  EditorView,
  Key,
  TextEditor,
  VSBrowser,
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
