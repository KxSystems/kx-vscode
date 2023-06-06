import * as path from "path";
import {
  Event,
  EventEmitter,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  commands,
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
import { getServerName } from "../utils/core";

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
    } else if (
      element.contextValue !== undefined &&
      ext.kdbrootNodes.indexOf(element.contextValue) !== -1
    ) {
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
    // filter out views for non-default namespaces
    let filteredCategories;
    if (ns !== ".") {
      filteredCategories = objectCategories.filter((item) => {
        return item !== "Views";
      });
    } else {
      filteredCategories = objectCategories;
    }
    const result = filteredCategories.map(
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
            `${ns === "." ? "" : ns + "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None,
            "p-dictionary"
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QServerNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[1]) {
      // functions
      const funcs = await loadFunctions(serverType.contextValue ?? "");
      const result = funcs.map(
        (x) =>
          new QServerNode(
            [],
            `${ns === "." ? "" : ns + "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None,
            "p-function"
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QServerNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[2]) {
      // tables
      const tables = await loadTables(serverType.contextValue ?? "");
      const result = tables.map(
        (x) =>
          new QServerNode(
            [],
            `${ns === "." ? "" : ns + "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None,
            "p-table"
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QServerNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[3]) {
      // variables
      const vars = await loadVariables(serverType.contextValue ?? "");
      const result = vars.map(
        (x) =>
          new QServerNode(
            [],
            `${ns === "." ? "" : ns + "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None,
            "p-var"
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QServerNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[4]) {
      // views
      const views = await loadViews();
      const result = views.map(
        (x) =>
          new QServerNode(
            [],
            `${ns === "." ? "" : "."}${x}`,
            "",
            TreeItemCollapsibleState.None,
            "p-view"
          )
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QServerNode>();
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
          ext.connectionNode?.label === getServerName(servers[x])
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None
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

    // set context for root nodes
    if (ext.kdbrootNodes.indexOf(label) === -1) {
      ext.kdbrootNodes.push(label);
      commands.executeCommand("setContext", "kdb.rootNodes", ext.kdbrootNodes);
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
        ? "p-data.svg"
        : "p-data.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      ext.connectionNode != undefined &&
        this.label === ext.connectionNode.label + " (connected)"
        ? "p-data.svg"
        : "p-data.svg"
    ),
  };

  contextValue = this.label; // "root";
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
      "p-file.svg"
    ),
    dark: path.join(__filename, "..", "..", "resources", "dark", "p-file.svg"),
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
      "p-folder.svg"
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "p-folder.svg"
    ),
  };
  contextValue = this.ns; // "category";
}

export class QServerNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly coreIcon: string
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
      `${this.coreIcon}.svg`
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      `${this.coreIcon}.svg`
    ),
  };
  contextValue = this.label;
}
