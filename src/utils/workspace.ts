/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import { Uri, window, workspace } from "vscode";

export function getWorkspaceRoot(
  ignoreException: boolean = false,
): string | undefined {
  const workspaceRoot =
    workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath;

  if (workspaceRoot === undefined && !ignoreException) {
    const error = new Error("Workspace root should be defined");
    throw error;
  }

  return workspaceRoot;
}

export function isWorkspaceOpen(): boolean {
  return !!(
    workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath
  );
}

export async function activateTextDocument(item: Uri) {
  if (item.fsPath) {
    let document = workspace.textDocuments.find(
      (doc) => doc.uri.fsPath === item.fsPath,
    );
    if (!document) {
      document = await workspace.openTextDocument(item);
    }
    if (document) {
      await window.showTextDocument(document);
    }
  }
}
