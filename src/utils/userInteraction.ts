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
