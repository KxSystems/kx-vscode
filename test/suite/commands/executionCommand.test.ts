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
import rewire from "rewire";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { InsightsConnection } from "../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../src/classes/localConnection";
import * as workspaceCommand from "../../../src/commands/workspaceCommand";
import { ext } from "../../../src/extensionVariables";
import {
  createDefaultDataSourceFile,
  DataSourceTypes,
} from "../../../src/models/dataSource";
import { ExecutionTypes } from "../../../src/models/execution";
import { CellKind } from "../../../src/models/notebook";
import { InsightsNode } from "../../../src/services/kdbTreeProvider";
import * as coreUtils from "../../../src/utils/core";
import * as executionUtils from "../../../src/utils/execution";
import * as notifications from "../../../src/utils/notifications";
import * as notebookTestUtils from "../services/notebook/notebookTest.utils.test";

describe("executionCommand", () => {
  let executionCommand: any;

  const dummyDS = createDefaultDataSourceFile();

  dummyDS.dataSource.api.selectedApi = "sampleApi";
  dummyDS.dataSource.api.table = "sampleTable";
  dummyDS.dataSource.api.startTS = "2023.01.01D00:00:00.000000000";
  dummyDS.dataSource.api.endTS = "2023.01.31D23:59:59.999999999";
  dummyDS.dataSource.qsql.selectedTarget = "sampleTarget";
  dummyDS.dataSource.qsql.query = "select from sampleTable";
  dummyDS.dataSource.sql.query = "select * from sampleTable";
  dummyDS.dataSource.uda = {
    name: "sampleUDA",
    description: "sample UDA",
    params: [
      {
        name: "param1",
        description: "sample param",
        isReq: true,
        type: 1,
        value: "sample value",
      },
    ],
    return: { type: [], description: "" },
  };
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

  beforeEach(() => {
    executionCommand = rewire("../../../src/commands/executionCommand");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("executeNotebookQuery", () => {
    let prepareToPopulateScratchpadStub: sinon.SinonStub;
    let executeDataQueryStub: sinon.SinonStub;
    let executeQueryStub: sinon.SinonStub;

    beforeEach(() => {
      prepareToPopulateScratchpadStub = sinon
        .stub()
        .resolves("mocked-prepare-result");
      executeDataQueryStub = sinon
        .stub()
        .resolves("mocked-execute-data-result");
      executeQueryStub = sinon.stub().resolves("mocked-execute-query-result");

      executionCommand.__set__(
        "prepareToPopulateScratchpad",
        prepareToPopulateScratchpadStub,
      );
      executionCommand.__set__("executeDataQuery", executeDataQueryStub);
      executionCommand.__set__("executeQuery", executeQueryStub);
    });

    afterEach(() => {
      sinon.restore();
      executionCommand = undefined;
    });

    it("should prepare to populate scratchpad when variable is provided for SQL cell", async () => {
      const mockCell = notebookTestUtils.createCell("sql", {
        target: "target",
        variable: "variable",
      });
      const result = await executionCommand.executeNotebookQuery(
        "connSample",
        mockCell,
        CellKind.SQL,
        "target",
        "var",
      );

      assert.strictEqual(result, "mocked-prepare-result");
      assert.ok(prepareToPopulateScratchpadStub.calledOnce);
      assert.ok(executeDataQueryStub.notCalled);
      assert.ok(executeQueryStub.notCalled);

      assert.ok(
        prepareToPopulateScratchpadStub.calledWith(
          "connSample",
          sinon.match.any,
          "target",
          "var",
          sinon.match.any,
        ),
      );
    });

    it("should execute data query when no variable is provided for SQL cell", async () => {
      const mockCell = notebookTestUtils.createCell("sql", {
        target: "target",
      });
      const result = await executionCommand.executeNotebookQuery(
        "connSample",
        mockCell,
        CellKind.SQL,
        "target",
        undefined,
      );

      assert.strictEqual(result, "mocked-execute-data-result");
      assert.ok(executeDataQueryStub.calledOnce);
      assert.ok(prepareToPopulateScratchpadStub.notCalled);
      assert.ok(executeQueryStub.notCalled);
    });

    it("should prepare to populate scratchpad when variable and target are provided for non-SQL cell", async () => {
      const mockCell = notebookTestUtils.createCell("q", {
        target: "target",
        variable: "variable",
      });
      const result = await executionCommand.executeNotebookQuery(
        "connSample",
        mockCell,
        CellKind.Q,
        "target",
        "var",
      );

      assert.strictEqual(result, "mocked-prepare-result");
      assert.ok(prepareToPopulateScratchpadStub.calledOnce);
      assert.ok(executeDataQueryStub.notCalled);
      assert.ok(executeQueryStub.notCalled);

      assert.ok(
        prepareToPopulateScratchpadStub.calledWith(
          "connSample",
          sinon.match.any,
          "target",
          "var",
          sinon.match.any,
        ),
      );
    });

    it("should execute query when no target is provided and kind is not SQL", async () => {
      const mockCell = notebookTestUtils.createCell("q", {});
      const result = await executionCommand.executeNotebookQuery(
        "connSample",
        mockCell,
        CellKind.Q,
        undefined,
        undefined,
      );

      assert.strictEqual(result, "mocked-execute-query-result");
      assert.ok(executeQueryStub.calledOnce);
      assert.ok(prepareToPopulateScratchpadStub.notCalled);
      assert.ok(executeDataQueryStub.notCalled);
    });
  });

  describe("executeActiveEditorQuery", () => {
    let notifyStub,
      getServerForUriStub,
      runOnReplStub,
      findConnectionStub,
      getBasenameStub,
      getTargetForUriStub,
      _getEditorExecutionTypeStub,
      _retrieveQueryDataStub,
      executeQueryStub,
      handleExecuteQueryResultsStub,
      executeDataQueryStub,
      handleExecuteDataQueryResultsStub: sinon.SinonStub;

    beforeEach(() => {
      executeDataQueryStub = sinon
        .stub()
        .resolves("mocked-execute-data-query-result");
      handleExecuteDataQueryResultsStub = sinon
        .stub()
        .resolves("mocked-handle-data-query-result");
      executeQueryStub = sinon.stub().resolves("mocked-execute-query-result");
      handleExecuteQueryResultsStub = sinon
        .stub()
        .resolves("mocked-execute-query-result");
      _retrieveQueryDataStub = sinon.stub(executionUtils, "retrieveQueryData");
      _getEditorExecutionTypeStub = sinon
        .stub(executionUtils, "getEditorExecutionType")
        .returns(ExecutionTypes.QuerySelection);
      getTargetForUriStub = sinon.stub(workspaceCommand, "getTargetForUri");
      getBasenameStub = sinon.stub(coreUtils, "getBasename");
      findConnectionStub = sinon.stub(workspaceCommand, "findConnection");
      runOnReplStub = sinon
        .stub(workspaceCommand, "runOnRepl")
        .resolves(undefined);
      getServerForUriStub = sinon.stub(workspaceCommand, "getServerForUri");
      notifyStub = sinon.stub(notifications, "notify");
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => "",
        },
      };
      executionCommand.__set__(
        "handleExecuteQueryResults",
        handleExecuteQueryResultsStub,
      );
      executionCommand.__set__("executeQuery", executeQueryStub);
      executionCommand.__set__("executeDataQuery", executeDataQueryStub);
      executionCommand.__set__(
        "handleExecuteDataQueryResults",
        handleExecuteDataQueryResultsStub,
      );
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
      sinon.restore();
    });

    it("should notify when no active editor", async () => {
      ext.activeTextEditor = undefined;

      await executionCommand.executeActiveEditorQuery(
        ExecutionTypes.DataQuerySelection,
      );

      assert.ok(notifyStub.calledOnce);
    });

    it("should run on Repl", async () => {
      getServerForUriStub.returns(ext.REPL);
      await executionCommand.executeActiveEditorQuery(
        ExecutionTypes.DataQuerySelection,
      );

      assert.ok(runOnReplStub.calledOnce);
    });

    it("should return undefined if no connection found", async () => {
      getServerForUriStub.returns("");
      findConnectionStub.resolves(undefined);

      const res = await executionCommand.executeActiveEditorQuery(
        ExecutionTypes.DataQuerySelection,
      );

      assert.strictEqual(res, undefined);
      sinon.assert.calledOnce(findConnectionStub);
    });

    it("should notify if isSQL and not insights", async () => {
      findConnectionStub.returns(localConn);
      getBasenameStub.returns("file.sql");
      getTargetForUriStub.returns(undefined);

      await executionCommand.executeActiveEditorQuery(
        ExecutionTypes.QuerySelection,
      );

      assert.ok(notifyStub.calledOnce);
    });

    it("should execute scratchpad and call handleExecuteQueryResults for insights connection", async () => {
      findConnectionStub.returns(insightsConn);
      getBasenameStub.returns("file.q");
      getTargetForUriStub.returns("scratchpad");

      await executionCommand.executeActiveEditorQuery();

      assert.ok(executeQueryStub.calledOnce);
      assert.ok(handleExecuteQueryResultsStub.calledOnce);
    });

    it("should execute scratchpad and call handleExecuteQueryResults for local kdb connection", async () => {
      findConnectionStub.returns(localConn);
      getBasenameStub.returns("file.q");
      getTargetForUriStub.returns(undefined);

      await executionCommand.executeActiveEditorQuery();

      assert.ok(executeQueryStub.calledOnce);
      assert.ok(handleExecuteQueryResultsStub.calledOnce);
    });

    it("should execute the data query", async () => {
      findConnectionStub.returns(insightsConn);
      getBasenameStub.returns("file.py");
      getTargetForUriStub.returns("asm tier dap");

      await executionCommand.executeActiveEditorQuery(
        ExecutionTypes.DataQuerySelection,
      );

      assert.ok(executeDataQueryStub.calledOnce);
      assert.ok(handleExecuteDataQueryResultsStub.calledOnce);
    });
  });

  describe("executeDataSourceQuery", () => {
    let executeDataQueryStub: sinon.SinonStub;

    beforeEach(() => {
      executeDataQueryStub = sinon
        .stub()
        .resolves("mocked-execute-data-result");
      executionCommand.__set__("executeDataQuery", executeDataQueryStub);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should execute data query", async () => {
      await executionCommand.executeDataSourceQuery("connSample", dummyDS);

      assert.ok(executeDataQueryStub.calledOnce);
    });

    it("should execute data query with target", async () => {
      const sampleDS = JSON.parse(JSON.stringify(dummyDS));

      sampleDS.dataSource.selectedType = DataSourceTypes.QSQL;
      sampleDS.dataSource.qsql.selectedTarget = "ams tier dap";
      await executionCommand.executeDataSourceQuery("connSample", sampleDS);

      assert.ok(executeDataQueryStub.calledOnce);
    });
  });
});
