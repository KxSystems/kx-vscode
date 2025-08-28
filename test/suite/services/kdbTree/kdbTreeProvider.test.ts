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
import * as sinon from "sinon";
import * as vscode from "vscode";

import { InsightsConnection } from "../../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../../src/classes/localConnection";
import { ext } from "../../../../src/extensionVariables";
import { Insights, Server } from "../../../../src/models/connectionsModels";
import { ConnectionLabel, Labels } from "../../../../src/models/labels";
import { ServerObject } from "../../../../src/models/serverObject";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import {
  InsightsMetaNode,
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  LabelNode,
  MetaObjectPayloadNode,
  QCategoryNode,
  QNamespaceNode,
  QServerNode,
} from "../../../../src/services/kdbTreeProvider";
import { KdbTreeService } from "../../../../src/services/kdbTreeService";
import { dummyMeta } from "../services.utils.test";

describe("kdbTreeProvider", () => {
  let servers: Server;
  let insights: Insights;
  let kdbNode: KdbNode;
  let insightNode: InsightsNode;

  const connMng = new ConnectionManagementService();

  let retrieveInsightsConnVersionStub,
    retrieveInsightsConnQEEnabledStub: sinon.SinonStub;

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
      vscode.TreeItemCollapsibleState.None,
    );
    insightNode = new InsightsNode(
      ["child1"],
      "testElement",
      insights["testInsight"],
      vscode.TreeItemCollapsibleState.None,
    );
    retrieveInsightsConnVersionStub = sinon.stub(
      connMng,
      "retrieveInsightsConnVersion",
    );
    retrieveInsightsConnQEEnabledStub = sinon.stub(
      connMng,
      "retrieveInsightsConnQEEnabled",
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it("Validate creation of KDB provider", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);

    assert.notStrictEqual(
      kdbProvider,
      undefined,
      "KdbTreeProvider should be created.",
    );
  });

  it("Validate reload of KDB provider", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);

    kdbProvider.reload();
    assert.notStrictEqual(
      kdbProvider,
      undefined,
      "KdbTreeProvider should be created.",
    );
  });

  it("Validate refreshing KDB provider with KDB instance", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);

    servers["testServer"] = {
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
      "KdbTreeProvider should be created.",
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
      "KdbTreeProvider should be created.",
    );
  });

  it("Should return the KdbNode tree item element", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const element = kdbProvider.getTreeItem(kdbNode);

    assert.strictEqual(
      element.label,
      kdbNode.label,
      "Get kdb node element is incorrect",
    );
  });

  it("Should return the Insights tree item element", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);
    const element = kdbProvider.getTreeItem(insightNode);

    assert.strictEqual(
      element.label,
      insightNode.label,
      "Get insights node element is incorrect",
    );
  });

  it("Should return no children for the tree when serverList is empty", async () => {
    const kdbProvider = new KdbTreeProvider({}, {});
    const result = await kdbProvider.getChildren();

    assert.strictEqual(result.length, 0, "Children should be empty");
  });

  it("Should return children for the tree when serverList has entries", async () => {
    retrieveInsightsConnVersionStub.returned(1);
    retrieveInsightsConnQEEnabledStub.returned("Enabled");
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
      vscode.TreeItemCollapsibleState.None,
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
      vscode.TreeItemCollapsibleState.None,
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
      vscode.TreeItemCollapsibleState.None,
    );

    kdbNode.contextValue = "ns";
    kdbProvider.getChildren(kdbNode);
    const result = await kdbProvider.getChildren(kdbNode);

    assert.notStrictEqual(result, undefined);
  });

  it("Should return a new KdbNode", () => {
    const kdbNode = new KdbNode(
      [],
      "",
      {
        serverName: "kdbservername",
        serverAlias: "",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    assert.strictEqual(
      kdbNode.label,
      "[kdbservername:5001]",
      "KdbNode node creation failed",
    );
  });

  it("Should return a new KdbNode with no static alias", () => {
    const kdbNode = new KdbNode(
      [],
      "",
      {
        serverName: "kdbservername",
        serverAlias: "",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    assert.strictEqual(
      kdbNode.label,
      "[kdbservername:5001]",
      "KdbNode node creation failed",
    );
  });

  it("Should return a new KdbNode with children", () => {
    const kdbNode = new KdbNode(
      ["node1", "node2", "node3", "node4"],
      "kdbserveralias",
      {
        serverName: "kdbservername",
        serverAlias: "kdbserveralias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    assert.strictEqual(
      kdbNode.label,
      "kdbserveralias [kdbservername:5001]",
      "KdbNode node creation failed",
    );
  });

  it("Should return a new KdbNode that is connected", () => {
    const kdbNode = new KdbNode(
      [],
      "kdbserveralias",
      {
        serverName: "kdbservername",
        serverAlias: "kdbserveralias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    ext.connectionNode = kdbNode;

    assert.strictEqual(
      kdbNode.label,
      "kdbserveralias [kdbservername:5001]",
      "KdbNode node creation failed",
    );
  });

  it("Should add node to no tls list", () => {
    ext.kdbNodesWithoutTls.length = 0;
    new KdbNode(
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
      vscode.TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutTls.length, 1);
  });

  it("Should remove node from no tls list", () => {
    ext.kdbNodesWithoutTls.length = 0;
    ext.kdbNodesWithoutTls.push("testServer [testServername:5001]");
    new KdbNode(
      [],
      "testServer",
      {
        serverName: "testServername",
        serverAlias: "testServerAlias",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: true,
      },
      vscode.TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutTls, 0);
  });

  it("Should add node to no auth list", () => {
    ext.kdbNodesWithoutAuth.length = 0;
    new KdbNode(
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
      vscode.TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutAuth.length, 1);
  });

  it("Should remove node from no auth list", () => {
    ext.kdbNodesWithoutAuth.length = 0;
    ext.kdbNodesWithoutAuth.push("testServer [testServername:5001]");
    new KdbNode(
      [],
      "testServer",
      {
        serverName: "testServername",
        serverAlias: "testServerAlias",
        serverPort: "5001",
        managed: false,
        auth: true,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutAuth.length, 0);
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
      vscode.TreeItemCollapsibleState.None,
    );

    ext.kdbinsightsNodes.pop();

    assert.strictEqual(
      insightsNode.label,
      "insightsnode1",
      "InsightsNode node creation failed",
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
      vscode.TreeItemCollapsibleState.None,
    );

    ext.kdbinsightsNodes.pop();

    assert.strictEqual(
      insightsNode.label,
      "insightsnode1",
      "InsightsNode node creation failed",
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
      vscode.TreeItemCollapsibleState.None,
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
      vscode.TreeItemCollapsibleState.None,
    );

    ext.kdbinsightsNodes.pop();

    assert.strictEqual(
      insightsNode1.label,
      "insightsnode1",
      "InsightsNode node creation failed",
    );
  });

  it("Should return a new QNamespaceNode", () => {
    const qNsNode = new QNamespaceNode(
      [],
      "nsnode1",
      "nsnodedetails1",
      vscode.TreeItemCollapsibleState.None,
      "nsfullname",
      "connLabel",
    );

    assert.strictEqual(
      qNsNode.label,
      "nsnode1",
      "QNamespaceNode node creation failed",
    );
  });

  it("should return a new QCategoryNode", () => {
    const qCategoryNode = new QCategoryNode(
      [],
      "categorynode1",
      "categorynodedetails1",
      "categoryns",
      vscode.TreeItemCollapsibleState.None,
      "connLabel",
    );

    assert.strictEqual(
      qCategoryNode.label,
      "categorynode1",
      "QCategoryNode node creation failed",
    );
  });

  it("Should return a new QServerNode", () => {
    const qServerNode = new QServerNode(
      [],
      "servernode1",
      "servernodedetails1",
      vscode.TreeItemCollapsibleState.None,
      "",
      "connLabel",
    );

    assert.strictEqual(
      qServerNode.label,
      "servernode1",
      "QServer node creation failed",
    );
  });

  it("Should return a new LabelNode", () => {
    const labelNode = new LabelNode({
      name: "White",
      color: { name: "White", colorHex: "#CCCCCC" },
    });

    assert.strictEqual(
      labelNode.label,
      "White",
      "LabelNode node creation failed",
    );
  });

  describe("InsightsMetaNode", () => {
    it("should initialize fields correctly", () => {
      const node = new InsightsMetaNode(
        ["child1", "child2"],
        "testLabel",
        "testDetails",
        vscode.TreeItemCollapsibleState.Collapsed,
        "testConnLabel",
      );

      assert.deepStrictEqual(node.children, ["child1", "child2"]);
      assert.strictEqual(node.label, "testLabel");
      assert.strictEqual(
        node.collapsibleState,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      assert.strictEqual(node.connLabel, "testConnLabel");
      assert.strictEqual(node.description, "");
      assert.strictEqual(node.contextValue, "meta");
    });

    it("should return empty string from getDescription", () => {
      const node = new InsightsMetaNode(
        [],
        "",
        "",
        vscode.TreeItemCollapsibleState.None,
        "",
      );

      assert.strictEqual(node.getDescription(), "");
    });
  });

  describe("MetaObjectPayloadNode", () => {
    it("should initialize fields correctly", () => {
      const node = new MetaObjectPayloadNode(
        ["child1", "child2"],
        "testLabel",
        "testDetails",
        vscode.TreeItemCollapsibleState.Collapsed,
        "testIcon",
        "testConnLabel",
      );

      assert.deepStrictEqual(node.children, ["child1", "child2"]);
      assert.strictEqual(node.label, "testLabel");
      assert.strictEqual(
        node.collapsibleState,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      assert.strictEqual(node.coreIcon, "testIcon");
      assert.strictEqual(node.connLabel, "testConnLabel");
      assert.strictEqual(node.description, "");
    });
  });

  describe("getChildren", () => {
    const kdbProvider = new KdbTreeProvider(servers, insights);

    insights = {
      testInsight: {
        alias: "testInsightsAlias",
        server: "testInsightsName",
        auth: false,
      },
    };
    insightNode = new InsightsNode(
      ["child1"],
      "testInsight",
      insights["testInsight"],
      vscode.TreeItemCollapsibleState.None,
    );
    insightNode.contextValue = "testInsight";

    afterEach(() => {
      ext.kdbinsightsNodes.length = 0;
      sinon.restore();
    });

    it("Should return categories for insights connection", async () => {
      ext.kdbinsightsNodes.push("testInsight");
      kdbProvider.getChildren(insightNode);
      const result = await kdbProvider.getChildren(insightNode);

      assert.notStrictEqual(result, undefined);
    });

    it("should return metaObjects for parent", async () => {
      const connMng = new ConnectionManagementService();
      const metaNode = new InsightsMetaNode(
        [],
        "testMeta",
        "",
        vscode.TreeItemCollapsibleState.None,
        "insightsConn",
      );
      const insightsConn = new InsightsConnection(
        insightNode.label,
        insightNode,
      );

      sinon.stub(connMng, "retrieveConnectedConnection").returns(insightsConn);
      insightsConn.meta = dummyMeta;
      const result = await kdbProvider.getChildren(metaNode);

      assert.notStrictEqual(result, undefined);
    });

    it("should return label node", async () => {
      const labels: Labels[] = [
        { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
      ];
      const conns: ConnectionLabel[] = [
        {
          labelName: "label1",
          connections: ["testServerAlias", "testInsightsAlias"],
        },
      ];

      sinon.stub(vscode.workspace, "getConfiguration").value(() => ({
        get: (v: string) => (v === "kdb.connectionLabels" ? labels : conns),
      }));
      const provider = new KdbTreeProvider(servers, insights);
      const result = await provider.getChildren();

      assert.strictEqual(result.length, 1);
    });
  });

  describe("KdbTreeProvider private methods", () => {
    let provider: KdbTreeProvider;
    let servers: Server;
    let insights: Insights;
    let mockLocalConn: LocalConnection;
    let mockInsightsConn: InsightsConnection;
    let connMngStub: sinon.SinonStub;

    const createMockServerObject = (
      id: number,
      name: string,
      typeNum: number,
      namespace: string = ".",
      isNs: boolean = false,
    ): ServerObject => ({
      id,
      pid: id,
      name,
      fname: name,
      typeNum,
      namespace,
      context: {},
      isNs,
    });

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

      provider = new KdbTreeProvider(servers, insights);
      mockLocalConn = sinon.createStubInstance(LocalConnection);
      mockInsightsConn = sinon.createStubInstance(InsightsConnection);

      connMngStub = sinon.stub(
        ConnectionManagementService.prototype,
        "retrieveConnectedConnection",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    describe("validateAndGetConnection", () => {
      it("should return null when connection is not found", () => {
        const serverType = new QCategoryNode(
          [],
          "test",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );

        connMngStub.returns(undefined);

        const result = (provider as any).validateAndGetConnection(serverType);

        assert.strictEqual(result, null);
      });

      it("should return null for InsightsConnection", () => {
        const serverType = new QCategoryNode(
          [],
          "test",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );

        connMngStub.returns(mockInsightsConn);

        const result = (provider as any).validateAndGetConnection(serverType);

        assert.strictEqual(result, null);
      });

      it("should return LocalConnection when valid", () => {
        const serverType = new QCategoryNode(
          [],
          "test",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );

        connMngStub.returns(mockLocalConn);

        const result = (provider as any).validateAndGetConnection(serverType);

        assert.strictEqual(result, mockLocalConn);
      });

      it("should extract connLabel from QCategoryNode", () => {
        const serverType = new QCategoryNode(
          [],
          "test",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testConnLabel",
        );

        connMngStub.returns(mockLocalConn);

        (provider as any).validateAndGetConnection(serverType);

        sinon.assert.calledWith(connMngStub, "testConnLabel");
      });

      it("should handle non-QCategoryNode TreeItem", () => {
        const serverType = { contextValue: "test" } as any;

        connMngStub.returns(mockLocalConn);

        (provider as any).validateAndGetConnection(serverType);

        sinon.assert.calledWith(connMngStub, "");
      });
    });

    describe("getServerObjects", () => {
      it("should return empty array when serverType is undefined", async () => {
        const result = await (provider as any).getServerObjects(undefined);

        assert.deepStrictEqual(result, []);
      });

      it("should return empty array when connection validation fails", async () => {
        const serverType = new QCategoryNode(
          [],
          "test",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "",
        );

        connMngStub.returns(undefined);

        const result = await (provider as any).getServerObjects(serverType);

        assert.deepStrictEqual(result, []);
      });

      it("should call loadObjectsByCategory when connection is valid", async () => {
        const serverType = new QCategoryNode(
          [],
          "Dictionaries",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );

        connMngStub.returns(mockLocalConn);

        const loadObjectsByCategoryStub = sinon
          .stub(provider as any, "loadObjectsByCategory")
          .resolves([]);

        await (provider as any).getServerObjects(serverType);

        sinon.assert.calledOnce(loadObjectsByCategoryStub);
        sinon.assert.calledWith(
          loadObjectsByCategoryStub,
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );
      });
    });

    describe("loadObjectsByCategory", () => {
      it("should load dictionaries for category index 0", async () => {
        const serverType = new QCategoryNode(
          [],
          "Dictionaries",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );
        const loadDictionariesStub = sinon
          .stub(provider as any, "loadDictionaries")
          .resolves([]);

        await (provider as any).loadObjectsByCategory(
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );

        sinon.assert.calledOnce(loadDictionariesStub);
        sinon.assert.calledWith(
          loadDictionariesStub,
          mockLocalConn,
          ".",
          ".",
          "testLabel",
        );
      });

      it("should load functions for category index 1", async () => {
        const serverType = new QCategoryNode(
          [],
          "Functions",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );
        const loadFunctionsStub = sinon
          .stub(provider as any, "loadFunctions")
          .resolves([]);

        await (provider as any).loadObjectsByCategory(
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );

        sinon.assert.calledOnce(loadFunctionsStub);
      });

      it("should load tables for category index 2", async () => {
        const serverType = new QCategoryNode(
          [],
          "Tables",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );
        const loadTablesStub = sinon
          .stub(provider as any, "loadTables")
          .resolves([]);

        await (provider as any).loadObjectsByCategory(
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );

        sinon.assert.calledOnce(loadTablesStub);
      });

      it("should load variables for category index 3", async () => {
        const serverType = new QCategoryNode(
          [],
          "Variables",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );
        const loadVariablesStub = sinon
          .stub(provider as any, "loadVariables")
          .resolves([]);

        await (provider as any).loadObjectsByCategory(
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );

        sinon.assert.calledOnce(loadVariablesStub);
      });

      it("should load views for category index 4", async () => {
        const serverType = new QCategoryNode(
          [],
          "Views",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );
        const loadViewsStub = sinon
          .stub(provider as any, "loadViews")
          .resolves([]);

        await (provider as any).loadObjectsByCategory(
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );

        sinon.assert.calledOnce(loadViewsStub);
      });

      it("should return empty array for unknown category", async () => {
        const serverType = new QCategoryNode(
          [],
          "Unknown",
          "",
          ".",
          vscode.TreeItemCollapsibleState.None,
          "testLabel",
        );
        const result = await (provider as any).loadObjectsByCategory(
          serverType,
          mockLocalConn,
          ".",
          "testLabel",
        );

        assert.deepStrictEqual(result, []);
      });
    });

    describe("loadDictionaries", () => {
      it("should load dictionaries and create QServerNodes", async () => {
        const mockDicts = [
          createMockServerObject(1, "dict1", 99),
          createMockServerObject(2, "dict2", 99),
        ];
        const kdbTreeServiceStub = sinon
          .stub(KdbTreeService, "loadDictionaries")
          .resolves(mockDicts);
        const createQServerNodesStub = sinon
          .stub(provider as any, "createQServerNodes")
          .returns([]);

        await (provider as any).loadDictionaries(
          mockLocalConn,
          "namespace",
          ".",
          "connLabel",
        );

        sinon.assert.calledWith(kdbTreeServiceStub, mockLocalConn, "namespace");
        sinon.assert.calledWith(
          createQServerNodesStub,
          mockDicts,
          ".",
          "connLabel",
          "dictionaries",
        );
      });
    });

    describe("loadFunctions", () => {
      it("should load functions and create QServerNodes", async () => {
        const mockFuncs = [
          createMockServerObject(1, "func1", 100),
          createMockServerObject(2, "func2", 100),
        ];
        const kdbTreeServiceStub = sinon
          .stub(KdbTreeService, "loadFunctions")
          .resolves(mockFuncs);
        const createQServerNodesStub = sinon
          .stub(provider as any, "createQServerNodes")
          .returns([]);

        await (provider as any).loadFunctions(
          mockLocalConn,
          "namespace",
          ".",
          "connLabel",
        );

        sinon.assert.calledWith(kdbTreeServiceStub, mockLocalConn, "namespace");
        sinon.assert.calledWith(
          createQServerNodesStub,
          mockFuncs,
          ".",
          "connLabel",
          "functions",
        );
      });
    });

    describe("loadTables", () => {
      it("should load tables and create QServerNodes", async () => {
        const mockTables = [
          createMockServerObject(1, "table1", 98),
          createMockServerObject(2, "table2", 98),
        ];
        const kdbTreeServiceStub = sinon
          .stub(KdbTreeService, "loadTables")
          .resolves(mockTables);
        const createQServerNodesStub = sinon
          .stub(provider as any, "createQServerNodes")
          .returns([]);

        await (provider as any).loadTables(
          mockLocalConn,
          "namespace",
          ".",
          "connLabel",
        );

        sinon.assert.calledWith(kdbTreeServiceStub, mockLocalConn, "namespace");
        sinon.assert.calledWith(
          createQServerNodesStub,
          mockTables,
          ".",
          "connLabel",
          "tables",
        );
      });
    });

    describe("loadVariables", () => {
      it("should load variables and create QServerNodes", async () => {
        const mockVars = [
          createMockServerObject(1, "var1", -7),
          createMockServerObject(2, "var2", 11),
        ];
        const kdbTreeServiceStub = sinon
          .stub(KdbTreeService, "loadVariables")
          .resolves(mockVars);
        const createQServerNodesStub = sinon
          .stub(provider as any, "createQServerNodes")
          .returns([]);

        await (provider as any).loadVariables(
          mockLocalConn,
          "namespace",
          ".",
          "connLabel",
        );

        sinon.assert.calledWith(kdbTreeServiceStub, mockLocalConn, "namespace");
        sinon.assert.calledWith(
          createQServerNodesStub,
          mockVars,
          ".",
          "connLabel",
          "variables",
        );
      });
    });

    describe("loadViews", () => {
      it("should load views and create QServerNodes with correct labels for root namespace", async () => {
        const mockViews = ["view1", "view2"];
        const kdbTreeServiceStub = sinon
          .stub(KdbTreeService, "loadViews")
          .resolves(mockViews);
        const result = await (provider as any).loadViews(
          mockLocalConn,
          ".",
          "connLabel",
        );

        sinon.assert.calledWith(kdbTreeServiceStub, mockLocalConn);
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].label, "view1");
        assert.strictEqual(result[1].label, "view2");
        assert.strictEqual(result[0].coreIcon, "views");
      });

      it("should load views and create QServerNodes with dot prefix for non-root namespace", async () => {
        const mockViews = ["view1"];

        sinon.stub(KdbTreeService, "loadViews").resolves(mockViews);

        const result = await (provider as any).loadViews(
          mockLocalConn,
          "myns",
          "connLabel",
        );

        assert.strictEqual(result[0].label, ".view1");
      });
    });

    describe("createQServerNodes", () => {
      it("should create QServerNodes correctly for root namespace", () => {
        const objects = [{ name: "test1" }, { name: "test2" }];
        const result = (provider as any).createQServerNodes(
          objects,
          ".",
          "connLabel",
          "tables",
        );

        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].label, "test1");
        assert.strictEqual(result[1].label, "test2");
        assert.strictEqual(result[0].coreIcon, "tables");
        assert.strictEqual(result[0].connLabel, "connLabel");
      });

      it("should create QServerNodes with namespace prefix for non-root namespace", () => {
        const objects = [{ name: "test1" }];
        const result = (provider as any).createQServerNodes(
          objects,
          "myns",
          "connLabel",
          "functions",
        );

        assert.strictEqual(result[0].label, "myns.test1");
      });

      it("should handle empty objects array", () => {
        const result = (provider as any).createQServerNodes(
          [],
          ".",
          "connLabel",
          "variables",
        );

        assert.deepStrictEqual(result, []);
      });

      it("should set correct TreeItemCollapsibleState", () => {
        const objects = [{ name: "test1" }];
        const result = (provider as any).createQServerNodes(
          objects,
          ".",
          "connLabel",
          "dictionaries",
        );

        assert.strictEqual(
          result[0].collapsibleState,
          vscode.TreeItemCollapsibleState.None,
        );
      });
    });
  });
});
