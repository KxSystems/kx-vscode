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

import assert from "assert";
import mock from "mock-fs";
import * as sinon from "sinon";
import * as vscode from "vscode";

import * as serverCommand from "../../../src/commands/serverCommand";
import { ext } from "../../../src/extensionVariables";
import {
  ExportedConnections,
  InsightDetails,
  ServerDetails,
  ServerType,
} from "../../../src/models/connectionsModels";
import { createDefaultDataSourceFile } from "../../../src/models/dataSource";
import { QueryHistory } from "../../../src/models/queryHistory";
import { ScratchpadResult } from "../../../src/models/scratchpadResult";
import { NewConnectionPannel } from "../../../src/panels/newConnection";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  MetaObjectPayloadNode,
} from "../../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../../src/services/resultsPanelProvider";
import * as coreUtils from "../../../src/utils/core";
import * as dataSourceUtils from "../../../src/utils/dataSource";
import { ExecutionConsole } from "../../../src/utils/executionConsole";
import * as loggers from "../../../src/utils/loggers";
import * as notifications from "../../../src/utils/notifications";
import * as queryUtils from "../../../src/utils/queryUtils";
import * as kdbValidators from "../../../src/validators/kdbValidator";

describe("serverCommand", () => {
  const servers = {
    testServer: {
      serverAlias: "testServerAlias",
      serverName: "testServerName",
      serverPort: "5001",
      tls: false,
      auth: false,
      managed: false,
    },
  };
  const insightsNode = new InsightsNode(
    [],
    "insightsnode1",
    {
      server: "https://insightsservername.com/",
      alias: "insightsserveralias",
      auth: true,
    },
    vscode.TreeItemCollapsibleState.None,
  );

  const kdbNode = new KdbNode(
    ["child1"],
    "testElement",
    servers["testServer"],
    vscode.TreeItemCollapsibleState.None,
  );
  const insights = {
    testInsight: {
      alias: "testInsightsAlias",
      server: "testInsightsName",
      auth: false,
    },
  };
  ext.serverProvider = new KdbTreeProvider(servers, insights);

  after(() => {
    ext.serverProvider = undefined;
  });

  it("should call the New Connection Panel Renderer", async () => {
    const newConnectionPanelStub = sinon.stub(NewConnectionPannel, "render");
    ext.context = <vscode.ExtensionContext>{};
    await serverCommand.addNewConnection();
    sinon.assert.calledOnce(newConnectionPanelStub);
    sinon.restore();
  });

  it("should call the Edit Connection Panel Renderer", async () => {
    const newConnectionPanelStub = sinon.stub(NewConnectionPannel, "render");
    ext.context = <vscode.ExtensionContext>{};
    await serverCommand.editConnection(kdbNode);
    sinon.assert.calledOnce(newConnectionPanelStub);
    sinon.restore();
  });

  describe("isConnected", () => {
    let connMngServiceMock: sinon.SinonStubbedInstance<ConnectionManagementService>;

    beforeEach(() => {
      connMngServiceMock = sinon.createStubInstance(
        ConnectionManagementService,
      );
    });

    it("deve retornar false quando isConnected do ConnectionManagementService retornar false", () => {
      connMngServiceMock.isConnected.returns(false);
      const result = serverCommand.isConnected("127.0.0.1:6812 [CONNLABEL]");
      assert.deepStrictEqual(result, false);
    });
  });

  describe("addInsightsConnection", () => {
    let insightsData: InsightDetails;
    let updateInsightsStub, getInsightsStub, notifyStub: sinon.SinonStub;

    beforeEach(() => {
      insightsData = {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      };
      updateInsightsStub = sinon.stub(coreUtils, "updateInsights");
      getInsightsStub = sinon.stub(coreUtils, "getInsights");
      notifyStub = sinon.stub(notifications, "notify");
      ext.serverProvider = new KdbTreeProvider(servers, insights);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should add new Insights connection", async () => {
      getInsightsStub.returns({});
      await serverCommand.addInsightsConnection(insightsData, ["lblTest"]);
      sinon.assert.calledOnce(updateInsightsStub);
      sinon.assert.calledWithExactly(
        notifyStub,
        `Added Insights connection: ${insightsData.alias}`,
        sinon.match.any,
        sinon.match.any,
      );
    });

    it("should show error message if Insights connection already exists", async () => {
      const getKeyForServerNameStub = sinon.stub(
        coreUtils,
        "getKeyForServerName",
      );
      getKeyForServerNameStub.returns("insightsserveralias");

      const existingInsights = {
        insightsserveralias: {
          alias: "insightsserveralias",
          server: "testInsightsName",
          auth: false,
        },
      };
      getInsightsStub.returns(existingInsights);

      await serverCommand.addInsightsConnection(insightsData);

      sinon.assert.calledWithExactly(
        notifyStub,
        `Insights instance named ${insightsData.alias} already exists.`,
        sinon.match.any,
        sinon.match.any,
      );
    });

    it("should show error message if Insights connection is invalid", async () => {
      insightsData.server = "invalid";
      const validateServerAliasStub = sinon.stub(
        kdbValidators,
        "validateServerAlias",
      );
      validateServerAliasStub.returns("Invalid alias");

      await serverCommand.addInsightsConnection(insightsData);
      sinon.assert.calledWithExactly(
        notifyStub,
        "Invalid alias",
        sinon.match.any,
        sinon.match.any,
      );
    });
  });

  describe("addKdbConnection", () => {
    let kdbData: ServerDetails;
    let windowMock: sinon.SinonMock;
    let updateServersStub,
      getServersStub,
      validationServerAliasStub,
      validationHostnameStub,
      validationPortStub: sinon.SinonStub;
    beforeEach(() => {
      kdbData = {
        serverName: "testServer",
        serverAlias: "testServerAlias",
        auth: false,
        managed: false,
        serverPort: "5001",
        tls: false,
      };
      windowMock = sinon.mock(vscode.window);
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      getServersStub = sinon.stub(coreUtils, "getServers");
      validationServerAliasStub = sinon.stub(
        kdbValidators,
        "validateServerAlias",
      );
      validationHostnameStub = sinon.stub(kdbValidators, "validateServerName");
      validationPortStub = sinon.stub(kdbValidators, "validateServerPort");
    });

    afterEach(() => {
      sinon.restore();
      windowMock.restore();
    });

    it("should add new Kdb connection", async () => {
      getServersStub.returns({});
      validationServerAliasStub.returns(false);
      validationHostnameStub.returns(false);
      validationPortStub.returns(false);
      await serverCommand.addKdbConnection(kdbData, false, ["lblTest"]);
      sinon.assert.calledOnce(updateServersStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Kdb connection added successfully");
    });

    it("should show error message if Kdb connection already exists", async () => {
      getServersStub.returns(servers);
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Kdb connection already exists");
    });

    it("should show error message if Kdb connection is invalid", async () => {
      kdbData.serverPort = "invalid";
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });

    it("should show error message if connection where alias is not provided", async () => {
      kdbData.serverAlias = "";
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Server Name is required");
    });

    it("should give error if alias is local and isLocal is false", async () => {
      validationServerAliasStub.returns(
        "The server name “local” is reserved for connections to the Bundled q process",
      );
      kdbData.serverAlias = "local";
      kdbData.managed = true;
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });

    it("should add authentication to the connection", async () => {
      kdbData.auth = true;
      kdbData.password = "password";
      kdbData.username = "username";
      getServersStub.returns({});
      await serverCommand.addKdbConnection(kdbData);
      sinon.assert.called(updateServersStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Kdb connection added successfully");
    });

    it("should return error when the servername with an invalid length", async () => {
      kdbData.serverName = "";
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });

    it("should return error when the servername with an invalid length", async () => {
      kdbData.serverName = "a".repeat(kdbValidators.MAX_STR_LEN + 1);
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });
  });

  describe("importConnections", () => {
    let showOpenDialogStub,
      kdbOutputLogStub,
      _addImportedConnectionsStub: sinon.SinonStub;

    beforeEach(() => {
      showOpenDialogStub = sinon.stub(vscode.window, "showOpenDialog");
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
      _addImportedConnectionsStub = sinon.stub(
        serverCommand,
        "addImportedConnections",
      );
    });

    afterEach(() => {
      sinon.restore();
      mock.restore();
    });

    it("should log an error if no file is selected", async () => {
      showOpenDialogStub.resolves(undefined);

      await serverCommand.importConnections();

      assert(
        kdbOutputLogStub.calledWith(
          "[serverCommand] No file selected.",
          "ERROR",
          true,
        ),
      );
    });
  });

  describe("addImportedConnections", async () => {
    let addInsightsConnectionStub,
      addKdbConnectionStub,
      kdbOutputLogStub,
      showInformationMessageStub,
      _getInsightsStub,
      _getServersStub,
      retrieveVersionStub: sinon.SinonStub;

    const kdbNodeImport1: KdbNode = {
      label: "local",
      details: {
        serverName: "testKdb",
        serverAlias: "local",
        serverPort: "1818",
        auth: false,
        managed: false,
        tls: false,
      },
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "kdbNode",
      children: [],
      getTooltip: function (): vscode.MarkdownString {
        throw new Error("Function not implemented.");
      },
      getDescription: function (): string {
        throw new Error("Function not implemented.");
      },
      iconPath: undefined,
    };
    const insightsNodeImport1: InsightsNode = {
      label: "testInsight",
      details: {
        server: "testInsight",
        alias: "testInsight",
        auth: false,
      },
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "insightsNode",
      children: [],
      getTooltip(): Promise<vscode.MarkdownString> {
        return Promise.resolve(new vscode.MarkdownString(""));
      },
      getDescription(): string {
        return "";
      },
      iconPath: undefined,
      initializeNode(): Promise<void> {
        return Promise.resolve();
      },
    };

    beforeEach(() => {
      addInsightsConnectionStub = sinon.stub(
        serverCommand,
        "addInsightsConnection",
      );
      addKdbConnectionStub = sinon.stub(serverCommand, "addKdbConnection");
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
      _getInsightsStub = sinon
        .stub(coreUtils, "getInsights")
        .returns(undefined);
      _getServersStub = sinon.stub(coreUtils, "getServers").returns(undefined);
      showInformationMessageStub = sinon.stub(
        vscode.window,
        "showInformationMessage",
      );
      retrieveVersionStub = sinon.stub(
        ConnectionManagementService.prototype,
        "retrieveInsightsConnVersion",
      );
      ext.connectionsList.length = 0;
    });

    afterEach(() => {
      sinon.restore();
      ext.connectionsList.length = 0;
    });

    it("should add insights connections with unique aliases", async () => {
      ext.connectionsList.push(insightsNodeImport1, kdbNodeImport1);
      const importedConnections: ExportedConnections = {
        connections: {
          Insights: [
            {
              alias: "testImportInsights1",
              server: "testInsight",
              auth: false,
            },
            {
              alias: "testImportInsights1",
              server: "testInsight2",
              auth: false,
            },
          ],
          KDB: [],
        },
      };

      retrieveVersionStub.resolves("1.0");

      await serverCommand.addImportedConnections(importedConnections);

      sinon.assert.notCalled(addKdbConnectionStub);
    });

    it("should log success message and show information message", async () => {
      const importedConnections: ExportedConnections = {
        connections: {
          Insights: [],
          KDB: [],
        },
      };

      await serverCommand.addImportedConnections(importedConnections);

      assert(
        kdbOutputLogStub.calledWith(
          "[serverCommand] Connections imported successfully.",
          "INFO",
        ),
      );
      assert(
        showInformationMessageStub.calledWith(
          "Connections imported successfully.",
        ),
      );
    });

    it("should add kdb connections", () => {
      ext.connectionsList.push(insightsNodeImport1, kdbNodeImport1);
      const importedConnections: ExportedConnections = {
        connections: {
          Insights: [],
          KDB: [
            {
              serverName: "testKdb",
              serverAlias: "testKdb",
              serverPort: "1818",
              auth: false,
              managed: false,
              tls: false,
            },
          ],
        },
      };

      serverCommand.addImportedConnections(importedConnections);

      sinon.assert.notCalled(addInsightsConnectionStub);
    });

    it("should overwrite connections", async () => {
      ext.connectionsList.push(insightsNodeImport1, kdbNodeImport1);
      const importedConnections: ExportedConnections = {
        connections: {
          Insights: [
            {
              alias: "testInsight",
              server: "testInsight",
              auth: false,
            },
          ],
          KDB: [
            {
              serverName: "testKdb",
              serverAlias: "testKdb",
              serverPort: "1818",
              auth: false,
              managed: false,
              tls: false,
            },
          ],
        },
      };

      retrieveVersionStub.resolves("0");

      showInformationMessageStub.returns("Overwrite");
      await serverCommand.addImportedConnections(importedConnections);
      sinon.assert.notCalled(addInsightsConnectionStub);
    });
  });

  describe("writeQueryResultsToView", () => {
    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(
        result,
        "",
        "testConn",
        "testFile.kdb.q",
        false,
        "WORKBOOK",
        false,
        "2",
      );

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        false,
      );

      executeCommandStub.restore();
    });

    it("should call executeCommand with correct arguments for an error", () => {
      const result = "Error: test error";
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(
        result,
        "",
        "testConn",
        "testFile.kdb.q",
        false,
        "WORKBOOK",
        false,
        "2",
      );

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        false,
      );

      executeCommandStub.restore();
    });
  });

  describe("enableTLS", () => {
    let getServersStub,
      updateServersStub,
      showErrorMessageStub: sinon.SinonStub;

    beforeEach(() => {
      getServersStub = sinon.stub(coreUtils, "getServers");
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      showErrorMessageStub = sinon.stub(vscode.window, "showErrorMessage");
    });

    afterEach(() => {
      getServersStub.restore();
      updateServersStub.restore();
      showErrorMessageStub.restore();
    });

    it("should show error message when OpenSSL is not found", async () => {
      ext.openSslVersion = null;
      showErrorMessageStub.resolves("More Info");

      await serverCommand.enableTLS("test");

      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.calledWith(
        showErrorMessageStub,
        "OpenSSL not found, please ensure this is installed",
        "More Info",
        "Cancel",
      );
      sinon.assert.notCalled(updateServersStub);
    });

    it("should show error message when server is not found", async () => {
      ext.openSslVersion = "1.0.2";
      getServersStub.returns({});

      await serverCommand.enableTLS("test");

      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.calledWith(
        showErrorMessageStub,
        "Server not found, please ensure this is a correct server",
        "Cancel",
      );
      sinon.assert.calledOnce(getServersStub);
      sinon.assert.notCalled(updateServersStub);
    });

    it("should update server with correct arguments", async () => {
      const servers = {
        testServer: {
          serverAlias: "testServerAlias",
          serverName: "testServerName",
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
      ext.serverProvider = new KdbTreeProvider(servers, insights);
      ext.openSslVersion = "1.0.2";
      getServersStub.returns({
        test: {
          auth: true,
          tls: false,
          serverName: "test",
          serverPort: "1001",
          serverAlias: "testando",
          managed: false,
        },
      });
      await serverCommand.enableTLS("test");
      sinon.assert.calledOnce(updateServersStub);
    });
  });

  describe("writeScratchpadResult", () => {
    const _console = vscode.window.createOutputChannel("q Console Output");
    const executionConsole = new ExecutionConsole(_console);
    const uriTest: vscode.Uri = vscode.Uri.parse("test");

    ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
    let scratchpadResult: ScratchpadResult;
    let _executionConsoleStub,
      queryConsoleErrorStub,
      writeQueryResultsToViewStub,
      writeQueryResultsToConsoleStub,
      isVisibleStub,
      formatScratchpadStacktraceStub: sinon.SinonStub;

    beforeEach(() => {
      _executionConsoleStub = sinon
        .stub(ExecutionConsole, "start")
        .returns(executionConsole);
      scratchpadResult = {
        data: "1234",
        error: false,
        errorMsg: "",
        sessionID: "123",
      };
      queryConsoleErrorStub = sinon.stub(
        ExecutionConsole.prototype,
        "appendQueryError",
      );
      writeQueryResultsToViewStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToView",
      );
      writeQueryResultsToConsoleStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToConsole",
      );
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      formatScratchpadStacktraceStub = sinon.stub(
        queryUtils,
        "formatScratchpadStacktrace",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should write appendQueryError", () => {
      scratchpadResult.error = true;
      scratchpadResult.errorMsg = "error";
      serverCommand.writeScratchpadResult(
        scratchpadResult,
        "dummy query",
        "connLabel",
        "testFile.kdb.q",
        false,
        "test type",
        "2",
        0,
      );
      sinon.assert.notCalled(writeQueryResultsToViewStub);
      sinon.assert.notCalled(writeQueryResultsToConsoleStub);
    });

    it("should write to view", () => {
      scratchpadResult.data = "data";
      isVisibleStub.returns(true);
      serverCommand.writeScratchpadResult(
        scratchpadResult,
        "dummy query",
        "connLabel",
        "testFile.kdb.py",
        true,
        "test type",
        "2",
        0,
      );
      sinon.assert.notCalled(writeQueryResultsToConsoleStub);
      sinon.assert.notCalled(queryConsoleErrorStub);
    });

    it("should write to console", () => {
      scratchpadResult.data = "data";
      isVisibleStub.returns(false);
      serverCommand.writeScratchpadResult(
        scratchpadResult,
        "dummy query",
        "connLabel",
        "testFile.kdb.py",
        true,
        "test type",
        "2",
        0,
      );
      sinon.assert.notCalled(writeQueryResultsToViewStub);
    });
  });

  describe("resetScratchPad", () => {
    it("should call reset scratchpad", async () => {
      const resetScratchpadStub = sinon.stub(
        ConnectionManagementService.prototype,
        "resetScratchpad",
      );
      await serverCommand.resetScratchpad();
      sinon.assert.calledOnce(resetScratchpadStub);
      sinon.restore();
    });
  });

  describe("getConextForRerunQuery", function () {
    it("should return correct context for given input", function () {
      assert.equal(serverCommand.getConextForRerunQuery("\\d .foo"), ".foo");
      assert.equal(
        serverCommand.getConextForRerunQuery('system "d .bar'),
        ".bar",
      );
    });

    it("should return default context for input without context", function () {
      assert.equal(
        serverCommand.getConextForRerunQuery("no context here"),
        ".",
      );
    });

    it("should return last context for input with multiple contexts", function () {
      assert.equal(
        serverCommand.getConextForRerunQuery("\\d .foo\n\\d .bar"),
        ".foo",
      );
    });
  });

  describe("activeConnection", () => {
    let setActiveConnectionStub,
      refreshDataSourcesPanelStub,
      reloadStub: sinon.SinonStub;

    beforeEach(() => {
      setActiveConnectionStub = sinon.stub(
        ConnectionManagementService.prototype,
        "setActiveConnection",
      );
      refreshDataSourcesPanelStub = sinon.stub(
        dataSourceUtils,
        "refreshDataSourcesPanel",
      );
      reloadStub = sinon.stub(ext.serverProvider, "reload");
    });
    afterEach(() => {
      sinon.restore();
    });

    it("should set active connection and refresh panel", () => {
      serverCommand.activeConnection(kdbNode);

      assert.ok(setActiveConnectionStub.calledWith(kdbNode));
      assert.ok(refreshDataSourcesPanelStub.calledOnce);
      assert.ok(reloadStub.calledOnce);
    });
  });

  describe("disconnect", () => {
    let findStub, disconnectStub: sinon.SinonStub;

    beforeEach(() => {
      findStub = sinon.stub(ext.kdbinsightsNodes, "find");
      disconnectStub = sinon.stub(
        ConnectionManagementService.prototype,
        "disconnect",
      );
    });

    afterEach(() => {
      findStub.restore();
      disconnectStub.restore();
    });

    it("should disconnect when ext.connectionNode", async () => {
      findStub.returns(undefined);

      await serverCommand.disconnect("testLabel");

      assert.ok(disconnectStub.calledWith("testLabel"));
    });
  });

  describe("removeConnection", () => {
    let indexOfStub,
      _disconnectStub,
      getServersStub,
      getHashStub,
      getKeyStub,
      getInsightsStub,
      removeLocalConnectionContextStub,
      updateServersStub,
      refreshStub,
      notifyStub: sinon.SinonStub;

    beforeEach(() => {
      indexOfStub = sinon.stub(ext.connectedContextStrings, "indexOf");
      _disconnectStub = sinon.stub(serverCommand, "disconnect");
      getServersStub = sinon.stub(coreUtils, "getServers");
      getInsightsStub = sinon.stub(coreUtils, "getInsights");
      getHashStub = sinon.stub(coreUtils, "getHash");
      getKeyStub = sinon.stub(coreUtils, "getKeyForServerName");
      removeLocalConnectionContextStub = sinon.stub(
        coreUtils,
        "removeLocalConnectionContext",
      );
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      refreshStub = sinon.stub(ext.serverProvider, "refresh");

      notifyStub = sinon.stub(notifications, "notify");
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      sinon.restore();
      ext.connectedContextStrings.length = 0;
    });

    it("should remove connection and refresh server provider when user clicks Proceed", async () => {
      notifyStub.resolves("Proceed");

      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(
        removeLocalConnectionContextStub.calledWith(
          coreUtils.getServerName(kdbNode.details),
        ),
      );
      assert.ok(updateServersStub.calledOnce);
      assert.ok(refreshStub.calledOnce);
    });

    it("should remove connection, but disconnect it before when user clicks Proceed", async () => {
      notifyStub.resolves("Proceed");

      ext.connectedContextStrings.push(kdbNode.label);
      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(updateServersStub.calledOnce);
    });

    it("should remove connection Insights, but disconnect it before when user clicks Proceed", async () => {
      notifyStub.resolves("Proceed");

      ext.connectedContextStrings.push(insightsNode.label);
      indexOfStub.returns(1);
      getInsightsStub.returns({ testKey: {} });
      getHashStub.returns("testKey");

      await serverCommand.removeConnection(insightsNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(updateServersStub.notCalled);
    }).timeout(5000);

    it("should not remove connection when user clicks Cancel", async () => {
      notifyStub.resolves("Cancel");

      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(removeLocalConnectionContextStub.notCalled);
      assert.ok(updateServersStub.notCalled);
      assert.ok(refreshStub.notCalled);
    });

    it("should not remove connection when user dismisses dialog", async () => {
      notifyStub.resolves(undefined);

      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      await new Promise((resolve) => setTimeout(resolve, 0));

      assert.ok(removeLocalConnectionContextStub.notCalled);
      assert.ok(updateServersStub.notCalled);
      assert.ok(refreshStub.notCalled);
    });
  });

  describe("connect", () => {
    const connService = new ConnectionManagementService();
    const _console = vscode.window.createOutputChannel("q Console Output");
    const _executionConsole = new ExecutionConsole(_console);
    let windowErrorStub, retrieveConnectionStub: sinon.SinonStub;

    beforeEach(() => {
      windowErrorStub = sinon.stub(vscode.window, "showErrorMessage");
      retrieveConnectionStub = sinon.stub(connService, "retrieveConnection");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should show error message if connection not found", async () => {
      retrieveConnectionStub.returns(undefined);
      await serverCommand.connect("test");
      assert.strictEqual(windowErrorStub.calledOnce, true);
    });
  });

  describe("refreshGetMeta", () => {
    let refreshGetMetaStub, refreshAllGetMetasStub: sinon.SinonStub;

    beforeEach(() => {
      refreshGetMetaStub = sinon.stub(
        ConnectionManagementService.prototype,
        "refreshGetMeta",
      );
      refreshAllGetMetasStub = sinon.stub(
        ConnectionManagementService.prototype,
        "refreshAllGetMetas",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call refreshGetMeta if connLabel is provided", async () => {
      await serverCommand.refreshGetMeta("test");

      sinon.assert.calledOnce(refreshGetMetaStub);
      sinon.assert.calledWith(refreshGetMetaStub, "test");
      sinon.assert.notCalled(refreshAllGetMetasStub);
    });

    it("should call refreshAllGetMetas if connLabel is not provided", async () => {
      await serverCommand.refreshGetMeta();

      sinon.assert.notCalled(refreshGetMetaStub);
      sinon.assert.calledOnce(refreshAllGetMetasStub);
    });
  });

  describe("openMeta", () => {
    let sandbox: sinon.SinonSandbox;
    let registerProviderCallCount = 0;
    let openTextDocumentCallCount = 0;
    let showTextDocumentCallCount = 0;

    const node = new MetaObjectPayloadNode(
      [],
      "meta",
      "",
      vscode.TreeItemCollapsibleState.None,
      "meta",
      "connLabel",
    );
    const connService = new ConnectionManagementService();

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      registerProviderCallCount = 0;
      openTextDocumentCallCount = 0;
      showTextDocumentCallCount = 0;

      sandbox
        .stub(vscode.workspace, "registerTextDocumentContentProvider")
        .callsFake(
          (scheme: string, provider: vscode.TextDocumentContentProvider) => {
            registerProviderCallCount++;
            return {
              dispose: () => {},
            } as vscode.Disposable;
          },
        );

      sandbox
        .stub(vscode.workspace, "openTextDocument")
        .callsFake((...args: any[]) => {
          openTextDocumentCallCount++;
          return Promise.resolve({} as vscode.TextDocument);
        });

      sandbox
        .stub(vscode.window, "showTextDocument")
        .callsFake((...args: any[]) => {
          showTextDocumentCallCount++;
          return Promise.resolve({} as vscode.TextEditor);
        });
    });

    afterEach(() => {
      sandbox.restore();
      sinon.restore();
    });

    it("should call functions once for valid meta content", async () => {
      sinon
        .stub(ConnectionManagementService.prototype, "retrieveMetaContent")
        .returns('{"test": []}');

      await serverCommand.openMeta(node);

      assert.strictEqual(
        registerProviderCallCount,
        1,
        "registerTextDocumentContentProvider should be called once",
      );
      assert.strictEqual(
        openTextDocumentCallCount,
        1,
        "openTextDocument should be called once",
      );
      assert.strictEqual(
        showTextDocumentCallCount,
        1,
        "showTextDocument should be called once",
      );
    });

    it("should not call some functions for invalid meta content", async () => {
      sinon.stub(connService, "retrieveMetaContent").returns("");

      await serverCommand.openMeta(node);

      assert.strictEqual(
        registerProviderCallCount,
        1,
        "registerTextDocumentContentProvider should be called once",
      );
      assert.strictEqual(
        openTextDocumentCallCount,
        0,
        "openTextDocument should not be called",
      );
      assert.strictEqual(
        showTextDocumentCallCount,
        0,
        "showTextDocument should not be called",
      );
    });
  });

  describe("exportConnections", () => {
    let sandbox: sinon.SinonSandbox;
    let kdbOutputLogStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
    });

    afterEach(() => {
      sandbox.restore();
      sinon.restore();
      mock.restore();
    });

    it("should log an error when no connections are found", async () => {
      const exportConnectionStub = sandbox
        .stub(ConnectionManagementService.prototype, "exportConnection")
        .returns("");
      const showQuickPickStub = sandbox
        .stub(vscode.window, "showQuickPick")
        .resolves({ label: "No" });

      await serverCommand.exportConnections();

      sinon.assert.calledOnce(kdbOutputLogStub);
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[serverCommand] No connections found to be exported.",
        "ERROR",
      );

      exportConnectionStub.restore();
      showQuickPickStub.restore();
    });

    it("should log info when save operation is cancelled by the user", async () => {
      const exportConnectionStub = sandbox
        .stub(ConnectionManagementService.prototype, "exportConnection")
        .returns("{}");
      const showSaveDialogStub = sandbox
        .stub(vscode.window, "showSaveDialog")
        .resolves(undefined);
      const showQuickPickStub = sandbox
        .stub(vscode.window, "showQuickPick")
        .resolves({ label: "Yes" });

      await serverCommand.exportConnections();

      sinon.assert.calledOnce(kdbOutputLogStub);
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[serverCommand] Save operation was cancelled by the user.",
        "DEBUG",
      );

      exportConnectionStub.restore();
      showSaveDialogStub.restore();
      showQuickPickStub.restore();
    });
  });

  describe("copyQuery", () => {
    let showInfoStub: sinon.SinonStub;

    beforeEach(() => {
      showInfoStub = sinon.stub(vscode.window, "showInformationMessage");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should copy query to clipboard", async () => {
      const queryHistory: QueryHistory = {
        executorName: "test",
        connectionName: "conn",
        connectionType: ServerType.KDB,
        query: "select from table",
        time: "now",
        success: true,
      };

      serverCommand.copyQuery(queryHistory);
      sinon.assert.calledOnceWithExactly(
        showInfoStub,
        "Query copied to clipboard.",
        "Dismiss",
      );
    });

    it("should not copy query to clipboard if query is not string", async () => {
      const dummyDsFiles = createDefaultDataSourceFile();
      const queryHistory: QueryHistory = {
        executorName: "test",
        connectionName: "conn",
        connectionType: ServerType.KDB,
        query: dummyDsFiles,
        time: "now",
        success: true,
      };
      await serverCommand.copyQuery(queryHistory);
      sinon.assert.notCalled(showInfoStub);
    });

    it("should not copy query to clipboard if is DS", async () => {
      const queryHistory: QueryHistory = {
        executorName: "test",
        connectionName: "conn",
        connectionType: ServerType.KDB,
        query: "select from table",
        time: "now",
        success: true,
        isDatasource: true,
      };
      await serverCommand.copyQuery(queryHistory);
      sinon.assert.notCalled(showInfoStub);
    });
  });
});
