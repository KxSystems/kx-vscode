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

import * as fs from "fs";
import path from "path";
import {
  Event,
  EventEmitter,
  FileSystemWatcher,
  RelativePattern,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  commands,
  workspace,
} from "vscode";
import { ext } from "../extensionVariables";
import {
  checkFileFromInsightsNode,
  createKdbDataSourcesFolder,
} from "../utils/dataSource";

// TODO: DEPRECATED THIS DS PROVIDER WILL BE REMOVED IN VERSION 1.6.0
export class KdbDataSourceProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    KdbDataSourceTreeItem | undefined | void
  > = new EventEmitter<KdbDataSourceTreeItem | undefined | void>();
  readonly onDidChangeTreeData: Event<
    KdbDataSourceTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  private watcher: FileSystemWatcher | undefined;

  constructor() {
    this.refresh();
    const datasourceFolder = createKdbDataSourcesFolder();
    this.watcher = workspace.createFileSystemWatcher(
      new RelativePattern(datasourceFolder, ext.kdbDataSourceFileGlob),
    );
    // watch updates in the folder
    this.watcher.onDidChange(() => this.refresh());
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  getTreeItem(element: KdbDataSourceTreeItem): KdbDataSourceTreeItem {
    return element;
  }

  getChildren(
    element?: KdbDataSourceTreeItem,
  ): Promise<KdbDataSourceTreeItem[]> {
    if (!element) {
      return this.getDsFiles();
    } else {
      return Promise.resolve([]);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
    }
  }

  private getDsFiles(): Promise<KdbDataSourceTreeItem[]> {
    const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
    if (kdbDataSourcesFolderPath) {
      const files = fs.readdirSync(kdbDataSourcesFolderPath);
      const dsFiles = files.filter((file) => {
        const isFromInsightsNode = checkFileFromInsightsNode(
          path.join(kdbDataSourcesFolderPath, file),
        );
        return (
          path.extname(file) === ext.kdbDataSourceFileExtension &&
          isFromInsightsNode
        );
      });
      return Promise.resolve(
        dsFiles.map((file) => {
          const newLabel = file.replace(ext.kdbDataSourceFileExtension, "");
          return new KdbDataSourceTreeItem(
            newLabel,
            TreeItemCollapsibleState.None,
            [Uri.file(path.join(kdbDataSourcesFolderPath, file))],
          );
        }),
      );
    } else {
      return Promise.resolve([]);
    }
  }
}

export class KdbDataSourceTreeItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly files: Uri[],
  ) {
    super(label, collapsibleState);
    this.iconPath = new ThemeIcon("file");
    this.command = {
      title: "Open DataSource",
      command: "kdb.dataSource.openDataSource",
      arguments: [this, ext.context.extensionUri],
    };
    if (ext.kdbDataSourceRootNodes.indexOf(label) === -1) {
      ext.kdbDataSourceRootNodes.push(label);
      commands.executeCommand(
        "setContext",
        "kdb.dataSourceTreeNodes",
        ext.kdbDataSourceRootNodes,
      );
    }
  }

  getChildren(): Promise<kdbDataSource[]> {
    return Promise.resolve(this.files.map((file) => new kdbDataSource(file)));
  }

  contextValue = this.label;
}

export class kdbDataSource extends TreeItem {
  constructor(public readonly resourceUri: Uri) {
    super(path.basename(resourceUri.fsPath));
    this.iconPath = new ThemeIcon("file");
    this.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [resourceUri],
    };
  }
}
