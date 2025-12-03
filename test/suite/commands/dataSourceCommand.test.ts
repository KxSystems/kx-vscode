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
import { MetaObject } from "../../../src/models/meta";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import { InsightsNode } from "../../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../../src/services/resultsPanelProvider";
import * as dataSourceUtils from "../../../src/utils/dataSource";
import * as loggers from "../../../src/utils/loggers";
import * as queryUtils from "../../../src/utils/queryUtils";

describe("dataSourceCommand", () => {
  let dummyDataSourceFiles: DataSourceFiles;
  let _resultsPanel: KdbResultsViewProvider;
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
  const uriTest: vscode.Uri = vscode.Uri.parse("test");
  const _view: vscode.WebviewView = {
    visible: true,
    show: (): void => {},
    viewType: "kdb-results",
    webview: {
      options: {},
      html: "",
      cspSource: "",
      asWebviewUri: (uri: vscode.Uri) => uri,
      onDidReceiveMessage: new vscode.EventEmitter<any>().event,
      postMessage: (): Thenable<boolean> => {
        return Promise.resolve(true);
      },
    },
    onDidDispose: new vscode.EventEmitter<void>().event,
    onDidChangeVisibility: new vscode.EventEmitter<null>().event,
  };

  beforeEach(() => {
    dummyDataSourceFiles = {
      name: "dummy ds",
      insightsNode: "dummy insights",
      dataSource: {
        selectedType: DataSourceTypes.API,
        api: {
          selectedApi: "getData",
          table: "dummy_table",
          startTS: "2023-09-10T09:30",
          endTS: "2023-09-19T12:30",
          fill: "",
          filter: [],
          groupBy: [],
          labels: [],
          slice: [],
          sortCols: [],
          temporality: "",
          agg: [],
        },
        qsql: {
          selectedTarget: "dummy_table rdb",
          query: "dummy QSQL query",
        },
        sql: {
          query: "dummy SQL query",
        },
        uda: {
          name: "test query",
          description: "test description",
          params: [],
        },
      },
    };
    _resultsPanel = new KdbResultsViewProvider(uriTest);
  });

  describe("getSelectedType", () => {
    it("should return selectedType if it is API", () => {
      const result = dataSourceCommand.getSelectedType(dummyDataSourceFiles);
      sinon.assert.match(result, "API");
    });

    it("should return selectedType if it is QSQL", () => {
      dummyDataSourceFiles.dataSource.selectedType = DataSourceTypes.QSQL;
      const result2 = dataSourceCommand.getSelectedType(dummyDataSourceFiles);
      sinon.assert.match(result2, "QSQL");
    });

    it("should return selectedType if it is SQL", () => {
      dummyDataSourceFiles.dataSource.selectedType = DataSourceTypes.SQL;
      const result3 = dataSourceCommand.getSelectedType(dummyDataSourceFiles);
      sinon.assert.match(result3, "SQL");
    });
  });

  describe("getQuery", () => {
    it("should return the correct query for API data sources", () => {
      const query = dataSourceCommand.getQuery(dummyDataSourceFiles, "API");
      assert.strictEqual(query, "GetData - table: dummy_table");
    });

    it("should return the correct query for QSQL data sources", () => {
      const query = dataSourceCommand.getQuery(dummyDataSourceFiles, "QSQL");
      assert.strictEqual(query, "dummy QSQL query");
    });

    it("should return the correct query for SQL data sources", () => {
      const query = dataSourceCommand.getQuery(dummyDataSourceFiles, "SQL");
      assert.strictEqual(query, "dummy SQL query");
    });
  });

  describe("getApiBody", () => {
    it("should return the correct API body for an old data source with all fields", () => {
      const api = dummyDataSourceFiles.dataSource.api;

      api.startTS = "2022-01-01T00:00:00Z";
      api.endTS = "2022-01-02T00:00:00Z";
      api.fill = "none";
      api.temporality = "1h";
      api.filter = ["col1=val1;col2=val2", "col3=val3"];
      api.groupBy = ["col1", "col2"];
      api.agg = ["sum(col3)", "avg(col4)"];
      api.sortCols = ["col1 ASC", "col2 DESC"];
      api.slice = ["10", "20"];
      api.labels = ["label1", "label2"];
      api.table = "myTable";
      const apiBody = dataSourceCommand.getApiBody(dummyDataSourceFiles);

      assert.deepStrictEqual(apiBody, {
        table: "myTable",
        startTS: "2022-01-01T00:00:00.000000000",
        endTS: "2022-01-02T00:00:00.000000000",
      });
    });

    it("should return the correct API body for a new data source with some fields", () => {
      const api = dummyDataSourceFiles.dataSource.api;

      api.startTS = "2022-01-01T00:00:00Z";
      api.endTS = "2022-01-02T00:00:00Z";
      api.fill = "zero";
      api.rowCountLimit = "20";
      api.isRowLimitLast = true;
      api.temporality = "snapshot";
      api.filter = ["col1=val1;col2=val2", "col3=val3"];
      api.groupBy = ["col1", "col2"];
      api.agg = ["sum(col3)", "avg(col4)"];
      api.sortCols = ["col1 ASC", "col2 DESC"];
      api.slice = ["10", "20"];
      api.labels = ["label1", "label2"];
      api.table = "myTable";
      api.optional = {
        filled: true,
        temporal: true,
        rowLimit: true,
        filters: [],
        sorts: [],
        groups: [],
        aggs: [],
        labels: [],
      };
      const apiBody = dataSourceCommand.getApiBody(dummyDataSourceFiles);

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
      const api = dummyDataSourceFiles.dataSource.api;

      api.startTS = "2022-01-01T00:00:00Z";
      api.endTS = "2022-01-02T00:00:00Z";
      api.fill = "zero";
      api.rowCountLimit = "20";
      api.isRowLimitLast = false;
      api.temporality = "slice";
      api.filter = [];
      api.groupBy = [];
      api.agg = [];
      api.sortCols = [];
      api.slice = [];
      api.labels = [];
      api.table = "myTable";
      api.optional = {
        rowLimit: true,
        filled: false,
        temporal: true,
        filters: [],
        sorts: [],
        groups: [],
        aggs: [],
        labels: [],
      };
      const apiBody = dataSourceCommand.getApiBody(dummyDataSourceFiles);
      assert.strictEqual(apiBody.temporality, "slice");
    });

    it("should return the correct API body for a new data source with all fields", () => {
      const api = dummyDataSourceFiles.dataSource.api;

      api.startTS = "2022-01-01T00:00:00Z";
      api.endTS = "2022-01-02T00:00:00Z";
      api.fill = "zero";
      api.temporality = "snapshot";
      api.rowCountLimit = "20";
      api.isRowLimitLast = false;
      api.filter = [];
      api.groupBy = [];
      api.agg = [];
      api.sortCols = [];
      api.slice = [];
      api.labels = [];
      api.table = "myTable";
      api.optional = {
        rowLimit: false,
        filled: true,
        temporal: true,
        filters: [
          { active: true, column: "bid", operator: ">", values: "100" },
        ],
        sorts: [{ active: true, column: "sym" }],
        groups: [{ active: true, column: "bid" }],
        aggs: [{ active: true, column: "ask", operator: "sum", key: "sumC" }],
        labels: [{ active: true, key: "key", value: "value" }],
      };
      const apiBody = dataSourceCommand.getApiBody(dummyDataSourceFiles);

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
      dummyDataSourceFiles.dataSource.api.startTS = "2022-01-01T00:00:00Z";
      dummyDataSourceFiles.dataSource.api.endTS = "2022-01-02T00:00:00Z";
      dummyDataSourceFiles.dataSource.api.fill = "";
      dummyDataSourceFiles.dataSource.api.temporality = "";
      dummyDataSourceFiles.dataSource.api.filter = [];
      dummyDataSourceFiles.dataSource.api.groupBy = [];
      dummyDataSourceFiles.dataSource.api.agg = [];
      dummyDataSourceFiles.dataSource.api.sortCols = [];
      dummyDataSourceFiles.dataSource.api.slice = [];
      dummyDataSourceFiles.dataSource.api.labels = [];
      dummyDataSourceFiles.dataSource.api.table = "myTable";
      const apiBody = dataSourceCommand.getApiBody(dummyDataSourceFiles);
      assert.deepStrictEqual(apiBody, {
        table: "myTable",
        startTS: "2022-01-01T00:00:00.000000000",
        endTS: "2022-01-02T00:00:00.000000000",
      });
    });
  });

  describe("runApiDataSource", () => {
    let _windowMock: sinon.SinonMock;
    let getApiBodyStub,
      checkIfTimeParamIsCorrectStub,
      getDataInsightsStub,
      handleWSResultsStub,
      handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      _windowMock = sinon.mock(vscode.window);
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
        dummyDataSourceFiles,
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
      getDataInsightsStub.resolves({ arrayBuffer: true });
      handleWSResultsStub.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      handleScratchpadTableRes.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);

      const result = await dataSourceCommand.runApiDataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      sinon.assert.calledOnce(handleWSResultsStub);
      assert.deepStrictEqual(result, [
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
    });
  });

  describe("runQsqlDataSource", () => {
    let _windowMock: sinon.SinonMock;
    let getDataInsightsStub,
      handleWSResultsStub,
      handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      _windowMock = sinon.mock(vscode.window);
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
      handleScratchpadTableRes = sinon.stub(
        queryUtils,
        "handleScratchpadTableRes",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call the API and handle the results", async () => {
      getDataInsightsStub.resolves({ arrayBuffer: true });
      handleWSResultsStub.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      handleScratchpadTableRes.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      const result = await dataSourceCommand.runQsqlDataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      sinon.assert.calledOnce(handleWSResultsStub);
      assert.deepStrictEqual(result, [
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
    });
  });

  describe("runSqlDataSource", () => {
    let _windowMock: sinon.SinonMock;
    let getDataInsightsStub,
      handleWSResultsStub,
      handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      _windowMock = sinon.mock(vscode.window);
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
      handleScratchpadTableRes = sinon.stub(
        queryUtils,
        "handleScratchpadTableRes",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call the API and handle the results", async () => {
      getDataInsightsStub.resolves({ arrayBuffer: true });
      handleWSResultsStub.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      handleScratchpadTableRes.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      const result = await dataSourceCommand.runSqlDataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      sinon.assert.calledOnce(handleWSResultsStub);
      assert.deepStrictEqual(result, [
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
    });
  });

  describe("runUDADataSource", () => {
    let getDataInsightsStub,
      handleWSResultsStub,
      handleScratchpadTableRes,
      isUDAAvailableStub,
      parseErrorStub: sinon.SinonStub;

    beforeEach(() => {
      getDataInsightsStub = sinon.stub(insightsConn, "getDatasourceQuery");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
      parseErrorStub = sinon.stub(dataSourceCommand, "parseError");
      isUDAAvailableStub = sinon.stub(insightsConn, "isUDAAvailable");
      handleScratchpadTableRes = sinon.stub(
        queryUtils,
        "handleScratchpadTableRes",
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call the API and handle the results", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves({ arrayBuffer: true });
      handleWSResultsStub.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      handleScratchpadTableRes.resolves([
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
      const result = await dataSourceCommand.runUDADataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      sinon.assert.calledOnce(getDataInsightsStub);
      sinon.assert.calledOnce(handleWSResultsStub);
      assert.deepStrictEqual(result, [
        { a: "2", b: "3" },
        { a: "4", b: "6" },
        { a: "6", b: "9" },
      ]);
    });

    it("should call the API and handle the error results", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves({ error: "error test" });
      parseErrorStub.resolves({ error: "error test" });
      const result = await dataSourceCommand.runUDADataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "error test" });
    });

    it("should call the API and handle undefined response ", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(undefined);
      const result = await dataSourceCommand.runUDADataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "UDA call failed" });
    });

    it("should handle if the UDA doesn't exist in the connection", async () => {
      isUDAAvailableStub.resolves(false);
      getDataInsightsStub.resolves(undefined);
      const result = await dataSourceCommand.runUDADataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      assert.deepStrictEqual(result, {
        error: "UDA test query is not available in this connection",
      });
    });

    it("should handle if a required param is empty", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(undefined);
      const dummyDSFiles2 = dummyDataSourceFiles;

      dummyDSFiles2.dataSource.uda.params = [
        {
          name: "param1",
          description: "test param",
          default: "",
          isReq: true,
          type: [0],
          value: "",
        },
      ];
      const result = await dataSourceCommand.runUDADataSource(
        dummyDSFiles2,
        insightsConn,
      );

      assert.deepStrictEqual(result, {
        error: "The UDA: test query requires the parameter: param1.",
      });
    });

    it("should handle if have invalid parameter type", async () => {
      isUDAAvailableStub.resolves(true);
      getDataInsightsStub.resolves(undefined);
      const dummyDSFiles2 = dummyDataSourceFiles;

      dummyDSFiles2.dataSource.uda.incompatibleError = "test error";
      const result = await dataSourceCommand.runUDADataSource(
        dummyDSFiles2,
        insightsConn,
      );

      assert.deepStrictEqual(result, {
        error:
          "The UDA you have selected cannot be queried because it has required fields with types that are not supported.",
      });
    });

    it("should handle undefined UDA ", async () => {
      dummyDataSourceFiles.dataSource.uda = undefined;
      const result = await dataSourceCommand.runUDADataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "UDA is undefined" });
    });

    it("should handle UDA without name", async () => {
      dummyDataSourceFiles.dataSource.uda.name = "";
      const result = await dataSourceCommand.runUDADataSource(
        dummyDataSourceFiles,
        insightsConn,
      );

      assert.deepStrictEqual(result, { error: "UDA name not found" });
    });
  });

  describe("runDataSource", () => {
    const dummyMeta: MetaObject = {
      header: {
        ac: "0",
        agg: ":127.0.0.1:5070",
        ai: "",
        api: ".kxi.getMeta",
        client: ":127.0.0.1:5050",
        corr: "CorrHash",
        http: "json",
        logCorr: "logCorrHash",
        protocol: "gw",
        rc: "0",
        rcvTS: "2099-05-22T11:06:33.650000000",
        retryCount: "0",
        to: "2099-05-22T11:07:33.650000000",
        userID: "dummyID",
        userName: "testUser",
      },
      payload: {
        rc: [
          {
            api: 3,
            agg: 1,
            assembly: 1,
            schema: 1,
            rc: "dummy-rc",
            labels: [{ kxname: "dummy-assembly" }],
            started: "2023-10-04T17:20:57.659088747",
          },
        ],
        dap: [],
        api: [],
        agg: [
          {
            aggFn: ".sgagg.aggFnDflt",
            custom: false,
            full: true,
            metadata: {
              description: "dummy desc.",
              params: [{ description: "dummy desc." }],
              return: { description: "dummy desc." },
              misc: {},
            },
            procs: [],
          },
        ],
        assembly: [
          {
            assembly: "dummy-assembly",
            kxname: "dummy-assembly",
            tbls: ["dummyTbl"],
          },
        ],
        schema: [],
      },
    };
    const dummyFileContent: DataSourceFiles = {
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
    const dummyError = {
      error: "error message",
    };
    const connMngService = new ConnectionManagementService();
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    const ab = new ArrayBuffer(26);

    ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
    let isVisibleStub,
      getMetaStub,
      _handleWSResultsStub,
      _handleScratchpadTableRes,
      retrieveConnStub,
      getDataInsightsStub,
      writeQueryResultsToViewStub,
      writeQueryResultsToConsoleStub: sinon.SinonStub;
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
      _handleWSResultsStub = sinon
        .stub(queryUtils, "handleWSResults")
        .returns("dummy results");
      _handleScratchpadTableRes = sinon
        .stub(queryUtils, "handleScratchpadTableRes")
        .returns("dummy results");
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
      insightsConn.meta = dummyMeta;
      getMetaStub.resolves(dummyMeta);
      sinon.stub(dataSourceCommand, "runQsqlDataSource").resolves(dummyError);

      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
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
      insightsConn.meta = dummyMeta;
      getMetaStub.resolves(dummyMeta);
      sinon.stub(dataSourceCommand, "runQsqlDataSource").resolves(dummyError);

      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
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
      insightsConn.meta = dummyMeta;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
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
      insightsConn.meta = dummyMeta;
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
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
      insightsConn.meta = dummyMeta;
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
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
      insightsConn.meta = dummyMeta;
      dummyFileContent.dataSource.selectedType = DataSourceTypes.UDA;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return error message QSQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.QSQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should return error message API", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should return error message SQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should return error message QSQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.QSQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should return error message API", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should return error message SQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
    });

    it("should handle errors correctly", async () => {
      retrieveConnStub.throws(new Error("Test error"));
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      windowMock.expects("showErrorMessage").once().withArgs("Test error");
    });
  });

  describe("populateScratchpad", async () => {
    let windowMock: sinon.SinonMock;
    let connMngService: ConnectionManagementService;
    let qeStatusStub: sinon.SinonStub;
    const dummyFileContent: DataSourceFiles = {
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
      connMngService = new ConnectionManagementService();
      qeStatusStub = sinon.stub(
        connMngService,
        "retrieveInsightsConnQEEnabled",
      );
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });

    it("should show error msg", async () => {
      await dataSourceCommand.populateScratchpad(
        dummyFileContent,
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
