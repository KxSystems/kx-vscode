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
import { CancellationEvent } from "../../src/models/cancellationEvent";
import { QueryResultType } from "../../src/models/queryResult";
import { ServerType } from "../../src/models/server";
import { InsightsNode, KdbNode } from "../../src/services/kdbTreeProvider";
import { QueryHistoryProvider } from "../../src/services/queryHistoryProvider";
import * as coreUtils from "../../src/utils/core";
import * as dataSourceUtils from "../../src/utils/dataSource";
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

    it("convertDataSourceFormToDataSourceFile", () => {
      const form = {
        name: "test",
        selectedType: "api",
        selectedApi: "test",
        selectedTable: "test",
        startTS: "test",
        endTS: "test",
        fill: "test",
      };
      const result =
        dataSourceUtils.convertDataSourceFormToDataSourceFile(form);
      assert.strictEqual(result.name, "test");
      assert.strictEqual(result.dataSource.selectedType, "api");
      assert.strictEqual(result.dataSource.api.selectedApi, "test");
      assert.strictEqual(result.dataSource.api.table, "test");
      assert.strictEqual(result.dataSource.api.startTS, "test");
      assert.strictEqual(result.dataSource.api.endTS, "test");
      assert.strictEqual(result.dataSource.api.fill, "test");
    });

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
        "2021-01-02"
      );
      assert.strictEqual(result, true);
      const result2 = dataSourceUtils.checkIfTimeParamIsCorrect(
        "2021-01-02",
        "2021-01-01"
      );
      assert.strictEqual(result2, false);
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
      assert.strictEqual(result, "!@#ERROR^&*%-test");
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
  });

  describe("executionConsole", () => {
    ext.queryHistoryProvider = new QueryHistoryProvider();

    describe("ExecutionConsole", () => {
      let queryConsole: executionConsoleUtils.ExecutionConsole;
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

      beforeEach(() => {
        queryConsole = executionConsoleUtils.ExecutionConsole.start();

        ext.kdbQueryHistoryList.length = 0;
      });

      it("should append and add queryHistory with kdbNode", () => {
        const query = "SELECT * FROM table";
        const output = "test";
        const serverName = "testServer";

        ext.connectionNode = kdbNode;

        queryConsole.append(output, query, serverName);
        assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
        assert.strictEqual(ext.kdbQueryHistoryList[0].success, true);
        assert.strictEqual(
          ext.kdbQueryHistoryList[0].connectionType,
          ServerType.KDB
        );
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
          ServerType.INSIGHTS
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
          ServerType.KDB
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
          ServerType.INSIGHTS
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
          ServerType.undefined
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
        true
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
        {}
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
        {}
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

    it("handleWSResults", () => {
      const ab = new ArrayBuffer(128);
      const result = queryUtils.handleWSResults(ab);
      assert.strictEqual(result, "No results found.");
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
      const expectedRes = ["a,b", "1,2", "3,4"].toString();
      const result = queryUtils.convertRows(rows);
      assert.equal(result, expectedRes);
    });

    it("convertRowsToConsole", () => {
      const rows = ["a,b", "1,2", "3,4"];
      const expectedRes = ["a  b  ", "------", "1  2  ", "3  4  "].toString();
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
  });

  describe("Registration", () => {
    let getConfigurationStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;

    beforeEach(() => {
      getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
      showInformationMessageStub = sinon.stub(
        vscode.window,
        "showInformationMessage"
      ) as sinon.SinonStub<
        [
          message: string,
          options: vscode.MessageOptions,
          ...items: vscode.MessageItem[]
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
