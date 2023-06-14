import * as fs from "fs";
import path from "path";
import {
  Event,
  EventEmitter,
  FileSystemWatcher,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  commands,
  workspace,
} from "vscode";
import { ext } from "../extensionVariables";
import { createKdbDataSourcesFolder } from "../utils/dataSource";

export class KdbDataSourceProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  private watcher: FileSystemWatcher | undefined;

  constructor() {
    this.refresh();
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders) {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const kdbDataSourcesFolderPath = path.join(
        rootPath,
        ext.kdbDataSourceFolder
      );

      this.watcher = workspace.createFileSystemWatcher(
        path.join(kdbDataSourcesFolderPath, ext.kdbDataSourceFileGlob)
      );
      // watch updates in the folder
      this.watcher.onDidChange(() => this.refresh());
      this.watcher.onDidCreate(() => this.refresh());
      this.watcher.onDidDelete(() => this.refresh());
    }
  }

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return this.getDsFiles();
    } else {
      return Promise.resolve([]);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.dispose();
    }
  }

  private getDsFiles(): Thenable<TreeItem[]> {
    const kdbDataSourcesFolderPath = createKdbDataSourcesFolder();
    if (kdbDataSourcesFolderPath) {
      const files = fs.readdirSync(kdbDataSourcesFolderPath);
      const dsFiles = files.filter((file) => path.extname(file) === ".ds");

      return Promise.resolve(
        dsFiles.map((file) => new TreeItem(file, TreeItemCollapsibleState.None))
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
    public readonly files: Uri[]
  ) {
    super(label, collapsibleState);
    this.iconPath = new ThemeIcon("file-code");

    // set context for root nodes
    if (ext.kdbDataSourceRootNodes.indexOf(label) === -1) {
      ext.kdbDataSourceRootNodes.push(label);
      commands.executeCommand(
        "setContext",
        "kdb.dataSourceTreeNodes",
        ext.kdbDataSourceRootNodes
      );
    }
  }

  getChildren(): Thenable<kdbDataSource[]> {
    return Promise.resolve(this.files.map((file) => new kdbDataSource(file)));
  }
}

export class kdbDataSource extends TreeItem {
  constructor(public readonly resourceUri: Uri) {
    super(path.basename(resourceUri.fsPath));
    this.iconPath = new ThemeIcon("file-code");
    this.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [resourceUri],
    };
  }
}
