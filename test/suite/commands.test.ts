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

import assert from "assert";
import mock from "mock-fs";
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as dataSourceCommand from "../../src/commands/dataSourceCommand";
import * as installTools from "../../src/commands/installTools";
import * as serverCommand from "../../src/commands/serverCommand";
import * as dsUtils from "../../src/utils/dataSource";
import * as walkthroughCommand from "../../src/commands/walkthroughCommand";
import { ext } from "../../src/extensionVariables";
import {
  DataSourceFiles,
  DataSourceTypes,
  createDefaultDataSourceFile,
} from "../../src/models/dataSource";
import { ExecutionTypes } from "../../src/models/execution";
import { ScratchpadResult } from "../../src/models/scratchpadResult";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
  MetaObjectPayloadNode,
} from "../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";
import * as coreUtils from "../../src/utils/core";
import * as dataSourceUtils from "../../src/utils/dataSource";
import { ExecutionConsole } from "../../src/utils/executionConsole";
import * as queryUtils from "../../src/utils/queryUtils";
import { QueryHistory } from "../../src/models/queryHistory";
import { NewConnectionPannel } from "../../src/panels/newConnection";
import { MAX_STR_LEN } from "../../src/validators/kdbValidator";
import { LocalConnection } from "../../src/classes/localConnection";
import { ConnectionManagementService } from "../../src/services/connectionManagerService";
import { InsightsConnection } from "../../src/classes/insightsConnection";
import * as workspaceCommand from "../../src/commands/workspaceCommand";
import { MetaObject } from "../../src/models/meta";
import { WorkspaceTreeProvider } from "../../src/services/workspaceTreeProvider";
import { GetDataError } from "../../src/models/data";
import * as clientCommand from "../../src/commands/clientCommands";
import { LanguageClient } from "vscode-languageclient/node";
import {
  ExportedConnections,
  InsightDetails,
  ServerDetails,
  ServerType,
} from "../../src/models/connectionsModels";

describe("dataSourceCommand", () => {
  afterEach(() => {
    sinon.restore();
    mock.restore();
  });

  it.skip("should add a data source", async () => {
    mock({
      "/temp": {
        ".kdb-datasources": {
          "datasource-0.ds": '{"name": "datasource-0"}',
        },
      },
    });

    ext.context = {} as vscode.ExtensionContext;
    sinon.stub(ext, "context").value({
      globalStorageUri: {
        fsPath: "/temp/",
      },
    });

    await assert.doesNotReject(dataSourceCommand.addDataSource());
  });
});

describe("dataSourceCommand2", () => {
  let dummyDataSourceFiles: DataSourceFiles;
  const localConn = new LocalConnection("localhost:5001", "test");
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
  let resultsPanel: KdbResultsViewProvider;
  ext.outputChannel = vscode.window.createOutputChannel("kdb");
  const view: vscode.WebviewView = {
    visible: true,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
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
      },
    };
    resultsPanel = new KdbResultsViewProvider(uriTest);
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
        labels: {},
        temporality: "snapshot",
      });
    });

    it("should return the correct API body for a new data source with slice", () => {
      const api = dummyDataSourceFiles.dataSource.api;

      api.startTS = "2022-01-01T00:00:00Z";
      api.endTS = "2022-01-02T00:00:00Z";
      api.fill = "zero";
      api.temporality = "slice";
      api.filter = [];
      api.groupBy = [];
      api.agg = [];
      api.sortCols = [];
      api.slice = [];
      api.labels = [];
      api.table = "myTable";
      api.optional = {
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
      api.filter = [];
      api.groupBy = [];
      api.agg = [];
      api.sortCols = [];
      api.slice = [];
      api.labels = [];
      api.table = "myTable";
      api.optional = {
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
    let windowMock: sinon.SinonMock;
    let getApiBodyStub: sinon.SinonStub;
    let checkIfTimeParamIsCorrectStub: sinon.SinonStub;
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;
    let handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      windowMock = sinon.mock(vscode.window);
      getApiBodyStub = sinon.stub(dataSourceCommand, "getApiBody");
      checkIfTimeParamIsCorrectStub = sinon.stub(
        dataSourceUtils,
        "checkIfTimeParamIsCorrect",
      );
      getDataInsightsStub = sinon.stub(insightsConn, "getDataInsights");
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
      const windowMock = sinon.mock(vscode.window);
      checkIfTimeParamIsCorrectStub.returns(false);

      await dataSourceCommand.runApiDataSource(
        dummyDataSourceFiles,
        insightsConn,
      );
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs(
          "The time parameters(startTS and endTS) are not correct, please check the format or if the startTS is before the endTS",
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
    let windowMock: sinon.SinonMock;
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;
    let handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      windowMock = sinon.mock(vscode.window);
      getDataInsightsStub = sinon.stub(insightsConn, "getDataInsights");
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
    let windowMock: sinon.SinonMock;
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;
    let handleScratchpadTableRes: sinon.SinonStub;

    beforeEach(() => {
      windowMock = sinon.mock(vscode.window);
      getDataInsightsStub = sinon.stub(insightsConn, "getDataInsights");
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
      },
      insightsNode: "dummyNode",
    };
    const connMngService = new ConnectionManagementService();
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    const ab = new ArrayBuffer(26);
    ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
    let isVisibleStub,
      getMetaStub,
      handleWSResultsStub,
      handleScratchpadTableRes,
      retrieveConnStub,
      getDataInsightsStub,
      writeQueryResultsToViewStub,
      writeQueryResultsToConsoleStub: sinon.SinonStub;
    let windowMock: sinon.SinonMock;

    ext.outputChannel = vscode.window.createOutputChannel("kdb");

    beforeEach(() => {
      retrieveConnStub = sinon.stub(
        connMngService,
        "retrieveConnectedConnection",
      );
      windowMock = sinon.mock(vscode.window);
      getMetaStub = sinon.stub(insightsConn, "getMeta");
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      handleWSResultsStub = sinon
        .stub(queryUtils, "handleWSResults")
        .returns("dummy results");
      handleScratchpadTableRes = sinon
        .stub(queryUtils, "handleScratchpadTableRes")
        .returns("dummy results");
      getDataInsightsStub = sinon.stub(insightsConn, "getDataInsights");
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
      },
      insightsNode: "dummyNode",
    };
    let windowMock: sinon.SinonMock;

    beforeEach(() => {
      windowMock = sinon.mock(vscode.window);
    });
    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });
    it("should show error msg", async () => {
      await dataSourceCommand.populateScratchpad(
        dummyFileContent,
        localConn.connLabel,
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
      kdbOutputLogStub = sinon.stub(coreUtils, "kdbOutputLog");
    });
    afterEach(() => {
      sinon.restore();
    });

    it("should call kdbOutputLog and return error if error does not have buffer", () => {
      const error: GetDataError = "test error";

      const result = dataSourceCommand.parseError(error);

      assert(kdbOutputLogStub.calledOnce);
      assert(
        kdbOutputLogStub.calledWith(`[DATASOURCE] Error: ${error}`, "ERROR"),
      );
      assert.deepEqual(result, { error });
    });
  });
});

describe("installTools", () => {
  //write tests for src/commands/installTools.ts
  //function to be deleted after write the tests
  installTools.installTools();
});
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
    let updateInsightsStub, getInsightsStub: sinon.SinonStub;
    let windowMock: sinon.SinonMock;
    beforeEach(() => {
      insightsData = {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      };
      windowMock = sinon.mock(vscode.window);
      updateInsightsStub = sinon.stub(coreUtils, "updateInsights");
      getInsightsStub = sinon.stub(coreUtils, "getInsights");
    });
    afterEach(() => {
      sinon.restore();
      windowMock.restore();
    });
    it("should add new Insights connection", async () => {
      getInsightsStub.returns({});
      await serverCommand.addInsightsConnection(insightsData, ["lblTest"]);
      sinon.assert.calledOnce(updateInsightsStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Insights connection added successfully");
    });
    it("should show error message if Insights connection already exists", async () => {
      getInsightsStub.returns(insights);
      await serverCommand.addInsightsConnection(insightsData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Insights connection already exists");
    });
    it("should show error message if Insights connection is invalid", async () => {
      insightsData.server = "invalid";
      await serverCommand.addInsightsConnection(insightsData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Insights connection");
    });
  });

  describe("addKdbConnection", () => {
    let kdbData: ServerDetails;
    let windowMock: sinon.SinonMock;
    let updateServersStub, getServersStub: sinon.SinonStub;
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
    });

    afterEach(() => {
      sinon.restore();
      windowMock.restore();
    });

    it("should add new Kdb connection", async () => {
      getServersStub.returns({});
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
      sinon.assert.calledOnce(updateServersStub);
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
      kdbData.serverName = "a".repeat(MAX_STR_LEN + 1);
      await serverCommand.addKdbConnection(kdbData);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs("Invalid Kdb connection");
    });
  });

  describe("importConnections", () => {
    let showOpenDialogStub: sinon.SinonStub;
    let kdbOutputLogStub: sinon.SinonStub;
    let addImportedConnectionsStub: sinon.SinonStub;

    beforeEach(() => {
      showOpenDialogStub = sinon.stub(vscode.window, "showOpenDialog");
      kdbOutputLogStub = sinon.stub(coreUtils, "kdbOutputLog");
      addImportedConnectionsStub = sinon.stub(
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
          "[IMPORT CONNECTION]No file selected",
          "ERROR",
        ),
      );
    });
  });

  describe("addImportedConnections", async () => {
    let addInsightsConnectionStub: sinon.SinonStub;
    let addKdbConnectionStub: sinon.SinonStub;
    let kdbOutputLogStub: sinon.SinonStub;
    let showInformationMessageStub: sinon.SinonStub;
    let getInsightsStub: sinon.SinonStub;
    let getServersStub: sinon.SinonStub;
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
      getTooltip: function (): vscode.MarkdownString {
        throw new Error("Function not implemented.");
      },
      getDescription: function (): string {
        throw new Error("Function not implemented.");
      },
      iconPath: undefined,
    };

    beforeEach(() => {
      addInsightsConnectionStub = sinon.stub(
        serverCommand,
        "addInsightsConnection",
      );
      addKdbConnectionStub = sinon.stub(serverCommand, "addKdbConnection");
      kdbOutputLogStub = sinon.stub(coreUtils, "kdbOutputLog");
      getInsightsStub = sinon.stub(coreUtils, "getInsights").returns(undefined);
      getServersStub = sinon.stub(coreUtils, "getServers").returns(undefined);
      showInformationMessageStub = sinon.stub(
        vscode.window,
        "showInformationMessage",
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
          "[IMPORT CONNECTION]Connections imported successfully",
          "INFO",
        ),
      );
      assert(
        showInformationMessageStub.calledWith(
          "Connections imported successfully",
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
  });
  describe("enableTLS", () => {
    let getServersStub: sinon.SinonStub;
    let updateServersStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;

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
    let executionConsoleStub: sinon.SinonStub;
    let scratchpadResult: ScratchpadResult;
    let queryConsoleErrorStub: sinon.SinonStub;
    let writeQueryResultsToViewStub: sinon.SinonStub;
    let writeQueryResultsToConsoleStub: sinon.SinonStub;
    let isVisibleStub: sinon.SinonStub;

    beforeEach(() => {
      executionConsoleStub = sinon
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
        true,
        "2",
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
        true,
        "2",
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
        true,
        "2",
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
      await serverCommand.resetScratchPad();
      sinon.assert.calledOnce(resetScratchpadStub);
      sinon.restore();
    });
  });

  describe("runQuery", () => {
    const editor = <vscode.TextEditor>(<unknown>{
      selection: {
        isEmpty: false,
        active: { line: 5 },
        end: sinon.stub().returns({ line: 10 }),
      },
      document: {
        lineAt: sinon.stub().returns({ text: "SELECT * FROM table" }),
        getText: sinon.stub().returns("SELECT * FROM table"),
      },
    });

    let getQueryContextStub, executeQueryStub: sinon.SinonStub;

    beforeEach(() => {
      ext.activeTextEditor = editor;
      getQueryContextStub = sinon
        .stub(serverCommand, "getQueryContext")
        .returns(".");
      executeQueryStub = sinon
        .stub(serverCommand, "executeQuery")
        .resolves(undefined);
      ext.kdbinsightsNodes.push("insightsserveralias (connected)");
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
      getQueryContextStub.restore();
      executeQueryStub.restore();
      ext.kdbinsightsNodes.pop();
    });

    it("runQuery with undefined editor ", () => {
      ext.activeTextEditor = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, false);
    });

    it("runQuery with QuerySelection", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.QuerySelection,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile not connected to inisghts node", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQuerySelection,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile connected to inisghts node", () => {
      ext.connectionNode = insightsNode;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQuerySelection,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with QueryFile", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.QueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with ReRunQuery", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.ReRunQuery,
        "",
        "",
        false,
        "rerun query",
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile", () => {
      ext.connectionNode = insightsNode;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQueryFile,
        "",
        "",
        false,
      );
      assert.equal(result, undefined);
    });
  });

  describe("executeQuery", () => {
    let isVisibleStub,
      executeQueryStub,
      writeResultsViewStub,
      writeResultsConsoleStub,
      writeScratchpadResultStub: sinon.SinonStub;
    const connMangService = new ConnectionManagementService();
    const insightsConn = new InsightsConnection(
      insightsNode.label,
      insightsNode,
    );
    const localConn = new LocalConnection("localhost:5001", "server1");
    beforeEach(() => {
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      executeQueryStub = sinon.stub(connMangService, "executeQuery");
      writeResultsViewStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToView",
      );
      writeResultsConsoleStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToConsole",
      );
      writeScratchpadResultStub = sinon.stub(
        serverCommand,
        "writeScratchpadResult",
      );
    });
    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectedConnectionList.length = 0;
      ext.connectedContextStrings.length = 0;
      sinon.restore();
    });
    it("should fail if connLabel is empty and activeConnection is undefined", async () => {
      serverCommand.executeQuery(
        "SELECT * FROM table",
        "",
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
      sinon.assert.notCalled(writeResultsViewStub);
      sinon.assert.notCalled(writeScratchpadResultStub);
    });

    it("should proceed if connLabel is empty and activeConnection is not undefined", async () => {
      ext.activeConnection = localConn;
      ext.connectedConnectionList.push(localConn);
      ext.connectedContextStrings.push(localConn.connLabel);
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery(
        "SELECT * FROM table",
        "",
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
      sinon.assert.notCalled(writeScratchpadResultStub);
    });
    it("should fail if the connection selected is not connected", async () => {
      ext.connectedConnectionList.push(localConn);
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery(
        "SELECT * FROM table",
        localConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
      sinon.assert.notCalled(writeResultsViewStub);
      sinon.assert.notCalled(writeScratchpadResultStub);
    });
    it("should execute query and write results to view", async () => {
      ext.connectedConnectionList.push(localConn);
      ext.connectedContextStrings.push(localConn.connLabel);
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery(
        "SELECT * FROM table",
        localConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
      sinon.assert.notCalled(writeScratchpadResultStub);
    });
    it("should execute query and write results to console", async () => {
      ext.connectedConnectionList.push(localConn);
      ext.connectedContextStrings.push(localConn.connLabel);
      isVisibleStub.returns(false);
      executeQueryStub.resolves("dummy test");
      serverCommand.executeQuery(
        "SELECT * FROM table",
        localConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsViewStub);
      sinon.assert.notCalled(writeScratchpadResultStub);
    });
    it("should execute query and write error to console", async () => {
      ext.connectedConnectionList.push(insightsConn);
      ext.connectedContextStrings.push(insightsConn.connLabel);
      isVisibleStub.returns(true);
      executeQueryStub.resolves("dummy test");
      serverCommand.executeQuery(
        "SELECT * FROM table",
        insightsConn.connLabel,
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      sinon.assert.notCalled(writeResultsConsoleStub);
    });

    it("should get error", async () => {
      ext.activeConnection = localConn;
      ext.connectionNode = kdbNode;
      const res = await serverCommand.executeQuery(
        "",
        "testeConn",
        "testFile.kdb.q",
        ".",
        true,
        true,
      );
      assert.equal(res, undefined);
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

  describe("rerunQuery", function () {
    let executeQueryStub, runDataSourceStub: sinon.SinonStub;
    beforeEach(() => {
      runDataSourceStub = sinon
        .stub(dataSourceCommand, "runDataSource")
        .resolves();

      executeQueryStub = sinon.stub(serverCommand, "executeQuery").resolves();
    });
    this.afterEach(() => {
      sinon.restore();
    });
    it("should execute query for non-datasource query", async function () {
      const rerunQueryElement: QueryHistory = {
        executorName: "test",
        isDatasource: false,
        query: "SELECT * FROM table",
        language: "q",
        time: "",
        success: true,
        connectionName: "",
        connectionType: ServerType.KDB,
      };

      serverCommand.rerunQuery(rerunQueryElement);
      sinon.assert.notCalled(runDataSourceStub);
    });

    it("should run datasource for datasource query", async function () {
      const ds = createDefaultDataSourceFile();
      const rerunQueryElement: QueryHistory = {
        executorName: "test",
        isDatasource: true,
        datasourceType: DataSourceTypes.QSQL,
        query: ds,
        connectionName: "",
        connectionType: ServerType.INSIGHTS,
        time: "",
        success: false,
      };

      await serverCommand.rerunQuery(rerunQueryElement);

      sinon.assert.notCalled(executeQueryStub);
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
        dsUtils,
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
    let findStub: sinon.SinonStub;
    let disconnectStub: sinon.SinonStub;

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
      disconnectStub,
      getServersStub,
      getHashStub,
      getKeyStub,
      getInsightsStub,
      removeLocalConnectionContextStub,
      updateServersStub,
      refreshStub: sinon.SinonStub;

    beforeEach(() => {
      indexOfStub = sinon.stub(ext.connectedContextStrings, "indexOf");
      disconnectStub = sinon.stub(serverCommand, "disconnect");
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
    });

    afterEach(() => {
      ext.activeConnection = undefined;
      ext.connectionNode = undefined;
      sinon.restore();
      ext.connectedContextStrings.length = 0;
    });

    it("should remove connection and refresh server provider", async () => {
      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);

      assert.ok(
        removeLocalConnectionContextStub.calledWith(
          coreUtils.getServerName(kdbNode.details),
        ),
      );
      assert.ok(updateServersStub.calledOnce);
      assert.ok(refreshStub.calledOnce);
    });

    it("should remove connection, but disconnect it before", async () => {
      ext.connectedContextStrings.push(kdbNode.label);
      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getKeyStub.returns("testKey");

      await serverCommand.removeConnection(kdbNode);
      assert.ok(updateServersStub.calledOnce);
    });
    it("should remove connection Insights, but disconnect it before", async () => {
      ext.connectedContextStrings.push(insightsNode.label);
      indexOfStub.returns(1);
      getInsightsStub.returns({ testKey: {} });
      getHashStub.returns("testKey");

      await serverCommand.removeConnection(insightsNode);
      assert.ok(updateServersStub.notCalled);
    }).timeout(5000);
  });

  describe("connect", () => {
    const connService = new ConnectionManagementService();
    const _console = vscode.window.createOutputChannel("q Console Output");
    const executionConsole = new ExecutionConsole(_console);
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
      windowErrorStub.calledOnce;
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
      sandbox.spy(vscode.workspace, "registerTextDocumentContentProvider");
      sandbox.spy(vscode.workspace, "openTextDocument");
      sandbox.spy(vscode.window, "showTextDocument");
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
      sinon.assert.calledOnce(
        vscode.workspace.registerTextDocumentContentProvider as sinon.SinonSpy,
      );
      sinon.assert.calledOnce(
        vscode.workspace.openTextDocument as sinon.SinonSpy,
      );
      sinon.assert.calledOnce(vscode.window.showTextDocument as sinon.SinonSpy);
    });

    it("should not call some functions for invalid meta content", async () => {
      sinon.stub(connService, "retrieveMetaContent").returns("");
      await serverCommand.openMeta(node);
      sinon.assert.calledOnce(
        vscode.workspace.registerTextDocumentContentProvider as sinon.SinonSpy,
      );
      sinon.assert.notCalled(
        vscode.workspace.openTextDocument as sinon.SinonSpy,
      );
      sinon.assert.notCalled(vscode.window.showTextDocument as sinon.SinonSpy);
    });
  });

  describe("exportConnections", () => {
    let sandbox: sinon.SinonSandbox;
    let kdbOutputLogStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      kdbOutputLogStub = sinon.stub(coreUtils, "kdbOutputLog");
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
        "[EXPORT CONNECTIONS] No connections found to be exported",
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
        "[EXPORT CONNECTIONS] Save operation was cancelled by the user",
        "INFO",
      );

      exportConnectionStub.restore();
      showSaveDialogStub.restore();
      showQuickPickStub.restore();
    });
  });
});

describe("walkthroughCommand", () => {
  //write tests for src/commands/walkthroughCommand.ts
  //function to be deleted after write the tests
  walkthroughCommand.showInstallationDetails();
});

describe("workspaceCommand", () => {
  beforeEach(() => {
    sinon.stub(vscode.workspace, "getConfiguration").value(() => {
      return {
        get(key: string) {
          switch (key) {
            case "insightsEnterpriseConnections":
              return [{ alias: "connection1" }];
          }
          return {};
        },
        update() {},
      };
    });
  });
  afterEach(() => {
    sinon.restore();
  });
  describe("connectWorkspaceCommands", () => {
    it("should update views on delete and create", () => {
      let cb1, cb2, dsTree, wbTree;
      sinon.stub(vscode.workspace, "createFileSystemWatcher").value(() => ({
        onDidCreate: (cb) => (cb1 = cb),
        onDidDelete: (cb) => (cb2 = cb),
      }));
      ext.dataSourceTreeProvider = <WorkspaceTreeProvider>{
        reload() {
          dsTree = true;
        },
      };
      ext.scratchpadTreeProvider = <WorkspaceTreeProvider>{
        reload() {
          wbTree = true;
        },
      };
      workspaceCommand.connectWorkspaceCommands();
      cb1(vscode.Uri.file("test.kdb.json"));
      assert.strictEqual(dsTree, true);
      cb2(vscode.Uri.file("test.kdb.q"));
      assert.strictEqual(wbTree, true);
    });
  });
  describe("activateConnectionForServer", () => {
    it("should not activate connection", async () => {
      sinon.stub(ext, "serverProvider").value({
        getChildren() {
          return [];
        },
      });
      await assert.rejects(() =>
        workspaceCommand.activateConnectionForServer("test"),
      );
    });
  });
  describe("getInsightsServers", () => {
    it("should return insights server aliases as array", () => {
      const result = workspaceCommand.getInsightsServers();
      assert.strictEqual(result[0], "connection1");
    });
  });
  describe("setServerForUri", () => {
    it("should associate a server with an uri", async () => {
      await assert.doesNotReject(() =>
        workspaceCommand.setServerForUri(
          vscode.Uri.file("test.kdb.q"),
          "connection1",
        ),
      );
    });
  });
  describe("pickConnection", () => {
    it("should pick from available servers", async () => {
      sinon.stub(vscode.window, "showQuickPick").value(async () => "test");
      const result = await workspaceCommand.pickConnection(
        vscode.Uri.file("test.kdb.q"),
      );
      assert.strictEqual(result, "test");
    });
    it("should return undefined from (none)", async () => {
      sinon.stub(vscode.window, "showQuickPick").value(async () => "(none)");
      const result = await workspaceCommand.pickConnection(
        vscode.Uri.file("test.kdb.q"),
      );
      assert.strictEqual(result, undefined);
    });
  });
  describe("ConnectionLensProvider", () => {
    describe("provideCodeLenses", () => {
      it("should return lenses", async () => {
        const document = await vscode.workspace.openTextDocument({
          language: "q",
          content: "a:1",
        });
        const provider = new workspaceCommand.ConnectionLensProvider();
        const result = await provider.provideCodeLenses(document);
        assert.strictEqual(result.length, 2);
      });
    });
  });
  describe("checkOldDatasourceFiles", () => {
    let oldFilesExistsStub: sinon.SinonStub;

    beforeEach(() => {
      oldFilesExistsStub = sinon.stub(dataSourceUtils, "oldFilesExists");
    });
    afterEach(() => {
      oldFilesExistsStub.restore();
    });
    it("should check for old datasource files", async () => {
      oldFilesExistsStub.returns(true);
      await workspaceCommand.checkOldDatasourceFiles();
      sinon.assert.calledOnce(oldFilesExistsStub);
    });
  });
  describe("importOldDSFiles", () => {
    let windowErrorStub,
      windowWithProgressStub,
      windowShowInfo,
      workspaceFolderStub,
      tokenOnCancellationRequestedStub,
      kdbOutputLogStub: sinon.SinonStub;
    beforeEach(() => {
      windowErrorStub = sinon.stub(vscode.window, "showErrorMessage");
      windowWithProgressStub = sinon.stub(vscode.window, "withProgress");
      windowShowInfo = sinon.stub(vscode.window, "showInformationMessage");
      workspaceFolderStub = sinon.stub(vscode.workspace, "workspaceFolders");
      tokenOnCancellationRequestedStub = sinon.stub();
      windowWithProgressStub.callsFake((options, task) => {
        const token = {
          onCancellationRequested: tokenOnCancellationRequestedStub,
        };
        task({}, token);
      });

      kdbOutputLogStub = sinon.stub(coreUtils, "kdbOutputLog");
    });
    afterEach(() => {
      sinon.restore();
    });
    it("should show info message if old files do not exist", async () => {
      ext.oldDSformatExists = false;
      await workspaceCommand.importOldDSFiles();
      sinon.assert.calledOnce(windowShowInfo);
    });
    it("should show error message if workspace do not exist", async () => {
      ext.oldDSformatExists = true;
      await workspaceCommand.importOldDSFiles();
      sinon.assert.calledOnce(windowErrorStub);
    });
    it("should show not show error or info message if workspace do exist", async () => {
      ext.oldDSformatExists = true;
      workspaceFolderStub.get(() => [
        {
          uri: { fsPath: "path/to/workspace" },
          name: "workspace",
          index: 0,
        },
      ]);
      await workspaceCommand.importOldDSFiles();
      sinon.assert.notCalled(windowErrorStub);
      sinon.assert.notCalled(windowShowInfo);
    });

    it("should log cancellation if user cancels the request", async () => {
      ext.oldDSformatExists = true;
      workspaceFolderStub.get(() => [
        {
          uri: { fsPath: "path/to/workspace" },
          name: "workspace",
          index: 0,
        },
      ]);

      tokenOnCancellationRequestedStub.callsFake((callback) => callback());

      await workspaceCommand.importOldDSFiles();

      sinon.assert.calledOnce(kdbOutputLogStub);
      sinon.assert.calledWith(
        kdbOutputLogStub,
        "[DATASOURCE] User cancelled the old DS files import.",
        "INFO",
      );
    });
  });
});

describe("clientCommands", () => {
  const client = sinon.createStubInstance(LanguageClient);
  let executeBlock;
  let toggleParameterCache;

  beforeEach(() => {
    const context = <vscode.ExtensionContext>{ subscriptions: [] };
    sinon.stub(vscode.commands, "registerCommand").value((a, b) => b);
    clientCommand.connectClientCommands(context, client);
    executeBlock = context.subscriptions[0];
    toggleParameterCache = context.subscriptions[1];
    ext.activeTextEditor = <vscode.TextEditor>{
      options: { insertSpaces: true, indentSize: 4 },
      selection: { active: new vscode.Position(0, 0) },
      document: {
        uri: vscode.Uri.file("/tmp/some.q"),
        getText: () => "",
      },
    };
  });
  afterEach(() => {
    sinon.restore();
    ext.activeTextEditor = undefined;
  });
  describe("executeBlock", () => {
    it("should execute current block", async () => {
      sinon
        .stub(client, "sendRequest")
        .value(async () => new vscode.Range(0, 0, 1, 1));
      sinon.stub(workspaceCommand, "runActiveEditor").value(() => {});
      await executeBlock(client);
      assert.deepEqual(
        ext.activeTextEditor.selection,
        new vscode.Selection(0, 0, 1, 1),
      );
    });
  });
  describe("kdb.toggleParameterCache", () => {
    it("should add parameter cache for single line functions", async () => {
      let edit: vscode.WorkspaceEdit;
      sinon.stub(client, "sendRequest").value(async () => ({
        params: ["a"],
        start: new vscode.Position(0, 0),
        end: new vscode.Position(0, 10),
      }));
      sinon.stub(vscode.workspace, "applyEdit").value(async (a) => (edit = a));
      await toggleParameterCache(client);
      assert.strictEqual(edit.size, 1);
    });
    it("should add parameter cache for multi line functions", async () => {
      let edit: vscode.WorkspaceEdit;
      sinon.stub(client, "sendRequest").value(async () => ({
        params: ["a"],
        start: new vscode.Position(0, 0),
        end: new vscode.Position(1, 10),
      }));
      sinon.stub(vscode.workspace, "applyEdit").value(async (a) => (edit = a));
      await toggleParameterCache(client);
      assert.strictEqual(edit.size, 1);
    });
  });
});
