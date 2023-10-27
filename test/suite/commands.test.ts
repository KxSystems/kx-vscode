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
import mock from "mock-fs";
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as dataSourceCommand from "../../src/commands/dataSourceCommand";
import * as installTools from "../../src/commands/installTools";
import * as serverCommand from "../../src/commands/serverCommand";
import * as walkthroughCommand from "../../src/commands/walkthroughCommand";
import { ext } from "../../src/extensionVariables";
import {
  DataSourceFiles,
  DataSourceTypes,
  createDefaultDataSourceFile,
} from "../../src/models/dataSource";
import { ScratchpadResult } from "../../src/models/scratchpadResult";
import { KdbDataSourceTreeItem } from "../../src/services/dataSourceTreeProvider";
import { KdbTreeProvider } from "../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";
import * as coreUtils from "../../src/utils/core";
import * as dataSourceUtils from "../../src/utils/dataSource";
import { ExecutionConsole } from "../../src/utils/executionConsole";
import * as queryUtils from "../../src/utils/queryUtils";

describe("dataSourceCommand", () => {
  afterEach(() => {
    sinon.restore();
    mock.restore();
  });

  it("should add a data source", async () => {
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

  it("should rename a data source", async () => {
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

    await assert.doesNotReject(
      dataSourceCommand.renameDataSource("datasource-0", "datasource-1")
    );
  });

  it("should save a data source", async () => {
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

    const ds = createDefaultDataSourceFile();
    ds.name = "datasource-0";

    await assert.doesNotReject(dataSourceCommand.saveDataSource(ds));
  });

  it("should save a data source with a different name", async () => {
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

    const ds = createDefaultDataSourceFile();
    ds.name = "datasource-1";
    ds.originalName = "datasource-0";

    await assert.doesNotReject(dataSourceCommand.saveDataSource(ds));
  });

  it("should delete a data source", async () => {
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

    const item = new KdbDataSourceTreeItem(
      "datasource-0",
      vscode.TreeItemCollapsibleState.Collapsed,
      []
    );

    await assert.doesNotReject(dataSourceCommand.deleteDataSource(item));
  });
});

describe("dataSourceCommand2", () => {
  let dummyDataSourceFiles: DataSourceFiles;
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
        startTS: "",
        endTS: "",
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
        temporality: "snapshot",
      });
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
        startTS: "10:00",
        endTS: "11:00",
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
    let getApiBodyStub: sinon.SinonStub;
    let checkIfTimeParamIsCorrectStub: sinon.SinonStub;
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;

    beforeEach(() => {
      getApiBodyStub = sinon.stub(dataSourceCommand, "getApiBody");
      checkIfTimeParamIsCorrectStub = sinon.stub(
        dataSourceUtils,
        "checkIfTimeParamIsCorrect"
      );
      getDataInsightsStub = sinon.stub(serverCommand, "getDataInsights");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should show an error message if the time parameters are incorrect", async () => {
      const windowMock = sinon.mock(vscode.window);
      checkIfTimeParamIsCorrectStub.returns(false);

      await dataSourceCommand.runApiDataSource(dummyDataSourceFiles);
      windowMock
        .expects("showErrorMessage")
        .once()
        .withArgs(
          "The time parameters(startTS and endTS) are not correct, please check the format or if the startTS is before the endTS"
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

      const result = await dataSourceCommand.runApiDataSource(
        dummyDataSourceFiles
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
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;

    beforeEach(() => {
      getDataInsightsStub = sinon.stub(serverCommand, "getDataInsights");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
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

      const result = await dataSourceCommand.runQsqlDataSource(
        dummyDataSourceFiles
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
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;

    beforeEach(() => {
      getDataInsightsStub = sinon.stub(serverCommand, "getDataInsights");
      handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
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

      const result = await dataSourceCommand.runSqlDataSource(
        dummyDataSourceFiles
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
    const dummyMeta = {
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
      dap: [
        {
          assembly: "dummy-assembly",
          instance: "idb",
          startTS: "2023-10-25T01:40:03.000000000",
          endTS: "2023-10-25T14:00:03.000000000",
        },
      ],
      api: [
        {
          api: ".kxi.getData",
          kxname: ["dummy-assembly"],
          aggFn: ".sgagg.getData",
          custom: false,
          full: true,
          metadata: {
            description: "dummy desc.",
            params: [
              {
                name: "table",
                type: -11,
                isReq: true,
                description: "dummy desc.",
              },
            ],
            return: {
              type: 0,
              description: "dummy desc.",
            },
            misc: { safe: true },
            aggReturn: {
              type: 98,
              description: "dummy desc.",
            },
          },
          procs: [],
        },
      ],
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
      schema: [
        {
          table: "dummyTbl",
          assembly: ["dummy-assembly"],
          typ: "partitioned",
          pkCols: [],
          prtnCol: "srcTime",
          sortColsMem: [],
          sortColsIDisk: [],
          sortColsDisk: [],
          isSplayed: true,
          isPartitioned: true,
          isSharded: false,
          columns: [
            {
              column: "sym",
              typ: 10,
              description: "dummy desc.",
              oldName: "",
              attrMem: "",
              attrIDisk: "",
              attrDisk: "",
              isSerialized: false,
              foreign: "",
              anymap: false,
              backfill: "",
            },
          ],
        },
      ],
    };
    const dummyFileContent = {
      name: "dummy-DS",
      dataSource: {
        selectedType: "QSQL",
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
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
    let isVisibleStub: sinon.SinonStub;
    let getMetaStub: sinon.SinonStub;
    let convertDSFormToDSFile: sinon.SinonStub;
    let getSelectedTypeStub: sinon.SinonStub;
    let runApiDataSourceStub: sinon.SinonStub;
    let runQsqlDataSourceStub: sinon.SinonStub;
    let runSqlDataSourceStub: sinon.SinonStub;
    let writeQueryResultsToViewStub: sinon.SinonStub;
    let writeQueryResultsToConsoleStub: sinon.SinonStub;
    const appendLineSpy = sinon.spy(ext.outputChannel, "appendLine");
    // const windowErrorSpy = sinon.spy(vscode.window, "showErrorMessage");
    ext.outputChannel = vscode.window.createOutputChannel("kdb");

    beforeEach(() => {
      getMetaStub = sinon.stub(serverCommand, "getMeta");
      convertDSFormToDSFile = sinon.stub(
        dataSourceUtils,
        "convertDataSourceFormToDataSourceFile"
      );
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      getSelectedTypeStub = sinon.stub(dataSourceCommand, "getSelectedType");
      runApiDataSourceStub = sinon.stub(dataSourceCommand, "runApiDataSource");
      runQsqlDataSourceStub = sinon.stub(
        dataSourceCommand,
        "runQsqlDataSource"
      );
      runSqlDataSourceStub = sinon.stub(dataSourceCommand, "runSqlDataSource");
      writeQueryResultsToViewStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToView"
      );
      writeQueryResultsToConsoleStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToConsole"
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should show an error message if not connected to an Insights server", async () => {
      getMetaStub.resolves({});
      await dataSourceCommand.runDataSource({} as DataSourceFiles);
      sinon.assert.notCalled(convertDSFormToDSFile);
    });

    it("should return QSQL results)", async () => {
      getMetaStub.resolves(dummyMeta);
      convertDSFormToDSFile.returns(dummyFileContent);
      getSelectedTypeStub.returns("QSQL");
      runQsqlDataSourceStub.resolves("dummy results");
      isVisibleStub.returns(true);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles
      );
      sinon.assert.calledOnce(writeQueryResultsToViewStub);
    });

    it("should return API results)", async () => {
      dummyFileContent.dataSource.selectedType = "API";
      getMetaStub.resolves(dummyMeta);
      convertDSFormToDSFile.returns(dummyFileContent);
      getSelectedTypeStub.returns("API");
      runApiDataSourceStub.resolves("dummy results");
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles
      );
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);
    });

    it("should return SQL results)", async () => {
      dummyFileContent.dataSource.selectedType = "SQL";
      getMetaStub.resolves(dummyMeta);
      convertDSFormToDSFile.returns(dummyFileContent);
      getSelectedTypeStub.returns("SQL");
      runSqlDataSourceStub.resolves("dummy results");
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles
      );
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);
    });
  });
});

describe("installTools", () => {
  //write tests for src/commands/installTools.ts
  //function to be deleted after write the tests
  installTools.installTools();
});
describe("serverCommand", () => {
  describe("writeQueryResultsToView", () => {
    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const dataSourceType = "test";
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(result, dataSourceType);

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb-results.focus"
      );
      sinon.assert.calledWith(
        executeCommandStub.secondCall,
        "kdb.resultsPanel.update",
        result,
        dataSourceType
      );

      executeCommandStub.restore();
    });

    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(result);

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        undefined
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
        "Cancel"
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
        "Cancel"
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
        "appendQueryError"
      );
      writeQueryResultsToViewStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToView"
      );
      writeQueryResultsToConsoleStub = sinon.stub(
        serverCommand,
        "writeQueryResultsToConsole"
      );
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should write appendQueryError", () => {
      scratchpadResult.error = true;
      scratchpadResult.errorMsg = "error";
      serverCommand.writeScratchpadResult(scratchpadResult, "dummy query");
      sinon.assert.notCalled(writeQueryResultsToViewStub);
      sinon.assert.notCalled(writeQueryResultsToConsoleStub);
    });

    it("should write to view", () => {
      scratchpadResult.data = "data";
      isVisibleStub.returns(true);
      serverCommand.writeScratchpadResult(scratchpadResult, "dummy query");
      sinon.assert.notCalled(writeQueryResultsToConsoleStub);
      sinon.assert.notCalled(queryConsoleErrorStub);
    });

    it("should write to console", () => {
      scratchpadResult.data = "data";
      isVisibleStub.returns(false);
      serverCommand.writeScratchpadResult(scratchpadResult, "dummy query");
      sinon.assert.notCalled(writeQueryResultsToViewStub);
    });
  });
});

describe("walkthroughCommand", () => {
  //write tests for src/commands/walkthroughCommand.ts
  //function to be deleted after write the tests
  walkthroughCommand.showInstallationDetails();
});
