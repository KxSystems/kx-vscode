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
import * as queryUtils from "../../../src/utils/queryUtils";
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

    it("should return selectedType if it is QSQL", () => {
      const result2 = dataSourceCommand.getSelectedType(
        createMockDatasource({ selectedType: DataSourceTypes.QSQL }),
      );
      sinon.assert.match(result2, "QSQL");
    });

    it("should return selectedType if it is SQL", () => {
      const result3 = dataSourceCommand.getSelectedType(
        createMockDatasource({ selectedType: DataSourceTypes.SQL }),
      );
      sinon.assert.match(result3, "SQL");
    });
  });

  describe("getQuery", () => {
    it("should return the correct query for API data sources", () => {
      const ds = createMockDatasource();
      const query = dataSourceCommand.getQuery(ds, "API");
      assert.strictEqual(query, `GetData - table: ${ds.dataSource.api.table}`);
    });

    it("should return the correct query for QSQL data sources", () => {
      const ds = createMockDatasource();
      const query = dataSourceCommand.getQuery(ds, "QSQL");
      assert.strictEqual(query, ds.dataSource.qsql.query);
    });

    it("should return the correct query for SQL data sources", () => {
      const ds = createMockDatasource();
      const query = dataSourceCommand.getQuery(ds, "SQL");
      assert.strictEqual(query, ds.dataSource.sql.query);
    });
  });

  describe("getApiBody", () => {
    it("should return the correct API body for an old data source with all fields", () => {
      const apiBody = dataSourceCommand.getApiBody(
        createMockDatasource({
          api: {
            selectedApi: "getData",
            startTS: "2022-01-01T00:00:00Z",
            endTS: "2022-01-02T00:00:00Z",
            fill: "none",
            temporality: "1h",
            filter: ["col1=val1,col2=val2", "col3=val3"],
            groupBy: ["col1", "col2"],
            agg: ["sum(col3)", "avg(col4)"],
            sortCols: ["col1 ASC", "col2 DESC"],
            slice: ["10", "20"],
            labels: ["label1", "label2"],
            table: "myTable",
          },
        }),
      );

      assert.deepStrictEqual(apiBody, {
        table: "myTable",
        startTS: "2022-01-01T00:00:00.000000000",
        endTS: "2022-01-02T00:00:00.000000000",
      });
    });

    it("should return the correct API body for a new data source with some fields", () => {
      const apiBody = dataSourceCommand.getApiBody(
        createMockDatasource({
          api: {
            selectedApi: "getData",
            startTS: "2022-01-01T00:00:00Z",
            endTS: "2022-01-02T00:00:00Z",
            fill: "zero",
            rowCountLimit: "20",
            isRowLimitLast: true,
            temporality: "snapshot",
            filter: ["col1=val1,col2=val2", "col3=val3"],
            groupBy: ["col1", "col2"],
            agg: ["sum(col3)", "avg(col4)"],
            sortCols: ["col1 ASC", "col2 DESC"],
            slice: ["10", "20"],
            labels: ["label1", "label2"],
            table: "myTable",
            optional: {
              filled: true,
              temporal: true,
              rowLimit: true,
              filters: [],
              sorts: [],
              groups: [],
              aggs: [],
              labels: [],
            },
          },
        }),
      );

      assert.deepStrictEqual(apiBody, {
        table: "myTable",
        startTS: "2022-01-01T00:00:00.000000000",
        endTS: "2022-01-02T00:00:00.000000000",
        fill: "zero",
        limit: -20,
        labels: {},
        temporality: "snapshot",
      });
    });

    it("should return the correct API body for a new data source with slice", () => {
      const apiBody = dataSourceCommand.getApiBody(
        createMockDatasource({
          api: {
            selectedApi: "getData",
            startTS: "2022-01-01T00:00:00Z",
            endTS: "2022-01-02T00:00:00Z",
            fill: "zero",
            rowCountLimit: "20",
            isRowLimitLast: false,
            temporality: "slice",
            filter: [],
            groupBy: [],
            agg: [],
            sortCols: [],
            slice: [],
            labels: [],
            table: "myTable",
            optional: {
              rowLimit: true,
              filled: false,
              temporal: true,
              filters: [],
              sorts: [],
              groups: [],
              aggs: [],
              labels: [],
            },
          },
        }),
      );
      assert.strictEqual(apiBody.temporality, "slice");
    });

    it("should return the correct API body for a new data source with all fields", () => {
      const apiBody = dataSourceCommand.getApiBody(
        createMockDatasource({
          api: {
            selectedApi: "getData",
            startTS: "2022-01-01T00:00:00Z",
            endTS: "2022-01-02T00:00:00Z",
            fill: "zero",
            temporality: "snapshot",
            rowCountLimit: "20",
            isRowLimitLast: false,
            filter: [],
            groupBy: [],
            agg: [],
            sortCols: [],
            slice: [],
            labels: [],
            table: "myTable",
            optional: {
              rowLimit: false,
              filled: true,
              temporal: true,
              filters: [
                { active: true, column: "bid", operator: ">", values: "100" },
              ],
              sorts: [{ active: true, column: "sym" }],
              groups: [{ active: true, column: "bid" }],
              aggs: [
                { active: true, column: "ask", operator: "sum", key: "sumC" },
              ],
              labels: [{ active: true, key: "key", value: "value" }],
            },
          },
        }),
      );

      assert.deepStrictEqual(apiBody, {
        table: "myTable",
        startTS: "2022-01-01T00:00:00.000000000",
        endTS: "2022-01-02T00:00:00.000000000",
        fill: "zero",
        temporality: "snapshot",
        labels: {
          key: "value",
        },
        sortCols: ["sym"],
        groupBy: ["bid"],
        agg: [["sumC", "sum", "ask"]],
        filter: [[">", "bid", 100]],
      });
    });

    it("should return the correct API body for a data source with only required fields", () => {
      const apiBody = dataSourceCommand.getApiBody(
        createMockDatasource({
          api: {
            selectedApi: "getData",
            startTS: "2022-01-01T00:00:00Z",
            endTS: "2022-01-02T00:00:00Z",
            fill: "",
            temporality: "",
            filter: [],
            groupBy: [],
            agg: [],
            sortCols: [],
            slice: [],
            labels: [],
            table: "myTable",
          },
        }),
      );

      assert.deepStrictEqual(apiBody, {
        table: "myTable",
        startTS: "2022-01-01T00:00:00.000000000",
        endTS: "2022-01-02T00:00:00.000000000",
      });
    });
  });

  describe("runApiDataSource", () => {
    let getApiBodyStub: sinon.SinonStub;
    let checkIfTimeParamIsCorrectStub: sinon.SinonStub;
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;
    let handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      getApiBodyStub = sinon.stub(dataSourceCommand, "getApiBody");
      checkIfTimeParamIsCorrectStub = sinon.stub(
        dataSourceUtils,
        "checkIfTimeParamIsCorrect",
      );
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
      handleScratchpadTableRes = sinon.stub(
        queryUtils,
        "handleScratchpadTableRes",
      );
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });

    it("should show an error message if the time parameters are incorrect", async () => {
      checkIfTimeParamIsCorrectStub.returns(false);

      const showErrorMessageStub = sinon.stub(
        vscode.window,
        "showErrorMessage",
      );

      await dataSourceCommand.runApiDataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(showErrorMessageStub);
      sinon.assert.calledWith(
        showErrorMessageStub,
        sinon.match("The time parameters"),
      );
      sinon.assert.notCalled(getApiBodyStub);
      sinon.assert.notCalled(getDataInsightsStub);
      sinon.assert.notCalled(handleWSResultsStub);
    });

    it("should call the API and handle the results if the time parameters are correct", async () => {
      checkIfTimeParamIsCorrectStub.returns(true);
      getApiBodyStub.returns({ table: "myTable" });
      getDataInsightsStub.resolves({ results: {} });
      handleScratchpadTableRes.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);

      await dataSourceCommand.runApiDataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
    });
  });

  describe("runQsqlDataSource", () => {
    let getDataInsightsStub: sinon.SinonStub;

    beforeEach(() => {
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call the API and handle the results", async () => {
      getDataInsightsStub.resolves(getDataIntResponse);

      const results = await dataSourceCommand.runQsqlDataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      assert.deepStrictEqual(results, getDataIntResponse.results);
    });
  });

  describe("runSqlDataSource", () => {
    let getDataInsightsStub: sinon.SinonStub;

    beforeEach(() => {
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call the API and handle the results", async () => {
      getDataInsightsStub.resolves(getDataIntResponse);

      const results = await dataSourceCommand.runSqlDataSource(
        createMockDatasource(),
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      assert.deepStrictEqual(results, getDataIntResponse.results);
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

    it("should return error for visible results panel", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      sinon.stub(dataSourceCommand, "runQsqlDataSource").resolves(dummyError);

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
      sinon.stub(dataSourceCommand, "runQsqlDataSource").resolves(dummyError);

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

    it("should return QSQL results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      getMetaStub.resolves(getMetaResponse);
      getDataInsightsStub.resolves({ results: getDataResponse, error: "" });
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

    it("should return SQL results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = getMetaResponse;
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.SQL;
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

    it("should return error message QSQL", async () => {
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
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

    it("should return error message SQL", async () => {
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.SQL;
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

    it("should return error message QSQL", async () => {
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.QSQL;
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

    it("should return error message SQL", async () => {
      mockDataSourceFile.dataSource.selectedType = DataSourceTypes.SQL;
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
  });
});
