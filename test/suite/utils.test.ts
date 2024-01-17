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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TreeItemCollapsibleState } from "vscode";
import { ext } from "../../src/extensionVariables";
import * as QTable from "../../src/ipc/QTable";
import { CancellationEvent } from "../../src/models/cancellationEvent";
import { QueryResultType } from "../../src/models/queryResult";
import { ServerType } from "../../src/models/server";
import { InsightsNode, KdbNode } from "../../src/services/kdbTreeProvider";
import { QueryHistoryProvider } from "../../src/services/queryHistoryProvider";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";
import * as coreUtils from "../../src/utils/core";
import * as dataSourceUtils from "../../src/utils/dataSource";
import * as decodeUtils from "../../src/utils/decode";
import * as executionUtils from "../../src/utils/execution";
import * as executionConsoleUtils from "../../src/utils/executionConsole";
import { getNonce } from "../../src/utils/getNonce";
import { getUri } from "../../src/utils/getUri";
import { openUrl } from "../../src/utils/openUrl";
import * as queryUtils from "../../src/utils/queryUtils";
import { showRegistrationNotification } from "../../src/utils/registration";
import { killPid } from "../../src/utils/shell";
import {
  showInputBox,
  showOpenFolderDialog,
  showQuickPick,
} from "../../src/utils/userInteraction";
import { validateUtils } from "../../src/utils/validateUtils";
import { DCDS } from "../../src/ipc/c";

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

        queryConsole.append(output, query, serverName);
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

        queryConsole.append(output, query, serverName);
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

        queryConsole.append(output, query, serverName);
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

        queryConsole.appendQueryError(query, output, true, serverName);
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

        ext.connectionNode = insightsNode;

        queryConsole.appendQueryError(query, output, true, serverName);
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

        queryConsole.appendQueryError(query, output, false, serverName);
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

      executionConsoleUtils.addQueryHistory(
        query,
        connectionName,
        connectionType,
        true,
      );
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
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

  // describe("Output", () => {
  //   let windowCreateOutputChannelStub: sinon.SinonStub;
  //   let outputChannelAppendStub: sinon.SinonStub;
  //   let outputChannelAppendLineStub: sinon.SinonStub;
  //   let outputChannelShowStub: sinon.SinonStub;
  //   let outputChannelHideStub: sinon.SinonStub;
  //   let outputChannelDisposeStub: sinon.SinonStub;
  //   Output._outputChannel = {
  //     name: "",
  //     append: sinon.stub(),
  //     appendLine: sinon.stub(),
  //     show: sinon.stub(),
  //     hide: sinon.stub(),
  //     dispose: sinon.stub(),
  //   } as unknown as vscode.OutputChannel;

  //   beforeEach(() => {
  //     windowCreateOutputChannelStub = sinon.stub(
  //       vscode.window,
  //       "createOutputChannel"
  //     );
  //     outputChannelAppendStub = sinon.stub(Output._outputChannel, "append");
  //     outputChannelAppendLineStub = sinon.stub(
  //       Output._outputChannel,
  //       "appendLine"
  //     );
  //     outputChannelShowStub = sinon.stub(Output._outputChannel, "show");
  //     outputChannelHideStub = sinon.stub(Output._outputChannel, "hide");
  //     outputChannelDisposeStub = sinon.stub(Output._outputChannel, "dispose");
  //   });

  //   afterEach(() => {
  //     windowCreateOutputChannelStub.restore();
  //     outputChannelAppendStub.restore();
  //     outputChannelAppendLineStub.restore();
  //     outputChannelShowStub.restore();
  //     outputChannelHideStub.restore();
  //     outputChannelDisposeStub.restore();
  //   });

  //   it("should create an output channel with the correct name", () => {
  //     Output._outputChannel = undefined as unknown as vscode.OutputChannel;
  //     windowCreateOutputChannelStub.returns(Output._outputChannel);
  //     Output._outputChannel =
  //       Output._outputChannel ||
  //       vscode.window.createOutputChannel("kdb-telemetry");
  //     assert.ok(windowCreateOutputChannelStub.calledOnceWith("kdb-telemetry"));
  //   });

  //   it("should append a message to the output channel", () => {
  //     const label = "label";
  //     const message = "message";
  //     Output.output(label, message);
  //     assert.ok(
  //       outputChannelAppendStub.calledOnceWith(`[${label}] ${message}`)
  //     );
  //   });

  //   it("should append a message with a newline to the output channel", () => {
  //     const label = "label";
  //     const message = "message";
  //     Output.outputLine(label, message);
  //     assert.ok(
  //       outputChannelAppendLineStub.calledOnceWith(`[${label}] ${message}`)
  //     );
  //   });

  //   it("should show the output channel", () => {
  //     Output.show();
  //     assert.ok(outputChannelShowStub.calledOnce);
  //   });

  //   it("should hide the output channel", () => {
  //     Output.hide();
  //     assert.ok(outputChannelHideStub.calledOnce);
  //   });

  //   it("should dispose the output channel", () => {
  //     Output.dispose();
  //     assert.ok(outputChannelDisposeStub.calledOnce);
  //   });
  // });

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
        console.log(JSON.stringify(actualOutput.rows));
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

    describe("handleWSResults", () => {
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
        const uriTest: vscode.Uri = vscode.Uri.parse("test");
        ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
        const qtableStub = sinon
          .stub(QTable.default, "toLegacy")
          .returns(expectedOutput);
        const isVisibleStub = sinon
          .stub(ext.resultsViewProvider, "isVisible")
          .returns(true);
        const convertRowsSpy = sinon.spy(queryUtils, "convertRows");
        const result = queryUtils.handleWSResults(ab);
        sinon.assert.notCalled(convertRowsSpy);
        assert.strictEqual(result, expectedOutput);
        sinon.restore();
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
      const expectedRes = ["a#$#;#$#b", "1#$#;#$#2", "3#$#;#$#4"].toString();
      const result = queryUtils.convertRows(rows);
      assert.equal(result, expectedRes);
    });

    it("convertRowsToConsole", () => {
      const rows = ["a,b", "1,2", "3,4"];
      const expectedRes = ["a,b  ", "-----", "1,2  ", "3,4  "].toString();
      const result = queryUtils.convertRowsToConsole(rows);
      assert.equal(result, expectedRes);
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
    });

    describe("arrayToTable", () => {
      it("should format an array of objects as a table", () => {
        const data = [
          { a: "0", b: "1.4198733294891718e+38" },
          { a: "1", b: "-1.2894694634258276e+29" },
        ];

        const expected =
          "a   b                      \n" +
          "---------------------------\n" +
          "0   1.4198733294891718e+38 \n" +
          "1   -1.2894694634258276e+29";

        const result = queryUtils.arrayToTable(data);
        assert.strictEqual(result, expected);
      });

      it("should return the input if it is not a non-empty array", () => {
        const data = [];
        const result = queryUtils.arrayToTable(data);
        assert.strictEqual(result, data);
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
    let outputChannelAppendLineSpy: sinon.SinonSpy;

    beforeEach(() => {
      tryExecuteCommandStub = sinon.stub();
      outputChannelAppendLineSpy = sinon.spy();
    });

    it("should not execute command if pid is NaN", async () => {
      await killPid(NaN);
      sinon.assert.notCalled(tryExecuteCommandStub);
    });
  });

  describe("userInteraction", () => {
    let windowMock: sinon.SinonMock;
    // let getConfigurationMock: any;
    // let withProgressMock: any;

    beforeEach(() => {
      windowMock = sinon.mock(vscode.window);
      // getConfigurationMock = sinon.stub(workspace, 'getConfiguration');
      // withProgressMock = sinon.stub(window, 'withProgress');
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
});
