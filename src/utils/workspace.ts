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
  commands,
  Range,
  TextDocumentShowOptions,
  Uri,
  ViewColumn,
  window,
  workspace,
  WorkspaceEdit,
} from "vscode";

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

export async function addWorkspaceFile(
  uri: Uri | undefined,
  name: string,
  ext: string,
  directory = ".kx",
) {
  const folders = workspace.workspaceFolders;
  if (folders) {
    const folder = uri ? workspace.getWorkspaceFolder(uri) : folders[0];
    if (folder) {
      let i = 1;
      while (true) {
        const files = await workspace.findFiles(
          `${directory}/${name}-${i}${ext}`,
        );
        if (files.length === 0) {
          break;
        }
        i++;
        if (i > 100) {
          throw new Error("No available file name found");
        }
      }

      const uri = Uri.joinPath(
        folder.uri,
        directory,
        `${name}-${i}${ext}`,
      ).with({
        scheme: "untitled",
      });

      return uri;
    }
  }
  throw new Error("No workspace has been opened");
}

export async function setUriContent(uri: Uri, content: string) {
  const edit = new WorkspaceEdit();
  edit.replace(uri, new Range(0, 0, 1, 0), content);
  await workspace.applyEdit(edit);
}

export function workspaceHas(uri: Uri) {
  return workspace.textDocuments.some(
    (doc) => doc.uri.toString() == uri.toString(),
  );
}

export async function openWith(
  uri: Uri,
  type: string,
  options?: TextDocumentShowOptions | ViewColumn,
) {
  await commands.executeCommand<void>("vscode.openWith", uri, type, options);
}
