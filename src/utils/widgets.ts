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

import { QuickPickOptions, window } from "vscode";

export function showInputPicker(
  items: readonly string[],
  options: QuickPickOptions,
) {
  return new Promise<string | undefined>((resolve) => {
    const picker = window.createQuickPick();

    picker.items = items.map((item) => ({ label: item }));
    picker.placeholder = options.placeHolder;
    picker.title = options.title;

    let selected = "";
    let accepted = false;

    picker.onDidChangeValue((value) => {
      selected = value;
    });

    picker.onDidChangeSelection((item) => {
      selected = item[0].label;
    });

    picker.onDidAccept(() => {
      accepted = true;
      picker.hide();
    });

    picker.onDidHide(() => {
      resolve((accepted && selected) || undefined);
    });

    picker.show();
  });
}
