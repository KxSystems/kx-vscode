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
  MarkdownString,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  commands,
} from "vscode";
import { ext } from "../extensionVariables";
import {
  loadDictionaries,
  loadFunctions,
  loadNamespaces,
  loadTables,
  loadVariables,
  loadViews,
} from "../models/serverObject";
import {
  getInsightsAlias,
  getServerAlias,
  getServerIconState,
  getServerName,
  getStatus,
} from "../utils/core";
import { ConnectionManagementService } from "./connectionManagerService";
import { InsightsConnection } from "../classes/insightsConnection";
import {
  getWorkspaceLabels,
  getWorkspaceLabelsConnMap,
  isLabelContentChanged,
  isLabelEmpty,
  retrieveConnLabelsNames,
} from "../utils/connLabel";
import { Labels } from "../models/labels";
import {
  InsightDetails,
  Insights,
  Server,
  ServerDetails,
} from "../models/connectionsModels";

export class KdbTreeProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    KdbNode | InsightsNode | undefined | void
  > = new EventEmitter<KdbNode | InsightsNode | undefined | void>();
  readonly onDidChangeTreeData: Event<
    KdbNode | InsightsNode | undefined | void
  > = this._onDidChangeTreeData.event;

  constructor(
    private serverList: Server,
    private insightsList: Insights,
  ) {}

  reload(): void {
    this._onDidChangeTreeData.fire();
  }

  refresh(serverList: Server): void {
    ext.isBundleQCreated = false;
    this.serverList = serverList;
    commands.executeCommand(
      "setContext",
      "kdb.selectContentNodesContext",
      ext.selectContentNodesContext,
    );
    this._onDidChangeTreeData.fire();
  }

  refreshInsights(insightsList: Insights): void {
    this.insightsList = insightsList;
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
    if (
      element instanceof InsightsMetaNode ||
      element instanceof MetaObjectPayloadNode
    ) {
      element.command = {
        command: "kdb.open.meta",
        title: "Open Meta Object",
        arguments: [element],
      };
    }
    if (element instanceof QServerNode) {
      element.contextValue = ext.selectContentNodesContext[0];
    }
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!this.serverList || !this.insightsList) {
      return [];
    }

    if (!element) {
      getWorkspaceLabels();
      getWorkspaceLabelsConnMap();

      const orphans: TreeItem[] = [];
      const nodes = ext.connLabelList.map((label) => new LabelNode(label));
      const items = this.getMergedElements(element);

      let orphan, found;
      for (const item of items) {
        orphan = true;
        if (item instanceof KdbNode || item instanceof InsightsNode) {
          const labels = retrieveConnLabelsNames(item);
          for (const label of labels) {
            found = nodes.find((node) => label === node.source.name);
            if (found) {
              found.children.push(item);
              orphan = false;
            }
          }
        }
        if (orphan) {
          orphans.push(item);
        }
      }
      return [...orphans, ...nodes];
    } else if (element instanceof LabelNode) {
      return element.children;
    } else if (
      element.contextValue !== undefined &&
      ext.kdbrootNodes.indexOf(element.contextValue) !== -1
    ) {
      return Promise.resolve(await this.getNamespaces(element.contextValue));
    } else if (
      element.contextValue !== undefined &&
      ext.kdbinsightsNodes.indexOf(element.contextValue) !== -1
    ) {
      return Promise.resolve(await this.getMetas(element.contextValue));
    } else if (element.contextValue === "ns") {
      return Promise.resolve(
        this.getCategories(
          (element as QNamespaceNode).details?.toString(),
          ext.qObjectCategories,
          (element as QNamespaceNode).connLabel,
        ),
      );
    } else if (
      element.contextValue === "meta" &&
      element instanceof InsightsMetaNode
    ) {
      return Promise.resolve(this.getMetaObjects(element.connLabel));
    } else {
      return Promise.resolve(this.getServerObjects(element));
    }
  }

  private getMergedElements(_element?: TreeItem): TreeItem[] {
    ext.connectionsList.length = 0;
    const servers = this.getChildElements(_element);
    const insights = this.getInsightsChildElements();
    ext.connectionsList.push(...servers, ...insights);
    ext.kdbConnectionAliasList.length = 0;
    getServerAlias(servers.map((x) => x.details));
    getInsightsAlias(insights.map((x) => x.details));
    return [...servers, ...insights];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getChildElements(_element?: TreeItem): KdbNode[] {
    return this.createLeafItems(this.serverList);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getInsightsChildElements(_element?: InsightsNode): InsightsNode[] {
    return this.createInsightLeafItems(this.insightsList);
  }

  /* istanbul ignore next */
  private async getMetas(connLabel: string): Promise<InsightsMetaNode[]> {
    const connMng = new ConnectionManagementService();
    const conn = connMng.retrieveConnectedConnection(connLabel);
    if (conn) {
      return [
        new InsightsMetaNode(
          [],
          "meta",
          "",
          TreeItemCollapsibleState.Collapsed,
          connLabel,
        ),
      ];
    } else {
      return new Array<InsightsMetaNode>();
    }
  }

  private async getNamespaces(connLabel?: string): Promise<QNamespaceNode[]> {
    const ns = await loadNamespaces();
    const result = ns.map(
      (x) =>
        new QNamespaceNode(
          [],
          x.name,
          "",
          TreeItemCollapsibleState.Collapsed,
          x.fname,
          connLabel ?? "",
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
    connLabel?: string,
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
          connLabel ?? "",
        ),
    );
    return result;
  }

  private async getServerObjects(
    serverType: QCategoryNode | TreeItem,
  ): Promise<QServerNode[] | QNamespaceNode[]> {
    console.log(serverType);
    if (serverType === undefined) return new Array<QServerNode>();
    const ns = serverType.contextValue ?? "";
    const connLabel =
      serverType instanceof QCategoryNode ? serverType.connLabel : "";
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
            connLabel,
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
            connLabel,
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
            connLabel,
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
            `${ns === "." ? "" : ns + "."}${x.name}`,
            "",
            TreeItemCollapsibleState.None,
            "p-var",
            connLabel,
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
            connLabel,
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
            connLabel,
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

  /* istanbul ignore next */
  private async getMetaObjects(
    connLabel: string,
  ): Promise<MetaObjectPayloadNode[]> {
    const connMng = new ConnectionManagementService();
    const conn = connMng.retrieveConnectedConnection(connLabel);
    const isInsights = conn instanceof InsightsConnection;
    if (conn && isInsights) {
      const meta = conn.meta;
      if (!meta) {
        return new Array<MetaObjectPayloadNode>();
      }
      const objects: MetaObjectPayloadNode[] = [];
      if (meta.payload.schema) {
        objects.push(
          new MetaObjectPayloadNode(
            [],
            "schema",
            "",
            TreeItemCollapsibleState.None,
            "schemaicon",
            connLabel,
          ),
        );
      }
      if (meta.payload.api) {
        objects.push(
          new MetaObjectPayloadNode(
            [],
            "api",
            "",
            TreeItemCollapsibleState.None,
            "apiicon",
            connLabel,
          ),
        );
      }
      if (meta.payload.dap) {
        objects.push(
          new MetaObjectPayloadNode(
            [],
            "dap",
            "",
            TreeItemCollapsibleState.None,
            "dapicon",
            connLabel,
          ),
        );
      }
      if (meta.payload.rc) {
        objects.push(
          new MetaObjectPayloadNode(
            [],
            "rc",
            "",
            TreeItemCollapsibleState.None,
            "rcicon",
            connLabel,
          ),
        );
      }
      if (meta.payload.agg) {
        objects.push(
          new MetaObjectPayloadNode(
            [],
            "agg",
            "",
            TreeItemCollapsibleState.None,
            "aggicon",
            connLabel,
          ),
        );
      }

      return objects;
    } else {
      return new Array<MetaObjectPayloadNode>();
    }
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
    const connMng = new ConnectionManagementService();
    const keys: string[] = Object.keys(insights);
    return keys.map((x) => {
      const isConnected = connMng.retrieveConnectedConnection(
        insights[x].alias,
      );
      return new InsightsNode(
        [],
        insights[x].alias,
        insights[x],
        isConnected
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None,
      );
    });
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
    this.tooltip = this.getTooltip();
  }

  getTooltip(): MarkdownString {
    const tooltipMd = new MarkdownString();
    const title = `${this.details.serverAlias} ${getStatus(this.label)}`;
    tooltipMd.appendMarkdown(`### ${title}\n`);
    tooltipMd.appendMarkdown(
      `${this.details.serverName}:${this.details.serverPort}`,
    );
    return tooltipMd;
  }

  getDescription(): string {
    return this.collapsibleState === TreeItemCollapsibleState.None &&
      this.children.length > 2
      ? `${this.children[2]}:${"*".repeat(this.children[3].length)}`
      : "";
  }

  iconPath = getNamedIconPath("p-q-connection", this.label);

  contextValue = this.label; // "root";
}

export class InsightsNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: InsightDetails,
    public readonly collapsibleState: TreeItemCollapsibleState,
  ) {
    // set context for root nodes
    if (ext.kdbinsightsNodes.indexOf(label) === -1) {
      const indexOriginalLabel = ext.kdbinsightsNodes.indexOf(label);
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
    this.tooltip = this.getTooltip();
    this.description = this.getDescription();
  }

  getTooltip(): MarkdownString {
    const tooltipMd = new MarkdownString();
    const title = `${this.label} ${getStatus(this.label)}`;
    tooltipMd.appendMarkdown(`### ${title}\n`);
    tooltipMd.appendMarkdown(
      `${this.details.server.replace(/:\/\//g, "&#65279;://")}`,
    );
    return tooltipMd;
  }

  getDescription(): string {
    return this.collapsibleState === TreeItemCollapsibleState.None &&
      this.children.length > 2
      ? `${this.children[2]}:${"*".repeat(this.children[3].length)}`
      : "";
  }

  iconPath = getNamedIconPath("p-insights", this.label);

  contextValue = this.label; // "root";
}

export class InsightsMetaNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly connLabel: string,
  ) {
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
      "metaicon.svg",
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "metaicon.svg",
    ),
  };
  contextValue = "meta";
}

export class QNamespaceNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly fullName: string,
    public readonly connLabel: string,
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
      "namespaces.svg",
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "namespaces.svg",
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
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly connLabel: string,
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
      `${this.label.toLowerCase()}.svg`,
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      `${this.label.toLowerCase()}.svg`,
    ),
  };
  contextValue = this.ns; // "category";
}

export class MetaObjectPayloadNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly coreIcon: string,
    public readonly connLabel: string,
  ) {
    super(label, collapsibleState);
    this.description = "";
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
}

export class QServerNode extends TreeItem {
  constructor(
    public readonly children: string[],
    public readonly label: string,
    public readonly details: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly coreIcon: string,
    public readonly connLabel: string,
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

export class LabelNode extends TreeItem {
  readonly children: TreeItem[] = [];
  static id = 0;

  constructor(public readonly source: Labels) {
    super(source.name);
    this.id = "LabelNode" + LabelNode.id++;
    this.collapsibleState = this.getCollapsibleState(source.name);
    this.contextValue = "label";
  }

  iconPath = {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      "labels",
      `label-${this.source.color.name.toLowerCase()}.svg`,
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      "labels",
      `label-${this.source.color.name.toLowerCase()}.svg`,
    ),
  };

  getCollapsibleState(labelName: string): TreeItemCollapsibleState {
    if (isLabelEmpty(labelName)) {
      return TreeItemCollapsibleState.None;
    }
    if (isLabelContentChanged(labelName)) {
      return TreeItemCollapsibleState.Expanded;
    }
    return TreeItemCollapsibleState.Collapsed;
  }
}

function getNamedIconPath(name: string, label: string) {
  return {
    light: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "light",
      name + getServerIconState(label) + ".svg",
    ),
    dark: path.join(
      __filename,
      "..",
      "..",
      "resources",
      "dark",
      name + getServerIconState(label) + ".svg",
    ),
  };
}
