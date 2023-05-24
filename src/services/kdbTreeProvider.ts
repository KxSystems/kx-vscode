import * as path from "path";
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { ext } from "../extensionVariables";
import { Server, ServerDetails } from "../models/server";
import {
  loadDictionaries,
  loadFunctions,
  loadNamespaces,
  loadTables,
  loadVariables,
  loadViews,
} from "../models/serverObject";

export class KdbTreeProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<KdbNode | undefined | void> =
    new EventEmitter<KdbNode | undefined | void>();
  readonly onDidChangeTreeData: Event<KdbNode | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private serverList: Server) {}

  reload(): void {
    this._onDidChangeTreeData.fire();
  }

  refresh(serverList: Server): void {
    this.serverList = serverList;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KdbNode): TreeItem {
    return element;
  }

  async getChildren(
    element?: TreeItem
  ): Promise<KdbNode[] | QCategoryNode[] | QNamespaceNode[] | QServerNode[]> {
    if (!this.serverList) {
      return Promise.resolve([]);
    }
    if (!element) {
      return Promise.resolve(this.getChildElements(element));
    } else if (element.contextValue === "root") {
      return Promise.resolve(await this.getNamespaces());
    } else if (element.contextValue === "ns") {
      return Promise.resolve(
        this.getCategories(element.label?.toString(), ext.qObjectCategories)
      );
    } else {
      return Promise.resolve(this.getServerObjects(element));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getChildElements(_element?: KdbNode): KdbNode[] {
    return this.createLeafItems(this.serverList);
  }

  private async getNamespaces(): Promise<QNamespaceNode[]> {
    const ns = await loadNamespaces();
    const result = ns.map(
      (x) =>
        new QNamespaceNode([], x.name, "", TreeItemCollapsibleState.Collapsed)
    );
    if (result !== undefined) {
      return result;
    } else {
      return new Array<QNamespaceNode>();
    }
  }

  private async getCategories(
    ns: string | undefined,
    objectCategories: string[]
  ): Promise<QCategoryNode[]> {
    const result = objectCategories.map(
      (x) =>
        new QCategoryNode(
          [],
          x,
          "",
          ns ?? "",
          TreeItemCollapsibleState.Collapsed
        )
    );
    return result;
  }

  private async getServerObjects(serverType: TreeItem): Promise<QServerNode[]> {
    if (serverType === undefined) return new Array<QServerNode>();
    const ns = serverType.contextValue ?? "";
    if (serverType.label === ext.qObjectCategories[0]) {
      // dictionaries
      const dicts = await loadDictionaries(serverType.contextValue ?? "");
      const result = dicts.map(
        (x) =>
          new QServerNode(
            [],
            `${ns}${ns === "." ? "" : "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QCategoryNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[1]) {
      // functions
      const funcs = await loadFunctions(serverType.contextValue ?? "");
      const result = funcs.map(
        (x) =>
          new QServerNode(
            [],
            `${ns}${ns === "." ? "" : "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QCategoryNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[2]) {
      // tables
      const tables = await loadTables(serverType.contextValue ?? "");
      const result = tables.map(
        (x) =>
          new QServerNode(
            [],
            `${ns}${ns === "." ? "" : "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QCategoryNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[3]) {
      // variables
      const vars = await loadVariables(serverType.contextValue ?? "");
      const result = vars.map(
        (x) =>
          new QServerNode(
            [],
            `${ns}${ns === "." ? "" : "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QCategoryNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[4]) {
      // views
      const views = await loadViews(serverType.contextValue ?? "");
      const result = views.map(
        (x) =>
          new QServerNode(
            [],
            `${ns}${ns === "." ? "" : "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QCategoryNode>();
      }
    }
    return new Array<QServerNode>();
  }

  private createLeafItems(servers: Server): KdbNode[] {
    const keys: string[] = Object.keys(servers);
    return keys.map(
      (x) =>
        new KdbNode(
          x.split(":"),
          `${servers[x].serverName}:${servers[x].serverPort}`,
          servers[x],
          TreeItemCollapsibleState.Collapsed
        )
    );
  }
}

export class KdbNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: ServerDetails,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    if (details.serverAlias != "") {
      label = label + ` [${details.serverAlias}]`;
    }

    if (ext.connectionNode != undefined && label === ext.connectionNode.label) {
      label = label + " (connected)";
    }

    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return this.collapsibleState === TreeItemCollapsibleState.None &&
      this.children.length > 2
      ? `${this.children[2]}:${"*".repeat(this.children[3].length)}`
      : "";
  }

  iconPath = {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      ext.connectionNode != undefined &&
        this.label === ext.connectionNode.label + " (connected)"
        ? "db-connected.svg"
        : "db-disconnected.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      ext.connectionNode != undefined &&
        this.label === ext.connectionNode.label + " (connected)"
        ? "db-connected.svg"
        : "db-disconnected.svg"
    ),
  };

  contextValue = "root"; // this.label;
}

export class QNamespaceNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    details = "";
    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return "";
  }

  iconPath = {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      "dependency.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "dependency.svg"
    ),
  };
  contextValue = "ns";
}

export class QCategoryNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly ns: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    details = "";
    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return "";
  }

  iconPath = {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      "dependency.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "dependency.svg"
    ),
  };
  contextValue = this.ns; // "category";
}

export class QServerNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    details = "";
    super(label, collapsibleState);
    this.description = this.getDescription();
  }

  getDescription(): string {
    return "";
  }

  iconPath = {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      "dependency.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "dependency.svg"
    ),
  };
  contextValue = this.label;
}
