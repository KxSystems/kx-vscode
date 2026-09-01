/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import { InsightsConnection } from "../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../src/classes/localConnection";
import * as dataSourceCommand from "../../../src/commands/dataSourceCommand";
import * as serverCommand from "../../../src/commands/serverCommand";
import { ext } from "../../../src/extensionVariables";
import { GetDataError } from "../../../src/models/data";
import {
  DataSourceFiles,
  DataSourceTypes,
} from "../../../src/models/dataSource";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import { InsightsNode } from "../../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../../src/services/resultsPanelProvider";
import * as dataSourceUtils from "../../../src/utils/dataSource";
import * as loggers from "../../../src/utils/loggers";
import {
  getDataIntResponse,
  getDataResponse,
} from "../../fixtures/api/getData";
import { getMetaResponse } from "../../fixtures/api/getMeta";
import { createMockDatasource } from "../../fixtures/config/datasource";

describe("dataSourceCommand", () => {
  ext.outputChannel = vscode.window.createOutputChannel("kdb", { log: true });
  const localConn = new LocalConnection("localhost:5001", "test", []);
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
  const insightsConn = new InsightsConnection(insightsNode.label, insightsNode);

  describe("getSelectedType", () => {
    it("should return selectedType if it is API", () => {
      const result = dataSourceCommand.getSelectedType(createMockDatasource());
      sinon.assert.match(result, "API");
    });

    it("should return selectedType if it is UDA", () => {
      const result2 = dataSourceCommand.getSelectedType(
        createMockDatasource({ selectedType: DataSourceTypes.UDA }),
      );
      sinon.assert.match(result2, "UDA");
    });
  });

  describe("getQuery", () => {
    it("should return the table for getData", () => {
      const ds = createMockDatasource();
      ds.dataSource.api.payload = { table: "mock_table" } as any;
      const query = dataSourceCommand.getQuery(ds, "API");
      assert.strictEqual(query, "GetData - table: mock_table");
    });

    it("should return the UDA name for a UDA", () => {
      const ds = createMockDatasource({ selectedType: DataSourceTypes.UDA });
      ds.dataSource.uda = { name: "test.uda", description: "", params: [] };
      const query = dataSourceCommand.getQuery(ds, "UDA");
      assert.strictEqual(query, "Executed UDA: test.uda");
    });
  });

  describe("getApiBody", () => {
    it("should return the payload the query editor built", () => {
      const payload = { table: "trades", startTS: "a", endTS: "b" };
      const dataSource = <DataSourceFiles>{
        dataSource: { selectedType: DataSourceTypes.API, api: { payload } },
      };
      assert.deepStrictEqual(dataSourceCommand.getApiBody(dataSource), payload);
    });

    it("should return an empty body when there is no payload", () => {
      const dataSource = <DataSourceFiles>{
        dataSource: { selectedType: DataSourceTypes.API, api: {} },
      };
      assert.deepStrictEqual(dataSourceCommand.getApiBody(dataSource), {});
    });
  });

  describe("runApiDataSource", () => {
    let getApiBodyStub: sinon.SinonStub;
    let checkIfTimeParamIsCorrectStub: sinon.SinonStub;
    let getDataInsightsStub: sinon.SinonStub;

    beforeEach(() => {
      getApiBodyStub = sinon.stub(dataSourceCommand, "getApiBody");
      checkIfTimeParamIsCorrectStub = sinon.stub(
        dataSourceUtils,
        "checkIfTimeParamIsCorrect",
      );
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });

    const bounded = () => {
      const ds = createMockDatasource();
      ds.dataSource.api.payload = {
        table: "myTable",
        startTS: "2024-01-02T00:00:00.000000000",
        endTS: "2024-01-01T00:00:00.000000000",
      };
      return ds;
    };

    it("should show an error message if the time parameters are incorrect", async () => {
      checkIfTimeParamIsCorrectStub.returns(false);

      const showErrorMessageStub = sinon.stub(
        vscode.window,
        "showErrorMessage",
      );

      await dataSourceCommand.runApiDataSource(bounded(), insightsConn);

      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.calledWith(
        showErrorMessageStub,
        sinon.match("The time parameters"),
      );
      sinon.assert.notCalled(getApiBodyStub);
      sinon.assert.notCalled(getDataInsightsStub);
    });

    it("should run without a time range at all", async () => {
      checkIfTimeParamIsCorrectStub.returns(false);
      getApiBodyStub.returns({ table: "myTable" });
      getDataInsightsStub.resolves({ results: {} });

      await dataSourceCommand.runApiDataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
    });

    it("should call the API and handle the results if the time parameters are correct", async () => {
      checkIfTimeParamIsCorrectStub.returns(true);
      getApiBodyStub.returns({ table: "myTable" });
      getDataInsightsStub.resolves({ results: {} });

      await dataSourceCommand.runApiDataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
    });
  });

  describe("runUDADataSource", () => {
    let getDataInsightsStub: sinon.SinonStub;
    let isUDAAvailableStub: sinon.SinonStub;
    let parseErrorStub: sinon.SinonStub;

    beforeEach(() => {
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
      parseErrorStub = sinon.stub(dataSourceCommand, "parseError");
      isUDAAvailableStub = sinon.stub(insightsConn, "isUDAAvailable");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call the API and handle the results", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(getDataIntResponse);

      const results = await dataSourceCommand.runUDADataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      assert.deepStrictEqual(results, getDataIntResponse.results);
    });

    it("warns when the gateway will override a chosen parameter type", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(getDataIntResponse);
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
      const warning = sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves();

      const source = createMockDatasource();
      source.dataSource.selectedType = DataSourceTypes.UDA;
      source.dataSource.uda = {
        name: ".uda.identity",
        description: "",
        params: [
          {
            name: "x",
            description: "",
            isReq: true,
            type: [-11, -7],
            selectedMultiTypeString: "Long",
            isVisible: true,
            value: 44,
          },
        ],
      };

      await dataSourceCommand.runUDADataSource(source, insightsConn);

      sinon.assert.calledOnce(warning);
      assert.match(
        warning.getCall(0).args[0],
        /^The service gateway will read x as the first type/,
      );
    });

    it("stays quiet when the chosen type is the one the gateway would use", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(getDataIntResponse);
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
      const warning = sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves();

      const source = createMockDatasource();
      source.dataSource.selectedType = DataSourceTypes.UDA;
      source.dataSource.uda = {
        name: ".uda.identity",
        description: "",
        params: [
          {
            name: "x",
            description: "",
            isReq: true,
            type: [-11, -7],
            selectedMultiTypeString: "Symbol",
            isVisible: true,
            value: "AAPL",
          },
        ],
      };

      await dataSourceCommand.runUDADataSource(source, insightsConn);

      sinon.assert.notCalled(warning);
    });

    it("should call the API and handle the error results", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves({ error: "error test" });
      parseErrorStub.resolves({ error: "error test" });
      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource(),
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "error test" });
    });

    it("should call the API and handle undefined response ", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(undefined);
      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource(),
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "UDA call failed" });
    });

    it("should handle if the UDA doesn't exist in the connection", async () => {
      isUDAAvailableStub.resolves(false);
      getDataInsightsStub.resolves(undefined);
      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource(),
        insightsConn,
      );

      assert.deepStrictEqual(result, {
        error: "UDA test query is not available in this connection",
      });
    });

    it("should handle if a required param is empty", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(undefined);

      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource({
          uda: {
            name: "test query",
            description: "test description",
            params: [
              {
                name: "param1",
                description: "test param",
                default: "",
                isReq: true,
                type: [0],
                value: "",
              },
            ],
          },
        }),
        insightsConn,
      );

      assert.deepStrictEqual(result, {
        error: "The UDA: test query requires the parameter: param1.",
      });
    });

    it("should handle if have invalid parameter type", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(undefined);

      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource({
          uda: {
            name: "test query",
            description: "test description",
            params: [],
            incompatibleError: "test error",
          },
        }),
        insightsConn,
      );

      assert.deepStrictEqual(result, {
        error:
          "The UDA you have selected cannot be queried because it has required fields with types that are not supported.",
      });
    });

    it("should handle undefined UDA ", async () => {
      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource({
          uda: undefined,
        }),
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "UDA is undefined" });
    });

    it("should handle UDA without name", async () => {
      const result = await dataSourceCommand.runUDADataSource(
        createMockDatasource({
          uda: {
            name: "",
            description: "",
            params: [],
          },
        }),
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "UDA name not found" });
    });
  });

  describe("runDataSource", () => {
    const mockDataSourceFile = createMockDatasource({
      selectedType: DataSourceTypes.QSQL,
      api: {
        selectedApi: "getData",
        payload: {
          table: "dummyTbl",
          startTS: "2023-09-10T09:30",
          endTS: "2023-09-19T12:30",
        },
        table: "dummyTbl",
        startTS: "2023-09-10T09:30",
        endTS: "2023-09-19T12:30",
        fill: "",
        temporality: "",
        filter: [],
        groupBy: [],
        agg: [],
        sortCols: [],
        slice: [],
        labels: [],
      },
      qsql: {
        query:
          "n:10;\n([] date:n?(reverse .z.d-1+til 10); instance:n?`inst1`inst2`inst3`inst4; sym:n?`USD`EUR`GBP`JPY; cnt:n?10; lists:{x?10}@/:1+n?10)\n",
        selectedTarget: "dummy-target",
      },
      sql: { query: "test query" },
      uda: {
        name: "test query",
        description: "test description",
        params: [],
      },
    });

    const dummyError = {
      error: "error message",
    };
    const connMngService = new ConnectionManagementService();
    const uriTest: vscode.Uri = vscode.Uri.parse("test");

    ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
    let isVisibleStub: sinon.SinonStub;
    let getMetaStub: sinon.SinonStub;
    let retrieveConnStub: sinon.SinonStub;
    let getDataInsightsStub: sinon.SinonStub;
    let writeQueryResultsToViewStub: sinon.SinonStub;
    let writeQueryResultsToConsoleStub: sinon.SinonStub;
    let windowMock: sinon.SinonMock;

    ext.outputChannel = vscode.window.createOutputChannel("kdb", { log: true });

    beforeEach(() => {
      retrieveConnStub = sinon.stub(
        connMngService,
        "retrieveConnectedConnection",
      );
      windowMock = sinon.mock(vscode.window);
      getMetaStub = sinon.stub(insightsConn, "getMeta");
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
      writeQueryResultsToViewStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToView",
      );
      writeQueryResultsToConsoleStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToConsole",
      );
    });

    afterEach(() => {
      sinon.restore();
      ext.isResultsTabVisible = false;
    });

    it("should not proceed there is no connection selected", async () => {
      ext.activeConnection = undefined;
      await dataSourceCommand.runDataSource(
        {} as DataSourceFiles,
        "",
        "test-file.kdb.json",
      );
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs(
          "You didn't selected any existing connection to execute this action, please select a connection and try again.",
        );
    });

    it("should show an error message if not connected to an Insights server", async () => {
      ext.activeConnection = undefined;
      getMetaStub.resolves({});
      await dataSourceCommand.runDataSource(
        {} as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("No Insights active connection found");
    });

    it("should show an error message if not active to an Insights server", async () => {
      ext.activeConnection = localConn;
      getMetaStub.resolves({});
      await dataSourceCommand.runDataSource(
        {} as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("No Insights active connection found");
    });

    it("should append the stack trace to the results panel message", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
      getDataInsightsStub.resolves({
        error: "Executing code using (Q) raised - type: Mismatched types",
        stacktrace: "  [0] {1+x}\n        ^\n",
      });

      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kxquery",
      );

      sinon.assert.calledWith(
        writeQueryResultsToViewStub,
        "Executing code using (Q) raised - type: Mismatched types\n  [0] {1+x}\n        ^\n",
      );

      ext.connectedConnectionList.length = 0;
    });

    it("should report and record a query that threw instead of returning", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
      getDataInsightsStub.rejects(new Error("socket hang up"));
      const showErrorMessage = sinon
        .stub(vscode.window, "showErrorMessage")
        .resolves(<any>undefined);
      ext.kdbQueryHistoryList.length = 0;

      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kxquery",
      );

      sinon.assert.calledOnce(showErrorMessage);
      assert.match(showErrorMessage.firstCall.args[0], /socket hang up/);
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
      assert.strictEqual(ext.kdbQueryHistoryList[0].success, false);
      assert.strictEqual(ext.isDatasourceExecution, false);

      ext.kdbQueryHistoryList.length = 0;
      ext.connectedConnectionList.length = 0;
    });

    it("should let a notebook render a query that threw", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
      getDataInsightsStub.rejects(new Error("socket hang up"));

      await assert.rejects(
        () =>
          dataSourceCommand.runDataSource(
            mockDataSourceFile,
            insightsConn.connLabel,
            "test-file.kxnb",
          ),
        /socket hang up/,
      );

      ext.connectedConnectionList.length = 0;
    });

    it("should append the stack trace to the console message", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
      getDataInsightsStub.resolves({
        error: "Executing code using (Q) raised - type: Mismatched types",
        stacktrace: "  [0] {1+x}\n        ^\n",
      });

      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kxquery",
      );

      sinon.assert.calledWith(
        writeQueryResultsToConsoleStub,
        "Executing code using (Q) raised - type: Mismatched types\n  [0] {1+x}\n        ^\n",
      );

      ext.connectedConnectionList.length = 0;
    });

    it("should return error for visible results panel", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      sinon.stub(dataSourceCommand, "runUDADataSource").resolves(dummyError);

      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
      sinon.assert.calledOnce(writeQueryResultsToViewStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return error for console panel", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      sinon.stub(dataSourceCommand, "runUDADataSource").resolves(dummyError);

      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return API results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(getMetaResponse);
      getDataInsightsStub.resolves({ results: getDataResponse, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return UDA results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.UDA;
      getMetaStub.resolves(getMetaResponse);
      getDataInsightsStub.resolves({ results: getDataResponse, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return error message API", async () => {
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(getMetaResponse);
      getDataInsightsStub.resolves({ results: getDataResponse, error: "" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should return error message API", async () => {
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(getMetaResponse);
      getDataInsightsStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should handle errors correctly", async () => {
      retrieveConnStub.throws(new Error("Test error"));
      await dataSourceCommand.runDataSource(
        mockDataSourceFile,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      windowMock.expects("showErrorMessage").once().withArgs("Test error");
    });
  });

  describe("populateScratchpad", async () => {
    let windowMock: sinon.SinonMock;
    const mockDataSourceFile: DataSourceFiles = {
      name: "dummy-DS",
      dataSource: {
        selectedType: DataSourceTypes.QSQL,
        api: {
          selectedApi: "getData",
          table: "dummyTbl",
          startTS: "2023-09-10T09:30",
          endTS: "2023-09-19T12:30",
          fill: "",
          temporality: "",
          filter: [],
          groupBy: [],
          agg: [],
          sortCols: [],
          slice: [],
          labels: [],
        },
        qsql: {
          query:
            "n:10;\n([] date:n?(reverse .z.d-1+til 10); instance:n?`inst1`inst2`inst3`inst4; sym:n?`USD`EUR`GBP`JPY; cnt:n?10; lists:{x?10}@/:1+n?10)\n",
          selectedTarget: "dummy-target",
        },
        sql: { query: "test query" },
        uda: {
          name: "test query",
          description: "test description",
          params: [],
        },
      },
      insightsNode: "dummyNode",
    };

    beforeEach(() => {
      ext.activeConnection = insightsConn;
      windowMock = sinon.mock(vscode.window);
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });

    it("should show error msg", async () => {
      await dataSourceCommand.populateScratchpad(
        mockDataSourceFile,
        localConn.connLabel,
        "testOutput",
      );
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Please connect to an Insights server");
    });
  });

  describe("parseError", () => {
    let kdbOutputLogStub: sinon.SinonStub;

    beforeEach(() => {
      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call kdbOutputLog and return error if error does not have buffer", () => {
      const error: GetDataError = "test error";
      const result = dataSourceCommand.parseError(error);

      assert.ok(kdbOutputLogStub.calledOnce);
      assert.deepEqual(result, { error });
    });

    it("should keep the stack trace beside the error", () => {
      const result = dataSourceCommand.parseError("test error", "  [0] {1+x}");

      assert.deepEqual(result, {
        error: "test error",
        stacktrace: "  [0] {1+x}",
      });
    });
  });

  describe("formatDataSourceError", () => {
    it("should prefer the error message over the error", () => {
      const result = dataSourceCommand.formatDataSourceError({
        error: true,
        errorMsg: "type",
      });

      assert.strictEqual(result, "type");
    });

    it("should append the stack trace under the message", () => {
      const result = dataSourceCommand.formatDataSourceError({
        error: "type",
        stacktrace: "  [0] {1+x}\n        ^\n",
      });

      assert.strictEqual(result, "type\n  [0] {1+x}\n        ^\n");
    });

    it("should leave the message alone without a stack trace", () => {
      const result = dataSourceCommand.formatDataSourceError({
        error: "type",
      });

      assert.strictEqual(result, "type");
    });

    it("should pass a buffer error through untouched", () => {
      const error = { buffer: new ArrayBuffer(1) };
      const result = dataSourceCommand.formatDataSourceError({ error });

      assert.strictEqual(result, error);
    });
  });
});
