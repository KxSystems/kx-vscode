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

import Path from "path";
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

import { getConnectionForUri } from "../commands/workspaceCommand";
import { ext } from "../extensionVariables";
import { getWorkspaceIconsState } from "../utils/core";

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
  declare private pattern?: RelativePattern;

  constructor(
    resourceUri: Uri,
    private baseIcon: string,
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
      this.contextValue = "artifact";
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
        state = getWorkspaceIconsState(connection.label);
      }
    }

    this.iconPath = {
      light: Uri.file(
        Path.join(
          __dirname,
          "..",
          "resources",
          "light",
          this.baseIcon + state + ".svg",
        ),
      ),
      dark: Uri.file(
        Path.join(
          __dirname,
          "..",
          "resources",
          "dark",
          this.baseIcon + state + ".svg",
        ),
      ),
    };
  }

  private getFileIconType(fileName: string) {
    if (fileName.endsWith(".kdb.json")) {
      this.baseIcon = "datasource";
    } else if (fileName.endsWith(".kdb.q")) {
      this.baseIcon = "scratchpad";
    } else {
      this.baseIcon = "python";
    }
  }

  async getChildren(): Promise<FileTreeItem[]> {
    if (this.pattern) {
      const files = await workspace.findFiles(this.pattern);
      return files
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((file) => {
          this.getFileIconType(file.toString());
          const item = new FileTreeItem(file, this.baseIcon);
          item.updateIconPath();
          return item;
        });
    }
    return [];
  }
}
