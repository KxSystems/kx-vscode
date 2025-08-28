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
import dotenv from "dotenv";
import path from "node:path";
import { env } from "node:process";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { LocalConnection } from "../../../src/classes/localConnection";
import { ext } from "../../../src/extensionVariables";
import {
  InsightDetails,
  ServerDetails,
} from "../../../src/models/connectionsModels";
import * as coreUtils from "../../../src/utils/core";
import * as cpUtils from "../../../src/utils/cpUtils";
import * as loggers from "../../../src/utils/loggers";
import * as shell from "../../../src/utils/shell";

describe("core", () => {
  describe("checkOpenSslInstalled", () => {
    let tryExecuteCommandStub, kdbOutputLogStub: sinon.SinonStub;

    beforeEach(() => {
      tryExecuteCommandStub = sinon.stub(cpUtils, "tryExecuteCommand");
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
    });

    afterEach(() => {
      tryExecuteCommandStub.restore();
      kdbOutputLogStub.restore();
    });

    it("should return null if OpenSSL is not installed", async () => {
      tryExecuteCommandStub.resolves({ code: 1, cmdOutput: "" });
      const result = await coreUtils.checkOpenSslInstalled();

      assert.strictEqual(result, null);
    });

    it("should handle errors correctly", async () => {
      const error = new Error("Test error");

      tryExecuteCommandStub.rejects(error);

      const result = await coreUtils.checkOpenSslInstalled();

      assert.strictEqual(result, null);
    });
  });

  describe("setOutputWordWrapper", () => {
    let getConfigurationStub: sinon.SinonStub;

    beforeEach(() => {
      getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    });

    afterEach(() => {
      getConfigurationStub.restore();
    });
    it("should create wordwrapper if doesn't exist", () => {
      getConfigurationStub.returns({
        get: sinon.stub().returns({ "[Log]": { "editor.wordWrap": "off" } }),
        update: sinon.stub(),
      });
      coreUtils.setOutputWordWrapper();
      sinon.assert.calledTwice(getConfigurationStub);
    });

    it("should let wordwrapper if it exist", () => {
      getConfigurationStub.returns({ "editor.wordWrap": "on" });
      coreUtils.setOutputWordWrapper();
      sinon.assert.calledOnce(getConfigurationStub);
    });
  });

  describe("server alias", () => {
    beforeEach(() => {
      ext.kdbConnectionAliasList.length = 0;
    });

    afterEach(() => {
      ext.kdbConnectionAliasList.length = 0;
    });

    it("should add insights alias to the list getInsightsAlias", () => {
      const insightsDetail: InsightDetails = {
        alias: "test",
        server: "test",
        auth: true,
      };

      coreUtils.getInsightsAlias([insightsDetail]);
      assert.strictEqual(ext.kdbConnectionAliasList.length, 1);
    });

    it("should add alias only from kdb server that have alias using getServerAlias", () => {
      const serverList: ServerDetails[] = [
        {
          serverName: "test",
          serverAlias: "test",
          serverPort: "5001",
          managed: false,
          auth: false,
          tls: false,
        },
        {
          serverName: "test2",
          serverAlias: undefined,
          serverPort: "5001",
          managed: false,
          auth: false,
          tls: false,
        },
      ];

      coreUtils.getServerAlias(serverList);
      assert.strictEqual(ext.kdbConnectionAliasList.length, 1);
    });
  });

  describe("getServerIconState", () => {
    const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectedConnectionList.length = 0;
    });

    it("should return connected state", () => {
      ext.activeConnection = undefined;
      ext.connectedConnectionList.push(localConn);
      const result = coreUtils.getServerIconState(localConn.connLabel);

      assert.strictEqual(result, "-connected");
    });

    it("should return active state", () => {
      ext.activeConnection = localConn;
      const result = coreUtils.getServerIconState(localConn.connLabel);

      assert.strictEqual(result, "-active");
    });

    it("should return disconnected state", () => {
      ext.activeConnection = undefined;
      const result = coreUtils.getServerIconState(localConn.connLabel);

      assert.strictEqual(result, "");
    });
  });

  describe("getStatus", () => {
    const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectedConnectionList.length = 0;
    });

    it("should return connected state", () => {
      ext.activeConnection = undefined;
      ext.connectedConnectionList.push(localConn);
      const result = coreUtils.getStatus(localConn.connLabel);

      assert.strictEqual(result, "- connected");
    });

    it("should return active state", () => {
      ext.activeConnection = localConn;
      const result = coreUtils.getStatus(localConn.connLabel);

      assert.strictEqual(result, "- active");
    });

    it("should return disconnected state", () => {
      ext.activeConnection = undefined;
      const result = coreUtils.getStatus(localConn.connLabel);

      assert.strictEqual(result, "- disconnected");
    });
  });

  describe("getWorkspaceIconsState", () => {
    const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);

    afterEach(() => {
      ext.connectedConnectionList.length = 0;
    });

    it("should return active state", () => {
      ext.connectedConnectionList.push(localConn);
      const result = coreUtils.getWorkspaceIconsState(localConn.connLabel);

      assert.strictEqual(result, "-active");
    });

    it("should return disconnected state", () => {
      ext.activeConnection = undefined;
      const result = coreUtils.getWorkspaceIconsState(localConn.connLabel);

      assert.strictEqual(result, "");
    });
  });

  /* eslint-disable @typescript-eslint/no-unused-expressions */
  describe("coreLogs", () => {
    ext.outputChannel = vscode.window.createOutputChannel("kdb");
    let appendLineSpy, showErrorMessageSpy: sinon.SinonSpy;

    beforeEach(() => {
      appendLineSpy = sinon.spy(
        vscode.window.createOutputChannel("testChannel"),
        "appendLine",
      );
      showErrorMessageSpy = sinon.spy(vscode.window, "showErrorMessage");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("kdbOutputLog should log message with date and type", () => {
      const message = "test message";
      const type = "INFO";

      loggers.kdbOutputLog(message, type);

      appendLineSpy.calledOnce;
      appendLineSpy.calledWithMatch(message);
      appendLineSpy.calledWithMatch(type);
    });

    it("kdbOutputLog should log message with date and ERROR type", () => {
      const message = "test message";
      const type = "ERROR";

      loggers.kdbOutputLog(message, type);

      appendLineSpy.calledOnce;
      showErrorMessageSpy.calledOnce;
      appendLineSpy.calledWithMatch(message);
      appendLineSpy.calledWithMatch(type);
    });

    it("tokenUndefinedError should log and show error message", () => {
      const connLabel = "test connection";

      coreUtils.tokenUndefinedError(connLabel);

      appendLineSpy.calledOnce;
      showErrorMessageSpy.calledOnce;
      appendLineSpy.calledWithMatch(connLabel);
      showErrorMessageSpy.calledWithMatch(connLabel);
    });

    it("invalidUsernameJWT should log and show error message", () => {
      const connLabel = "test connection";

      coreUtils.invalidUsernameJWT(connLabel);

      appendLineSpy.calledOnce;
      showErrorMessageSpy.calledOnce;
      appendLineSpy.calledWithMatch(connLabel);
      showErrorMessageSpy.calledWithMatch(connLabel);
    });
  });
  /* eslint-enable @typescript-eslint/no-unused-expressions */

  describe("hasWorkspaceOrShowOption", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return true if a workspace folder is opened", () => {
      sinon.stub(vscode.workspace, "workspaceFolders").get(() => [{}]);
      const result = coreUtils.hasWorkspaceOrShowOption("Test");

      assert.strictEqual(result, true);
    });

    it("should return false and display message if no workspace", () => {
      const stub = sinon.stub(vscode.window, "showWarningMessage").resolves();
      const result = coreUtils.hasWorkspaceOrShowOption("Test");

      assert.strictEqual(result, false);
      assert.ok(stub.calledOnce);
    });
  });

  describe("noSelectedConnectionAction", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should call showInformationMessage", () => {
      const stub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();

      coreUtils.noSelectedConnectionAction();
      assert.ok(stub.calledOnce);
    });
  });

  describe("getServers", () => {
    let workspaceStub,
      _getConfigurationStub,
      getStub,
      updateServersStub: sinon.SinonStub;

    beforeEach(() => {
      getStub = sinon.stub();
      _getConfigurationStub = sinon
        .stub()
        .returns({ get: getStub, update: sinon.stub() });
      workspaceStub = sinon.stub(vscode.workspace, "getConfiguration").returns({
        get: getStub,
        has: function (_section: string): boolean {
          throw new Error("Function not implemented.");
        },
        inspect: function <T>(_section: string):
          | {
              key: string;
              defaultValue?: T;
              globalValue?: T;
              workspaceValue?: T;
              workspaceFolderValue?: T;
              defaultLanguageValue?: T;
              globalLanguageValue?: T;
              workspaceLanguageValue?: T;
              workspaceFolderLanguageValue?: T;
              languageIds?: string[];
            }
          | undefined {
          throw new Error("Function not implemented.");
        },
        update: function (
          _section: string,
          _value: any,
          _configurationTarget?: vscode.ConfigurationTarget | boolean | null,
          _overrideInLanguage?: boolean,
        ): Thenable<void> {
          throw new Error("Function not implemented.");
        },
      });
      updateServersStub = sinon.stub(coreUtils, "updateServers").resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return an empty object when no servers are configured", () => {
      getStub.returns({});
      const result = coreUtils.getServers();

      assert.ok(typeof result === "object");
      assert.strictEqual(Object.keys(result).length, 0);
      assert.ok(getStub.calledWith("kdb.servers"));
    });

    it("should return servers sorted alphabetically by serverAlias", () => {
      const mockServers = {
        server3: {
          serverName: "localhost",
          serverPort: "5003",
          serverAlias: "Charlie Server",
          auth: false,
          managed: false,
          tls: false,
        },
        server1: {
          serverName: "localhost",
          serverPort: "5001",
          serverAlias: "Alpha Server",
          auth: false,
          managed: false,
          tls: false,
        },
        server2: {
          serverName: "localhost",
          serverPort: "5002",
          serverAlias: "Beta Server",
          auth: true,
          managed: true,
          tls: true,
        },
      };

      getStub.returns(mockServers);

      const result = coreUtils.getServers();

      assert.ok(result);
      const serverKeys = Object.keys(result);
      const serverAliases = serverKeys.map((key) => result[key].serverAlias);

      assert.deepStrictEqual(serverAliases, [
        "Alpha Server",
        "Beta Server",
        "Charlie Server",
      ]);

      assert.strictEqual(result[serverKeys[0]].serverName, "localhost");
      assert.strictEqual(result[serverKeys[0]].serverPort, "5001");
      assert.strictEqual(result[serverKeys[0]].auth, false);
      assert.strictEqual(result[serverKeys[1]].managed, true);
      assert.strictEqual(result[serverKeys[2]].tls, false);
    });

    it("should handle single server correctly", () => {
      const mockServers = {
        onlyServer: {
          serverName: "remote-host",
          serverPort: "6000",
          serverAlias: "Single Server",
          auth: true,
          managed: false,
          tls: true,
        },
      };

      getStub.returns(mockServers);

      const result = coreUtils.getServers();

      assert.ok(result);
      const serverKeys = Object.keys(result);

      assert.strictEqual(serverKeys.length, 1);
      assert.strictEqual(result[serverKeys[0]].serverAlias, "Single Server");
      assert.strictEqual(result[serverKeys[0]].serverName, "remote-host");
    });

    it("should handle servers with identical serverAlias", () => {
      const mockServers = {
        server1: {
          serverName: "host1",
          serverPort: "5001",
          serverAlias: "Same Name",
          auth: false,
          managed: false,
          tls: false,
        },
        server2: {
          serverName: "host2",
          serverPort: "5002",
          serverAlias: "Same Name",
          auth: false,
          managed: false,
          tls: false,
        },
      };

      getStub.returns(mockServers);

      const result = coreUtils.getServers();

      assert.ok(result);
      const serverKeys = Object.keys(result);

      assert.strictEqual(serverKeys.length, 2);

      serverKeys.forEach((key) => {
        assert.strictEqual(result[key].serverAlias, "Same Name");
      });
    });

    it("should handle empty servers object", () => {
      const mockServers = {};

      getStub.returns(mockServers);

      const result = coreUtils.getServers();

      assert.ok(result);
      assert.strictEqual(Object.keys(result).length, 0);
    });

    it("should handle servers with special characters in serverAlias", () => {
      const mockServers = {
        server1: {
          serverName: "localhost",
          serverPort: "5001",
          serverAlias: "!Special Server",
          auth: false,
          managed: false,
          tls: false,
        },
        server2: {
          serverName: "localhost",
          serverPort: "5002",
          serverAlias: "123 Numeric Server",
          auth: false,
          managed: false,
          tls: false,
        },
        server3: {
          serverName: "localhost",
          serverPort: "5003",
          serverAlias: "Åccented Server",
          auth: false,
          managed: false,
          tls: false,
        },
      };

      getStub.returns(mockServers);

      const result = coreUtils.getServers();

      assert.ok(result);
      const serverKeys = Object.keys(result);
      const serverAliases = serverKeys.map((key) => result[key].serverAlias);

      assert.strictEqual(serverAliases[0], "!Special Server");
      assert.strictEqual(serverAliases[1], "123 Numeric Server");
      assert.strictEqual(serverAliases[2], "Åccented Server");
    });

    it("should call workspace.getConfiguration without parameters", () => {
      getStub.returns(undefined);

      coreUtils.getServers();

      assert.ok(workspaceStub.calledTwice);
      assert.ok(workspaceStub.calledWith());
    });

    it("should call get method with correct parameter", () => {
      getStub.returns(undefined);

      coreUtils.getServers();

      assert.ok(getStub.calledOnce);
      assert.ok(getStub.calledWith("kdb.servers"));
    });
  });

  describe("getInsights", () => {
    let workspaceStub,
      _getConfigurationStub,
      getStub,
      updateInsightsStub: sinon.SinonStub;

    beforeEach(() => {
      getStub = sinon.stub();
      _getConfigurationStub = sinon
        .stub()
        .returns({ get: getStub, update: sinon.stub() });
      workspaceStub = sinon.stub(vscode.workspace, "getConfiguration").returns({
        get: getStub,
        has: function (_section: string): boolean {
          throw new Error("Function not implemented.");
        },
        inspect: function <T>(_section: string):
          | {
              key: string;
              defaultValue?: T;
              globalValue?: T;
              workspaceValue?: T;
              workspaceFolderValue?: T;
              defaultLanguageValue?: T;
              globalLanguageValue?: T;
              workspaceLanguageValue?: T;
              workspaceFolderLanguageValue?: T;
              languageIds?: string[];
            }
          | undefined {
          throw new Error("Function not implemented.");
        },
        update: sinon.stub(),
      });
      updateInsightsStub = sinon.stub(coreUtils, "updateInsights").resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return undefined when no insights are configured", () => {
      getStub.withArgs("kdb.insightsEnterpriseConnections").returns(undefined);
      getStub.withArgs("kdb.insights").returns(undefined);

      const result = coreUtils.getInsights();

      assert.ok(typeof result === "object");
      assert.strictEqual(Object.keys(result).length, 0);
      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(getStub.calledWith("kdb.insights"));
    });

    it("should return insightsEnterpriseConnections when available and not empty", () => {
      const mockInsights = {
        insight3: {
          alias: "Charlie Insight",
          server: "https://charlie.insights.com",
          auth: true,
          realm: "charlie-realm",
          insecure: false,
        },
        insight1: {
          alias: "Alpha Insight",
          server: "https://alpha.insights.com",
          auth: false,
          insecure: true,
        },
        insight2: {
          alias: "Beta Insight",
          server: "https://beta.insights.com",
          auth: true,
          realm: "beta-realm",
          insecure: false,
        },
      };

      getStub
        .withArgs("kdb.insightsEnterpriseConnections")
        .returns(mockInsights);
      getStub.withArgs("kdb.insights").returns(undefined);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);
      const insightAliases = insightKeys.map((key) => result[key].alias);

      assert.deepStrictEqual(insightAliases, [
        "Alpha Insight",
        "Beta Insight",
        "Charlie Insight",
      ]);

      assert.strictEqual(
        result[insightKeys[0]].server,
        "https://alpha.insights.com",
      );
      assert.strictEqual(result[insightKeys[0]].auth, false);
      assert.strictEqual(result[insightKeys[1]].realm, "beta-realm");
      assert.strictEqual(result[insightKeys[2]].insecure, false);

      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(!getStub.calledWith("kdb.insights"));
    });

    it("should fallback to kdb.insights when insightsEnterpriseConnections is empty", () => {
      const mockFallbackInsights = {
        fallback2: {
          alias: "Fallback Beta",
          server: "https://fallback-beta.com",
          auth: true,
        },
        fallback1: {
          alias: "Fallback Alpha",
          server: "https://fallback-alpha.com",
          auth: false,
        },
      };

      getStub.withArgs("kdb.insightsEnterpriseConnections").returns({});
      getStub.withArgs("kdb.insights").returns(mockFallbackInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);
      const insightAliases = insightKeys.map((key) => result[key].alias);

      assert.deepStrictEqual(insightAliases, [
        "Fallback Alpha",
        "Fallback Beta",
      ]);

      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(getStub.calledWith("kdb.insights"));
    });

    it("should fallback to kdb.insights when insightsEnterpriseConnections is undefined", () => {
      const mockFallbackInsights = {
        single: {
          alias: "Single Fallback",
          server: "https://single-fallback.com",
          auth: true,
          realm: "single-realm",
        },
      };

      getStub.withArgs("kdb.insightsEnterpriseConnections").returns(undefined);
      getStub.withArgs("kdb.insights").returns(mockFallbackInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);

      assert.strictEqual(insightKeys.length, 1);
      assert.strictEqual(result[insightKeys[0]].alias, "Single Fallback");

      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(getStub.calledWith("kdb.insights"));
    });

    it("should return undefined when both sources are empty", () => {
      getStub.withArgs("kdb.insightsEnterpriseConnections").returns({});
      getStub.withArgs("kdb.insights").returns({});

      const result = coreUtils.getInsights();

      assert.ok(typeof result === "object");
      assert.strictEqual(Object.keys(result).length, 0);
      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(getStub.calledWith("kdb.insights"));
    });

    it("should handle single insight correctly", () => {
      const mockInsights = {
        onlyInsight: {
          alias: "Only Insight",
          server: "https://only.insights.com",
          auth: true,
          realm: "only-realm",
          insecure: false,
        },
      };

      getStub
        .withArgs("kdb.insightsEnterpriseConnections")
        .returns(mockInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);

      assert.strictEqual(insightKeys.length, 1);
      assert.strictEqual(result[insightKeys[0]].alias, "Only Insight");
      assert.strictEqual(
        result[insightKeys[0]].server,
        "https://only.insights.com",
      );
    });

    it("should handle insights with identical aliases", () => {
      const mockInsights = {
        insight1: {
          alias: "Same Name",
          server: "https://server1.com",
          auth: false,
        },
        insight2: {
          alias: "Same Name",
          server: "https://server2.com",
          auth: true,
        },
      };

      getStub
        .withArgs("kdb.insightsEnterpriseConnections")
        .returns(mockInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);

      assert.strictEqual(insightKeys.length, 2);

      insightKeys.forEach((key) => {
        assert.strictEqual(result[key].alias, "Same Name");
      });
    });

    it("should handle insights with special characters in alias", () => {
      const mockInsights = {
        insight1: {
          alias: "!Special Insight",
          server: "https://special.com",
          auth: false,
        },
        insight2: {
          alias: "123 Numeric Insight",
          server: "https://numeric.com",
          auth: false,
        },
        insight3: {
          alias: "Åccented Insight",
          server: "https://accented.com",
          auth: false,
        },
      };

      getStub
        .withArgs("kdb.insightsEnterpriseConnections")
        .returns(mockInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);
      const insightAliases = insightKeys.map((key) => result[key].alias);

      assert.strictEqual(insightAliases[0], "!Special Insight");
      assert.strictEqual(insightAliases[1], "123 Numeric Insight");
      assert.strictEqual(insightAliases[2], "Åccented Insight");
    });

    it("should prefer insightsEnterpriseConnections over fallback when both exist", () => {
      const mockPrimaryInsights = {
        primary: {
          alias: "Primary Insight",
          server: "https://primary.com",
          auth: true,
        },
      };
      const mockFallbackInsights = {
        fallback: {
          alias: "Fallback Insight",
          server: "https://fallback.com",
          auth: false,
        },
      };

      getStub
        .withArgs("kdb.insightsEnterpriseConnections")
        .returns(mockPrimaryInsights);
      getStub.withArgs("kdb.insights").returns(mockFallbackInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);

      assert.strictEqual(insightKeys.length, 1);
      assert.strictEqual(result[insightKeys[0]].alias, "Primary Insight");
      assert.strictEqual(result[insightKeys[0]].server, "https://primary.com");

      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(!getStub.calledWith("kdb.insights"));
    });

    it("should call workspace.getConfiguration without parameters", () => {
      getStub.withArgs("kdb.insightsEnterpriseConnections").returns(undefined);
      getStub.withArgs("kdb.insights").returns(undefined);

      coreUtils.getInsights();

      assert.ok(workspaceStub.calledTwice);
      assert.ok(workspaceStub.calledWith());
    });

    it("should call get method with correct parameters", () => {
      getStub.withArgs("kdb.insightsEnterpriseConnections").returns(undefined);
      getStub.withArgs("kdb.insights").returns(undefined);

      coreUtils.getInsights();

      assert.ok(getStub.calledWith("kdb.insightsEnterpriseConnections"));
      assert.ok(getStub.calledWith("kdb.insights"));
    });

    it("should handle insights with optional properties", () => {
      const mockInsights = {
        insight1: {
          alias: "Basic Insight",
          server: "https://basic.com",
          auth: false,
        },
        insight2: {
          alias: "Full Insight",
          server: "https://full.com",
          auth: true,
          realm: "full-realm",
          insecure: true,
        },
      };

      getStub
        .withArgs("kdb.insightsEnterpriseConnections")
        .returns(mockInsights);

      const result = coreUtils.getInsights();

      assert.ok(result);
      const insightKeys = Object.keys(result);

      assert.strictEqual(insightKeys.length, 2);

      const basicInsight = Object.values(result).find(
        (i) => i.alias === "Basic Insight",
      );
      const fullInsight = Object.values(result).find(
        (i) => i.alias === "Full Insight",
      );

      assert.ok(basicInsight);
      assert.strictEqual(basicInsight.realm, undefined);
      assert.strictEqual(basicInsight.insecure, undefined);

      assert.ok(fullInsight);
      assert.strictEqual(fullInsight.realm, "full-realm");
      assert.strictEqual(fullInsight.insecure, true);
    });
  });

  describe("getQExecutablePath", () => {
    afterEach(() => {
      sinon.restore();
    });
    it("should return KDB+", () => {
      ext.REAL_QHOME = "QHOME";
      sinon.stub(shell, "stat").returns(false);
      const res = coreUtils.getEnvironment();

      assert.ok(res);
    });
    it("should return KDB-X", () => {
      ext.REAL_QHOME = "QHOME";
      sinon.stub(shell, "stat").returns(true);
      const res = coreUtils.getEnvironment();

      assert.strictEqual(res.QPATH, path.join("QHOME", "bin", "q"));
    });
    it("should return KDB-X", () => {
      ext.REAL_QHOME = "";
      const target = path.join("QHOME", "bin", "q");

      sinon.stub(shell, "which").returns([target]);
      const res = coreUtils.getEnvironment();

      assert.strictEqual(res.QPATH, target);
    });
    it("should return qHomeDirectory", () => {
      ext.REAL_QHOME = "";
      sinon.stub(shell, "which").throws();
      sinon.stub(vscode.workspace, "getConfiguration").value(() => {
        return { get: () => "QHOME" };
      });
      const res = coreUtils.getEnvironment();

      assert.ok(res);
    });
    it("should throw if q not found", () => {
      ext.REAL_QHOME = "";
      sinon.stub(shell, "which").throws();
      sinon.stub(vscode.workspace, "getConfiguration").value(() => {
        return { get: () => "" };
      });
      const res = coreUtils.getEnvironment();

      assert.strictEqual(res.QPATH, undefined);
    });
    it("should return dotenv", () => {
      const uri = vscode.Uri.file("test");

      sinon
        .stub(vscode.workspace, "getWorkspaceFolder")
        .returns({ uri, name: "test", index: 0 });
      const stub = sinon.stub(dotenv, "configDotenv");

      coreUtils.getEnvironment(uri);
      sinon.assert.calledOnce(stub);
    });
  });

  describe("checkLocalInstall", () => {
    let getConfigurationStub,
      updateConfigurationStub,
      showInformationMessageStub,
      executeCommandStub: sinon.SinonStub;
    let QHOME = "";

    beforeEach(() => {
      getConfigurationStub = sinon
        .stub(vscode.workspace, "getConfiguration")
        .returns({
          get: sinon.stub().returns(false),
          update: sinon.stub().resolves(),
        } as any);
      updateConfigurationStub = getConfigurationStub()
        .update as sinon.SinonStub;
      showInformationMessageStub = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves();
      executeCommandStub = sinon
        .stub(vscode.commands, "executeCommand")
        .resolves();
      QHOME = env.QHOME;
      env.QHOME = "";
    });

    afterEach(() => {
      env.QHOME = QHOME;
      sinon.restore();
    });

    it("should return if 'neverShowQInstallAgain' is true", async () => {
      getConfigurationStub()
        .get.withArgs("kdb.neverShowQInstallAgain")
        .returns(true);

      await coreUtils.checkLocalInstall(true);

      assert.strictEqual(showInformationMessageStub.called, false);
      assert.strictEqual(executeCommandStub.called, false);
    });
    it("should continue if 'neverShowQInstallAgain' is false", async () => {
      getConfigurationStub()
        .get.withArgs("kdb.neverShowQInstallAgain")
        .returns(false);

      await coreUtils.checkLocalInstall(true);

      assert.strictEqual(showInformationMessageStub.called, true);
      assert.strictEqual(executeCommandStub.called, true);
    });

    it("should handle 'Never show again' response", async () => {
      getConfigurationStub()
        .get.withArgs("kdb.qHomeDirectory")
        .returns(undefined);
      getConfigurationStub()
        .get.withArgs("kdb.neverShowQInstallAgain")
        .returns(false);
      showInformationMessageStub.resolves("Never show again");

      await coreUtils.checkLocalInstall();

      assert.strictEqual(
        updateConfigurationStub.calledWith(
          "kdb.neverShowQInstallAgain",
          true,
          vscode.ConfigurationTarget.Global,
        ),
        true,
      );
    });
  });
});
