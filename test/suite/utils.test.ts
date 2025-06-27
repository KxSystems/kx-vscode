/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import mock from "mock-fs";
import { env } from "node:process";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TreeItemCollapsibleState } from "vscode";

import { LocalConnection } from "../../src/classes/localConnection";
import { ext } from "../../src/extensionVariables";
import { DCDS } from "../../src/ipc/c";
import {
  DDateClass,
  DDateTimeClass,
  DTimestampClass,
} from "../../src/ipc/cClasses";
import * as QTable from "../../src/ipc/QTable";
import { CancellationEvent } from "../../src/models/cancellationEvent";
import {
  InsightDetails,
  ServerDetails,
  ServerType,
} from "../../src/models/connectionsModels";
import { DataSourceTypes } from "../../src/models/dataSource";
import { Labels } from "../../src/models/labels";
import { MetaObjectPayload } from "../../src/models/meta";
import { QueryResultType } from "../../src/models/queryResult";
import {
  InvalidParamFieldErrors,
  ParamFieldType,
  UDAParam,
  UDARequestBody,
} from "../../src/models/uda";
import { InsightsNode, KdbNode } from "../../src/services/kdbTreeProvider";
import { QueryHistoryProvider } from "../../src/services/queryHistoryProvider";
import * as LabelsUtils from "../../src/utils/connLabel";
import * as coreUtils from "../../src/utils/core";
import * as cpUtils from "../../src/utils/cpUtils";
import * as dataSourceUtils from "../../src/utils/dataSource";
import * as decodeUtils from "../../src/utils/decode";
import * as executionUtils from "../../src/utils/execution";
import * as executionConsoleUtils from "../../src/utils/executionConsole";
import { feedbackSurveyDialog } from "../../src/utils/feedbackSurveyUtils";
import { getNonce } from "../../src/utils/getNonce";
import { getUri } from "../../src/utils/getUri";
import * as loggers from "../../src/utils/loggers";
import { openUrl } from "../../src/utils/openUrl";
import * as queryUtils from "../../src/utils/queryUtils";
import { showRegistrationNotification } from "../../src/utils/registration";
import * as shared from "../../src/utils/shared";
import { killPid } from "../../src/utils/shell";
import * as UDAUtils from "../../src/utils/uda";
import {
  showInputBox,
  showOpenFolderDialog,
  showQuickPick,
} from "../../src/utils/userInteraction";
import { validateUtils } from "../../src/utils/validateUtils";

interface ITestItem extends vscode.QuickPickItem {
  id: number;
  label: string;
  description: string;
  testProperty: string;
}

describe("Utils", () => {
  let windowMock: sinon.SinonMock;

  beforeEach(() => {
    windowMock = sinon.mock(vscode.window);
  });

  afterEach(() => {
    windowMock.restore();
  });

  describe("core", () => {
    describe("checkOpenSslInstalled", () => {
      let tryExecuteCommandStub: sinon.SinonStub;
      let kdbOutputLogStub: sinon.SinonStub;
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

    describe("getHideDetailedConsoleQueryOutput", () => {
      let getConfigurationStub: sinon.SinonStub;

      beforeEach(() => {
        getConfigurationStub = sinon.stub(
          vscode.workspace,
          "getConfiguration",
        ) as sinon.SinonStub;
      });

      afterEach(() => {
        getConfigurationStub.restore();
        sinon.restore();
      });

      it("should update configuration and set hideDetailedConsoleQueryOutput to true when setting is undefined", async () => {
        getConfigurationStub.returns({
          get: sinon.stub().returns(undefined),
          update: sinon.stub(),
        });

        await coreUtils.getHideDetailedConsoleQueryOutput();

        sinon.assert.calledTwice(getConfigurationStub);
        assert.strictEqual(ext.hideDetailedConsoleQueryOutput, true);
      });

      it("should set hideDetailedConsoleQueryOutput to setting when setting is defined", async () => {
        getConfigurationStub.returns({
          get: sinon.stub().returns(false),
          update: sinon.stub(),
        });

        await coreUtils.getHideDetailedConsoleQueryOutput();

        sinon.assert.calledOnce(getConfigurationStub);
        assert.strictEqual(ext.hideDetailedConsoleQueryOutput, false);
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
  });

  describe("dataSource", () => {
    // need check how to mock ext variables and populate it with values
    // it("createKdbDataSourcesFolder", () => {
    //   const result = dataSourceUtils.createKdbDataSourcesFolder();
    //   assert.strictEqual(
    //     result,
    //     "/Users/username/.vscode-server/data/User/kdb/dataSources"
    //   );
    // });

    it("convertTimeToTimestamp", () => {
      const result = dataSourceUtils.convertTimeToTimestamp("2021-01-01");
      assert.strictEqual(result, "2021-01-01T00:00:00.000000000");
    });

    it("convertTimeToTimestamp", () => {
      const result = dataSourceUtils.convertTimeToTimestamp("testTime");
      assert.strictEqual(result, "");
    });

    it("getConnectedInsightsNode", () => {
      const result = dataSourceUtils.getConnectedInsightsNode();
      assert.strictEqual(result, "");
    });

    it("checkFileFromInsightsNode", () => {
      const file = "test";
      const result = dataSourceUtils.checkFileFromInsightsNode(file);
      assert.strictEqual(result, false);
    });

    it("checkIfTimeParamIsCorrect", () => {
      const result = dataSourceUtils.checkIfTimeParamIsCorrect(
        "2021-01-01",
        "2021-01-02",
      );
      assert.strictEqual(result, true);
      const result2 = dataSourceUtils.checkIfTimeParamIsCorrect(
        "2021-01-02",
        "2021-01-01",
      );
      assert.strictEqual(result2, false);
    });

    describe("oldFilesExists", () => {
      let createKdbDataSourcesFolderStub: sinon.SinonStub;

      beforeEach(() => {
        createKdbDataSourcesFolderStub = sinon.stub(
          dataSourceUtils,
          "createKdbDataSourcesFolder",
        );
      });

      afterEach(() => {
        sinon.restore();
        mock.restore();
      });

      it("should return false if there are no files in the directory", () => {
        ext.context = {} as vscode.ExtensionContext;
        sinon.stub(ext, "context").value({
          globalStorageUri: {
            fsPath: "/temp/",
          },
        });
        mock({
          "path/to/directory": {},
        });

        createKdbDataSourcesFolderStub.returns("path/to/directory");

        const result = dataSourceUtils.oldFilesExists();

        assert.equal(result, false);
      });
    });
  });

  describe("decode", () => {
    describe("decodeQUTF", () => {
      it("should return undefined if the input is undefined", () => {
        const result = decodeUtils.decodeQUTF(undefined);
        assert.strictEqual(result, undefined);
      });

      it("should decode octal escape sequences in the input string", () => {
        const input = "\\344\\275\\240\\345\\245\\275";
        const expectedOutput = "你好";
        const result = decodeUtils.decodeQUTF(input);
        assert.strictEqual(result, expectedOutput);
      });

      it("should decode 1b to true and 0b to false", () => {
        const input1 = "1b";
        const input2 = "0b";
        const result1 = decodeUtils.decodeQUTF(input1);
        const result2 = decodeUtils.decodeQUTF(input2);
        assert.strictEqual(result1, true);
        assert.strictEqual(result2, false);
      });
    });

    describe("decodeUnicode", () => {
      it("should return the input string if the index is even", () => {
        const input = "hello";
        const result = decodeUtils.decodeUnicode(input, 0);
        assert.strictEqual(result, input);
      });

      it("should decode percent-encoded characters in the input string if the index is odd", () => {
        const input = "ããç ãã¯ãªããªãªããªãªããª";
        const expectedOutput = "もう眠くはないなないなないな";
        const result = decodeUtils.decodeUnicode(input, 1);
        assert.strictEqual(result, expectedOutput);
      });
    });

    describe("toOctalEscapes", () => {
      it("should return the input string if all characters have code points less than 128", () => {
        const input = "hello";
        const result = decodeUtils.toOctalEscapes(input);
        assert.strictEqual(result, input);
      });
    });

    describe("decodeOctal", () => {
      it("should decode an octal escape sequence to a character", () => {
        const input = "\\344";
        const expectedOutput = "ä";
        const result = decodeUtils.decodeOctal(input);
        assert.strictEqual(result, expectedOutput);
      });
    });
  });

  describe("execution", () => {
    it("runQFileTerminal", () => {
      const filename = "test";
      const result = executionUtils.runQFileTerminal(filename);
      assert.strictEqual(result, undefined);
    });

    it("handleQueryResults", () => {
      const results = "test";
      const type = QueryResultType.Error;
      const result = executionUtils.handleQueryResults(results, type);
      assert.strictEqual(result, "test");
    });

    it("convertArrayStringInVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [["a,b"], ["1,2"], ["3,4"]].toString();
      const result = executionUtils
        .convertArrayStringInVector(resultRows)
        .toString();
      assert.equal(result, expectedRes);
    });

    it("convertArrayInVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ].toString();
      const result = executionUtils.convertArrayInVector(resultRows).toString();
      assert.equal(result, expectedRes);
    });

    it("convertResultStringToVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ].toString();
      const result = executionUtils
        .convertResultStringToVector(resultRows)
        .toString();
      assert.equal(result, expectedRes);
    });

    it("convertResultToVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ].toString();
      const result = executionUtils
        .convertResultToVector(resultRows)
        .toString();
      assert.equal(result, expectedRes);
    });

    describe("convertArrayOfArraysToObjects", () => {
      it("should return an empty array if the input is not an array", () => {
        const result = executionUtils.convertArrayOfArraysToObjects(null);
        assert.deepStrictEqual(result, null);
      });

      it("should return the input array if it is empty", () => {
        const result = executionUtils.convertArrayOfArraysToObjects([]);
        assert.deepStrictEqual(result, []);
      });

      it("should return the input array if the first row is not an array", () => {
        const result = executionUtils.convertArrayOfArraysToObjects([1, 2, 3]);
        assert.deepStrictEqual(result, [1, 2, 3]);
      });

      it("should return the input array if the first row is empty", () => {
        const result = executionUtils.convertArrayOfArraysToObjects([[]]);
        assert.deepStrictEqual(result, [[]]);
      });

      it("should return an empty array if any row has a different length than the first row", () => {
        const result = executionUtils.convertArrayOfArraysToObjects([
          [1, 2],
          [3],
        ]);
        assert.deepStrictEqual(result, []);
      });

      it("should convert an array of arrays to an array of objects", () => {
        const input = [
          [{ b: 0 }, { b: 1 }, { b: 2 }],
          [{ a: 0 }, { a: 1 }, { a: 2 }],
        ];
        const expectedOutput = [
          { b: 0, a: 0 },
          { b: 1, a: 1 },
          { b: 2, a: 2 },
        ];
        const result = executionUtils.convertArrayOfArraysToObjects(input);
        assert.deepStrictEqual(result, expectedOutput);
      });
    });

    describe("convertArrayOfObjectsToArrays", () => {
      it("convertStringToArray handles string with separator", () => {
        const input = "key1 | value1\nkey2 | value2";
        const expectedOutput = [
          { Index: 1, Key: "key1", Value: "value1" },
          { Index: 2, Key: "key2", Value: "value2" },
        ];
        const output = executionUtils.convertStringToArray(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("convertStringToArray handles string without separator", () => {
        const input = "value1\nvalue2";
        const expectedOutput = [
          { Index: 1, Value: "value1" },
          { Index: 2, Value: "value2" },
        ];
        const output = executionUtils.convertStringToArray(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("convertStringToArray handles string with field names and lengths", () => {
        const input = "name age\n---\nJohn 25\nDoe  30";
        const expectedOutput = [
          { Index: 1, name: "John", age: "25" },
          { Index: 2, name: "Doe", age: "30" },
        ];
        const output = executionUtils.convertStringToArray(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("convertStringToArray filters out lines starting with '-'", () => {
        const input = "key1 | value1\nkey2 | value2\nkey3 | value3";
        const expectedOutput = [
          { Index: 1, Key: "key1", Value: "value1" },
          { Index: 2, Key: "key2", Value: "value2" },
          { Index: 3, Key: "key3", Value: "value3" },
        ];
        const output = executionUtils.convertStringToArray(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("convertStringToArray handles single value results", () => {
        const input = "2001.01.01D12:00:00.000000000\n";
        const expectedOutput = [
          { Index: 1, Value: "2001.01.01D12:00:00.000000000" },
        ];
        const output = executionUtils.convertStringToArray(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("convertStringToArray handles single line with multiple value results", () => {
        const input =
          "2001.01.01D12:00:00.000000000 2001.01.01D12:00:00.000000001\n";
        const expectedOutput = [
          { Index: 1, Value: "2001.01.01D12:00:00.000000000" },
          { Index: 2, Value: "2001.01.01D12:00:00.000000001" },
        ];
        const output = executionUtils.convertStringToArray(input);
        assert.deepStrictEqual(output, expectedOutput);
      });
    });
  });

  describe("executionConsole", () => {
    ext.queryHistoryProvider = new QueryHistoryProvider();

    describe("ExecutionConsole", () => {
      let queryConsole: executionConsoleUtils.ExecutionConsole;
      let getConfigurationStub: sinon.SinonStub;
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

      beforeEach(() => {
        queryConsole = executionConsoleUtils.ExecutionConsole.start();

        ext.kdbQueryHistoryList.length = 0;
      });

      describe("checkOutput", () => {
        it("should return the input string if the input is not an array", () => {
          const result = queryConsole.checkOutput("test", "test");
          assert.strictEqual(result, "test");
        });

        it("should return No results found if the input is an empty array", () => {
          const result = queryConsole.checkOutput([], "test");
          assert.strictEqual(result, "No results found.");
        });

        it("should return No results found if the input is an empty string", () => {
          const result = queryConsole.checkOutput("", "test");
          assert.strictEqual(result, "No results found.");
        });

        it("should return the input array if the input is an array with multiple strings", () => {
          const result = queryConsole.checkOutput(["test", "test"], "test");
          assert.deepStrictEqual(result, ["test", "test"]);
        });
      });

      it("should append and add queryHistory with kdbNode without details", () => {
        getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
        getConfigurationStub.returns({
          get: sinon.stub().returns(true),
          update: sinon.stub(),
        });
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        ext.connectionNode = kdbNode;

        queryConsole.append(output, query, "fileName", serverName);
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, true);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.KDB,
        );

        getConfigurationStub.restore();
      });

      it("should append and add queryHistory with kdbNode with details", () => {
        getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
        getConfigurationStub.returns({
          get: sinon.stub().returns(false),
          update: sinon.stub(),
        });
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        ext.connectionNode = kdbNode;

        queryConsole.append(output, query, "fileName", serverName);
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, true);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.KDB,
        );
        getConfigurationStub.restore();
      });

      it("should append and add queryHistory with insightsNode", () => {
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        ext.connectionNode = insightsNode;

        queryConsole.append(
          output,
          query,
          "fileName",
          serverName,
          true,
          "WORKBOOK",
          true,
          "2",
        );
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, true);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.INSIGHTS,
        );
      });

      it("should return add query history error with kdbNode", () => {
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        ext.connectionNode = kdbNode;

        queryConsole.appendQueryError(
          query,
          output,
          serverName,
          "fileName",
          true,
          false,
          "WORKBOOK",
          true,
          false,
          "2",
        );
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, false);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.KDB,
        );
      });

      it("should return add query history error with insightsNode", () => {
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        queryConsole.appendQueryError(
          query,
          output,
          serverName,
          "filename",
          true,
          true,
          "WORKBOOK",
          true,
          false,
          "2",
        );
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, false);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.INSIGHTS,
        );
      });

      it("should return add query history error with no connection", () => {
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        ext.connectionNode = insightsNode;

        queryConsole.appendQueryError(
          query,
          output,
          serverName,
          "filename",
          false,
        );
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, false);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.undefined,
        );
      });
    });

    it("addQueryHistory", () => {
      const query = "SELECT * FROM table";
      const connectionName = "test";
      const connectionType = ServerType.KDB;

      ext.kdbQueryHistoryList.length = 0;

      queryUtils.addQueryHistory(
        query,
        "fileName",
        connectionName,
        connectionType,
        true,
      );
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
    });

    it("addQueryHistory in python", () => {
      const query = "SELECT * FROM table";
      const connectionName = "test";
      const connectionType = ServerType.KDB;

      ext.kdbQueryHistoryList.length = 0;

      queryUtils.addQueryHistory(
        query,
        connectionName,
        "fileName",
        connectionType,
        true,
        true,
      );
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
    });

    it("should format a Scratchpad stacktrace correctly", () => {
      const stacktrace = [
        { name: "g", isNested: false, text: ["{a:x*2;a", "+y}"] },
        { name: "f", isNested: false, text: ["{", "g[x;2#y]}"] },
        { name: "", isNested: false, text: ["", 'f[3;"hello"]'] },
      ];

      const formatted = queryUtils.formatScratchpadStacktrace(stacktrace);
      assert.strictEqual(
        formatted,
        '[2] g{a:x*2;a+y}\n             ^\n[1] f{g[x;2#y]}\n      ^\n[0] f[3;"hello"]\n    ^',
      );
    });

    it("should format a Scratchpad stacktrace with nested function correctly", () => {
      const stacktrace = [
        { name: "f", isNested: true, text: ["{a:x*2;a", "+y}"] },
        { name: "f", isNested: false, text: ["{", "{a:x*2;a+y}[x;2#y]}"] },
        { name: "", isNested: false, text: ["", 'f[3;"hello"]'] },
      ];

      const formatted = queryUtils.formatScratchpadStacktrace(stacktrace);
      assert.strictEqual(
        formatted,
        '[2] f @ {a:x*2;a+y}\n                ^\n[1] f{{a:x*2;a+y}[x;2#y]}\n      ^\n[0] f[3;"hello"]\n    ^',
      );
    });
  });

  describe("selectDSType", () => {
    it("should return correct DataSourceTypes for given input", function () {
      assert.equal(queryUtils.selectDSType("API"), DataSourceTypes.API);
      assert.equal(queryUtils.selectDSType("QSQL"), DataSourceTypes.QSQL);
      assert.equal(queryUtils.selectDSType("SQL"), DataSourceTypes.SQL);
    });

    it("should return undefined for unknown input", function () {
      assert.equal(queryUtils.selectDSType("unknown"), undefined);
    });
  });

  describe("getNonce", () => {
    it("should return a string with length 32", () => {
      const nonce = getNonce();
      assert.strictEqual(nonce.length, 32);
    });

    it("should return a string containing only alphanumeric characters", () => {
      const nonce = getNonce();
      const alphanumericRegex = /^[a-zA-Z0-9]+$/;
      assert.match(nonce, alphanumericRegex);
    });
  });

  describe("getUri", () => {
    it("should return a Uri object", () => {
      const panel = vscode.window.createWebviewPanel(
        "testPanel",
        "Test Panel",
        vscode.ViewColumn.One,
        {},
      );
      const webview = panel.webview;
      const extensionUri = vscode.Uri.parse("file:///path/to/extension");
      const pathList = ["path", "to", "file.txt"];
      const uri = getUri(webview, extensionUri, pathList);
      assert.ok(uri instanceof vscode.Uri);
    });

    it("should return a Uri object with the correct path", () => {
      const panel = vscode.window.createWebviewPanel(
        "testPanel",
        "Test Panel",
        vscode.ViewColumn.One,
        {},
      );
      const webview = panel.webview;
      const extensionUri = vscode.Uri.parse("file:///path/to/extension");
      const pathList = ["path", "to", "file.txt"];
      const uri = getUri(webview, extensionUri, pathList);
      assert.strictEqual(uri.path, "/path/to/extension/path/to/file.txt");
    });
  });

  describe("openUrl", () => {
    let envOpenExternalStub: sinon.SinonStub;

    beforeEach(() => {
      envOpenExternalStub = sinon.stub(vscode.env, "openExternal");
    });

    afterEach(() => {
      envOpenExternalStub.restore();
    });

    it("should call env.openExternal for a valid url", async () => {
      const validUrl = "https://example.com";
      await openUrl(validUrl);
      assert.ok(envOpenExternalStub.calledOnceWith(vscode.Uri.parse(validUrl)));
    });
  });

  describe("queryUtils", () => {
    it("sanitizeQuery", () => {
      const query1 = "`select from t";
      const query2 = "select from t;";
      const sanitizedQuery1 = queryUtils.sanitizeQuery(query1);
      const sanitizedQuery2 = queryUtils.sanitizeQuery(query2);
      assert.strictEqual(sanitizedQuery1, "`select from t ");
      assert.strictEqual(sanitizedQuery2, "select from t");
    });

    describe("getValueFromArray", () => {
      let inputSample: DCDS = undefined;
      beforeEach(() => {
        inputSample = {
          class: "203",
          columns: ["Value"],
          meta: { Value: 7 },
          rows: [],
        };
      });

      it("should return the value of the 'Value' property if the input is an array with a single object with a 'Value' property", () => {
        inputSample.rows = [{ Value: "hello" }];
        const expectedOutput = [{ Value: "hello" }];
        const actualOutput = queryUtils.getValueFromArray(inputSample);
        assert.deepEqual(actualOutput.rows, expectedOutput);
      });

      it("should return the input array if it is not an array with a single object with a 'Value' property", () => {
        inputSample.rows = [{ Value: "hello" }, { Value: "world" }];
        const expectedOutput = [{ Value: "hello" }, { Value: "world" }];
        const actualOutput = queryUtils.getValueFromArray(inputSample);
        assert.deepStrictEqual(actualOutput.rows, expectedOutput);
      });

      it("should return the input array if it is an empty array", () => {
        const expectedOutput: any[] = [];
        const actualOutput = queryUtils.getValueFromArray(inputSample);
        assert.deepStrictEqual(actualOutput.rows, expectedOutput);
      });
    });

    describe("generateQSqlBody", () => {
      it("should use scope for 1.13", () => {
        const output = queryUtils.generateQSqlBody(
          "a:1",
          "assembly target",
          1.13,
        );
        assert.equal(output.scope.assembly, "assembly");
        assert.equal(output.scope.tier, "target");
      });

      it("should use legacy syntax for 1.12", () => {
        const output = queryUtils.generateQSqlBody(
          "a:1",
          "assembly target",
          1.12,
        );
        assert.equal(output.assembly, "assembly");
        assert.equal(output.target, "target");
      });
    });

    describe("handleWSResults", () => {
      afterEach(() => {
        sinon.restore();
        ext.isResultsTabVisible = false;
      });

      it("should return no results found", () => {
        const ab = new ArrayBuffer(128);
        const result = queryUtils.handleWSResults(ab);
        assert.strictEqual(result, "No results found.");
      });

      it("should return the result of getValueFromArray if the results are an array with a single object with a 'Value' property", () => {
        const ab = new ArrayBuffer(128);
        const expectedOutput = {
          class: "203",
          columns: ["Value"],
          meta: { Value: 7 },
          rows: [{ Value: "10" }],
        };
        ext.isResultsTabVisible = true;
        sinon.stub(QTable.default, "toLegacy").returns(expectedOutput);
        const convertRowsSpy = sinon.spy(queryUtils, "convertRows");
        const result = queryUtils.handleWSResults(ab);
        sinon.assert.notCalled(convertRowsSpy);
        assert.strictEqual(result, expectedOutput);
      });
    });

    describe("handleScratchpadTableRes", () => {
      let inputSample: DCDS = undefined;
      beforeEach(() => {
        inputSample = {
          class: "203",
          columns: ["Value"],
          meta: { Value: 7 },
          rows: [],
        };
      });

      it("should convert bigint values to number", () => {
        inputSample.rows = [
          { key1: BigInt(123), key2: "value2" },
          { key3: BigInt(456), key4: "value4" },
        ];
        const expected = [
          { Index: 1, key1: 123, key2: "value2" },
          { Index: 2, key3: 456, key4: "value4" },
        ];
        const result = queryUtils.handleScratchpadTableRes(inputSample);
        assert.deepStrictEqual(result.rows, expected);
      });

      it("should not modify other values", () => {
        inputSample.rows = [
          { key1: "value1", key2: "value2" },
          { key3: "value3", key4: "value4" },
        ];
        const result = queryUtils.handleScratchpadTableRes(inputSample);
        assert.deepStrictEqual(result.rows, inputSample.rows);
      });

      it("should return case results is string type", () => {
        const result = queryUtils.handleScratchpadTableRes("test");
        assert.strictEqual(result, "test");
      });

      it("should return same results case results.rows is undefined", () => {
        inputSample.rows = undefined;
        const result = queryUtils.handleScratchpadTableRes(inputSample);
        assert.strictEqual(result, inputSample);
      });

      it("should return same results case results.rows is an empty array", () => {
        const result = queryUtils.handleScratchpadTableRes(inputSample);
        assert.strictEqual(result, inputSample);
      });
    });

    describe("checkIfIsQDateTypes", () => {
      it("should return string representation of DTimestampClass instance", () => {
        const input = { Value: new DTimestampClass(978350400000, 0) };
        const expectedOutput = input.Value.toString();

        const output = queryUtils.checkIfIsQDateTypes(input);
        assert.strictEqual(output, expectedOutput);
      });

      it("should return string representation of DDateTimeClass instance", () => {
        const input = { Value: new DDateTimeClass(978350400000) };
        const expectedOutput = input.Value.toString();

        const output = queryUtils.checkIfIsQDateTypes(input);
        assert.strictEqual(output, expectedOutput);
      });

      it("should return string representation of DDateClass instance", () => {
        const input = { Value: new DDateClass(978350400000) };
        const expectedOutput = input.Value.toString();

        const output = queryUtils.checkIfIsQDateTypes(input);
        assert.strictEqual(output, expectedOutput);
      });

      it("should return input as is when Value is not an instance of DTimestampClass, DDateTimeClass, or DDateClass", () => {
        const input = {
          Value:
            "not an instance of DTimestampClass, DDateTimeClass, or DDateClass",
        };

        const output = queryUtils.checkIfIsQDateTypes(input);
        assert.deepStrictEqual(output, input);
      });
    });

    describe("addIndexKey", () => {
      it("should add index key to array of objects", () => {
        const input = [
          { prop1: "value1", prop2: "value2" },
          { prop1: "value3", prop2: "value4" },
        ];

        const expectedOutput = [
          { Index: 1, prop1: "value1", prop2: "value2" },
          { Index: 2, prop1: "value3", prop2: "value4" },
        ];

        const output = queryUtils.addIndexKey(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("should add index key to single object", () => {
        const input = { prop1: "value1", prop2: "value2" };

        const expectedOutput = [{ Index: 1, prop1: "value1", prop2: "value2" }];

        const output = queryUtils.addIndexKey(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("should return empty array when input is empty array", () => {
        const input = [];

        const expectedOutput = [];

        const output = queryUtils.addIndexKey(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("should not add index key when it already exists", () => {
        const input = [{ Index: 5, prop1: "value1", prop2: "value2" }];

        const expectedOutput = [{ Index: 5, prop1: "value1", prop2: "value2" }];

        const output = queryUtils.addIndexKey(input);
        assert.deepStrictEqual(output, expectedOutput);
      });

      it("should add index key to non-array input", () => {
        const input = "not an array";

        const expectedOutput = [{ Index: 1, Value: "not an array" }];

        const output = queryUtils.addIndexKey(input);
        assert.deepStrictEqual(output, expectedOutput);
      });
    });

    it("convertRows", () => {
      const rows = [
        {
          a: 1,
          b: 2,
        },
        {
          a: 3,
          b: 4,
        },
      ];
      const expectedRes = ["a  b  \n------\n1  2  \n3  4  \n\n"].toString();
      const result = queryUtils.convertRows(rows);
      assert.equal(result, expectedRes);
    });

    describe("convertRowsToConsole", () => {
      it("should work with headers", () => {
        const rows = ["a#$#;header;#$#b", "1#$#;#$#2", "3#$#;#$#4"];
        const expectedRes = ["a  b  ", "------", "1  2  ", "3  4  "];
        const result = queryUtils.convertRowsToConsole(rows);
        assert.deepEqual(result, expectedRes);
      });
      it("should work without headers", () => {
        const rows = ["a#$#;#$#1", "b#$#;#$#2", "c#$#;#$#3"];
        const expectedRes = ["a| 1  ", "b| 2  ", "c| 3  "];
        const result = queryUtils.convertRowsToConsole(rows);
        assert.deepEqual(result, expectedRes);
      });

      it("should work with empty rows", () => {
        const rows = [];
        const expectedRes = [];
        const result = queryUtils.convertRowsToConsole(rows);
        assert.deepEqual(result, expectedRes);
      });
    });

    it("getConnectionType", () => {
      const params: ServerType[] = [
        ServerType.INSIGHTS,
        ServerType.KDB,
        ServerType.undefined,
      ];
      const expectedRes = ["insights", "kdb", "undefined"];
      for (let i = 0; i < params.length; i++) {
        const result = queryUtils.getConnectionType(params[i]);
        assert.equal(result, expectedRes[i]);
      }
    });

    describe("handleWSError", () => {
      let sandbox: sinon.SinonSandbox;
      const abTest = new Uint8Array([
        1, 2, 0, 0, 114, 1, 0, 0, 0, 0, 2, 0, 0, 0, 99, 11, 0, 17, 0, 0, 0, 0,
        114, 99, 118, 84, 83, 0, 99, 111, 114, 114, 0, 112, 114, 111, 116, 111,
        99, 111, 108, 0, 108, 111, 103, 67, 111, 114, 114, 0, 99, 108, 105, 101,
        110, 116, 0, 104, 116, 116, 112, 0, 97, 112, 105, 0, 117, 115, 101, 114,
        78, 97, 109, 101, 0, 117, 115, 101, 114, 73, 68, 0, 116, 105, 109, 101,
        111, 117, 116, 0, 116, 111, 0, 112, 118, 86, 101, 114, 0, 114, 101, 102,
        86, 105, 110, 116, 97, 103, 101, 0, 114, 99, 0, 97, 99, 0, 97, 105, 0,
        0, 0, 17, 0, 0, 0, 101, 0, 244, 0, 168, 200, 104, 217, 55, 151, 10, 254,
        148, 230, 16, 238, 61, 245, 76, 4, 178, 72, 184, 185, 138, 80, 65, 216,
        245, 103, 119, 0, 10, 0, 36, 0, 0, 0, 57, 52, 101, 54, 49, 48, 101, 101,
        45, 51, 100, 102, 53, 45, 52, 99, 48, 52, 45, 98, 50, 52, 56, 45, 98,
        56, 98, 57, 56, 97, 53, 48, 52, 49, 100, 56, 245, 58, 49, 48, 46, 57,
        46, 49, 51, 56, 46, 49, 57, 50, 58, 53, 48, 53, 48, 0, 245, 111, 99,
        116, 101, 116, 115, 116, 114, 101, 97, 109, 0, 245, 46, 107, 120, 105,
        46, 113, 115, 113, 108, 0, 245, 0, 254, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 249, 96, 234, 0, 0, 0, 0, 0, 0, 244, 0, 0, 16, 97, 231,
        55, 151, 10, 249, 134, 0, 0, 0, 0, 0, 0, 0, 249, 1, 0, 0, 0, 0, 0, 0,
        128, 251, 10, 0, 251, 10, 0, 10, 0, 54, 0, 0, 0, 85, 110, 101, 120, 112,
        101, 99, 116, 101, 100, 32, 101, 114, 114, 111, 114, 32, 40, 110, 49,
        48, 41, 32, 101, 110, 99, 111, 117, 110, 116, 101, 114, 101, 100, 32,
        101, 120, 101, 99, 117, 116, 105, 110, 103, 32, 46, 107, 120, 105, 46,
        113, 115, 113, 108, 0, 0, 0, 0, 0, 0,
      ]);
      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });

      afterEach(() => {
        sandbox.restore();
      });

      it("should handle qe/sql & gateway/data error", () => {
        const ab = new ArrayBuffer(10); // Mock ArrayBuffer

        // Stub the necessary functions

        // Call the function being tested
        const result = queryUtils.handleWSError(ab);

        // Assert the result
        assert.deepStrictEqual(result, { error: "Query error" });
      });

      it("should handle unknown error", () => {
        const ab = new ArrayBuffer(8); // Mock ArrayBuffer

        // Call the function being tested
        const result = queryUtils.handleWSError(ab);

        // Assert the result
        assert.deepStrictEqual(result, { error: "Query error" });
      });

      it("should handle qe/sql error", () => {
        const result = queryUtils.handleWSError(abTest);
        assert.deepStrictEqual(result, {
          error:
            "\u00006\u0000\u0000\u0000Unexpected error (n10) encountered executing .kxi.qsql\u0000\u0000\u0000\u0000\u0000",
        });
      });
    });
  });

  describe("Registration", () => {
    let getConfigurationStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;

    beforeEach(() => {
      getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
      showInformationMessageStub = sinon.stub(
        vscode.window,
        "showInformationMessage",
      ) as sinon.SinonStub<
        [
          message: string,
          options: vscode.MessageOptions,
          ...items: vscode.MessageItem[],
        ],
        Thenable<vscode.MessageItem>
      >;
    });

    afterEach(() => {
      getConfigurationStub.restore();
      showInformationMessageStub.restore();
    });

    it("should show registration notification if setting is false", async () => {
      getConfigurationStub.returns({
        get: sinon.stub().returns(false),
        update: sinon.stub(),
      });
      showInformationMessageStub.resolves("Opt-In");
      await showRegistrationNotification();
      sinon.assert.calledOnce(showInformationMessageStub);
    });

    it("should not show registration notification if setting is true", async () => {
      getConfigurationStub.returns({
        get: sinon.stub().returns(true),
        update: sinon.stub(),
      });
      await showRegistrationNotification();
      sinon.assert.notCalled(showInformationMessageStub);
    });
  });

  // describe("AuthSettings", () => {
  //   let secrets: vscode.SecretStorage;
  //   let storeStub: sinon.SinonStub;
  //   let getStub: sinon.SinonStub;
  //   let storeSpy: sinon.SinonSpy;
  //   let getSpy: sinon.SinonSpy;

  //   beforeEach(() => {
  //     secrets = {
  //       store: sinon.stub(),
  //       get: sinon.stub(),
  //     } as unknown as vscode.SecretStorage;
  //     storeStub = sinon.stub(secrets, "store");
  //     getStub = sinon.stub(secrets, "get");
  //     storeSpy = sinon.spy();
  //     getSpy = sinon.spy();
  //   });

  //   afterEach(() => {
  //     storeStub.restore();
  //     getStub.restore();
  //   });

  //   it("should store auth data", async () => {
  //     const tokenKey = "tokenKey";
  //     const tokenValue = "tokenValue";
  //     const authSettings = new AuthSettings(secrets);
  //     storeSpy = sinon.spy(secrets, "store");
  //     await authSettings.storeAuthData(tokenKey, tokenValue);
  //     sinon.assert.calledOnceWithExactly(storeStub, tokenKey, tokenValue);
  //     sinon.assert.calledOnceWithExactly(storeSpy, tokenKey, tokenValue);
  //   });

  //   it("should get auth data", async () => {
  //     const tokenKey = "tokenKey";
  //     const tokenValue = "tokenValue";
  //     const authSettings = new AuthSettings(secrets);
  //     getStub.resolves(tokenValue);
  //     getSpy = sinon.spy(secrets, "get");
  //     const result = await authSettings.getAuthData(tokenKey);
  //     sinon.assert.calledOnceWithExactly(getStub, tokenKey);
  //     sinon.assert.match(result, tokenValue);
  //     sinon.assert.calledOnceWithExactly(getSpy, tokenKey);
  //   });
  // });

  describe("killPid", () => {
    let tryExecuteCommandStub: sinon.SinonStub;

    beforeEach(() => {
      tryExecuteCommandStub = sinon.stub();
    });

    it("should not execute command if pid is NaN", async () => {
      await killPid(NaN);
      sinon.assert.notCalled(tryExecuteCommandStub);
    });
  });

  describe("userInteraction", () => {
    let windowMock: sinon.SinonMock;

    beforeEach(() => {
      windowMock = sinon.mock(vscode.window);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("showInputBox should return a value", async () => {
      const option: vscode.InputBoxOptions = {};
      windowMock.expects("showInputBox").withArgs(option).returns("test");
      const result = await showInputBox(option);
      assert.strictEqual(result, "test");
    });

    it("showInputBox should throw cancellation event", async () => {
      const option: vscode.InputBoxOptions = {};
      windowMock.expects("showInputBox").withArgs(option).returns(undefined);
      await assert.rejects(showInputBox(option), CancellationEvent);
    });

    it("showQuickPick should return a value", async () => {
      const option: vscode.QuickPickOptions = {};
      const items: vscode.QuickPickItem[] = [
        {
          description: "test 1",
          label: "test 1",
        },
        {
          description: "test 2",
          label: "test 2",
        },
      ];

      windowMock
        .expects("showQuickPick")
        .withArgs(items, option)
        .returns(items[1]);
      const result = await showQuickPick(items, option);
      assert.deepStrictEqual(result, items[1]);
    });

    it("showQuickPick with custom items should return a value", async () => {
      const option: vscode.QuickPickOptions = {};
      const items: ITestItem[] = [
        {
          description: "test 1",
          id: 1,
          label: "test 1",
          testProperty: "test 1",
        },
        {
          description: "test 2",
          id: 2,
          label: "test 2",
          testProperty: "test 2",
        },
      ];

      windowMock
        .expects("showQuickPick")
        .withArgs(items, option)
        .returns(items[1]);
      const result = await showQuickPick(items, option);
      assert.deepStrictEqual(result, items[1]);
    });

    it("showQuickPick should throw cancellation event", async () => {
      const option: vscode.QuickPickOptions = {};
      const items: vscode.QuickPickItem[] = [
        {
          description: "test 1",
          label: "test 1",
        },
        {
          description: "test 2",
          label: "test 2",
        },
      ];

      windowMock
        .expects("showQuickPick")
        .withArgs(items, option)
        .returns(undefined);
      await assert.rejects(showQuickPick(items, option), CancellationEvent);
    });

    it("showOpenFolderDialog should return a folder path", async () => {
      const folderPath = "test/test";
      const uris: vscode.Uri[] = [{ fsPath: folderPath } as vscode.Uri];

      windowMock.expects("showOpenDialog").returns(uris);
      const result = await showOpenFolderDialog();
      assert.deepStrictEqual(result, folderPath);
    });

    it("showOpenFolderDialog should return path of first folder", async () => {
      const folderPath1 = "test/test";
      const folderPath2 = "test2/test2";
      const uris: vscode.Uri[] = [
        { fsPath: folderPath1 },
        { fsPath: folderPath2 },
      ] as vscode.Uri[];

      windowMock.expects("showOpenDialog").returns(uris);
      const result = await showOpenFolderDialog();
      assert.strictEqual(result, folderPath1);
    });

    it("showOpenFolderDialog should throw cancellation event if dialog cancelled", async () => {
      windowMock.expects("showOpenDialog").returns(undefined);
      await assert.rejects(showOpenFolderDialog(), CancellationEvent);
    });
  });

  describe("validateUtils", () => {
    describe("isValidLength", () => {
      it("should return true if value length is within range", () => {
        const value = "test-value";
        const lower = 1;
        const upper = 20;
        const result = validateUtils.isValidLength(value, lower, upper);
        assert.strictEqual(result, true);
      });

      it("should return false if value length is less than lower bound", () => {
        const value = "test-value";
        const lower = 20;
        const upper = 30;
        const result = validateUtils.isValidLength(value, lower, upper);
        assert.strictEqual(result, false);
      });

      it("should return false if value length is greater than upper bound", () => {
        const value = "test-value";
        const lower = 1;
        const upper = 5;
        const result = validateUtils.isValidLength(value, lower, upper);
        assert.strictEqual(result, false);
      });

      it("should return false if lower bound is greater than upper bound", () => {
        const value = "test-value";
        const lower = 30;
        const upper = 20;
        const result = validateUtils.isValidLength(value, lower, upper);
        assert.strictEqual(result, false);
      });

      it("should return true if upper bound is greater than max integer", () => {
        const value = "test-value";
        const lower = 1;
        const upper = 2147483648;
        const result = validateUtils.isValidLength(value, lower, upper);
        assert.strictEqual(result, true);
      });
    });

    describe("isAlphanumericWithHypens", () => {
      it("should return true if value is alphanumeric with hyphens", () => {
        const value = "test-value-123";
        const result = validateUtils.isAlphanumericWithHypens(value);
        assert.strictEqual(result, true);
      });
    });

    describe("isLowerCaseAlphanumericWithHypens", () => {
      it("should return true if value is lowercase alphanumeric with hyphens", () => {
        const value = "test-value-123";
        const result = validateUtils.isLowerCaseAlphanumericWithHypens(value);
        assert.strictEqual(result, true);
      });

      it("should return false if value contains uppercase characters", () => {
        const value = "Test-Value-123";
        const result = validateUtils.isLowerCaseAlphanumericWithHypens(value);
        assert.strictEqual(result, false);
      });
    });

    describe("isNumber", () => {
      it("should return true if value is a number", () => {
        const value = "123";
        const result = validateUtils.isNumber(value);
        assert.strictEqual(result, true);
      });

      it("should return false if value is not a number", () => {
        const value = "test";
        const result = validateUtils.isNumber(value);
        assert.strictEqual(result, false);
      });
    });

    describe("isBoolean", () => {
      it("should return true if value is 'true'", () => {
        const value = "true";
        const result = validateUtils.isBoolean(value);
        assert.strictEqual(result, true);
      });

      it("should return true if value is 'false'", () => {
        const value = "false";
        const result = validateUtils.isBoolean(value);
        assert.strictEqual(result, true);
      });

      it("should return false if value is not 'true' or 'false'", () => {
        const value = "test";
        const result = validateUtils.isBoolean(value);
        assert.strictEqual(result, false);
      });
    });
  });

  describe("connLabelsUtils", () => {
    let getConfigurationStub: sinon.SinonStub;

    beforeEach(() => {
      getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
      ext.connLabelList.length = 0;
      ext.labelConnMapList.length = 0;
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should get workspace labels", () => {
      const labels: Labels[] = [
        { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
      ];
      getConfigurationStub.returns({
        get: sinon.stub().returns(labels),
        update: sinon.stub(),
      });

      LabelsUtils.getWorkspaceLabels();

      assert.strictEqual(ext.connLabelList.length, 1);

      assert.deepStrictEqual(ext.connLabelList, labels);
    });

    it("should create a new label", () => {
      getConfigurationStub.returns({
        get: sinon.stub().returns([]),
        update: sinon.stub(),
      });

      LabelsUtils.createNewLabel("label1", "red");

      assert.strictEqual(ext.connLabelList.length, 1);
      assert.strictEqual(ext.connLabelList[0].name, "label1");
      assert.strictEqual(ext.connLabelList[0].color.name, "Red");
    });

    it("should handle empty label name", () => {
      getConfigurationStub.returns({
        get: sinon.stub(),
        update: sinon.stub(),
      });
      const logStub = sinon.stub(loggers, "kdbOutputLog");

      LabelsUtils.createNewLabel("", "red");

      sinon.assert.calledWith(
        logStub,
        "[connLabel] Label name can't be empty.",
        "ERROR",
      );
    });

    it("should handle no color selected", () => {
      getConfigurationStub.returns({
        get: sinon.stub(),
        update: sinon.stub(),
      });
      const logStub = sinon.stub(loggers, "kdbOutputLog");

      LabelsUtils.createNewLabel("label1", "randomColorName");

      sinon.assert.calledWith(
        logStub,
        "[connLabel] No Color selected for the label.",
        "ERROR",
      );
    });

    it("should get workspace labels connection map", () => {
      const connMap = [{ labelName: "label1", connections: ["conn1"] }];
      getConfigurationStub.returns({
        get: sinon.stub().returns(connMap),
        update: sinon.stub(),
      });

      LabelsUtils.getWorkspaceLabelsConnMap();

      assert.deepStrictEqual(ext.labelConnMapList, connMap);
    });

    it("should add connection to label", () => {
      ext.connLabelList.push({
        name: "label1",
        color: { name: "red", colorHex: "#FF0000" },
      });

      LabelsUtils.addConnToLabel("label1", "conn1");

      assert.strictEqual(ext.labelConnMapList.length, 1);
      assert.strictEqual(ext.labelConnMapList[0].labelName, "label1");
      assert.deepStrictEqual(ext.labelConnMapList[0].connections, ["conn1"]);
    });

    it("should remove connection from labels", () => {
      ext.labelConnMapList.push({
        labelName: "label1",
        connections: ["conn1", "conn2"],
      });
      getConfigurationStub.returns({
        get: sinon.stub(),
        update: sinon.stub(),
      });

      LabelsUtils.removeConnFromLabels("conn1");

      assert.deepStrictEqual(ext.labelConnMapList[0].connections, ["conn2"]);
    });

    it("should handle labels connection map", () => {
      ext.connLabelList.push({
        name: "label1",
        color: { name: "Red", colorHex: "#FF0000" },
      });
      ext.labelConnMapList.push({
        labelName: "label1",
        connections: ["conn2"],
      });

      getConfigurationStub.returns({
        get: sinon.stub(),
        update: sinon.stub(),
      });

      LabelsUtils.handleLabelsConnMap(["label1"], "conn2");

      assert.strictEqual(ext.labelConnMapList.length, 1);
      assert.deepStrictEqual(ext.labelConnMapList[0].connections, ["conn2"]);
    });

    it("should retrieve connection labels names", () => {
      ext.labelConnMapList.push({
        labelName: "label1",
        connections: ["conn1"],
      });
      const conn = new KdbNode(
        [],
        "conn1",
        {
          serverName: "kdbservername",
          serverAlias: "conn1",
          serverPort: "5001",
          managed: false,
          auth: false,
          tls: false,
        },
        TreeItemCollapsibleState.None,
      );

      const labels = LabelsUtils.retrieveConnLabelsNames(conn);

      assert.deepStrictEqual(labels, ["label1"]);
    });

    it("should rename a label", () => {
      const labels: Labels[] = [
        { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
      ];
      getConfigurationStub.returns({
        get: sinon.stub().returns(labels),
        update: sinon.stub().returns(Promise.resolve()),
      });
      LabelsUtils.renameLabel("label1", "label2");
      assert.strictEqual(ext.connLabelList.length, 1);
      assert.deepStrictEqual(ext.connLabelList[0].name, "label2");
    });

    it("should set label color", () => {
      const labels: Labels[] = [
        { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
      ];
      getConfigurationStub.returns({
        get: sinon.stub().returns(labels),
        update: sinon.stub().returns(Promise.resolve()),
      });
      LabelsUtils.setLabelColor("label1", "Blue");
      assert.strictEqual(ext.connLabelList.length, 1);
      assert.deepStrictEqual(ext.connLabelList[0].color.name, "Blue");
    });

    it("should delete label", () => {
      const labels: Labels[] = [
        { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
      ];
      getConfigurationStub.returns({
        get: sinon.stub().returns(labels),
        update: sinon.stub().returns(Promise.resolve()),
      });
      LabelsUtils.deleteLabel("label1");
      assert.strictEqual(ext.connLabelList.length, 0);
    });

    it("should get label statistics", () => {
      ext.connLabelList.push(
        { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
        { name: "Label2", color: { name: "Blue", colorHex: "#0000FF" } },
        { name: "Label3", color: { name: "Red", colorHex: "#FF0000" } },
      );

      const stats = LabelsUtils.getLabelStatistics();

      assert.strictEqual(stats.count, 3);
      assert.strictEqual(stats.Red, 2);
      assert.strictEqual(stats.Blue, 1);
      assert.strictEqual(stats.Green, 0);
      assert.strictEqual(stats.Yellow, 0);
      assert.strictEqual(stats.Magenta, 0);
      assert.strictEqual(stats.Cyan, 0);
    });

    it("should get connection label statistics", () => {
      ext.connLabelList.push(
        { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
        { name: "Label2", color: { name: "Blue", colorHex: "#0000FF" } },
        { name: "Label3", color: { name: "Red", colorHex: "#FF0000" } },
      );

      ext.labelConnMapList.push(
        { labelName: "Label1", connections: ["conn1", "conn2"] },
        { labelName: "Label2", connections: ["conn1"] },
        { labelName: "Label3", connections: ["conn3"] },
      );

      const stats = LabelsUtils.getConnectionLabelStatistics("conn1");

      assert.strictEqual(stats.count, 2);
      assert.strictEqual(stats.Red, 1);
      assert.strictEqual(stats.Blue, 1);
      assert.strictEqual(stats.Green, 0);
      assert.strictEqual(stats.Yellow, 0);
      assert.strictEqual(stats.Magenta, 0);
      assert.strictEqual(stats.Cyan, 0);
    });

    it("should return zero statistics for a connection with no labels", () => {
      ext.connLabelList.push(
        { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
        { name: "Label2", color: { name: "Blue", colorHex: "#0000FF" } },
      );

      ext.labelConnMapList.push(
        { labelName: "Label1", connections: ["conn2"] },
        { labelName: "Label2", connections: ["conn3"] },
      );

      const stats = LabelsUtils.getConnectionLabelStatistics("conn1");

      assert.strictEqual(stats.count, 0);
      assert.strictEqual(stats.Red, 0);
      assert.strictEqual(stats.Blue, 0);
      assert.strictEqual(stats.Green, 0);
      assert.strictEqual(stats.Yellow, 0);
      assert.strictEqual(stats.Magenta, 0);
      assert.strictEqual(stats.Cyan, 0);
    });
    describe("isLabelEmpty", () => {
      beforeEach(() => {
        ext.labelConnMapList.length = 0;
      });

      afterEach(() => {
        ext.labelConnMapList.length = 0;
      });
      it("should return true if label is empty", () => {
        ext.labelConnMapList.push({ labelName: "label1", connections: [] });
        const result = LabelsUtils.isLabelEmpty("label1");
        assert.strictEqual(result, true);
      });

      it("should return false if label is not empty", () => {
        ext.labelConnMapList.push({
          labelName: "label1",
          connections: ["conn1"],
        });
        const result = LabelsUtils.isLabelEmpty("label1");
        assert.strictEqual(result, false);
      });

      it("should return false if label is empty if label not on map list", () => {
        const result = LabelsUtils.isLabelEmpty("label1");
        assert.strictEqual(result, true);
      });
    });

    describe("isLabelContentChanged", () => {
      beforeEach(() => {
        ext.latestLblsChanged.length = 0;
      });

      afterEach(() => {
        ext.latestLblsChanged.length = 0;
      });

      it("should return true if label content is changed", () => {
        ext.latestLblsChanged.push("label1");
        const result = LabelsUtils.isLabelContentChanged("label1");
        assert.strictEqual(result, true);
      });

      it("should return false if label content is not changed", () => {
        const result = LabelsUtils.isLabelContentChanged("label1");
        assert.strictEqual(result, false);
      });
    });
  });

  describe("checkLocalInstall", () => {
    let getConfigurationStub: sinon.SinonStub;
    let updateConfigurationStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
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

  describe("resultToBase64", () => {
    const png = [
      "0x89",
      "0x50",
      "0x4e",
      "0x47",
      "0x0d",
      "0x0a",
      "0x1a",
      "0x0a",
    ];
    const img = Array.from({ length: 59 }, () => "0x00");

    it("should return undefined for undefined", () => {
      const result = queryUtils.resultToBase64(undefined);
      assert.strictEqual(result, undefined);
    });
    it("should return undefined for just signature", () => {
      const result = queryUtils.resultToBase64(png);
      assert.strictEqual(result, undefined);
    });
    it("should return undefined for bad signature", () => {
      const result = queryUtils.resultToBase64([
        ...png.map((v) => parseInt(v, 16) + 1),
        ...img,
      ]);
      assert.strictEqual(result, undefined);
    });
    it("should return base64 for minimum img str", () => {
      const result = queryUtils.resultToBase64([...png, ...img]);
      assert.ok(result);
    });
    it("should return base64 for minimum img num", () => {
      const result = queryUtils.resultToBase64([
        ...png.map((v) => parseInt(v, 16)),
        ...img.map((v) => parseInt(v, 16)),
      ]);
      assert.ok(result);
    });
    it("should return base64 for minimum img str for structuredText", () => {
      const result = queryUtils.resultToBase64({
        columns: { values: [...png, ...img] },
      });
      assert.ok(result);
    });
    it("should return base64 for minimum img str for structuredText v2", () => {
      const result = queryUtils.resultToBase64({
        columns: [{ values: [...png, ...img] }],
      });
      assert.ok(result);
    });
    it("should return undefined for bogus structuredText", () => {
      const result = queryUtils.resultToBase64({
        columns: {},
      });
      assert.strictEqual(result, undefined);
    });
    it("should return undefined for bogus structuredText v2", () => {
      const result = queryUtils.resultToBase64({
        columns: [],
      });
      assert.strictEqual(result, undefined);
    });
    it("should return base64 from windows q server", () => {
      const result = queryUtils.resultToBase64([
        ...png.map((v) => `${v}\r`),
        ...img.map((v) => `${v}\r`),
      ]);
      assert.ok(result);
    });
  });
  describe("UDAUtils", () => {
    describe("filterUDAParamsValidTypes", () => {
      it("should filter valid types", () => {
        const types = [1, 2, 3];
        const validTypes = new Set([1, 2]);
        sinon.stub(ext, "booleanTypes").value(validTypes);
        sinon.stub(ext, "numberTypes").value(validTypes);
        sinon.stub(ext, "textTypes").value(validTypes);
        sinon.stub(ext, "timestampTypes").value(validTypes);
        sinon.stub(ext, "jsonTypes").value(validTypes);

        const result = UDAUtils.filterUDAParamsValidTypes(types);
        assert.deepStrictEqual(result, [1, 2]);
      });
    });

    describe("getUDAParamType", () => {
      it("should return the correct type string", () => {
        const type = ParamFieldType.Boolean;
        const dataTypes = new Map([["1", "Boolean"]]);
        sinon.stub(ext.constants, "dataTypes").value(dataTypes);

        const result = UDAUtils.getUDAParamType(type);
        assert.strictEqual(result, "boolean");
      });

      it("should return the correct types string", () => {
        const type = [ParamFieldType.Boolean, ParamFieldType.Number];
        const dataTypes = new Map([
          ["1", "Boolean"],
          ["2", "Number"],
        ]);
        const expectedRes = ["boolean", "number"];
        sinon.stub(ext.constants, "dataTypes").value(dataTypes);

        const result = UDAUtils.getUDAParamType(type);
        assert.strictEqual(result.toString(), expectedRes.toString());
      });
    });

    describe("getUDAFieldType", () => {
      it("should return the correct field type", () => {
        const type = 1;
        sinon.stub(ext, "booleanTypes").value(new Set([1]));
        sinon.stub(ext, "numberTypes").value(new Set([2]));
        sinon.stub(ext, "textTypes").value(new Set([3]));
        sinon.stub(ext, "timestampTypes").value(new Set([4]));
        sinon.stub(ext, "jsonTypes").value(new Set([5]));

        const result = UDAUtils.getUDAFieldType(type);
        assert.strictEqual(result, ParamFieldType.Boolean);
      });

      it("should return MultiType for multiple types", () => {
        const types = [1, 2];
        sinon.stub(ext, "booleanTypes").value(new Set([1]));
        sinon.stub(ext, "numberTypes").value(new Set([2]));

        const result = UDAUtils.getUDAFieldType(types);
        assert.strictEqual(result, ParamFieldType.MultiType);
      });
    });

    describe("parseUDAParamTypes", () => {
      it("should return the correct param field type", () => {
        const type = 1;
        sinon.stub(ext, "booleanTypes").value(new Set([1]));
        sinon.stub(ext, "numberTypes").value(new Set([2]));
        sinon.stub(ext, "textTypes").value(new Set([3]));
        sinon.stub(ext, "timestampTypes").value(new Set([4]));
        sinon.stub(ext, "jsonTypes").value(new Set([5]));

        const result = UDAUtils.parseUDAParamTypes(type);
        assert.strictEqual(result, ParamFieldType.Boolean);
      });
    });

    describe("parseUDAParams", () => {
      it("should parse UDA params correctly", () => {
        const params: UDAParam[] = [
          {
            name: "param1",
            type: 1,
            isReq: true,
            description: "",
          },
          {
            name: "param2",
            type: 2,
            isReq: false,
            description: "",
          },
        ];
        sinon.stub(ext, "booleanTypes").value(new Set([1]));
        sinon.stub(ext, "numberTypes").value(new Set([2]));

        const result = UDAUtils.parseUDAParams(params);
        assert.strictEqual(result.length, 2);
        if (typeof result === "string") {
          return;
        }
        assert.strictEqual(result[0].fieldType, ParamFieldType.Boolean);
        assert.strictEqual(result[1].fieldType, ParamFieldType.Number);
      });

      it("should return Invalid if required param is invalid", () => {
        const params: UDAParam[] = [
          {
            name: "param1",
            type: 9999,
            isReq: true,
            description: "",
          },
        ];
        sinon.stub(ext, "booleanTypes").value(new Set([1]));
        sinon.stub(ext, "numberTypes").value(new Set([2]));

        const result = UDAUtils.parseUDAParams(params);
        assert.strictEqual(result, ParamFieldType.Invalid);
      });
    });

    describe("convertTypesToString", () => {
      let dataTypesStub: sinon.SinonStub;

      beforeEach(() => {
        dataTypesStub = sinon.stub(ext.constants, "dataTypes");
      });

      afterEach(() => {
        dataTypesStub.restore();
      });

      it("should convert types to strings", () => {
        const types = [1, 2];
        const dataTypes = new Map([
          ["1", "Boolean"],
          ["2", "Number"],
        ]);
        dataTypesStub.value(dataTypes);

        const result = UDAUtils.convertTypesToString(types);
        assert.deepStrictEqual(result, ["Boolean", "Number"]);
      });

      it("should convert type to string", () => {
        const types = [1];
        const dataTypes = new Map([["1", "Boolean"]]);
        dataTypesStub.value(dataTypes);

        const result = UDAUtils.convertTypesToString(types);
        assert.deepStrictEqual(result, ["Boolean"]);
      });

      it("should handle empty array", () => {
        const types: number[] = [];
        const dataTypes = new Map();
        dataTypesStub.value(dataTypes);

        const result = UDAUtils.convertTypesToString(types);
        assert.deepStrictEqual(result, []);
      });

      it("should return type as string if not found in dataTypes map", () => {
        const types = [3];
        const dataTypes = new Map([
          ["1", "Boolean"],
          ["2", "Number"],
        ]);
        dataTypesStub.value(dataTypes);

        const result = UDAUtils.convertTypesToString(types);
        assert.deepStrictEqual(result, ["3"]);
      });

      it("should handle mixed valid and invalid types", () => {
        const types = [1, 3];
        const dataTypes = new Map([["1", "Boolean"]]);
        dataTypesStub.value(dataTypes);

        const result = UDAUtils.convertTypesToString(types);
        assert.deepStrictEqual(result, ["Boolean", "3"]);
      });
    });

    describe("fixTimeAtUDARequestBody", () => {
      it("should append ':00.000000000' when parameterTypes[key] is [-12] and params[key] is a valid string", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey: -12 },
          params: { timeKey: "12:30" },
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const expected: UDARequestBody = {
          ...input,
          params: { timeKey: "12:30:00.000000000" },
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, expected);
      });

      it("should not modify params[key] if parameterTypes[key] is not [-12]", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey: 1 },
          params: { timeKey: "12:30" },
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, input);
      });

      it("should not modify params[key] if params[key] is an empty string", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey: -12 },
          params: { timeKey: "" },
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, input);
      });

      it("should not modify params[key] if params[key] is undefined", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey: -12 },
          params: {},
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, input);
      });

      it("should not modify params[key] if parameterTypes[key] is not an array", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey: -12 },
          params: { timeKey: "12:30" },
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, input);
      });

      it("should not modify params[key] if parameterTypes[key] is an empty array", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey: [] },
          params: { timeKey: "12:30" },
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, input);
      });

      it("should handle multiple keys in parameterTypes and params", () => {
        const input: UDARequestBody = {
          language: "en",
          name: "test",
          parameterTypes: { timeKey1: -12, timeKey2: 1 },
          params: { timeKey1: "12:30", timeKey2: "value" },
          returnFormat: "json",
          sampleFn: "sample",
          sampleSize: 10,
        };

        const expected: UDARequestBody = {
          ...input,
          params: { timeKey1: "12:30:00.000000000", timeKey2: "value" },
        };

        const result = UDAUtils.fixTimeAtUDARequestBody(input);
        assert.deepStrictEqual(result, expected);
      });
    });

    describe("getIncompatibleError", () => {
      it("should return no meta error message", () => {
        const result = UDAUtils.getIncompatibleError(undefined, undefined);

        assert.deepEqual(result, InvalidParamFieldErrors.NoMetadata);
      });

      it("should return BadField error message", () => {
        const result = UDAUtils.getIncompatibleError(
          {},
          ParamFieldType.Invalid,
        );

        assert.strictEqual(result, "badField");
      });

      it("should return undefined", () => {
        const result = UDAUtils.getIncompatibleError(
          {},
          ParamFieldType.Boolean,
        );
        assert.strictEqual(result, undefined);
      });
    });

    describe("UDAUtils.createUDAReturn", () => {
      let convertTypesToStringStub: sinon.SinonStub;

      beforeEach(() => {
        convertTypesToStringStub = sinon.stub(UDAUtils, "convertTypesToString");
      });

      afterEach(() => {
        convertTypesToStringStub.restore();
      });

      it("should return correct UDAReturn when metadata has return type and description", () => {
        const metadata = {
          return: {
            type: [1, 2],
            description: "Test description",
          },
        };
        convertTypesToStringStub.withArgs([1, 2]).returns(["type1", "type2"]);

        const result = UDAUtils.createUDAReturn(metadata);

        assert.deepStrictEqual(result, {
          type: ["Boolean", "Number"],
          description: "Test description",
        });
      });

      it("should return empty type array and empty description when metadata is undefined", () => {
        const metadata = undefined;
        convertTypesToStringStub.withArgs([]).returns([]);

        const result = UDAUtils.createUDAReturn(metadata);

        assert.deepStrictEqual(result, {
          type: [],
          description: "",
        });
      });

      it("should return empty type array and empty description when metadata has no return", () => {
        const metadata = undefined;
        convertTypesToStringStub.withArgs([]).returns([]);

        const result = UDAUtils.createUDAReturn(metadata);

        assert.deepStrictEqual(result, {
          type: [],
          description: "",
        });
      });

      it("should return empty type array and provided description when metadata has no return type", () => {
        const metadata = {
          return: {
            description: "Test description",
          },
        };
        convertTypesToStringStub.withArgs([]).returns([]);

        const result = UDAUtils.createUDAReturn(metadata);

        assert.deepStrictEqual(result, {
          type: [],
          description: "Test description",
        });
      });

      it("should return correct type array and empty description when metadata has return type but no description", () => {
        const metadata = {
          return: {
            type: [1, 2],
          },
        };
        convertTypesToStringStub.withArgs([1, 2]).returns(["type1", "type2"]);

        const result = UDAUtils.createUDAReturn(metadata);

        assert.deepStrictEqual(result, {
          type: ["Boolean", "Number"],
          description: "",
        });
      });
    });

    describe("parseUDAList", () => {
      it("should parse UDA list correctly", () => {
        const getMeta: MetaObjectPayload = {
          api: [
            {
              api: "testAPI",
              custom: true,
              metadata: {
                params: [
                  {
                    name: "param1",
                    type: 1,
                    isReq: true,
                    description: "",
                  },
                ],
                return: { type: [1], description: "test" },
                description: "",
                aggReturn: {
                  type: 0,
                  description: "",
                },
                misc: {},
              },
              kxname: [],
              aggFn: "",
              full: false,
              procs: [],
            },
          ],
          rc: [],
          agg: [],
          assembly: [],
          schema: [],
          dap: [],
        };
        sinon.stub(ext, "booleanTypes").value(new Set([1]));

        const result = UDAUtils.parseUDAList(getMeta);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, "testAPI");
        assert.strictEqual(result[0].params.length, 1);
        assert.strictEqual(
          result[0].params[0].fieldType,
          ParamFieldType.Boolean,
        );
      });
    });

    describe("retrieveDataTypeByString", () => {
      it("should retrieve data type by string", () => {
        const dataTypes = new Map([["Boolean", 1]]);
        sinon.stub(ext.constants, "reverseDataTypes").value(dataTypes);

        const result = UDAUtils.retrieveDataTypeByString("Boolean");
        assert.strictEqual(result, 1);
      });

      it("should return 0 if data type not found", () => {
        const dataTypes = new Map([["Boolean", 1]]);
        sinon.stub(ext.constants, "reverseDataTypes").value(dataTypes);

        const result = UDAUtils.retrieveDataTypeByString("Number");
        assert.strictEqual(result, 0);
      });
    });

    describe("isInvalidRequiredParam", () => {
      beforeEach(() => {
        sinon.stub(ext.constants, "allowedEmptyRequiredTypes").value([10, -11]);
        sinon.stub(ext.constants, "reverseDataTypes").value(
          new Map([
            ["Symbol", -11],
            ["String", 10],
            ["InvalidType", -1],
          ]),
        );
      });

      afterEach(() => {
        sinon.restore();
      });

      it("should return true if param.name is 'table' and isReq is true but value is empty", () => {
        const param: UDAParam = {
          name: "table",
          isReq: true,
          value: "",
          type: 10,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, true);
      });

      it("should return false if param.name is 'table' and isReq is true with a valid value", () => {
        const param = {
          name: "table",
          isReq: true,
          value: "validValue",
          type: 10,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, false);
      });

      it("should return false if param.type is a number and is in allowedEmptyRequiredTypes", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: 10,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, false);
      });

      it("should return true if param.type is a number and is not in allowedEmptyRequiredTypes", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: 1,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, true);
      });

      it("should return false if param.type is an array and contains a value in allowedEmptyRequiredTypes", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: [10],
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, false);
      });

      it("should return true if param.type is an array and does not contain a value in allowedEmptyRequiredTypes", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: [1],
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, true);
      });

      it("should return false if param.type is an array with multiple elements and selectedMultiTypeString resolves to an allowed type", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: [10, -11],
          selectedMultiTypeString: "Symbol",
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, false);
      });

      it("should return true if param.type is an array with multiple elements and selectedMultiTypeString resolves to a disallowed type", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: [10, -11],
          selectedMultiTypeString: "InvalidType",
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, true);
      });

      it("should return true if param.isReq is true and value is empty, and type is not allowed", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: 1,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, true);
      });

      it("should return false if param.isReq is false, regardless of value or type", () => {
        const param = {
          name: "param1",
          isReq: false,
          value: "",
          type: 1,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, false);
      });

      it("should return false if param.value is not empty, regardless of type", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "validValue",
          type: 1,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, false);
      });

      it("should return true if param.type is an array with multiple elements and selectedMultiTypeString is undefined", () => {
        const param = {
          name: "param1",
          isReq: true,
          value: "",
          type: [10, -11],
          selectedMultiTypeString: undefined,
          description: "",
        };
        const result = UDAUtils.isInvalidRequiredParam(param);
        assert.strictEqual(result, true);
      });
    });

    describe("resolveParamType", () => {
      it("should return the first element of param.type if it is an array with at least one element", () => {
        const param: UDAParam = {
          name: "param1",
          description: "Test parameter",
          isReq: true,
          type: [10, 20],
        };

        const result = UDAUtils.resolveParamType(param);
        assert.strictEqual(result, 10);
      });

      it("should return param.type if it is a number", () => {
        const param: UDAParam = {
          name: "param2",
          description: "Test parameter",
          isReq: false,
          type: 15,
        };

        const result = UDAUtils.resolveParamType(param);
        assert.strictEqual(result, 15);
      });

      it("should throw an error if param.type is an empty array", () => {
        const param: UDAParam = {
          name: "param3",
          description: "Test parameter",
          isReq: true,
          type: [],
        };

        assert.throws(
          () => UDAUtils.resolveParamType(param),
          new Error(
            "Invalid type for parameter: param3. Expected number or array of numbers.",
          ),
        );
      });

      it("should throw an error if param.type is undefined", () => {
        const param: UDAParam = {
          name: "param4",
          description: "Test parameter",
          isReq: false,
          type: undefined as any, // Simula um caso inválido
        };

        assert.throws(
          () => UDAUtils.resolveParamType(param),
          new Error(
            "Invalid type for parameter: param4. Expected number or array of numbers.",
          ),
        );
      });

      it("should throw an error if param.type is null", () => {
        const param: UDAParam = {
          name: "param5",
          description: "Test parameter",
          isReq: false,
          type: null as any, // Simula um caso inválido
        };

        assert.throws(
          () => UDAUtils.resolveParamType(param),
          new Error(
            "Invalid type for parameter: param5. Expected number or array of numbers.",
          ),
        );
      });

      it("should throw an error if param.type is not a number or an array", () => {
        const param: UDAParam = {
          name: "param6",
          description: "Test parameter",
          isReq: true,
          type: "invalidType" as any, // Simula um caso inválido
        };

        assert.throws(
          () => UDAUtils.resolveParamType(param),
          new Error(
            "Invalid type for parameter: param6. Expected number or array of numbers.",
          ),
        );
      });
    });
  });
  describe("FeedbackSurveyUtils", () => {
    describe("feedbackSurveyDialog", () => {
      let showSurveyDialogStub: sinon.SinonStub;

      beforeEach(() => {
        // Stub the showSurveyDialog function
        showSurveyDialogStub = sinon
          .stub(vscode.window, "showInformationMessage")
          .resolves();
      });

      afterEach(() => {
        sinon.restore();
      });

      it("should increment extSurveyTriggerCount and return immediately if hideSurvey is true", async () => {
        const result = await feedbackSurveyDialog(false, 0, true);
        assert.deepStrictEqual(result, {
          sawSurveyAlready: false,
          extSurveyTriggerCount: 1,
        });
        sinon.assert.notCalled(showSurveyDialogStub);
      });

      it("should set sawSurveyAlready to true and reset extSurveyTriggerCount when extSurveyTriggerCount >= 3 and sawSurveyAlready is false", async () => {
        const result = await feedbackSurveyDialog(false, 3, false);
        assert.deepStrictEqual(result, {
          sawSurveyAlready: true,
          extSurveyTriggerCount: 0,
        });
        sinon.assert.calledOnce(showSurveyDialogStub);
      });

      it("should reset extSurveyTriggerCount when extSurveyTriggerCount >= 5 and sawSurveyAlready is true", async () => {
        const result = await feedbackSurveyDialog(true, 5, false);
        assert.deepStrictEqual(result, {
          sawSurveyAlready: true,
          extSurveyTriggerCount: 0,
        });
        sinon.assert.calledOnce(showSurveyDialogStub);
      });

      it("should increment extSurveyTriggerCount and not show survey dialog for other cases", async () => {
        const result = await feedbackSurveyDialog(false, 1, false);
        assert.deepStrictEqual(result, {
          sawSurveyAlready: false,
          extSurveyTriggerCount: 2,
        });
        sinon.assert.notCalled(showSurveyDialogStub);
      });
    });
  });

  describe("Shared with webview utils", () => {
    describe("normalizeAssemblyTarget", () => {
      it("should return qe assembly without -qe", () => {
        const res = shared.normalizeAssemblyTarget("test-assembly-qe target");
        assert.strictEqual(res, "test-assembly target");
      });
      it("should return normal assembly without -qe", () => {
        const res = shared.normalizeAssemblyTarget("test-assembly target");
        assert.strictEqual(res, "test-assembly target");
      });
    });
  });

  describe("sanitizeQsqlQuery", () => {
    it("should trim query", () => {
      const res = queryUtils.sanitizeQsqlQuery("  a:1  ");
      assert.strictEqual(res, "a:1");
    });
    it("should remove block comment", () => {
      let res = queryUtils.sanitizeQsqlQuery("/\nBlock Comment\n\\a:1");
      assert.strictEqual(res, "a:1");
      res = queryUtils.sanitizeQsqlQuery("/\nBlock Comment\r\n\\a:1");
      assert.strictEqual(res, "a:1");
    });
    it("should remove single line comment", () => {
      let res = queryUtils.sanitizeQsqlQuery("/ single line comment\na:1");
      assert.strictEqual(res, "a:1");
      res = queryUtils.sanitizeQsqlQuery("/ single line comment\r\na:1");
      assert.strictEqual(res, "a:1");
    });
    it("should remove line comment", () => {
      const res = queryUtils.sanitizeQsqlQuery("a:1 / line comment");
      assert.strictEqual(res, "a:1");
    });
    it("should ignore line comment in a string", () => {
      const res = queryUtils.sanitizeQsqlQuery('a:"1 / not line comment"');
      assert.strictEqual(res, 'a:"1 / not line comment"');
    });
    it("should replace EOS with semicolon", () => {
      let res = queryUtils.sanitizeQsqlQuery("a:1\na");
      assert.strictEqual(res, "a:1;a");
      res = queryUtils.sanitizeQsqlQuery("a:1\r\na");
      assert.strictEqual(res, "a:1;a");
    });
    it("should not replace continuation with semicolon", () => {
      let res = queryUtils.sanitizeQsqlQuery('a:"a\n \nb"');
      assert.strictEqual(res, 'a:"a\n \nb"');
      res = queryUtils.sanitizeQsqlQuery('a:"a\r\n \r\nb"');
      assert.strictEqual(res, 'a:"a\r\n \r\nb"');
    });
  });
});
