/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

type QueryHistoryType = QueryHistoryTreeItem | undefined | void;

export class QueryHistoryProvider implements TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: EventEmitter<QueryHistoryType> =
    new EventEmitter<QueryHistoryType>();
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
    element?: QueryHistoryTreeItem,
  ): ProviderResult<QueryHistoryTreeItem[]> {
    if (!element) {
      return this.getQueryHistoryList();
    } else {
      return Promise.resolve([]);
    }
  }

  private getQueryHistoryList(): Promise<QueryHistoryTreeItem[]> {
    commands.executeCommand("setContext", "kdb.kdbQHCopyList", []);
    ext.queryHistoryAvailableToCopy.length = 0;
    return Promise.resolve(
      this.queryList.map((query) => {
        const label = query.connectionName + " - " + query.time;
        if (!query.isDatasource && typeof query.query === "string") {
          ext.queryHistoryAvailableToCopy.push(label);
        }
        return new QueryHistoryTreeItem(
          label,
          query,
          TreeItemCollapsibleState.None,
        );
      }),
    ).then((result) => {
      commands.executeCommand(
        "setContext",
        "kdb.kdbQHCopyList",
        ext.queryHistoryAvailableToCopy,
      );
      return result;
    });
  }
}

export class QueryHistoryTreeItem extends TreeItem {
  constructor(
    public label: string,
    public readonly details: QueryHistory,
    public readonly collapsibleState: TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.id = label;
    this.contextValue = label;
    if (ext.kdbQueryHistoryNodes.indexOf(label) === -1) {
      ext.kdbQueryHistoryNodes.push(label);
      commands.executeCommand(
        "setContext",
        "kdb.kdbQueryHistoryList",
        ext.kdbQueryHistoryList,
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
    const codeType = this.details.language === "python" ? "python" : "q";
    tooltipMd.appendMarkdown("### Query History Details\n");
    tooltipMd.appendMarkdown(
      "- Connection Name: **" + this.details.connectionName + "** \n",
    );
    tooltipMd.appendMarkdown("- Connection Type: **" + connType + "** \n");
    tooltipMd.appendMarkdown("- Time: **" + this.details.time + "** \n");
    if (!this.details.isDatasource && typeof this.details.query === "string") {
      if (this.details.isWorkbook) {
        tooltipMd.appendMarkdown(
          "- Workbook: " + this.details.executorName + " \n",
        );
      } else if (this.details.isFromConnTree) {
        tooltipMd.appendMarkdown("- Executiom from: Connection Tree \n");
        tooltipMd.appendMarkdown(
          "- Category: " + this.details.executorName + " \n",
        );
      } else {
        tooltipMd.appendMarkdown(
          "- File: " + this.details.executorName + " \n",
        );
      }
      tooltipMd.appendMarkdown("- Query: ");
      let queryText = this.details.query;

      if (typeof queryText === "string") {
        const lines = queryText.split("\n");
        if (lines.length > 1) {
          queryText =
            lines[0].slice(0, 77) +
            (lines[0].length > 77 ? "... " : "") +
            "\n" +
            lines[1].slice(0, 77) +
            (lines[1].length > 77 ? "... " : "");
        } else {
          queryText =
            lines[0].slice(0, 77) + (lines[0].length > 77 ? "... " : "");
        }
      }

      tooltipMd.appendCodeblock(queryText, codeType);
    } else {
      tooltipMd.appendMarkdown(
        "- Data Source: **" + this.details.executorName + "**  \n",
      );
      tooltipMd.appendMarkdown(
        "- Data Source Type: **" + this.details.datasourceType + "** \n",
      );
    }
    if (this.details.duration) {
      tooltipMd.appendMarkdown(
        "- Duration: **" + this.details.duration + "ms** \n",
      );
    }
    return tooltipMd;
  }
}
