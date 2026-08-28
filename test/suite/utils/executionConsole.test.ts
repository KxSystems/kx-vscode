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

import { ext } from "../../../src/extensionVariables";
import { ServerType } from "../../../src/models/connectionsModels";
import { InsightsNode, KdbNode } from "../../../src/services/kdbTreeProvider";
import { QueryHistoryProvider } from "../../../src/services/queryHistoryProvider";
import * as executionConsoleUtils from "../../../src/utils/executionConsole";

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
        auth: false,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    beforeEach(() => {
      queryConsole = executionConsoleUtils.ExecutionConsole.start();

      ext.kdbQueryHistoryList.length = 0;
    });

    describe("checkOutput", () => {
      it("should return the input string if the input is not an array", () => {
        const result = queryConsole.checkOutput("test", "test");
        assert.strictEqual(result, "test");
      });

      it("should return No results found if the input is an empty array", () => {
        const result = queryConsole.checkOutput([], "test");
        assert.strictEqual(result, "No results found.");
      });

      it("should return No results found if the input is an empty string", () => {
        const result = queryConsole.checkOutput("", "test");
        assert.strictEqual(result, "No results found.");
      });

      it("should return the input array if the input is an array with multiple strings", () => {
        const result = queryConsole.checkOutput(["test", "test"], "test");
        assert.deepStrictEqual(result, ["test", "test"]);
      });
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

      queryConsole.append(output, query, "fileName", serverName);
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

      queryConsole.append(output, query, "fileName", serverName);
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

      queryConsole.append(
        output,
        query,
        "fileName",
        serverName,
        true,
        "WORKBOOK",
        true,
        "2",
      );
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

      queryConsole.appendQueryError(
        query,
        output,
        serverName,
        "fileName",
        true,
        false,
        "WORKBOOK",
        true,
        false,
        "2",
      );
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

      queryConsole.appendQueryError(
        query,
        output,
        serverName,
        "filename",
        true,
        true,
        "WORKBOOK",
        true,
        false,
        "2",
      );
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

      queryConsole.appendQueryError(
        query,
        output,
        serverName,
        "filename",
        false,
      );
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
      assert.strictEqual(ext.kdbQueryHistoryList[0].success, false);
      assert.strictEqual(
        ext.kdbQueryHistoryList[0].connectionType,
        ServerType.undefined,
      );
    });

    describe("resolveSink", () => {
      const connLabel = "consoleServer";
      let appendLine: sinon.SinonStub;
      let appendResult: sinon.SinonStub;
      let show: sinon.SinonStub;

      beforeEach(() => {
        appendLine = sinon.stub();
        appendResult = sinon.stub();
        show = sinon.stub();
        ext.connectionConsoles.set(connLabel, <any>{
          appendLine,
          appendResult,
          terminal: { show },
        });
        getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
        getConfigurationStub.returns({
          get: sinon.stub().returns(true),
          update: sinon.stub(),
        });
      });

      afterEach(() => {
        ext.connectionConsoles.delete(connLabel);
        getConfigurationStub.restore();
      });

      it("should write to the connection console and reveal its terminal", () => {
        queryConsole.append("test", "a:1", "fileName", connLabel);

        sinon.assert.calledWith(appendResult, ["test"]);
        sinon.assert.calledWith(show, true);
      });

      it("should write errors to the connection console", () => {
        queryConsole.appendQueryError(
          "a:1",
          "error",
          connLabel,
          "fileName",
          true,
        );

        sinon.assert.calledWith(appendLine, "Error: error");
      });

      it("should fall back to the shared channel for unknown connections", () => {
        const consoleSpy = sinon.spy(queryConsole["_console"], "appendLine");

        queryConsole.append("test", "a:1", "fileName", "notAConsole");

        sinon.assert.notCalled(appendLine);
        assert.ok(consoleSpy.calledWith("test"));
        consoleSpy.restore();
      });
    });

    describe("output details", () => {
      let appendLineSpy: sinon.SinonSpy;

      beforeEach(() => {
        getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
        getConfigurationStub.returns({
          get: sinon.stub().returns(false),
          update: sinon.stub(),
        });
        appendLineSpy = sinon.spy(queryConsole["_console"], "appendLine");
      });

      afterEach(() => {
        appendLineSpy.restore();
        getConfigurationStub.restore();
      });

      it("should append every row of an array output", () => {
        queryConsole.append(["row1", "row2"], "a:1", "fileName", "testServer");

        assert.ok(appendLineSpy.calledWith("row1"));
        assert.ok(appendLineSpy.calledWith("row2"));
        assert.ok(appendLineSpy.calledWith("<<<\n"));
      });

      it("should append converted rows for a datasource output", () => {
        queryConsole.append(
          ["col1#$#;header;#$#col2", "value1#$#;#$#value2"],
          "a:1",
          "fileName",
          "testServer",
          true,
          "QSQL",
        );

        assert.ok(
          appendLineSpy
            .getCalls()
            .some((call) => call.args[0].includes("col1")),
        );
        assert.ok(
          appendLineSpy
            .getCalls()
            .some((call) => call.args[0].includes("value1")),
        );
      });

      it("should append error details when they are not hidden", () => {
        queryConsole.appendQueryError(
          "a:1",
          "error",
          "testServer",
          "fileName",
          true,
        );

        assert.ok(appendLineSpy.calledWith("ERROR Query executed: a:1\n"));
        assert.ok(appendLineSpy.calledWith("error"));
        assert.ok(appendLineSpy.calledWith("<<< >>>"));
      });
    });

    describe("appendStdErr", () => {
      it("should append message with STDERR prefix", () => {
        const appendLineSpy = sinon.spy(queryConsole["_console"], "appendLine");
        const testMsg = "Table not found";

        queryConsole.appendStdErr(testMsg);

        assert.ok(appendLineSpy.calledWith("❌"));
        assert.ok(appendLineSpy.calledWith(testMsg));
        appendLineSpy.restore();
      });
    });

    describe("appendStdOut", () => {
      it("should append message with STDOUT prefix", () => {
        const appendLineSpy = sinon.spy(queryConsole["_console"], "appendLine");
        const testMsg = "Query executed successfully";

        queryConsole.appendStdOut(testMsg);

        assert.ok(appendLineSpy.calledWith("ℹ️"));
        assert.ok(appendLineSpy.calledWith(testMsg));
        appendLineSpy.restore();
      });
    });
  });
});
