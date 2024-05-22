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

import axios from "axios";
import assert from "node:assert";
import sinon from "sinon";
import {
  ExtensionContext,
  TreeItemCollapsibleState,
  Uri,
  WebviewPanel,
  commands,
  env,
  window,
  workspace,
} from "vscode";
import { ext } from "../../src/extensionVariables";
import { Insights } from "../../src/models/insights";
import { QueryHistory } from "../../src/models/queryHistory";
import { Server, ServerType } from "../../src/models/server";
import {
  getCurrentToken,
  refreshToken,
  signIn,
  signOut,
} from "../../src/services/kdbInsights/codeFlowLogin";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  QCategoryNode,
  QNamespaceNode,
  QServerNode,
} from "../../src/services/kdbTreeProvider";
import {
  QueryHistoryProvider,
  QueryHistoryTreeItem,
} from "../../src/services/queryHistoryProvider";
import { createDefaultDataSourceFile } from "../../src/models/dataSource";
import { ConnectionManagementService } from "../../src/services/connectionManagerService";
import { LocalConnection } from "../../src/classes/localConnection";
import { Telemetry } from "../../src/utils/telemetryClient";
import { InsightsConnection } from "../../src/classes/insightsConnection";
import { DataSourceEditorProvider } from "../../src/services/dataSourceEditorProvider";
import {
  WorkspaceTreeProvider,
  addWorkspaceFile,
} from "../../src/services/workspaceTreeProvider";
import Path from "path";
import * as utils from "../../src/utils/getUri";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const codeFlow = require("../../src/services/kdbInsights/codeFlowLogin");

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
      TreeItemCollapsibleState.None,
    );
    insightNode = new InsightsNode(
      ["child1"],
      "testElement",
      insights["testInsight"],
      TreeItemCollapsibleState.None,
    );
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
    );
    assert.strictEqual(
      kdbNode.label,
      "kdbnode1 [kdbserveralias]",
      "KdbNode node creation failed",
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
      TreeItemCollapsibleState.None,
    );
    assert.strictEqual(
      kdbNode.label,
      "kdbnode1",
      "KdbNode node creation failed",
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
      TreeItemCollapsibleState.None,
    );
    assert.strictEqual(
      kdbNode.label,
      "kdbnode1 [kdbserveralias]",
      "KdbNode node creation failed",
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
    );

    assert.strictEqual(
      kdbNode1.label,
      "kdbnode1 [kdbserveralias]",
      "KdbNode node creation failed",
    );
  });

  it("Should add node to no tls list", () => {
    ext.kdbNodesWithoutTls.length = 0;
    ext.kdbNodesWithoutTls.push("testServer [testServerAlias]");
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
      TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutTls.length, 1);
  });

  it("Should remove node from no tls list", () => {
    ext.kdbNodesWithoutTls.length = 0;
    ext.kdbNodesWithoutTls.push("testServer [testServerAlias]");
    const kdbNode = new KdbNode(
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
      TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutTls, 0);
  });

  it("Should add node to no auth list", () => {
    ext.kdbNodesWithoutAuth.length = 0;
    ext.kdbNodesWithoutAuth.push("testServer [testServerAlias]");
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
      TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutAuth.length, 1);
  });

  it("Should remove node from no auth list", () => {
    ext.kdbNodesWithoutAuth.length = 0;
    ext.kdbNodesWithoutAuth.push("testServer [testServerAlias]");
    const kdbNode = new KdbNode(
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
      TreeItemCollapsibleState.None,
    );
    assert.equal(ext.kdbNodesWithoutAuth, 0);
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
      "nsfullname",
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
      TreeItemCollapsibleState.None,
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
      TreeItemCollapsibleState.None,
      "",
    );
    assert.strictEqual(
      qServerNode.label,
      "servernode1",
      "QServer node creation failed",
    );
  });
});

describe("Code flow login service tests", () => {
  const token = {
    access_token:
      "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Imk2bEdrM0ZaenhSY1ViMkMzbkVRN3N5SEpsWSJ9.eyJhdWQiOiI2ZTc0MTcyYi1iZTU2LTQ4NDMtOWZmNC1lNjZhMzliYjEyZTMiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3L3YyLjAiLCJpYXQiOjE1MzcyMzEwNDgsIm5iZiI6MTUzNzIzMTA0OCwiZXhwIjoxNTM3MjM0OTQ4LCJhaW8iOiJBWFFBaS84SUFBQUF0QWFaTG8zQ2hNaWY2S09udHRSQjdlQnE0L0RjY1F6amNKR3hQWXkvQzNqRGFOR3hYZDZ3TklJVkdSZ2hOUm53SjFsT2NBbk5aY2p2a295ckZ4Q3R0djMzMTQwUmlvT0ZKNGJDQ0dWdW9DYWcxdU9UVDIyMjIyZ0h3TFBZUS91Zjc5UVgrMEtJaWpkcm1wNjlSY3R6bVE9PSIsImF6cCI6IjZlNzQxNzJiLWJlNTYtNDg0My05ZmY0LWU2NmEzOWJiMTJlMyIsImF6cGFjciI6IjAiLCJuYW1lIjoiQWJlIExpbmNvbG4iLCJvaWQiOiI2OTAyMjJiZS1mZjFhLTRkNTYtYWJkMS03ZTRmN2QzOGU0NzQiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJhYmVsaUBtaWNyb3NvZnQuY29tIiwicmgiOiJJIiwic2NwIjoiYWNjZXNzX2FzX3VzZXIiLCJzdWIiOiJIS1pwZmFIeVdhZGVPb3VZbGl0anJJLUtmZlRtMjIyWDVyclYzeERxZktRIiwidGlkIjoiNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3IiwidXRpIjoiZnFpQnFYTFBqMGVRYTgyUy1JWUZBQSIsInZlciI6IjIuMCJ9.pj4N-w_3Us9DrBLfpCt",
    request_token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTY4ODUwMjJ9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ",
    expires_in: 0,
  };
  afterEach(() => {
    sinon.restore();
  });

  it("Should return a correct login", async () => {
    sinon.stub(codeFlow, "signIn").returns(token);
    const result = await signIn("http://localhost");
    assert.strictEqual(result, token, "Invalid token returned");
  });

  it("Should execute a correct logout", async () => {
    sinon.stub(axios, "post").resolves(Promise.resolve({ data: token }));
    const result = await signOut("http://localhost", "token");
    assert.strictEqual(result, undefined, "Invalid response from logout");
  });

  it("Should execute token refresh", async () => {
    sinon.stub(axios, "post").resolves(Promise.resolve({ data: token }));
    const result = await refreshToken(
      "http://localhost",
      JSON.stringify(token),
    );
    assert.strictEqual(
      result.accessToken,
      token.access_token,
      "Token has not refreshed correctly",
    );
  });

  it("Should not return token from secret store", async () => {
    const result = await getCurrentToken("", "testalias");
    assert.strictEqual(
      result,
      undefined,
      "Should return undefined when server name is empty.",
    );
  });

  it("Should not return token from secret store", async () => {
    const result = await getCurrentToken("testserver", "");
    assert.strictEqual(
      result,
      undefined,
      "Should return undefined when server alias is empty.",
    );
  });

  it.skip("Should not sign in if link is not opened", async () => {
    sinon.stub(env, "openExternal").value(async () => false);
    await assert.rejects(() => signIn("http://127.0.0.1"));
  });
});

describe("queryHistoryProvider", () => {
  const dummyDS = createDefaultDataSourceFile();
  const dummyQueryHistory: QueryHistory[] = [
    {
      executorName: "testExecutorName",
      connectionName: "testConnectionName",
      time: "testTime",
      query: "testQuery",
      success: true,
      connectionType: ServerType.INSIGHTS,
    },
    {
      executorName: "testExecutorName2",
      connectionName: "testConnectionName2",
      time: "testTime2",
      query: "testQuery2",
      success: true,
      connectionType: ServerType.KDB,
      duration: "500",
    },
    {
      executorName: "testExecutorName3",
      connectionName: "testConnectionName3",
      time: "testTime3",
      query: dummyDS,
      success: false,
      connectionType: ServerType.undefined,
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
      TreeItemCollapsibleState.None,
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
    assert.strictEqual(result.length, 3, "Children count should be 3");
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
        TreeItemCollapsibleState.None,
      );
      assert.strictEqual(
        queryHistoryTreeItem.label,
        "testLabel",
        "QueryHistoryTreeItem node creation failed",
      );
    });
    it("Should return a new QueryHistoryTreeItem with sucess icom", () => {
      const queryHistoryTreeItem = new QueryHistoryTreeItem(
        "testLabel",
        dummyQueryHistory[0],
        TreeItemCollapsibleState.None,
      );
      const result = queryHistoryTreeItem.defineQueryIcon(true);
      assert.strictEqual(
        result,
        sucessIcon,
        "QueryHistoryTreeItem defineQueryIcon failed",
      );
    });

    it("Should return a new QueryHistoryTreeItem with sucess icom", () => {
      const queryHistoryTreeItem = new QueryHistoryTreeItem(
        "testLabel",
        dummyQueryHistory[0],
        TreeItemCollapsibleState.None,
      );
      const result = queryHistoryTreeItem.defineQueryIcon(false);
      assert.strictEqual(
        result,
        failIcon,
        "QueryHistoryTreeItem defineQueryIcon failed",
      );
    });
  });
});

describe("connectionManagerService", () => {
  const connectionManagerService = new ConnectionManagementService();
  const servers = {
    testServer: {
      serverAlias: "testLabel",
      serverName: "127.0.0.1",
      serverPort: "5001",
      tls: false,
      auth: false,
      managed: false,
    },
  };
  const insights = {
    testInsight: {
      alias: "testInsightsAlias",
      server: "testInsightsName",
      auth: false,
    },
  };
  const kdbNode = new KdbNode(
    ["child1"],
    "testLabel",
    servers["testServer"],
    TreeItemCollapsibleState.None,
  );
  const insightNode = new InsightsNode(
    ["child1"],
    "testInsightsAlias",
    insights["testInsight"],
    TreeItemCollapsibleState.None,
  );
  ext.serverProvider = new KdbTreeProvider(servers, insights);

  const localConn = new LocalConnection("127.0.0.1:5001", "testLabel");

  const insightsConn = new InsightsConnection(insightNode.label, insightNode);
  describe("retrieveConnection", () => {
    afterEach(() => {
      ext.connectionsList.length = 0;
    });
    it("Should return undefined when connection is not found", () => {
      const result = connectionManagerService.retrieveConnection("testLabel");
      assert.strictEqual(result, undefined);
    });

    it("Should return the connection when found", () => {
      ext.connectionsList.push(kdbNode);
      const result = connectionManagerService.retrieveConnection(kdbNode.label);
      assert.strictEqual(result, kdbNode);
    });
  });

  describe("retrieveConnectedConnection", () => {
    afterEach(() => {
      ext.connectedConnectionList.length = 0;
    });
    it("Should return undefined when connection is not found", () => {
      const result =
        connectionManagerService.retrieveConnectedConnection("testLabel");
      assert.strictEqual(result, undefined);
    });

    it("Should return the connection when found", () => {
      ext.connectedConnectionList.push(localConn);
      const result =
        connectionManagerService.retrieveConnectedConnection("testLabel");
      assert.strictEqual(result, localConn);
    });
  });

  describe("isKdbConnection", () => {
    it("Should return true for KDB connection", () => {
      const result = connectionManagerService.isKdbConnection(kdbNode);
      assert.strictEqual(result, true);
    });

    it("Should return false for Insights connection", () => {
      const result = connectionManagerService.isKdbConnection(insightNode);
      assert.strictEqual(result, false);
    });
  });

  describe("retrieveLocalConnectionString", () => {
    it("Should return the connection string", () => {
      const result =
        connectionManagerService.retrieveLocalConnectionString(kdbNode);
      assert.strictEqual(result, "127.0.0.1:5001");
    });
  });

  describe("removeConnectionFromContextString", () => {
    it("Should remove the connection from context string", () => {
      ext.connectedContextStrings.push("testLabel");
      connectionManagerService.removeConnectionFromContextString("testLabel");
      assert.strictEqual(ext.connectedContextStrings.length, 0);
      ext.connectedContextStrings.length = 0;
    });
  });

  describe("connect", () => {
    afterEach(() => {
      ext.connectedContextStrings.length = 0;
      ext.connectionNode = undefined;
      ext.connectedConnectionList.length = 0;
      sinon.restore();
    });
    it("Should not connect if connection does not exist", async () => {
      const result = await connectionManagerService.connect("testLabel");
      assert.strictEqual(result, undefined);
    });
  });

  describe("setActiveConnection", () => {
    beforeEach(() => {
      ext.activeConnection = undefined;
    });

    afterEach(() => {
      ext.connectionNode = undefined;
      sinon.restore();
    });
    it("Should not set active connection if connection does not exist", () => {
      connectionManagerService.setActiveConnection(kdbNode);
      assert.strictEqual(ext.activeConnection, undefined);
    });

    it("Should set active connection", () => {
      ext.serverProvider = new KdbTreeProvider(servers, insights);
      sinon
        .stub(connectionManagerService, "retrieveConnectedConnection")
        .returns(localConn);
      connectionManagerService.setActiveConnection(kdbNode);
      assert.strictEqual(ext.activeConnection, localConn);
    });
  });

  describe("disconnect", () => {
    let retrieveConnectionStub, retrieveConnectedConnectionStub;
    beforeEach(() => {
      retrieveConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnection",
      );
      retrieveConnectedConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnectedConnection",
      );
    });
    afterEach(() => {
      ext.connectedContextStrings.length = 0;
      ext.connectionNode = undefined;
      ext.connectedConnectionList.length = 0;
      sinon.restore();
    });
    it("Should not disconnect if connection does not exist", async () => {
      retrieveConnectedConnectionStub.returns(undefined);
      retrieveConnectionStub.returns(undefined);
      const result = await connectionManagerService.disconnect("testLabel");
      assert.strictEqual(result, undefined);
    });
  });

  describe("executeQuery", () => {
    const command = "testCommand";
    const context = "testContext";
    const stringfy = true;
    let executeQueryStub, getScratchpadQueryStub;
    beforeEach(() => {
      executeQueryStub = sinon.stub(localConn, "executeQuery");
      getScratchpadQueryStub = sinon.stub(insightsConn, "getScratchpadQuery");
    });
    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });
    it("Should not execute query if connection does not exist", async () => {
      ext.activeConnection = undefined;
      const result = await connectionManagerService.executeQuery(
        command,
        "connTest",
        context,
        stringfy,
      );
      assert.strictEqual(result, undefined);
    });

    it("Should execute query from kdbNode", async () => {
      ext.activeConnection = localConn;
      executeQueryStub.returns("test results");
      const result = await connectionManagerService.executeQuery(
        command,
        undefined,
        context,
        stringfy,
      );
      assert.strictEqual(result, "test results");
    });

    it("Should execute query from InsightsNode", async () => {
      ext.activeConnection = insightsConn;
      getScratchpadQueryStub.returns("test query");
      const result = await connectionManagerService.executeQuery(
        command,
        undefined,
        context,
        stringfy,
      );
      assert.strictEqual(result, "test query");
    });
  });

  describe("behaviour methods", () => {
    beforeEach(() => {
      ext.serverProvider = new KdbTreeProvider(servers, insights);
    });
    afterEach(() => {
      sinon.restore();
      ext.connectedConnectionList.length = 0;
      ext.activeConnection = undefined;

      ext.serverProvider = undefined;
    });
    it("isConnectedBehaviour", () => {
      const setActiveConnectionStub = sinon.stub(
        connectionManagerService,
        "setActiveConnection",
      );
      const executeCommandStub = sinon.stub(commands, "executeCommand");
      const reloadStub = sinon.stub(ext.serverProvider, "reload");

      connectionManagerService.isConnectedBehaviour(insightNode);

      sinon.assert.calledOnce(setActiveConnectionStub);
      sinon.assert.calledOnce(reloadStub);
      sinon.assert.calledWith(
        executeCommandStub,
        "setContext",
        "kdb.connected",
        [insightNode.label],
      );
    });

    it("isNotConnectedBehaviour", () => {
      const showErrorMessageStub = sinon.stub(window, "showErrorMessage");
      const sendEventStub = sinon.stub(Telemetry, "sendEvent");

      const testLabel = "testLabel";

      connectionManagerService.isNotConnectedBehaviour(testLabel);

      sinon.assert.calledWith(
        showErrorMessageStub,
        `Connection failed to: ${testLabel}`,
      );
      sinon.assert.calledWith(sendEventStub, "Connection.Failed");
    });

    it("disconnectBehaviour", () => {
      const testConnection = new LocalConnection("localhost:5001", "server1");
      ext.connectedConnectionList.push(testConnection);
      ext.activeConnection = testConnection;

      connectionManagerService.disconnectBehaviour(testConnection);
      assert.equal(ext.connectedConnectionList.length, 0);
      assert.equal(ext.activeConnection, undefined);
      assert.equal(ext.connectionNode, undefined);
    });

    it("disconnectBehaviour with IOnsights connection", () => {
      ext.connectedConnectionList.push(insightsConn);
      ext.activeConnection = insightsConn;

      connectionManagerService.disconnectBehaviour(insightsConn);
      assert.equal(ext.connectedConnectionList.length, 0);
      assert.equal(ext.activeConnection, undefined);
      assert.equal(ext.connectionNode, undefined);
    });

    it("disconnectBehaviour with no active connection", () => {
      ext.connectedConnectionList.push(insightsConn);

      connectionManagerService.disconnectBehaviour(insightsConn);
      assert.equal(ext.connectedConnectionList.length, 0);
      assert.equal(ext.activeConnection, undefined);
    });
  });

  describe("resetScratchpad", () => {
    let connMngService: ConnectionManagementService;
    let showErrorMessageStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let resetScratchpadStub: sinon.SinonStub;

    beforeEach(() => {
      connMngService = new ConnectionManagementService();
      showErrorMessageStub = sinon.stub(window, "showErrorMessage");
      showInformationMessageStub = sinon.stub(window, "showInformationMessage");
      ext.activeConnection = insightsConn;
      resetScratchpadStub = sinon.stub(ext.activeConnection, "resetScratchpad");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call resetScratchpad on activeConnection if selection is Yes and activeConnection is an instance of InsightsConnection", async () => {
      showInformationMessageStub.resolves("Yes");
      await connMngService.resetScratchpad();
      sinon.assert.calledOnce(resetScratchpadStub);
      sinon.assert.notCalled(showErrorMessageStub);
    });

    it("should show error message if activeConnection is not an instance of InsightsConnection", async () => {
      showInformationMessageStub.resolves("Yes");
      ext.activeConnection = undefined;
      await connMngService.resetScratchpad();
      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.notCalled(resetScratchpadStub);
    });
  });
});

describe("dataSourceEditorProvider", () => {
  let context: ExtensionContext;

  function createPanel() {
    const listeners = {
      onDidReceiveMessage: undefined,
      postMessage: undefined,
      onDidChangeViewState: undefined,
      onDidDispose: undefined,
    };
    const panel = <WebviewPanel>{
      webview: {
        onDidReceiveMessage(e) {
          listeners.onDidReceiveMessage = e;
        },
        postMessage(e) {
          listeners.postMessage = e;
        },
      },
      onDidChangeViewState(e) {
        listeners.onDidChangeViewState = e;
      },
      onDidDispose(e) {
        listeners.onDidDispose = e;
      },
    };
    return {
      panel,
      listeners,
    };
  }

  beforeEach(() => {
    context = <ExtensionContext>{};
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("register", () => {
    it("should register the provider", () => {
      let result = undefined;
      sinon
        .stub(window, "registerCustomEditorProvider")
        .value(() => (result = true));
      DataSourceEditorProvider.register(context);
      assert.ok(result);
    });
  });

  describe("resolveCustomTextEditor", () => {
    it("should resolve ", async () => {
      const provider = new DataSourceEditorProvider(context);
      const document = await workspace.openTextDocument({
        language: "q",
        content: "{}",
      });
      sinon.stub(utils, "getUri").value(() => "");
      const panel = createPanel();
      await assert.doesNotReject(() =>
        provider.resolveCustomTextEditor(document, panel.panel),
      );
      panel.listeners.onDidReceiveMessage({});
      panel.listeners.onDidChangeViewState();
      panel.listeners.onDidDispose();
    });
  });
});

describe("workspaceTreeProvider", () => {
  let provider: WorkspaceTreeProvider;

  function stubWorkspaceFile(path: string) {
    const parsed = Path.parse(path);
    sinon
      .stub(workspace, "workspaceFolders")
      .value([{ uri: Uri.file(parsed.dir) }]);
    sinon
      .stub(workspace, "getWorkspaceFolder")
      .value(() => Uri.file(parsed.dir));
    sinon.stub(workspace, "findFiles").value(async () => [Uri.file(path)]);
    sinon.stub(workspace, "openTextDocument").value(async (uri: Uri) => uri);
  }

  beforeEach(() => {
    sinon.stub(ext, "serverProvider").value({ onDidChangeTreeData() {} });
    provider = new WorkspaceTreeProvider("**/*.kdb.q", "scratchpad");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getChildren", () => {
    it("should return workspace scratchpad items", async () => {
      stubWorkspaceFile("/workspace/test.kdb.q");
      let result = await provider.getChildren();
      assert.strictEqual(result.length, 1);
      result = await provider.getChildren(provider.getTreeItem(result[0]));
      assert.strictEqual(result.length, 1);
    });

    it("should return workspace python items", async () => {
      stubWorkspaceFile("/workspace/test.kdb.py");
      let result = await provider.getChildren();
      assert.strictEqual(result.length, 1);
      result = await provider.getChildren(provider.getTreeItem(result[0]));
      assert.strictEqual(result.length, 1);
    });

    it("should return workspace datasource items", async () => {
      stubWorkspaceFile("/workspace/test.kdb.json");
      let result = await provider.getChildren();
      assert.strictEqual(result.length, 1);
      result = await provider.getChildren(provider.getTreeItem(result[0]));
      assert.strictEqual(result.length, 1);
    });
  });

  describe("addWorkspaceFile", () => {
    it("should break after try", async () => {
      stubWorkspaceFile("/workspace/test.kdb.q");
      await assert.rejects(() => addWorkspaceFile(undefined, "test", ".kdb.q"));
    });
  });
});
