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
  Event,
  EventEmitter,
  MarkdownString,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  commands,
} from "vscode";
import { ext } from "../extensionVariables";
import { QueryHistory } from "../models/queryHistory";
import { getConnectionType } from "../utils/queryUtils";

export class queryHistoryProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<
    QueryHistoryTreeItem | undefined | void
  > = new EventEmitter<QueryHistoryTreeItem | undefined | void>();
  private queryList = ext.kdbQueryHistoryList;
  readonly onDidChangeTreeData: Event<QueryHistoryTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  reload(): void {
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: QueryHistoryTreeItem): QueryHistoryTreeItem {
    return element;
  }

  getChildren(
    element?: QueryHistoryTreeItem
  ): ProviderResult<QueryHistoryTreeItem[]> {
    if (!element) {
      return this.getQueryHistoryList();
    } else {
      return Promise.resolve([]);
    }
  }

  private getQueryHistoryList(): Promise<QueryHistoryTreeItem[]> {
    return Promise.resolve(
      this.queryList.map((query) => {
        const label = query.connectionName + " - " + query.time;
        return new QueryHistoryTreeItem(
          label,
          query,
          TreeItemCollapsibleState.None
        );
      })
    );
  }
}

export class QueryHistoryTreeItem extends TreeItem {
  constructor(
    public label: string,
    public readonly details: QueryHistory,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    if (ext.kdbQueryHistoryNodes.indexOf(label) === -1) {
      ext.kdbQueryHistoryNodes.push(label);
      commands.executeCommand(
        "setContext",
        "kdb.kdbQueryHistoryList",
        ext.kdbQueryHistoryList
      );
    }
    this.iconPath = new ThemeIcon(this.defineQueryIcon(details.success));
    this.tooltip = this.getTooltip();
  }

  defineQueryIcon(success: boolean): string {
    return success ? "testing-passed-icon" : "testing-error-icon";
  }

  getTooltip(): MarkdownString {
    const connType = getConnectionType(this.details.connectionType);
    const tooltipMd = new MarkdownString();
    tooltipMd.appendMarkdown("### Query History Details\n");
    tooltipMd.appendMarkdown(
      "- Connection Name: **" + this.details.connectionName + "** \n"
    );
    tooltipMd.appendMarkdown("- Connection Type: **" + connType + "** \n");
    tooltipMd.appendMarkdown("- Time: **" + this.details.time + "** \n");
    tooltipMd.appendMarkdown("- Query:");
    tooltipMd.appendCodeblock(this.details.query, "q");
    return tooltipMd;
  }
}

// export class QueryHistoryNode extends TreeItem {
//   constructor(public readonly details: QueryHistory) {
//     super(path.basename(resourceUri.fsPath));
//     this.iconPath = new ThemeIcon("circuit-board");
//     this.command = {
//       command: "kdb.queryHistory.rerun",
//       title: "Rerun Query",
//       arguments: [resourceUri],
//     };
//   }
// }
