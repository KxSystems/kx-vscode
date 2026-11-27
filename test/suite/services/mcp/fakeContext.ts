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

import * as vscode from "vscode";

// The parts of ExtensionContext the MCP code reads: globalState and secrets
export function fakeContext(): vscode.ExtensionContext {
  const globals = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  return {
    globalState: {
      get: <T>(key: string, fallback?: T) =>
        globals.has(key) ? (globals.get(key) as T) : fallback,
      update: async (key: string, value: unknown) => {
        globals.set(key, value);
      },
    },
    secrets: {
      get: async (key: string) => secrets.get(key),
      store: async (key: string, value: string) => {
        secrets.set(key, value);
      },
      onDidChange: () => ({ dispose: () => undefined }),
    },
  } as unknown as vscode.ExtensionContext;
}
