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

import * as assert from "assert";
import * as vscode from "vscode";

import { ext } from "../../../../src/extensionVariables";
import { ServerType } from "../../../../src/models/connectionsModels";
import { createDefaultDataSourceFile } from "../../../../src/models/dataSource";
import { QueryHistory } from "../../../../src/models/queryHistory";
import {
  QueryHistoryProvider,
  QueryHistoryTreeItem,
} from "../../../../src/services/queryHistoryProvider";

describe("queryHistoryProvider", () => {
  const dummyDS = createDefaultDataSourceFile();
  const dummyQueryHistory: QueryHistory[] = [
    {
      executorName: "testExecutorName",
      connectionName: "testConnectionName",
      time: "testTime",
      query: `testQuery\n long test query line counter ${"a".repeat(80)}`,
      success: true,
      connectionType: ServerType.INSIGHTS,
    },
    {
      executorName: "testExecutorName2",
      connectionName: "testConnectionName2",
      time: "testTime2",
      query: `testQuery2 ${"a".repeat(80)} \n testQuery2 ${"a".repeat(80)}\n testQuery2 ${"a".repeat(80)}`,
      success: true,
      isWorkbook: true,
      connectionType: ServerType.KDB,
      duration: "500",
    },
    {
      executorName: "testExecutorName2",
      connectionName: "testConnectionName2",
      time: "testTime2",
      query: "testQuery2\n testQuery2\n testQuery2",
      success: true,
      isWorkbook: true,
      connectionType: ServerType.KDB,
      duration: "500",
    },
    {
      executorName: "testExecutorName3",
      connectionName: "testConnectionName3",
      time: "testTime3",
      query: dummyDS,
      success: false,
      connectionType: ServerType.KDB,
    },
    {
      executorName: "variables",
      connectionName: "testConnectionName2",
      time: "testTime2",
      query: `testQuery2 ${"a".repeat(80)}`,
      success: true,
      isFromConnTree: true,
      connectionType: ServerType.KDB,
      duration: "500",
    },
    {
      executorName: "variables",
      connectionName: "testConnectionName2",
      time: "testTime2",
      query: "testQuery2",
      success: true,
      isFromConnTree: true,
      connectionType: ServerType.KDB,
      duration: "500",
    },
  ];
  beforeEach(() => {
    ext.kdbQueryHistoryList.length = 0;
    ext.kdbQueryHistoryList.push(...dummyQueryHistory);
  });
  it("Should reload the provider", () => {
    const queryHistoryProvider = new QueryHistoryProvider();
    queryHistoryProvider.reload();
    assert.notStrictEqual(
      queryHistoryProvider,
      undefined,
      "queryHistoryProvider should be created.",
    );
  });
  it("Should refresh the provider", () => {
    const queryHistoryProvider = new QueryHistoryProvider();
    queryHistoryProvider.refresh();
    assert.notStrictEqual(
      queryHistoryProvider,
      undefined,
      "queryHistoryProvider should be created.",
    );
  });

  it("Should return the KdbNode tree item element", () => {
    const queryHistoryTreeItem = new QueryHistoryTreeItem(
      "testLabel",
      dummyQueryHistory[0],
      vscode.TreeItemCollapsibleState.None,
    );
    const queryHistoryProvider = new QueryHistoryProvider();
    const element = queryHistoryProvider.getTreeItem(queryHistoryTreeItem);
    assert.strictEqual(
      element.label,
      queryHistoryTreeItem.label,
      "Get query history item is incorrect",
    );
  });

  it("Should return the KdbNode tree item element", () => {
    const queryHistoryTreeItem = new QueryHistoryTreeItem(
      "testLabel",
      dummyQueryHistory[3],
      vscode.TreeItemCollapsibleState.None,
    );
    const queryHistoryProvider = new QueryHistoryProvider();
    const element = queryHistoryProvider.getTreeItem(queryHistoryTreeItem);
    assert.strictEqual(
      element.label,
      queryHistoryTreeItem.label,
      "Get query history item is incorrect",
    );
  });

  it("Should return children for the tree when queryHistory has entries", async () => {
    const queryHistoryProvider = new QueryHistoryProvider();
    const result = await queryHistoryProvider.getChildren();
    assert.strictEqual(result.length, 6, "Children count should be 6");
  });

  it("Should not return children for the tree when queryHistory has no entries", async () => {
    ext.kdbQueryHistoryList.length = 0;
    const queryHistoryProvider = new QueryHistoryProvider();
    const result = await queryHistoryProvider.getChildren();
    assert.strictEqual(result.length, 0, "Children count should be 0");
  });

  describe("QueryHistoryTreeItem", () => {
    const sucessIcon = "testing-passed-icon";
    const failIcon = "testing-error-icon";
    it("Should return a new QueryHistoryTreeItem", () => {
      const queryHistoryTreeItem = new QueryHistoryTreeItem(
        "testLabel",
        dummyQueryHistory[0],
        vscode.TreeItemCollapsibleState.None,
      );
      assert.strictEqual(
        queryHistoryTreeItem.label,
        "testLabel",
        "QueryHistoryTreeItem node creation failed",
      );
    });
    it("Should return a new QueryHistoryTreeItem with sucess icon", () => {
      const queryHistoryTreeItem = new QueryHistoryTreeItem(
        "testLabel",
        dummyQueryHistory[0],
        vscode.TreeItemCollapsibleState.None,
      );
      const result = queryHistoryTreeItem.defineQueryIcon(true);
      assert.strictEqual(
        result,
        sucessIcon,
        "QueryHistoryTreeItem defineQueryIcon failed",
      );
    });

    it("Should return a new QueryHistoryTreeItem with fail icon", () => {
      const queryHistoryTreeItem = new QueryHistoryTreeItem(
        "testLabel",
        dummyQueryHistory[2],
        vscode.TreeItemCollapsibleState.None,
      );
      const result = queryHistoryTreeItem.defineQueryIcon(false);
      assert.strictEqual(
        result,
        failIcon,
        "QueryHistoryTreeItem defineQueryIcon failed",
      );
    });

    it("Should return a new QueryHistoryTreeItem with sucess icon", () => {
      const queryHistoryTreeItem = new QueryHistoryTreeItem(
        "testLabel",
        dummyQueryHistory[3],
        vscode.TreeItemCollapsibleState.None,
      );
      const result = queryHistoryTreeItem.defineQueryIcon(true);
      assert.strictEqual(
        result,
        sucessIcon,
        "QueryHistoryTreeItem defineQueryIcon failed",
      );
    });
  });
});
