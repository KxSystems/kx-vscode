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
import { createKdbDataSourcesFolder } from "../utils/dataSource";

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
      new RelativePattern(datasourceFolder, ext.kdbDataSourceFileGlob)
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
    element?: KdbDataSourceTreeItem
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
      const dsFiles = files.filter(
        (file) => path.extname(file) === ext.kdbDataSourceFileExtension
      );

      return Promise.resolve(
        dsFiles.map((file) => {
          const label = file.slice(0, -3);
          return new KdbDataSourceTreeItem(
            label,
            TreeItemCollapsibleState.None,
            [Uri.file(path.join(kdbDataSourcesFolderPath, file))]
          );
        })
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
    this.iconPath = new ThemeIcon("file");

    // set context for root nodes
    if (ext.kdbDataSourceRootNodes.indexOf(label) === -1) {
      commands.executeCommand(
        "setContext",
        "kdb.dataSourceTreeNodes",
        ext.kdbDataSourceRootNodes
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
