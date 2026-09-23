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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import * as vscode from "vscode";

/**
 * Stands in for the person a dialog is addressed to.
 *
 * A file dialog is drawn by the workbench — natively on macOS, as a quick
 * input when files.simpleDialog.enable is set — and there is no API that hands
 * one a path, so a command that asks for a file cannot be driven to an answer.
 * This takes the same place the reader does in utils/prompt.ts and the browser
 * does in utils/insights.ts: it replaces the part outside the extension, the
 * person choosing, and leaves the extension itself alone.
 *
 * Every dialog is recorded together with the options it was raised with, so a
 * test can assert what the user was offered as well as what was done with the
 * answer.
 *
 * A quick pick nothing has been queued for is passed to the workbench and
 * shown as usual, the way an unanswered notification is. A file dialog is not:
 * there is no one to dismiss it, so an unanswered one is answered the way a
 * dialog closed without a choice is, and a test that forgets to queue an answer
 * fails on the outcome rather than hanging until the timeout.
 *
 * That answer is a cancellation, which a command elsewhere in the window has no
 * way of telling from a real one, so a suite that queues anything here has to
 * put the workbench back with uninstall() when it is done.
 */

export interface Request {
  kind: "open" | "save" | "pick";
  prompt: string;
  options: any;
}

export const requests: Request[] = [];

interface Choice {
  kind: Request["kind"];
  match?: string;
  uri?: vscode.Uri;
  label?: string;
}

const choices: Choice[] = [];

type Stubbed = "showOpenDialog" | "showSaveDialog" | "showQuickPick";

let real: { [method in Stubbed]: any } | undefined;

function replace(method: Stubbed, value: any) {
  Object.defineProperty(vscode.window, method, {
    configurable: true,
    writable: true,
    value,
  });
}

function wording(kind: Request["kind"], options: any): string {
  const parts =
    kind === "pick"
      ? [options?.title, options?.placeHolder]
      : [options?.title, options?.saveLabel, options?.openLabel];
  return parts.filter(Boolean).join(" ");
}

function take(kind: Request["kind"], prompt: string) {
  const index = choices.findIndex(
    (choice) =>
      choice.kind === kind && (!choice.match || prompt.includes(choice.match)),
  );
  return index === -1 ? undefined : choices.splice(index, 1)[0];
}

function install() {
  if (real) {
    return;
  }

  real = {
    showOpenDialog: vscode.window.showOpenDialog,
    showSaveDialog: vscode.window.showSaveDialog,
    showQuickPick: vscode.window.showQuickPick,
  };

  for (const [kind, method] of [
    ["open", "showOpenDialog"],
    ["save", "showSaveDialog"],
  ] as [Request["kind"], "showOpenDialog" | "showSaveDialog"][]) {
    replace(method, (options: any = {}) => {
      const prompt = wording(kind, options);
      requests.push({ kind, prompt, options });

      const uri = take(kind, prompt)?.uri;

      return Promise.resolve(kind === "open" ? uri && [uri] : uri);
    });
  }

  const picker = real.showQuickPick;

  replace(
    "showQuickPick",
    async (items: any, options: any = {}, ...rest: any[]) => {
      const prompt = wording("pick", options);
      requests.push({ kind: "pick", prompt, options });

      const choice = take("pick", prompt);
      if (!choice) {
        return picker.call(vscode.window, items, options, ...rest);
      }

      const offered = await items;
      return offered.find(
        (item: any) =>
          (typeof item === "string" ? item : item.label) === choice.label,
      );
    },
  );
}

/**
 * Chooses `uri` in the next open dialog whose wording contains `match`, or in
 * the next one at all when no match is given.
 */
export function opens(uri: vscode.Uri, match?: string) {
  install();
  choices.push({ kind: "open", match, uri });
}

/**
 * Chooses `uri` in the next save dialog whose wording contains `match`, or in
 * the next one at all when no match is given.
 */
export function saves(uri: vscode.Uri, match?: string) {
  install();
  choices.push({ kind: "save", match, uri });
}

/**
 * Chooses the item labelled `label` in the next quick pick whose title or
 * placeholder contains `match`. Anything else is left to the workbench, so a
 * picker another suite drives is untouched.
 */
export function picks(match: string, label: string) {
  install();
  choices.push({ kind: "pick", match, label });
}

export function cancels(kind: Request["kind"], match?: string) {
  install();
  choices.push({ kind, match });
}

export function clear() {
  requests.length = 0;
  choices.length = 0;
}

/**
 * Hands the dialogs back to the workbench, so a command run after the suite
 * that queued an answer here is not silently cancelled.
 */
export function uninstall() {
  if (!real) {
    return;
  }

  for (const method of Object.keys(real) as Stubbed[]) {
    replace(method, real[method]);
  }

  real = undefined;
  clear();
}

export const raised = (kind: Request["kind"]) =>
  requests.filter((request) => request.kind === kind);
