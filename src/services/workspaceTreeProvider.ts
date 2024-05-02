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

import {
  Command,
  EventEmitter,
  RelativePattern,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace,
} from "vscode";
import Path from "path";
import { getServerIconState } from "../utils/core";
import { getConnectionForUri } from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";

export class WorkspaceTreeProvider implements TreeDataProvider<FileTreeItem> {
  private _onDidChangeTreeData = new EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly glob: string,
    private readonly baseIcon: string,
  ) {
    ext.serverProvider.onDidChangeTreeData(() => this.reload());
  }

  reload() {
    this._onDidChangeTreeData.fire();
  }

  getChildren(element?: FileTreeItem) {
    if (element) {
      return element.getChildren();
    }
    const folders = workspace.workspaceFolders;
    if (folders) {
      return Promise.resolve(
        folders.map(
          (folder) => new FileTreeItem(folder.uri, this.baseIcon, this.glob),
        ),
      );
    }
    return Promise.resolve([]);
  }

  getTreeItem(element: FileTreeItem) {
    return element;
  }
}

export class FileTreeItem extends TreeItem {
  private declare pattern?: RelativePattern;

  constructor(
    resourceUri: Uri,
    private readonly baseIcon: string,
    glob?: string,
  ) {
    super(resourceUri);
    this.id = resourceUri.toString();
    if (glob) {
      const folder = workspace.getWorkspaceFolder(resourceUri);
      if (folder) {
        this.pattern = new RelativePattern(folder, glob);
        this.collapsibleState = TreeItemCollapsibleState.Expanded;
      }
    } else {
      this.command = <Command>{
        title: "",
        command: "vscode.open",
        arguments: [resourceUri],
      };
    }
  }

  private updateIconPath() {
    let state = "";
    if (this.resourceUri) {
      const connection = getConnectionForUri(this.resourceUri);
      if (connection) {
        state = getServerIconState(connection.label);
      }
    }
    this.iconPath = Path.join(
      __filename,
      "../".repeat(2),
      "resources",
      this.baseIcon + state + ".svg",
    );
  }

  async getChildren(): Promise<FileTreeItem[]> {
    if (this.pattern) {
      const files = await workspace.findFiles(this.pattern);
      return files
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((file) => {
          const item = new FileTreeItem(file, this.baseIcon);
          item.updateIconPath();
          return item;
        });
    }
    return [];
  }
}

export async function addWorkspaceFile(
  item: FileTreeItem,
  name: string,
  ext: string,
) {
  const folders = workspace.workspaceFolders;
  if (folders) {
    const folder =
      item && item.resourceUri
        ? workspace.getWorkspaceFolder(item.resourceUri)
        : folders[0];
    if (folder) {
      let i = 1;
      while (true) {
        const files = await workspace.findFiles(`${name}-${i}${ext}`);
        if (files.length === 0) {
          break;
        }
        i++;
      }
      const uri = Uri.joinPath(folder.uri, `${name}-${i}${ext}`).with({
        scheme: "untitled",
      });
      await workspace.openTextDocument(uri);
      return uri;
    }
  }
}
