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
import { InsightDetails, Insights } from "../models/insights";
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
  private _onDidChangeTreeData: EventEmitter<
    KdbNode | InsightsNode | undefined | void
  > = new EventEmitter<KdbNode | InsightsNode | undefined | void>();
  readonly onDidChangeTreeData: Event<
    KdbNode | InsightsNode | undefined | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private serverList: Server,
    private insightList: Insights,
  ) {}

  reload(): void {
    this._onDidChangeTreeData.fire();
  }

  refresh(serverList: Server): void {
    ext.isBundleQCreated = false;
    this.serverList = serverList;
    this._onDidChangeTreeData.fire();
  }

  refreshInsights(insightsList: Insights): void {
    this.insightList = insightsList;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: KdbNode | InsightsNode): TreeItem {
    if (
      element instanceof KdbNode &&
      element.details.managed &&
      element.details.serverAlias === "local"
    ) {
      ext.isBundleQCreated = true;
    }
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.serverList) {
      return Promise.resolve([]);
    }
    if (!this.insightList) {
      return Promise.resolve([]);
    }

    if (!element) {
      return Promise.resolve(this.getMergedElements(element));
    } else if (
      element.contextValue !== undefined &&
      ext.kdbrootNodes.indexOf(element.contextValue) !== -1
    ) {
      return Promise.resolve(await this.getNamespaces());
    } else if (element.contextValue === "ns") {
      return Promise.resolve(
        this.getCategories(
          (element as QNamespaceNode).details?.toString(),
          ext.qObjectCategories,
        ),
      );
    } else {
      return Promise.resolve(this.getServerObjects(element));
    }
  }

  private getMergedElements(_element?: TreeItem): TreeItem[] {
    const servers = this.getChildElements(_element);
    const insights = this.getInsightsChildElements();
    return [...servers, ...insights];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getChildElements(_element?: TreeItem): KdbNode[] {
    return this.createLeafItems(this.serverList);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getInsightsChildElements(_element?: InsightsNode): InsightsNode[] {
    return this.createInsightLeafItems(this.insightList);
  }

  private async getNamespaces(): Promise<QNamespaceNode[]> {
    const ns = await loadNamespaces();
    const result = ns.map(
      (x) =>
        new QNamespaceNode(
          [],
          x.name,
          "",
          TreeItemCollapsibleState.Collapsed,
          x.fname,
        ),
    );
    if (result !== undefined) {
      return result;
    } else {
      return new Array<QNamespaceNode>();
    }
  }

  private async getCategories(
    ns: string | undefined,
    objectCategories: string[],
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
          TreeItemCollapsibleState.Collapsed,
        ),
    );
    return result;
  }

  private async getServerObjects(
    serverType: TreeItem,
  ): Promise<QServerNode[] | QNamespaceNode[]> {
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
            "p-dictionary",
          ),
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
            "p-function",
          ),
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
            "p-table",
          ),
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
            `${ns === "." ? "." : ""}${x.name}`,
            "",
            TreeItemCollapsibleState.None,
            "p-var",
          ),
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
            "p-view",
          ),
      );
      if (result !== undefined) {
        return result;
      } else {
        return new Array<QServerNode>();
      }
    } else if (serverType.label === ext.qObjectCategories[5]) {
      // nested namespaces
      const namespaces = await loadNamespaces(ns);
      const result = namespaces.map(
        (x) =>
          new QNamespaceNode(
            [],
            x.fname,
            "",
            TreeItemCollapsibleState.Collapsed,
            x.fname,
          ),
      );
      if (result !== undefined) {
        return result;
      } else {
        return Array<QNamespaceNode>();
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
            : TreeItemCollapsibleState.None,
        ),
    );
  }

  private createInsightLeafItems(insights: Insights): InsightsNode[] {
    const keys: string[] = Object.keys(insights);
    return keys.map(
      (x) =>
        new InsightsNode(
          [],
          insights[x].alias,
          insights[x],
          TreeItemCollapsibleState.None,
        ),
    );
  }
}

export class KdbNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: ServerDetails,
    public readonly collapsibleState: TreeItemCollapsibleState,
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

    // set context for nodes without auth
    if (details.auth === false) {
      if (ext.kdbNodesWithoutAuth.indexOf(label) === -1) {
        ext.kdbNodesWithoutAuth.push(label);
        commands.executeCommand(
          "setContext",
          "kdb.kdbNodesWithoutAuth",
          ext.kdbNodesWithoutAuth,
        );
      }
    } else {
      const index = ext.kdbNodesWithoutAuth.indexOf(label);
      if (index !== -1) {
        ext.kdbNodesWithoutAuth.splice(index, 1);
        commands.executeCommand(
          "setContext",
          "kdb.kdbNodesWithoutAuth",
          ext.kdbNodesWithoutAuth,
        );
      }
    }

    // set context for nodes without tls
    if (details.tls === false) {
      if (ext.kdbNodesWithoutTls.indexOf(label) === -1) {
        ext.kdbNodesWithoutTls.push(label);
        commands.executeCommand(
          "setContext",
          "kdb.kdbNodesWithoutTls",
          ext.kdbNodesWithoutTls,
        );
      }
    } else {
      const index = ext.kdbNodesWithoutTls.indexOf(label);
      if (index !== -1) {
        ext.kdbNodesWithoutTls.splice(index, 1);
        commands.executeCommand(
          "setContext",
          "kdb.kdbNodesWithoutTls",
          ext.kdbNodesWithoutTls,
        );
      }
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
        : "p-data.svg",
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
        : "p-data.svg",
    ),
  };

  contextValue = this.label; // "root";
}

export class InsightsNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: InsightDetails,
    public readonly collapsibleState: TreeItemCollapsibleState,
  ) {
    let auxLabel = label;
    if (ext.connectionNode != undefined && label === ext.connectionNode.label) {
      auxLabel = label;
      label = label + " (connected)";
    } else {
      auxLabel = label + " (connected)";
    }
    // set context for root nodes
    if (ext.kdbinsightsNodes.indexOf(label) === -1) {
      const indexOriginalLabel = ext.kdbinsightsNodes.indexOf(auxLabel);
      if (indexOriginalLabel !== -1) {
        ext.kdbinsightsNodes.splice(indexOriginalLabel, 1);
      }
      ext.kdbinsightsNodes.push(label);
      commands.executeCommand(
        "setContext",
        "kdb.insightsNodes",
        ext.kdbinsightsNodes,
      );
    }

    super(label, collapsibleState);
    this.tooltip = details.server;
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
        ? "p-insights.svg"
        : "p-insights.svg",
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      ext.connectionNode != undefined &&
        this.label === ext.connectionNode.label + " (connected)"
        ? "p-insights.svg"
        : "p-insights.svg",
    ),
  };

  contextValue = this.label; // "root";
}

export class QNamespaceNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly fullName: string,
  ) {
    details = fullName;
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
      "p-file.svg",
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
    public readonly collapsibleState: TreeItemCollapsibleState,
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
      "p-folder.svg",
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "p-folder.svg",
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
    public readonly coreIcon: string,
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
      `${this.coreIcon}.svg`,
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      `${this.coreIcon}.svg`,
    ),
  };
  contextValue = this.label;
}
