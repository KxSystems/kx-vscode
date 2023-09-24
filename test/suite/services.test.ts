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

import assert from "node:assert";
import { TreeItemCollapsibleState } from "vscode";
import { ext } from "../../src/extensionVariables";
import { Insights } from "../../src/models/insights";
import { Server } from "../../src/models/server";
import * as dataSourceTreeProvider from "../../src/services/dataSourceTreeProvider";
import * as codeFlowLogin from "../../src/services/kdbInsights/codeFlowLogin";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  QCategoryNode,
  QNamespaceNode,
  QServerNode,
} from "../../src/services/kdbTreeProvider";
import * as terminalProvider from "../../src/services/terminalProvider";

describe("dataSourceTreeProvider", () => {
  //write tests for src/services/dataSourceTreeProvider.ts
  //function to be deleted after write the tests
  dataSourceTreeProvider;
});

describe("kdbTreeProvider", () => {
  let servers: Server;
  let insights: Insights;
  let kdbNode: KdbNode;
  let insightNode: InsightsNode;

  beforeEach(() => {
    servers = {
      testServer: {
        serverAlias: "testServerAlias",
        serverName: "testServerName",
        serverPort: "5001",
        tls: false,
        auth: false,
        managed: false,
      },
    };
    insights = {
      testInsight: {
        alias: "testInsightsAlias",
        server: "testInsightsName",
        auth: false,
      },
    };
    kdbNode = new KdbNode(
      ["child1"],
      "testElement",
      servers["testServer"],
      TreeItemCollapsibleState.None
    );
    insightNode = new InsightsNode(
      ["child1"],
      "testElement",
      insights["testInsight"],
      TreeItemCollapsibleState.None
    );
  });

  it("Validate creation of KDB provider", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    assert.notStrictEqual(
      kdbProvider,
      undefined,
      "KdbTreeProvider should be created."
    );
  });

  it("Validate reload of KDB provider", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    kdbProvider.reload();
    assert.notStrictEqual(
      kdbProvider,
      undefined,
      "KdbTreeProvider should be created."
    );
  });

  it("Validate refreshing KDB provider with KDB instance", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    servers["testServer2"] = {
      serverAlias: "testServer2Alias",
      serverName: "testServer2Name",
      serverPort: "5001",
      tls: false,
      auth: false,
      managed: false,
    };
    kdbProvider.refresh(servers);
    assert.notStrictEqual(
      kdbProvider,
      undefined,
      "KdbTreeProvider should be created."
    );
  });

  it("Validate refreshing KDB provide with Insights instancer", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    insights["testInsight2"] = {
      alias: "testInsights2Alias",
      server: "testInsights2Name",
      auth: false,
    };
    kdbProvider.refreshInsights(insights);
    assert.notStrictEqual(
      kdbProvider,
      undefined,
      "KdbTreeProvider should be created."
    );
  });

  it("Should return the KdbNode tree item element", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const element = kdbProvider.getTreeItem(kdbNode);
    assert.strictEqual(
      element.label,
      kdbNode.label,
      "Get kdb node element is incorrect"
    );
  });

  it("Should return the Insights tree item element", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const element = kdbProvider.getTreeItem(insightNode);
    assert.strictEqual(
      element.label,
      insightNode.label,
      "Get insights node element is incorrect"
    );
  });

  it("Should return no children for the tree when serverList is empty", async () => {
    const kdbProvider = new KdbTreeProvider({}, {});
    const result = await kdbProvider.getChildren();
    assert.strictEqual(result.length, 0, "Children should be empty");
  });

  it("Should return children for the tree when serverList has entries", async () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const result = await kdbProvider.getChildren();
    assert.strictEqual(result.length, 2, "Children count should be 2");
  });

  it("Should return merged elements for parent", async () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const kdbNode = new KdbNode(
      [],
      "testServer",
      {
        serverName: "testServername",
        serverAlias: "testServerAlias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );
    kdbNode.contextValue = "testServerAlias";
    kdbProvider.getChildren(kdbNode);
    const result = await kdbProvider.getChildren(kdbNode);
    assert.notStrictEqual(result, undefined);
  });

  it("Should return namespaces for parent", async () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const kdbNode = new KdbNode(
      [],
      "testServer",
      {
        serverName: "testServername",
        serverAlias: "testServerAlias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );
    kdbProvider.getChildren(kdbNode);
    const result = await kdbProvider.getChildren(kdbNode);
    assert.notStrictEqual(result, undefined);
  });

  it("Should return categories for parent", async () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const kdbNode = new KdbNode(
      [],
      "testServer",
      {
        serverName: "testServername",
        serverAlias: "testServerAlias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );
    kdbNode.contextValue = "ns";
    kdbProvider.getChildren(kdbNode);
    const result = await kdbProvider.getChildren(kdbNode);
    assert.notStrictEqual(result, undefined);
  });

  it("Should return a new KdbNode", () => {
    const kdbNode = new KdbNode(
      [],
      "kdbnode1",
      {
        serverName: "kdbservername",
        serverAlias: "kdbserveralias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );
    assert.strictEqual(
      kdbNode.label,
      "kdbnode1 [kdbserveralias]",
      "KdbNode node creation failed"
    );
  });

  it("Should return a new KdbNode with no static alias", () => {
    const kdbNode = new KdbNode(
      [],
      "kdbnode1",
      {
        serverName: "kdbservername",
        serverAlias: "",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );
    assert.strictEqual(
      kdbNode.label,
      "kdbnode1",
      "KdbNode node creation failed"
    );
  });

  it("Should return a new KdbNode with children", () => {
    const kdbNode = new KdbNode(
      ["node1", "node2", "node3", "node4"],
      "kdbnode1",
      {
        serverName: "kdbservername",
        serverAlias: "kdbserveralias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );
    assert.strictEqual(
      kdbNode.label,
      "kdbnode1 [kdbserveralias]",
      "KdbNode node creation failed"
    );
  });

  it("Should return a new KdbNode that is connected", () => {
    const kdbNode = new KdbNode(
      [],
      "kdbnode1",
      {
        serverName: "kdbservername",
        serverAlias: "kdbserveralias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );

    ext.connectionNode = kdbNode;

    const kdbNode1 = new KdbNode(
      [],
      "kdbnode1",
      {
        serverName: "kdbservername",
        serverAlias: "kdbserveralias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      TreeItemCollapsibleState.None
    );

    assert.strictEqual(
      kdbNode1.label,
      "kdbnode1 [kdbserveralias] (connected)",
      "KdbNode node creation failed"
    );
  });

  it("Should retun a new InsightsNode", () => {
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None
    );
    assert.strictEqual(
      insightsNode.label,
      "insightsnode1",
      "InsightsNode node creation failed"
    );
  });

  it("Should return a new InsightsNode with children", () => {
    const insightsNode = new InsightsNode(
      ["child1", "child2", "child3", "child4"],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None
    );
    assert.strictEqual(
      insightsNode.label,
      "insightsnode1",
      "InsightsNode node creation failed"
    );
  });

  it("Should return a new InsightsNode that is connected", () => {
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None
    );

    ext.connectionNode = insightsNode;

    const insightsNode1 = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None
    );

    assert.strictEqual(
      insightsNode1.label,
      "insightsnode1 (connected)",
      "InsightsNode node creation failed"
    );
  });

  it("Should return a new QNamespaceNode", () => {
    const qNsNode = new QNamespaceNode(
      [],
      "nsnode1",
      "nsnodedetails1",
      TreeItemCollapsibleState.None,
      "nsfullname"
    );
    assert.strictEqual(
      qNsNode.label,
      "nsnode1",
      "QNamespaceNode node creation failed"
    );
  });

  it("should return a new QCategoryNode", () => {
    const qCategoryNode = new QCategoryNode(
      [],
      "categorynode1",
      "categorynodedetails1",
      "categoryns",
      TreeItemCollapsibleState.None
    );
    assert.strictEqual(
      qCategoryNode.label,
      "categorynode1",
      "QCategoryNode node creation failed"
    );
  });

  it("Should return a new QServerNode", () => {
    const qServerNode = new QServerNode(
      [],
      "servernode1",
      "servernodedetails1",
      TreeItemCollapsibleState.None,
      ""
    );
    assert.strictEqual(
      qServerNode.label,
      "servernode1",
      "QServer node creation failed"
    );
  });
});

describe("terminalProvider", () => {
  //write tests for src/services/terminalProvider.ts
  //function to be deleted after write the tests
  terminalProvider;
});

describe("codeFlowLogin", () => {
  //write tests for src/services/kdbInsights/codeFlowLogin.ts
  //function to be deleted after write the tests
  codeFlowLogin;
});
