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
import axios from "axios";
import mock from "mock-fs";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { QuickPickItem, TreeItemCollapsibleState, window } from "vscode";
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
import { InsightDetails } from "../../src/models/insights";
import { ScratchpadResult } from "../../src/models/scratchpadResult";
import { KdbDataSourceTreeItem } from "../../src/services/dataSourceTreeProvider";
import * as codeFlowLogin from "../../src/services/kdbInsights/codeFlowLogin";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
} from "../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";
import * as coreUtils from "../../src/utils/core";
import * as dataSourceUtils from "../../src/utils/dataSource";
import { ExecutionConsole } from "../../src/utils/executionConsole";
import * as queryUtils from "../../src/utils/queryUtils";
import { QueryHistory } from "../../src/models/queryHistory";
import { ServerDetails, ServerType } from "../../src/models/server";
import { NewConnectionPannel } from "../../src/panels/newConnection";
import { MAX_STR_LEN } from "../../src/validators/kdbValidator";
import { LocalConnection } from "../../src/classes/localConnection";
import { ConnectionManagementService } from "../../src/services/connectionManagerService";
import { InsightsConnection } from "../../src/classes/insightsConnection";

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
      dataSourceCommand.renameDataSource("datasource-0", "datasource-1"),
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
      [],
    );

    await assert.doesNotReject(dataSourceCommand.deleteDataSource(item));
  });

  it("should open a data source", async () => {
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
      [],
    );

    const uri = vscode.Uri.file("/temp/.kdb-datasources/datasource-0.ds");

    await assert.doesNotReject(dataSourceCommand.openDataSource(item, uri));
  });

  it("should open datasource", async () => {
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    ext.activeConnection = new InsightsConnection(
      insightsNode.label,
      insightsNode,
    );

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
      [],
    );

    const uri = vscode.Uri.file("/temp/.kdb-datasources/datasource-0.ds");

    await assert.doesNotReject(dataSourceCommand.openDataSource(item, uri));
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
    let getApiBodyStub: sinon.SinonStub;
    let checkIfTimeParamIsCorrectStub: sinon.SinonStub;
    let getDataInsightsStub: sinon.SinonStub;
    let handleWSResultsStub: sinon.SinonStub;
    let handleScratchpadTableRes: sinon.SinonStub;
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    beforeEach(() => {
      ext.activeConnection = new InsightsConnection(
        insightsNode.label,
        insightsNode,
      );
      getApiBodyStub = sinon.stub(dataSourceCommand, "getApiBody");
      checkIfTimeParamIsCorrectStub = sinon.stub(
        dataSourceUtils,
        "checkIfTimeParamIsCorrect",
      );
      getDataInsightsStub = sinon.stub(ext.activeConnection, "getDataInsights");
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

      await dataSourceCommand.runApiDataSource(dummyDataSourceFiles);
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

      const result =
        await dataSourceCommand.runApiDataSource(dummyDataSourceFiles);

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
    let handleScratchpadTableRes: sinon.SinonStub;
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    beforeEach(() => {
      ext.activeConnection = new InsightsConnection(
        insightsNode.label,
        insightsNode,
      );
      getDataInsightsStub = sinon.stub(ext.activeConnection, "getDataInsights");
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

      const result =
        await dataSourceCommand.runQsqlDataSource(dummyDataSourceFiles);

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
    let handleScratchpadTableRes: sinon.SinonStub;
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    beforeEach(() => {
      ext.activeConnection = new InsightsConnection(
        insightsNode.label,
        insightsNode,
      );
      getDataInsightsStub = sinon.stub(ext.activeConnection, "getDataInsights");
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

      const result =
        await dataSourceCommand.runSqlDataSource(dummyDataSourceFiles);

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
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    const ab = new ArrayBuffer(26);
    ext.resultsViewProvider = new KdbResultsViewProvider(uriTest);
    let isVisibleStub,
      getMetaStub,
      handleWSResultsStub,
      handleScratchpadTableRes,
      getDataInsightsStub,
      writeQueryResultsToViewStub,
      writeQueryResultsToConsoleStub: sinon.SinonStub;
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    ext.outputChannel = vscode.window.createOutputChannel("kdb");

    beforeEach(() => {
      ext.activeConnection = new InsightsConnection(
        insightsNode.label,
        insightsNode,
      );
      getMetaStub = sinon.stub(ext.activeConnection, "getMeta");
      isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
      handleWSResultsStub = sinon
        .stub(queryUtils, "handleWSResults")
        .returns("dummy results");
      handleScratchpadTableRes = sinon
        .stub(queryUtils, "handleScratchpadTableRes")
        .returns("dummy results");
      getDataInsightsStub = sinon.stub(ext.activeConnection, "getDataInsights");
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
      ext.activeConnection = undefined;
      sinon.restore();
    });

    it("should show an error message if not connected to an Insights server", async () => {
      getMetaStub.resolves({});
      await dataSourceCommand.runDataSource({} as DataSourceFiles);
      sinon.assert.notCalled(isVisibleStub);
    });

    it("should return QSQL results", async () => {
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      isVisibleStub.returns(true);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
      );
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
      sinon.assert.calledOnce(writeQueryResultsToViewStub);
    });

    it("should return API results", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);
    });

    it("should return SQL results", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.calledOnce(writeQueryResultsToConsoleStub);
    });

    it("should return error message QSQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.QSQL;
      getMetaStub.resolves(dummyMeta);
      getDataInsightsStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
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
      );
      sinon.assert.neverCalledWith(writeQueryResultsToViewStub);
      sinon.assert.neverCalledWith(writeQueryResultsToConsoleStub);
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
    TreeItemCollapsibleState.None,
  );

  const kdbNode = new KdbNode(
    ["child1"],
    "testElement",
    servers["testServer"],
    TreeItemCollapsibleState.None,
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

  it("should call the New Connection Panel Renderer", () => {
    const newConnectionPanelStub = sinon.stub(NewConnectionPannel, "render");

    serverCommand.addNewConnection();
    sinon.assert.calledOnce(newConnectionPanelStub);
    sinon.restore();
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
      await serverCommand.addInsightsConnection(insightsData);
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
    it("should add connection where alias is not provided", async () => {
      insightsData.alias = "";
      getInsightsStub.returns({});
      await serverCommand.addInsightsConnection(insightsData);
      sinon.assert.calledOnce(updateInsightsStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Insights connection added successfully");
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
      await serverCommand.addKdbConnection(kdbData);
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
    it("should add connection where alias is not provided", async () => {
      kdbData.serverAlias = "";
      getServersStub.returns({});
      await serverCommand.addKdbConnection(kdbData);
      sinon.assert.calledOnce(updateServersStub);
      windowMock
        .expects("showInformationMessage")
        .once()
        .withArgs("Kdb connection added successfully");
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

  describe("writeQueryResultsToView", () => {
    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(result, "");

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        undefined,
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
        "123",
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
        "123",
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
        "123",
      );
      sinon.assert.notCalled(writeQueryResultsToViewStub);
    });
  });

  // describe("importScratchpad", () => {
  //   ext.outputChannel = vscode.window.createOutputChannel("kdb");
  //   const insightsNode = new InsightsNode(
  //     [],
  //     "insightsnode1",
  //     {
  //       server: "https://insightsservername.com/",
  //       alias: "insightsserveralias",
  //       auth: true,
  //     },
  //     TreeItemCollapsibleState.None,
  //   );

  //   const token: codeFlowLogin.IToken = {
  //     accessToken:
  //       "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Imk2bEdrM0ZaenhSY1ViMkMzbkVRN3N5SEpsWSJ9.eyJhdWQiOiI2ZTc0MTcyYi1iZTU2LTQ4NDMtOWZmNC1lNjZhMzliYjEyZTMiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3L3YyLjAiLCJpYXQiOjE1MzcyMzEwNDgsIm5iZiI6MTUzNzIzMTA0OCwiZXhwIjoxNTM3MjM0OTQ4LCJhaW8iOiJBWFFBaS84SUFBQUF0QWFaTG8zQ2hNaWY2S09udHRSQjdlQnE0L0RjY1F6amNKR3hQWXkvQzNqRGFOR3hYZDZ3TklJVkdSZ2hOUm53SjFsT2NBbk5aY2p2a295ckZ4Q3R0djMzMTQwUmlvT0ZKNGJDQ0dWdW9DYWcxdU9UVDIyMjIyZ0h3TFBZUS91Zjc5UVgrMEtJaWpkcm1wNjlSY3R6bVE9PSIsImF6cCI6IjZlNzQxNzJiLWJlNTYtNDg0My05ZmY0LWU2NmEzOWJiMTJlMyIsImF6cGFjciI6IjAiLCJuYW1lIjoiQWJlIExpbmNvbG4iLCJvaWQiOiI2OTAyMjJiZS1mZjFhLTRkNTYtYWJkMS03ZTRmN2QzOGU0NzQiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJhYmVsaUBtaWNyb3NvZnQuY29tIiwicmgiOiJJIiwic2NwIjoiYWNjZXNzX2FzX3VzZXIiLCJzdWIiOiJIS1pwZmFIeVdhZGVPb3VZbGl0anJJLUtmZlRtMjIyWDVyclYzeERxZktRIiwidGlkIjoiNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3IiwidXRpIjoiZnFpQnFYTFBqMGVRYTgyUy1JWUZBQSIsInZlciI6IjIuMCJ9.pj4N-w_3Us9DrBLfpCt",
  //     refreshToken:
  //       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTY4ODUwMjJ9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ",
  //     accessTokenExpirationDate: new Date(),
  //   };

  //   const params: DataSourceFiles = {
  //     name: "dummy ds",
  //     insightsNode: "dummy insights",
  //     dataSource: {
  //       selectedType: DataSourceTypes.API,
  //       api: {
  //         selectedApi: "getData",
  //         table: "dummy_table",
  //         startTS: "2023-09-10T09:30",
  //         endTS: "2023-09-19T12:30",
  //         fill: "",
  //         filter: [],
  //         groupBy: [],
  //         labels: [],
  //         slice: [],
  //         sortCols: [],
  //         temporality: "",
  //         agg: [],
  //       },
  //       qsql: {
  //         selectedTarget: "dummy_table rdb",
  //         query: "dummy QSQL query",
  //       },
  //       sql: {
  //         query: "dummy SQL query",
  //       },
  //     },
  //   };

  //   afterEach(() => {
  //     sinon.restore();
  //   });
  //   it("should return undefined if ext.connectionNode is not an InsightsNode", async () => {
  //     // Mock ext.connectionNode to not be an InsightsNode
  //     ext.connectionNode = undefined;

  //     const variableName = "testVariable";

  //     const result = await serverCommand.importScratchpad(variableName, params);
  //     assert.equal(result, undefined);
  //   });

  //   it("should return undefined if token is undefined", async () => {
  //     // Mock ext.connectionNode to be an InsightsNode
  //     ext.connectionNode = insightsNode;

  //     // Mock getCurrentToken to return undefined
  //     sinon.stub(codeFlowLogin, "getCurrentToken").resolves(undefined);

  //     const variableName = "testVariable";

  //     const result = await serverCommand.importScratchpad(variableName, params);
  //     assert.equal(result, undefined);
  //   });

  //   it("should return undefined if token is undefined", async () => {
  //     // Mock ext.connectionNode to be an InsightsNode
  //     ext.connectionNode = insightsNode;

  //     // Mock getCurrentToken to return undefined
  //     sinon.stub(codeFlowLogin, "getCurrentToken").resolves(undefined);

  //     const variableName = "testVariable";

  //     const result = await serverCommand.importScratchpad(variableName, params);
  //     assert.equal(result, undefined);
  //   });

  //   it("should reach the axios call", async () => {
  //     // Mock ext.connectionNode to be an InsightsNode
  //     ext.connectionNode = insightsNode;
  //     sinon.stub(codeFlowLogin, "getCurrentToken").resolves(token);
  //     const axiosPostStub = sinon
  //       .stub(axios, "post")
  //       .resolves({ data: { success: true } });
  //     const variableName = "testVariable";
  //     await serverCommand.importScratchpad(variableName, params);
  //     sinon.assert.calledOnce(axiosPostStub);
  //   });
  // });

  // describe("getScratchpadQuery", () => {
  //   let axiosPostStub: sinon.SinonStub;
  //   let getTokenStub: sinon.SinonStub;
  //   let isVisibleStub: sinon.SinonStub;
  //   let handleWSResultsStub: sinon.SinonStub;
  //   let handleScratchpadTableResStub: sinon.SinonStub;
  //   const dummyTableViewDataRes = [
  //     "01",
  //     "00",
  //     "00",
  //     "00",
  //     "2b",
  //     "00",
  //     "00",
  //     "00",
  //     "62",
  //     "00",
  //     "63",
  //     "0b",
  //     "00",
  //     "01",
  //     "00",
  //     "00",
  //     "00",
  //     "56",
  //     "61",
  //     "6c",
  //     "75",
  //     "65",
  //     "00",
  //     "00",
  //     "00",
  //     "01",
  //     "00",
  //     "00",
  //     "00",
  //     "07",
  //     "00",
  //     "01",
  //     "00",
  //     "00",
  //     "00",
  //     "0a",
  //     "00",
  //     "00",
  //     "00",
  //     "00",
  //     "00",
  //     "00",
  //     "00",
  //   ];
  //   const insightsNode = new InsightsNode(
  //     [],
  //     "insightsnode1",
  //     {
  //       server: "https://insightsservername.com/",
  //       alias: "insightsserveralias",
  //       auth: true,
  //     },
  //     TreeItemCollapsibleState.None,
  //   );
  //   const token: codeFlowLogin.IToken = {
  //     accessToken:
  //       "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6Imk2bEdrM0ZaenhSY1ViMkMzbkVRN3N5SEpsWSJ9.eyJhdWQiOiI2ZTc0MTcyYi1iZTU2LTQ4NDMtOWZmNC1lNjZhMzliYjEyZTMiLCJpc3MiOiJodHRwczovL2xvZ2luLm1pY3Jvc29mdG9ubGluZS5jb20vNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3L3YyLjAiLCJpYXQiOjE1MzcyMzEwNDgsIm5iZiI6MTUzNzIzMTA0OCwiZXhwIjoxNTM3MjM0OTQ4LCJhaW8iOiJBWFFBaS84SUFBQUF0QWFaTG8zQ2hNaWY2S09udHRSQjdlQnE0L0RjY1F6amNKR3hQWXkvQzNqRGFOR3hYZDZ3TklJVkdSZ2hOUm53SjFsT2NBbk5aY2p2a295ckZ4Q3R0djMzMTQwUmlvT0ZKNGJDQ0dWdW9DYWcxdU9UVDIyMjIyZ0h3TFBZUS91Zjc5UVgrMEtJaWpkcm1wNjlSY3R6bVE9PSIsImF6cCI6IjZlNzQxNzJiLWJlNTYtNDg0My05ZmY0LWU2NmEzOWJiMTJlMyIsImF6cGFjciI6IjAiLCJuYW1lIjoiQWJlIExpbmNvbG4iLCJvaWQiOiI2OTAyMjJiZS1mZjFhLTRkNTYtYWJkMS03ZTRmN2QzOGU0NzQiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJhYmVsaUBtaWNyb3NvZnQuY29tIiwicmgiOiJJIiwic2NwIjoiYWNjZXNzX2FzX3VzZXIiLCJzdWIiOiJIS1pwZmFIeVdhZGVPb3VZbGl0anJJLUtmZlRtMjIyWDVyclYzeERxZktRIiwidGlkIjoiNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3IiwidXRpIjoiZnFpQnFYTFBqMGVRYTgyUy1JWUZBQSIsInZlciI6IjIuMCJ9.pj4N-w_3Us9DrBLfpCt",
  //     refreshToken:
  //       "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTY4ODUwMjJ9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ",
  //     accessTokenExpirationDate: new Date(),
  //   };

  //   beforeEach(() => {
  //     ext.connectionNode = insightsNode;
  //     ext.activeConnection = new InsightsConnection(insightsNode.label, insightsNode)
  //     axiosPostStub = sinon.stub(axios, "post");
  //     getTokenStub = sinon.stub(codeFlowLogin, "getCurrentToken");
  //     isVisibleStub = sinon.stub(ext.resultsViewProvider, "isVisible");
  //     handleWSResultsStub = sinon.stub(queryUtils, "handleWSResults");
  //     handleScratchpadTableResStub = sinon.stub(
  //       queryUtils,
  //       "handleScratchpadTableRes",
  //     );
  //   });

  //   afterEach(() => {
  //     ext.activeConnection = undefined;
  //     ext.connectionNode = undefined;
  //     axiosPostStub.restore();
  //     getTokenStub.restore();
  //     isVisibleStub.restore();
  //     handleWSResultsStub.restore();
  //     handleScratchpadTableResStub.restore();
  //   });

  //   it("should return the response from axios", async () => {
  //     const query = "SELECT * FROM table";
  //     const context = "context";

  //     const mockedResponse = { data: { data: dummyTableViewDataRes } };
  //     axiosPostStub.resolves(mockedResponse);
  //     getTokenStub.resolves(token);
  //     isVisibleStub.returns(true);
  //     handleWSResultsStub.returns("10");
  //     handleScratchpadTableResStub.returns("10");

  //     const response = await ext.activeConnection.getScratchpadQuery(query, context);

  //     assert.equal(response.data, "10");
  //     sinon.assert.calledOnce(axiosPostStub);
  //     sinon.assert.calledOnce(handleWSResultsStub);
  //     sinon.assert.calledOnce(handleScratchpadTableResStub);
  //   });

  //   it("should return undefined if token is undefined", async () => {
  //     const query = "SELECT * FROM table";
  //     const context = "context";

  //     const expectedToken = undefined;
  //     getTokenStub.resolves(expectedToken);

  //     const response = await serverCommand.getScratchpadQuery(query, context);

  //     assert.equal(response, undefined);
  //     sinon.assert.notCalled(axiosPostStub);
  //   });
  // });

  describe("runQuery", () => {
    const editor = {
      selection: {
        isEmpty: false,
        active: { line: 5 },
        end: sinon.stub().returns({ line: 10 }),
      },
      document: {
        lineAt: sinon.stub().returns({ text: "SELECT * FROM table" }),
        getText: sinon.stub().returns("SELECT * FROM table"),
      },
    };

    let getQueryContextStub,
      activeTextEditorStub,
      executeQueryStub: sinon.SinonStub;

    beforeEach(() => {
      activeTextEditorStub = sinon
        .stub(vscode.window, "activeTextEditor")
        .value(editor);
      getQueryContextStub = sinon
        .stub(serverCommand, "getQueryContext")
        .returns(".");
      executeQueryStub = sinon
        .stub(serverCommand, "executeQuery")
        .resolves(undefined);
      ext.kdbinsightsNodes.push("insightsserveralias (connected)");
    });

    afterEach(() => {
      activeTextEditorStub.restore();
      getQueryContextStub.restore();
      executeQueryStub.restore();
      ext.kdbinsightsNodes.pop();
    });

    it("runQuery with undefined editor ", () => {
      activeTextEditorStub.value(undefined);
      const result = serverCommand.runQuery(ExecutionTypes.PythonQueryFile);
      assert.equal(result, false);
    });

    it("runQuery with QuerySelection", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(ExecutionTypes.QuerySelection);
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile not connected to inisghts node", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQuerySelection,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile connected to inisghts node", () => {
      ext.connectionNode = insightsNode;
      const result = serverCommand.runQuery(
        ExecutionTypes.PythonQuerySelection,
      );
      assert.equal(result, undefined);
    });

    it("runQuery with QueryFile", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(ExecutionTypes.QueryFile);
      assert.equal(result, undefined);
    });

    it("runQuery with ReRunQuery", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(
        ExecutionTypes.ReRunQuery,
        "rerun query",
      );
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile", () => {
      ext.connectionNode = undefined;
      const result = serverCommand.runQuery(ExecutionTypes.PythonQueryFile);
      assert.equal(result, undefined);
    });

    it("runQuery with PythonQueryFile", () => {
      ext.connectionNode = insightsNode;
      const result = serverCommand.runQuery(ExecutionTypes.PythonQueryFile);
      assert.equal(result, undefined);
    });
  });

  describe("executeQuery", () => {
    let isVisibleStub,
      executeQueryStub,
      writeResultsViewStub,
      writeResultsConsoleStub: sinon.SinonStub;
    const connMangService = new ConnectionManagementService();
    beforeEach(() => {
      ext.activeConnection = new LocalConnection("localhost:5001", "server1");
      ext.connectionNode = kdbNode;
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
    });
    afterEach(() => {
      ext.activeConnection = undefined;
      sinon.restore();
    });
    it("should execute query and write results to view", async () => {
      isVisibleStub.returns(true);
      executeQueryStub.resolves({ data: "data" });
      serverCommand.executeQuery("SELECT * FROM table");
      sinon.assert.notCalled(writeResultsConsoleStub);
    });
    it("should execute query and write results to console", async () => {
      isVisibleStub.returns(false);
      executeQueryStub.resolves("dummy test");
      serverCommand.executeQuery("SELECT * FROM table");
      sinon.assert.notCalled(writeResultsViewStub);
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
      removeLocalConnectionContextStub = sinon.stub(
        coreUtils,
        "removeLocalConnectionContext",
      );
      updateServersStub = sinon.stub(coreUtils, "updateServers");
      refreshStub = sinon.stub(ext.serverProvider, "refresh");
    });

    afterEach(() => {
      sinon.restore();
      ext.connectedContextStrings.length = 0;
    });

    it("should remove connection and refresh server provider", async () => {
      indexOfStub.returns(1);
      getServersStub.returns({ testKey: {} });
      getHashStub.returns("testKey");

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
      getHashStub.returns("testKey");

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
    });
  });
});

describe("walkthroughCommand", () => {
  //write tests for src/commands/walkthroughCommand.ts
  //function to be deleted after write the tests
  walkthroughCommand.showInstallationDetails();
});
