import path from "path";
import {
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace,
} from "vscode";

export class KdbDataSourceProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> =
    new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: Event<TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      return workspace.findFiles("**/*.ds").then((files) => {
        const dsFiles = new KdbDataSourceTreeItem(
          "DS Files",
          TreeItemCollapsibleState.Expanded,
          files
        );
        return [dsFiles];
      });
    } else if (element instanceof KdbDataSourceTreeItem) {
      return element.getChildren();
    } else {
      return Promise.resolve([]);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
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
