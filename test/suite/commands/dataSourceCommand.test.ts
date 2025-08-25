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
import * as executionCommand from "../../../src/commands/executionCommand";
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
import * as loggers from "../../../src/utils/loggers";
import * as queryUtils from "../../../src/utils/queryUtils";

describe("dataSourceCommand", () => {
  let dummyDataSourceFiles: DataSourceFiles;
  let _resultsPanel: KdbResultsViewProvider;
  ext.outputChannel = vscode.window.createOutputChannel("kdb");
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
      executeDataSourceQueryStub,
      handleExecuteDataQueryResultsStub: sinon.SinonStub;
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
      _handleWSResultsStub = sinon
        .stub(queryUtils, "handleWSResults")
        .returns("dummy results");
      _handleScratchpadTableRes = sinon
        .stub(queryUtils, "handleScratchpadTableRes")
        .returns("dummy results");
      executeDataSourceQueryStub = sinon.stub(
        executionCommand,
        "executeDataSourceQuery",
      );
      handleExecuteDataQueryResultsStub = sinon.stub(
        executionCommand,
        "handleExecuteDataQueryResults",
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
      executeDataSourceQueryStub.resolves(dummyError);

      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.calledOnce(handleExecuteDataQueryResultsStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return error for console panel", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = dummyMeta;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves(dummyError);

      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.calledOnce(handleExecuteDataQueryResultsStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return QSQL results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = dummyMeta;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = true;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.calledOnce(handleExecuteDataQueryResultsStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return API results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = dummyMeta;
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.calledOnce(handleExecuteDataQueryResultsStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return SQL results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = dummyMeta;
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.calledOnce(handleExecuteDataQueryResultsStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return UDA results", async () => {
      ext.connectedConnectionList.push(insightsConn);
      retrieveConnStub.resolves(insightsConn);
      insightsConn.meta = dummyMeta;
      dummyFileContent.dataSource.selectedType = DataSourceTypes.UDA;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "" });
      ext.isResultsTabVisible = false;
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.calledOnce(handleExecuteDataQueryResultsStub);

      ext.connectedConnectionList.length = 0;
    });

    it("should return error message QSQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.QSQL;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.notCalled(handleExecuteDataQueryResultsStub);
    });

    it("should return error message API", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.notCalled(handleExecuteDataQueryResultsStub);
    });

    it("should return error message SQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves({ arrayBuffer: ab, error: "error" });
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.notCalled(handleExecuteDataQueryResultsStub);
    });

    it("should return error message QSQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.QSQL;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.notCalled(handleExecuteDataQueryResultsStub);
    });

    it("should return error message API", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.API;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.notCalled(handleExecuteDataQueryResultsStub);
    });

    it("should return error message SQL", async () => {
      dummyFileContent.dataSource.selectedType = DataSourceTypes.SQL;
      getMetaStub.resolves(dummyMeta);
      executeDataSourceQueryStub.resolves(undefined);
      isVisibleStub.returns(false);
      await dataSourceCommand.runDataSource(
        dummyFileContent as DataSourceFiles,
        insightsConn.connLabel,
        "test-file.kdb.json",
      );
      sinon.assert.notCalled(handleExecuteDataQueryResultsStub);
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
