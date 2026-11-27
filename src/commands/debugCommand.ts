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

import { basename, join } from "path";
import * as vscode from "vscode";

import { QDebugSession } from "../debugger/debugSession";
import { killDebugTerminal } from "../debugger/debugTerminal";
import { ext } from "../extensionVariables";
import { MessageKind, notify } from "../utils/notifications";

export const DEBUG_TYPE = "q";

const STOP = "Stop and Debug";
const RESTART = "Restart";

const activeSessions = new Map<string, vscode.DebugSession>();
let confirming = false;

function programOf(session: vscode.DebugSession) {
  const program = session.configuration.program;
  return session.type === DEBUG_TYPE && typeof program === "string"
    ? program
    : undefined;
}

export async function debugFile(uri?: vscode.Uri) {
  const editor = vscode.window.activeTextEditor;
  const document = uri
    ? await vscode.workspace.openTextDocument(uri)
    : editor?.document;
  if (!document || document.languageId !== "q") {
    vscode.window.showErrorMessage("No active q file to debug.");
    return;
  }
  if (document.isDirty) {
    await document.save();
  }
  const program = document.uri.fsPath;
  await vscode.debug.startDebugging(
    vscode.workspace.getWorkspaceFolder(document.uri),
    {
      type: DEBUG_TYPE,
      request: "launch",
      name: "q: Debug File",
      program,
    },
  );
}

interface DebugValueContext {
  sessionId?: string;
  variable?: { value?: string; evaluateName?: string };
}

export async function showValueInConsole(context?: DebugValueContext) {
  const variable = context?.variable;
  const session =
    activeSessions.get(context?.sessionId ?? "") ??
    vscode.debug.activeDebugSession;
  if (!variable || session?.type !== DEBUG_TYPE) return;
  let text = variable.value ?? "";
  if (variable.evaluateName) {
    const item = vscode.debug.activeStackItem;
    const frameId =
      item instanceof vscode.DebugStackFrame && item.session.id === session.id
        ? item.frameId
        : undefined;
    text = await session
      .customRequest("evaluate", {
        expression: variable.evaluateName,
        frameId,
        context: "clipboard",
      })
      .then(
        (reply: { result?: string }) => reply.result ?? text,
        () => text,
      );
  }
  vscode.debug.activeDebugConsole.appendLine(text);
  await vscode.commands.executeCommand("workbench.debug.action.focusRepl");
}

async function stopRunningSessions(
  configuration: vscode.DebugConfiguration,
): Promise<boolean> {
  const running = [...activeSessions.values()];
  if (running.length === 0) return true;
  if (confirming) return false;
  const current = programOf(running[0]);
  const next = configuration.program;
  const name = current ? basename(current) : running[0].name;
  const same =
    typeof next === "string" &&
    running.every((session) => programOf(session) === next);
  const action = same ? RESTART : STOP;
  confirming = true;
  try {
    const choice = await notify(
      same
        ? `${name} is being debugged. Restart it?`
        : `${name} is being debugged. Stop it and debug ${typeof next === "string" ? basename(next) : configuration.name} instead?`,
      MessageKind.WARNING,
      { logger: "debugCommand", modal: true },
      action,
    );
    if (choice !== action) return false;
    await Promise.all(
      running.map((session) => vscode.debug.stopDebugging(session)),
    );
    return true;
  } finally {
    confirming = false;
  }
}

export function registerDebugger(context: vscode.ExtensionContext) {
  const helper = context.asAbsolutePath(join("resources", "q", "debug.q"));
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((session) => {
      if (session.type === DEBUG_TYPE) activeSessions.set(session.id, session);
    }),
    vscode.debug.onDidTerminateDebugSession((session) => {
      activeSessions.delete(session.id);
    }),
    vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, {
      async resolveDebugConfiguration(_folder, configuration) {
        if (!configuration.type && !configuration.request) {
          const document = vscode.window.activeTextEditor?.document;
          if (document?.languageId !== "q") {
            return undefined;
          }
          configuration.type = DEBUG_TYPE;
          configuration.request = "launch";
          configuration.name = "q: Debug File";
          configuration.program = document.uri.fsPath;
        }
        configuration.internalConsoleOptions = "neverOpen";
        return (await stopRunningSessions(configuration))
          ? configuration
          : undefined;
      },
    }),
    vscode.debug.registerDebugAdapterDescriptorFactory(DEBUG_TYPE, {
      createDebugAdapterDescriptor: () => {
        notify("Debug session started.", MessageKind.DEBUG, {
          logger: "debugCommand",
          telemetry: "Debug.Start",
        });
        return new vscode.DebugAdapterInlineImplementation(
          new QDebugSession(() => ext.client, helper),
        );
      },
    }),
    { dispose: killDebugTerminal },
  );
}
