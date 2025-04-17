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

import {
  InputBoxOptions,
  QuickPickItem,
  QuickPickOptions,
  window,
} from "vscode";

import { CancellationEvent } from "../models/cancellationEvent";

export async function showInputBox(options: InputBoxOptions): Promise<string> {
  const result = await window.showInputBox(options);

  if (result === undefined) {
    throw new CancellationEvent();
  }

  return result;
}

export async function showQuickPick<T extends QuickPickItem>(
  items: T[] | Promise<T[]>,
  options: QuickPickOptions
): Promise<T> {
  const result = await window.showQuickPick(items, options);

  if (result === undefined) {
    throw new CancellationEvent();
  }

  return result;
}

export async function showOpenFolderDialog(): Promise<string> {
  const folder = await window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
  });

  if (!folder) {
    throw new CancellationEvent();
  }

  return folder[0].fsPath;
}
