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

import { until } from "./index";

/**
 * Stands in for the person a notification is addressed to.
 *
 * A notification's buttons are drawn by the workbench and there is no API that
 * presses one, so a command that asks before it acts cannot be driven to
 * either answer. This takes the same place the browser stand-in does in
 * utils/insights.ts: it replaces the part outside the extension — the reader —
 * and leaves the extension itself alone. Every notification is recorded, and
 * one is only answered when a test has said what to answer it with; anything
 * else is passed to the workbench and shown as usual.
 */

export interface Notification {
  kind: "info" | "warning" | "error";
  message: string;
  buttons: string[];
}

// Every notification raised since the last clear(), in order.
export const notifications: Notification[] = [];

interface Answer {
  match: string;
  button: string;
}

const answers: Answer[] = [];
let installed = false;

const KINDS = {
  info: "showInformationMessage",
  warning: "showWarningMessage",
  error: "showErrorMessage",
} as const;

function install() {
  if (installed) {
    return;
  }
  installed = true;

  for (const [kind, method] of Object.entries(KINDS) as [
    Notification["kind"],
    (typeof KINDS)[keyof typeof KINDS],
  ][]) {
    const real = vscode.window[method] as any;

    Object.defineProperty(vscode.window, method, {
      configurable: true,
      writable: true,
      value: (message: string, ...rest: any[]) => {
        // The options object, when there is one, comes before the buttons.
        const buttons = rest.filter(
          (item): item is string => typeof item === "string",
        );
        notifications.push({ kind, message, buttons });

        const index = answers.findIndex((answer) =>
          message.includes(answer.match),
        );
        if (index === -1) {
          return real.call(vscode.window, message, ...rest);
        }

        return Promise.resolve(answers.splice(index, 1)[0].button);
      },
    });
  }
}

/**
 * Presses `button` on the next notification whose message contains `match`.
 * Queued rather than applied, because the notification is raised part way
 * through the command being tested.
 */
export function answer(match: string, button: string) {
  install();
  answers.push({ match, button });
}

export function clear() {
  install();
  notifications.length = 0;
  answers.length = 0;
}

// The notifications raised so far, of any kind, whose message contains `text`.
export const raised = (text: string) =>
  notifications.filter((notification) => notification.message.includes(text));

/**
 * Waits for a notification carrying `text`. A command resolves before the
 * notifications it raises on the way have all been recorded, so what was said
 * has to be waited for rather than read once.
 */
export const untilRaised = (text: string) =>
  until(() => raised(text).length > 0, `a notification saying "${text}"`);
