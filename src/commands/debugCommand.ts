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

import { join } from "path";
import * as vscode from "vscode";

import { QDebugSession } from "../debugger/debugSession";
import { killDebugTerminal } from "../debugger/debugTerminal";
import { ext } from "../extensionVariables";
import { MessageKind, notify } from "../utils/notifications";

export const DEBUG_TYPE = "q";

const activePrograms = new Set<string>();

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
  if (activePrograms.has(program)) {
    return;
  }
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

export function registerDebugger(context: vscode.ExtensionContext) {
  const helper = context.asAbsolutePath(join("resources", "q", "debug.q"));
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((session) => {
      const program = programOf(session);
      if (program) activePrograms.add(program);
    }),
    vscode.debug.onDidTerminateDebugSession((session) => {
      const program = programOf(session);
      if (program) activePrograms.delete(program);
    }),
    vscode.debug.registerDebugConfigurationProvider(DEBUG_TYPE, {
      resolveDebugConfiguration(_folder, configuration) {
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
        return configuration;
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
