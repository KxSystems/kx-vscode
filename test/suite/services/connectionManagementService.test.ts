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

import { dummyMeta } from "./services.utils.test";
import { InsightsConnection } from "../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../src/classes/localConnection";
import { ext } from "../../../src/extensionVariables";
import { InsightsApiConfig } from "../../../src/models/config";
import { MetaInfoType } from "../../../src/models/meta";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
} from "../../../src/services/kdbTreeProvider";
import * as loggers from "../../../src/utils/loggers";
import AuthSettings from "../../../src/utils/secretStorage";
import { Telemetry } from "../../../src/utils/telemetryClient";

describe("ConnectionManagementService", () => {
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
    vscode.TreeItemCollapsibleState.None,
  );
  const insightNode = new InsightsNode(
    ["child1"],
    "testInsightsAlias",
    insights["testInsight"],
    vscode.TreeItemCollapsibleState.None,
  );
  const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);
  const insightsConn = new InsightsConnection(insightNode.label, insightNode);

  ext.serverProvider = new KdbTreeProvider(servers, insights);

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

  describe("retrieveListOfConnectionsNames", () => {
    it("Should return the list of connection names", () => {
      ext.connectionsList.push(kdbNode, insightNode);
      const result = connectionManagerService.retrieveListOfConnectionsNames();

      assert.strictEqual(result.size, 2);
    });
  });

  describe("checkConnAlias", () => {
    it("Should return localInsights when connection is insights and alias equals local", () => {
      const result = connectionManagerService.checkConnAlias("local", true);

      assert.strictEqual(result, "localInsights");
    });

    it("Should note return localInsights when connection is insights and alias not equals local", () => {
      const result = connectionManagerService.checkConnAlias("notLocal", true);

      assert.strictEqual(result, "notLocal");
    });

    it("Should return local when connection is kdb and alias equals local and local conn not exist already", () => {
      const result = connectionManagerService.checkConnAlias(
        "local",
        false,
        false,
      );

      assert.strictEqual(result, "local");
    });

    it("Should return localKDB when connection is kdb and alias equals local and local conn exist already", () => {
      const result = connectionManagerService.checkConnAlias(
        "local",
        false,
        true,
      );

      assert.strictEqual(result, "localKDB");
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
    let retrieveConnectionStub,
      retrieveConnectedConnectionStub: sinon.SinonStub;

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

    it("connectSuccessBehaviour", () => {
      const setActiveConnectionStub = sinon.stub(
        connectionManagerService,
        "setActiveConnection",
      );
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");
      const reloadStub = sinon.stub(ext.serverProvider, "reload");

      connectionManagerService.connectSuccessBehaviour(insightNode);
      sinon.assert.calledOnce(setActiveConnectionStub);
      sinon.assert.calledOnce(reloadStub);
      sinon.assert.calledWith(
        executeCommandStub,
        "setContext",
        "kdb.connected",
        [insightNode.label],
      );
    });

    it("connectFailBehaviour", () => {
      const showErrorMessageStub = sinon.stub(
        vscode.window,
        "showErrorMessage",
      );
      const sendEventStub = sinon.stub(Telemetry, "sendEvent");
      const testLabel = "testLabel";

      connectionManagerService.connectFailBehaviour(testLabel);
      sinon.assert.calledWith(
        showErrorMessageStub,
        `Connection failed to: ${testLabel}`,
      );
      sinon.assert.calledWith(sendEventStub, "Connection.Failed.KDB+");
    });

    it("disconnectBehaviour", () => {
      const testConnection = new LocalConnection(
        "localhost:5001",
        "server1",
        [],
      );

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
    let retrieveConnectedConnectionStub: sinon.SinonStub;
    let resetScratchpadStub: sinon.SinonStub;
    let kdbOutputLogStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let _showErrorMessageStub: sinon.SinonStub;

    beforeEach(() => {
      connMngService = new ConnectionManagementService();
      ext.activeConnection = insightsConn;
      resetScratchpadStub = sinon.stub(insightsConn, "resetScratchpad");
      retrieveConnectedConnectionStub = sinon.stub(
        connMngService,
        "retrieveConnectedConnection",
      );
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
      showInformationMessageStub = sinon.stub(
        vscode.window,
        "showInformationMessage",
      );
      _showErrorMessageStub = sinon.stub(vscode.window, "showErrorMessage");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should log an error if there is no active connection", async () => {
      ext.activeConnection = null;
      await connMngService.resetScratchpad();
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[connectionManagerService] Please activate an Insights connection to use this feature.",
        "ERROR",
      );
    });

    it("should log an error if the active connection is not an InsightsConnection", async () => {
      ext.activeConnection = localConn;
      await connMngService.resetScratchpad();
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[connectionManagerService] Please activate an Insights connection to use this feature.",
        "ERROR",
      );
    });

    it("should reset the scratchpad if the active connection is an InsightsConnection", async () => {
      ext.activeConnection = insightsConn;
      ext.activeConnection.insightsVersion = 1.13;
      showInformationMessageStub.resolves("Yes");
      await connMngService.resetScratchpad();
      sinon.assert.calledOnce(resetScratchpadStub);
    });

    it("should retrieve insights connection and procced with resetScratchpad", async () => {
      insightsConn.insightsVersion = 1.13;
      retrieveConnectedConnectionStub.returns(insightsConn);
      showInformationMessageStub.resolves("Yes");
      await connMngService.resetScratchpad("test");
      sinon.assert.calledOnce(retrieveConnectedConnectionStub);
    });

    it("should retrieve insights connection and procced with resetScratchpad", async () => {
      insightsConn.insightsVersion = 1.13;
      retrieveConnectedConnectionStub.returns(insightsConn);
      showInformationMessageStub.resolves("No");
      await connMngService.resetScratchpad("test");
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[connectionManagerService] The user canceled the scratchpad reset.",
        "DEBUG",
      );
    });

    it("should retrieve kdb connection not proceed", async () => {
      retrieveConnectedConnectionStub.returns(localConn);
      await connMngService.resetScratchpad("test");
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[connectionManagerService] Please connect to an Insights connection to use this feature.",
        "ERROR",
      );
    });

    it("should log an error if insightsVersion is less than or equal to 1.11", async () => {
      ext.activeConnection = insightsConn;
      ext.activeConnection.insightsVersion = 1.11;
      await connMngService.resetScratchpad();
      sinon.assert.calledOnce(kdbOutputLogStub);
    });
  });

  describe("refreshAllGetMetas && refreshGetMeta", () => {
    let getMetaStub: sinon.SinonStub;

    beforeEach(() => {
      getMetaStub = sinon.stub(insightsConn, "getMeta");
    });

    afterEach(() => {
      sinon.restore();
      ext.connectedConnectionList.length = 0;
    });

    it("Should not refreshAllgetMetas if connection is not InsightsConnection", async () => {
      await connectionManagerService.refreshAllGetMetas();
      sinon.assert.notCalled(getMetaStub);
    });

    it("Should refreshAllgetMetas if connection is InsightsConnection", async () => {
      ext.connectedConnectionList.push(insightsConn);
      await connectionManagerService.refreshAllGetMetas();
      sinon.assert.calledOnce(getMetaStub);
    });

    it("Should not refreshGetMeta if connection is not InsightsConnection", async () => {
      await connectionManagerService.refreshGetMeta("test");
      sinon.assert.notCalled(getMetaStub);
    });

    it("Should refreshGetMeta if connection is InsightsConnection", async () => {
      ext.connectedConnectionList.push(insightsConn);
      await connectionManagerService.refreshGetMeta(insightsConn.connLabel);
      sinon.assert.calledOnce(getMetaStub);
    });
  });

  describe("getMetaInfoType", () => {
    it("should return correct MetaInfoType for valid input", () => {
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("meta".toUpperCase()),
        MetaInfoType.META,
      );
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("schema".toUpperCase()),
        MetaInfoType.SCHEMA,
      );
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("api".toUpperCase()),
        MetaInfoType.API,
      );
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("agg".toUpperCase()),
        MetaInfoType.AGG,
      );
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("dap".toUpperCase()),
        MetaInfoType.DAP,
      );
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("rc".toUpperCase()),
        MetaInfoType.RC,
      );
    });

    it("should return undefined for invalid input", () => {
      assert.strictEqual(
        connectionManagerService.getMetaInfoType("invalid"),
        undefined,
      );
    });
  });

  describe("retrieveMetaContent", () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should return empty string for invalid meta info type", () => {
      sandbox
        .stub(connectionManagerService, "getMetaInfoType")
        .returns(undefined);
      assert.strictEqual(
        connectionManagerService.retrieveMetaContent("connLabel", "invalid"),
        "",
      );
    });

    it("should return empty string for not connected connection", () => {
      sandbox
        .stub(connectionManagerService, "getMetaInfoType")
        .returns(MetaInfoType.META);
      sandbox
        .stub(connectionManagerService, "retrieveConnectedConnection")
        .returns(undefined);
      assert.strictEqual(
        connectionManagerService.retrieveMetaContent("connLabel", "meta"),
        "",
      );
    });

    it("should return empty string for local connection", () => {
      sandbox
        .stub(connectionManagerService, "getMetaInfoType")
        .returns(MetaInfoType.META);
      sandbox
        .stub(connectionManagerService, "retrieveConnectedConnection")
        .returns(localConn);
      assert.strictEqual(
        connectionManagerService.retrieveMetaContent("connLabel", "meta"),
        "",
      );
    });

    it("should return meta object for valid input", () => {
      insightsConn.meta = dummyMeta;
      sandbox
        .stub(connectionManagerService, "getMetaInfoType")
        .returns(MetaInfoType.META);
      sandbox
        .stub(connectionManagerService, "retrieveConnectedConnection")
        .returns(insightsConn);
      assert.strictEqual(
        connectionManagerService.retrieveMetaContent(
          insightsConn.connLabel,
          "meta",
        ),
        JSON.stringify(dummyMeta.payload),
      );
    });
  });

  describe("retrieveUserPass", () => {
    let connectionManagerService: ConnectionManagementService;
    let connectionsListStub: sinon.SinonStub;
    let getAuthDataStub: sinon.SinonStub;
    let _kdbAuthMapStub: sinon.SinonStub;
    let _contextStub: sinon.SinonStub;
    ext.context = {} as vscode.ExtensionContext;

    beforeEach(() => {
      _contextStub = sinon.stub(ext, "context").value({
        globalStorageUri: {
          fsPath: "/temp/",
        },
      });
      AuthSettings.init(ext.context);
      ext.secretSettings = AuthSettings.instance;
      connectionManagerService = new ConnectionManagementService();
      connectionsListStub = sinon.stub(ext, "connectionsList").value([]);
      getAuthDataStub = sinon.stub(ext.secretSettings, "getAuthData");
      _kdbAuthMapStub = sinon.stub(ext, "kdbAuthMap").value([]);
    });

    afterEach(() => {
      sinon.restore();
      ext.connectionsList.length = 0;
    });

    it("should retrieve and store auth data for KdbNode connections", async () => {
      ext.connectionsList.push(kdbNode);
      getAuthDataStub.withArgs(kdbNode.children[0]).resolves("user1:pass1");
      await connectionManagerService.retrieveUserPass();
      assert.strictEqual(ext.kdbAuthMap.length, 1);
      assert.deepEqual(ext.kdbAuthMap[0], {
        child1: {
          username: "user1",
          password: "pass1",
        },
      });
    });

    it("should not store auth data if getAuthData returns null", async () => {
      connectionsListStub.value([kdbNode]);
      getAuthDataStub.withArgs("server1").resolves(null);
      await connectionManagerService.retrieveUserPass();
      assert.strictEqual(ext.kdbAuthMap.length, 0);
    });

    it("should not store auth data for non-KdbNode connections", async () => {
      const nonKdbNode = { children: ["server1"] };

      connectionsListStub.value([nonKdbNode]);
      await connectionManagerService.retrieveUserPass();
      assert.strictEqual(ext.kdbAuthMap.length, 0);
    });
  });

  describe("retrieveInsightsConnVersion", () => {
    let retrieveConnectionStub: sinon.SinonStub;
    let _connectionsListStub: sinon.SinonStub;

    beforeEach(() => {
      retrieveConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnectedConnection",
      );
      _connectionsListStub = sinon.stub(ext, "connectionsList").value([]);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return 0 in case of non-Insights connection", async () => {
      retrieveConnectionStub.withArgs("nonInsightsLabel").returns(kdbNode);
      const result =
        await connectionManagerService.retrieveInsightsConnVersion(
          "nonInsightsLabel",
        );

      assert.strictEqual(result, 0);
    });

    it("should return 1.11 in case of Insights connection with  version", async () => {
      retrieveConnectionStub.withArgs("insightsLabel").returns(insightsConn);
      const result =
        await connectionManagerService.retrieveInsightsConnVersion(
          "insightsLabel",
        );

      assert.strictEqual(result, 1.11);
    });

    it("should not return the version of undefined connection", async () => {
      retrieveConnectionStub.withArgs("nonInsightsLabel").returns(undefined);
      const result =
        await connectionManagerService.retrieveInsightsConnVersion(
          "nonInsightsLabel",
        );

      assert.strictEqual(result, 0);
    });

    it("should return  0 in case of Insights with no connection version", async () => {
      const insightsConn2 = new InsightsConnection(
        "insightsLabel",
        insightNode,
      );

      retrieveConnectionStub.withArgs("insightsLabel").returns(insightsConn2);

      const result =
        await connectionManagerService.retrieveInsightsConnVersion(
          "insightsLabel",
        );

      assert.strictEqual(result, 0);
    });
  });

  describe("retrieveInsightsConnQEEnabled", () => {
    let retrieveConnectedConnectionStub: sinon.SinonStub;
    const apiConfig: InsightsApiConfig = {
      version: "1.11",
      encryptionDatabase: false,
      encryptionInTransit: false,
      queryEnvironmentsEnabled: true,
    };

    beforeEach(() => {
      retrieveConnectedConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnectedConnection",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return undefined if connection is not found", async () => {
      retrieveConnectedConnectionStub.returns(undefined);
      const result =
        await connectionManagerService.retrieveInsightsConnQEEnabled("test");

      assert.strictEqual(result, undefined);
    });

    it("should return enabled if connection if qe is on", async () => {
      insightsConn.apiConfig = apiConfig;
      retrieveConnectedConnectionStub.returns(insightsConn);
      const result =
        await connectionManagerService.retrieveInsightsConnQEEnabled("test");

      assert.strictEqual(result, "Enabled");
    });

    it("should return disabled if connection qe is off", async () => {
      apiConfig.queryEnvironmentsEnabled = false;
      insightsConn.apiConfig = apiConfig;
      retrieveConnectedConnectionStub.returns(insightsConn);
      const result =
        await connectionManagerService.retrieveInsightsConnQEEnabled("test");

      assert.strictEqual(result, "Disabled");
    });
  });

  describe("exportConnection", () => {
    let retrieveConnectionStub: sinon.SinonStub;
    let connectionsListStub: sinon.SinonStub;
    let kdbAuthMapStub: sinon.SinonStub;

    beforeEach(() => {
      retrieveConnectionStub = sinon.stub(
        connectionManagerService,
        "retrieveConnection",
      );
      connectionsListStub = sinon.stub(ext, "connectionsList").value([]);
      kdbAuthMapStub = sinon.stub(ext, "kdbAuthMap").value([]);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return empty string if connLabel is provided and connection is not found", () => {
      retrieveConnectionStub.withArgs("nonExistentLabel").returns(null);
      const result =
        connectionManagerService.exportConnection("nonExistentLabel");

      assert.strictEqual(result, "");
    });

    it("should export KDB connection when connLabel is provided and connection is an instance of KdbNode", () => {
      kdbNode.details.auth = true;
      retrieveConnectionStub.withArgs("kdbLabel").returns(kdbNode);
      const result = connectionManagerService.exportConnection("kdbLabel");
      const expectedOutput = {
        connections: {
          Insights: [],
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should export Insights connection when connLabel is provided and connection is not an instance of KdbNode", () => {
      retrieveConnectionStub.withArgs("insightsLabel").returns(insightNode);
      const result = connectionManagerService.exportConnection("insightsLabel");
      const expectedOutput = {
        connections: {
          Insights: [insightNode.details],
          KDB: [],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should return empty string if connLabel is not provided and connectionsList is empty", () => {
      connectionsListStub.value([]);
      const result = connectionManagerService.exportConnection();

      assert.strictEqual(result, "");
    });

    it("should export all connections when connLabel is not provided and connectionsList contains instances of KdbNode and other connections", () => {
      connectionsListStub.value([kdbNode, insightNode]);
      const result = connectionManagerService.exportConnection();
      const expectedOutput = {
        connections: {
          Insights: [insightNode.details],
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should set auth to false and clear username and password if includeAuth is false", () => {
      connectionsListStub.value([kdbNode]);
      const result = connectionManagerService.exportConnection(
        undefined,
        false,
      );
      const expectedOutput = {
        connections: {
          Insights: [],
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should set auth to true and populate username and password if includeAuth is true and auth is found", () => {
      const authData = {
        server1: {
          username: "user1",
          password: "pass1",
        },
      };

      connectionsListStub.value([kdbNode]);
      kdbAuthMapStub.value([authData]);
      const result = connectionManagerService.exportConnection(undefined, true);
      const expectedOutput = {
        connections: {
          Insights: [],
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should not change auth, username, and password if includeAuth is true and auth is not found", () => {
      connectionsListStub.value([kdbNode]);
      kdbAuthMapStub.value([]);
      const result = connectionManagerService.exportConnection(undefined, true);
      const expectedOutput = {
        connections: {
          Insights: [],
          KDB: [kdbNode.details],
        },
      };

      assert.strictEqual(result, JSON.stringify(expectedOutput, null, 2));
    });

    it("should clear kdbAuthMap after processing", () => {
      const authData = {
        server1: {
          username: "user1",
          password: "pass1",
        },
      };

      connectionsListStub.value([kdbNode]);
      kdbAuthMapStub.value([authData]);
      connectionManagerService.exportConnection(undefined, true);
      assert.strictEqual(ext.kdbAuthMap.length, 0);
    });
  });
});
