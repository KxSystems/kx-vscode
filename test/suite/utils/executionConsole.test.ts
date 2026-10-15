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
import * as notifications from "../../../src/utils/notifications";

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
      let appendError: sinon.SinonStub;
      let appendParts: sinon.SinonStub;
      let appendResult: sinon.SinonStub;
      let show: sinon.SinonStub;

      beforeEach(() => {
        appendLine = sinon.stub();
        appendError = sinon.stub();
        appendParts = sinon.stub();
        appendResult = sinon.stub();
        show = sinon.stub();
        ext.connectionConsoles.set(connLabel, <any>{
          appendLine,
          appendError,
          appendParts,
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

        sinon.assert.calledWith(appendParts, [
          { text: "Error: error", error: true },
        ]);
      });

      it("should fall back to the shared channel for unknown connections", () => {
        const consoleSpy = sinon.spy(queryConsole["_console"], "appendLine");

        queryConsole.append("test", "a:1", "fileName", "notAConsole");

        sinon.assert.notCalled(appendLine);
        assert.ok(consoleSpy.calledWith("test"));
        consoleSpy.restore();
      });
    });

    describe("connection console blocks", () => {
      const connLabel = "blockServer";
      let writes: [string, string | string[]][];

      // The writes after the header, query echo and its blank line, which
      // only appear with source expressions shown.
      const body = () => (writes.length > 3 ? writes.slice(3) : writes);

      const stubSettings = (hide: boolean) => {
        getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
        getConfigurationStub.returns({
          get: (key: string, fallback: boolean) =>
            key === "hideSourceExpressions" ? hide : fallback,
          update: sinon.stub(),
        });
      };

      beforeEach(() => {
        writes = [];
        ext.connectionConsoles.set(connLabel, <any>{
          appendLine: (value: string) => writes.push(["line", value]),
          appendError: (value: string) => writes.push(["error", value]),
          appendParts: (parts: any[]) => writes.push(["parts", parts]),
          appendResult: (lines: string[]) => writes.push(["result", lines]),
          terminal: { show: sinon.stub() },
        });
      });

      afterEach(() => {
        ext.connectionConsoles.delete(connLabel);
        getConfigurationStub.restore();
      });

      describe("with source expressions shown", () => {
        beforeEach(() => stubSettings(false));

        it("should end a result with its footer and a blank line", () => {
          queryConsole.append("2", "1+1", "fileName", connLabel);

          assert.strictEqual(writes[0][0], "line");
          assert.match(<string>writes[0][1], /^>>> blockServer {2}@ .* <<<$/);
          assert.deepStrictEqual(writes.slice(1), [
            ["line", "1+1"],
            ["line", ""],
            ["result", ["2"]],
            ["line", "<<<"],
            ["line", ""],
          ]);
        });

        it("should write the error block in red around a plain query echo and end it with a blank line", () => {
          queryConsole.appendQueryError(
            "1+`a",
            "type",
            connLabel,
            "fileName",
            true,
          );

          assert.strictEqual(writes[0][0], "error");
          assert.match(
            <string>writes[0][1],
            /^<<< ERROR - {2}blockServer {2}@ .* >>>$/,
          );
          assert.deepStrictEqual(writes.slice(1), [
            [
              "parts",
              [
                { text: "ERROR Query executed: ", error: true },
                { text: "1+`a\n" },
              ],
            ],
            ["parts", [{ text: "type", error: true }]],
            ["error", "<<< >>>"],
            ["line", ""],
          ]);
        });

        it("should keep the source excerpt of an error plain", () => {
          queryConsole.appendQueryError(
            "til 10`",
            "Executing code using (Q) raised - boom\n[0] til 10`\n        ^",
            connLabel,
            "fileName",
            true,
          );

          assert.deepStrictEqual(writes.slice(1, 4), [
            [
              "parts",
              [
                { text: "ERROR Query executed: ", error: true },
                { text: "til 10`\n" },
              ],
            ],
            [
              "parts",
              [{ text: "Executing code using (Q) raised - boom", error: true }],
            ],
            ["line", "[0] til 10`\n        ^"],
          ]);
        });

        it("should keep an indented source excerpt plain", () => {
          queryConsole.appendQueryError(
            "foo[]`",
            "Cannot write to handle 10000. OS reports: Bad file descriptor\n  [1]  foo[]`\n       ^",
            connLabel,
            "fileName",
            true,
          );

          assert.deepStrictEqual(writes.slice(2, 4), [
            [
              "parts",
              [
                {
                  text: "Cannot write to handle 10000. OS reports: Bad file descriptor",
                  error: true,
                },
              ],
            ],
            ["line", "  [1]  foo[]`\n       ^"],
          ]);
        });

        it("should write a datasource error reason in red inside a result block", () => {
          queryConsole.append(
            "Error: boom",
            "select from t",
            "fileName",
            connLabel,
            true,
            "QSQL",
            false,
            undefined,
            undefined,
            true,
          );

          assert.strictEqual(writes[0][0], "error");
          assert.match(<string>writes[0][1], /^>>> blockServer {2}@ .* <<<$/);
          assert.deepStrictEqual(body(), [
            ["parts", [{ text: "Error: boom", error: true }]],
            ["error", "<<<"],
            ["line", ""],
          ]);
        });

        it("should keep the stack trace of a UDA error plain", () => {
          queryConsole.append(
            "Error: Unexpected error (type) encountered executing .nsansUda.evalAPI\n  [0]  1+1`\n         ^\n",
            "Executed UDA: .nsansUda.evalAPI",
            "fileName",
            connLabel,
            true,
            "UDA",
            false,
            undefined,
            undefined,
            true,
          );

          assert.deepStrictEqual(body(), [
            [
              "parts",
              [
                {
                  text: "Error: Unexpected error (type) encountered executing .nsansUda.evalAPI",
                  error: true,
                },
              ],
            ],
            ["line", "  [0]  1+1`\n         ^"],
            ["error", "<<<"],
            ["line", ""],
          ]);
        });

        it("should keep a datasource result out of the error path", () => {
          queryConsole.append(
            "col1",
            "select from t",
            "fileName",
            connLabel,
            true,
            "QSQL",
            false,
            undefined,
            undefined,
            false,
          );

          assert.deepStrictEqual(body(), [
            ["result", ["col1"]],
            ["line", "<<<"],
            ["line", ""],
          ]);
        });
      });

      describe("without a connection", () => {
        let notifyStub: sinon.SinonStub;
        let executeCommandStub: sinon.SinonStub;

        beforeEach(() => {
          notifyStub = sinon.stub(notifications, "notify");
          executeCommandStub = sinon.stub(vscode.commands, "executeCommand");
        });

        afterEach(() => {
          notifyStub.restore();
          executeCommandStub.restore();
        });

        const runDisconnected = () =>
          queryConsole.appendQueryError(
            "1+1",
            "",
            connLabel,
            "fileName",
            false,
          );

        it("should write the connect prompt in red inside the error block when shown", () => {
          stubSettings(false);
          runDisconnected();

          assert.strictEqual(writes[0][0], "error");
          assert.match(
            <string>writes[0][1],
            /^<<< ERROR - {2}blockServer {2}@ .* >>>$/,
          );
          assert.deepStrictEqual(writes.slice(1), [
            ["error", "Please connect to a KDB or Insights server"],
            ["error", "<<< >>>"],
            ["line", ""],
          ]);
          sinon.assert.calledOnce(notifyStub);
          sinon.assert.calledWith(
            executeCommandStub,
            "kdb.connections.disconnect",
          );
        });

        it("should write only the connect prompt in red when hidden", () => {
          stubSettings(true);
          runDisconnected();

          assert.deepStrictEqual(writes, [
            ["error", "Please connect to a KDB or Insights server"],
            ["line", ""],
          ]);
          sinon.assert.calledOnce(notifyStub);
          sinon.assert.calledWith(
            executeCommandStub,
            "kdb.connections.disconnect",
          );
        });
      });

      describe("with source expressions hidden", () => {
        beforeEach(() => stubSettings(true));

        it("should end a result with a blank line and no footer", () => {
          queryConsole.append("2", "1+1", "fileName", connLabel);

          assert.deepStrictEqual(writes, [
            ["result", ["2"]],
            ["line", ""],
          ]);
        });

        it("should write only the error reason in red and end with a blank line", () => {
          queryConsole.appendQueryError(
            "1+`a",
            "type",
            connLabel,
            "fileName",
            true,
          );

          assert.deepStrictEqual(writes, [
            ["parts", [{ text: "Error: type", error: true }]],
            ["line", ""],
          ]);
        });

        it("should keep the source excerpt plain when the details are hidden", () => {
          queryConsole.appendQueryError(
            "foo[]`",
            "Cannot write to handle 10000. OS reports: Bad file descriptor\n  [1]  foo[]`\n       ^",
            connLabel,
            "fileName",
            true,
          );

          assert.deepStrictEqual(writes, [
            [
              "parts",
              [
                {
                  text: "Error: Cannot write to handle 10000. OS reports: Bad file descriptor",
                  error: true,
                },
              ],
            ],
            ["line", "  [1]  foo[]`\n       ^"],
            ["line", ""],
          ]);
        });

        it("should keep the code line and caret of a Python error plain", () => {
          queryConsole.appendQueryError(
            "{[x;y] (x+y}[1] each til 10",
            'boom\n  File "<unknown>", line 1\n    {[x;y] (x+y}[1] each til 10\n               ^\nSyntaxError: boom',
            connLabel,
            "fileName",
            true,
          );

          assert.deepStrictEqual(writes, [
            [
              "parts",
              [
                {
                  text: 'Error: boom\n  File "<unknown>", line 1',
                  error: true,
                },
              ],
            ],
            ["line", "    {[x;y] (x+y}[1] each til 10\n               ^"],
            ["parts", [{ text: "SyntaxError: boom", error: true }]],
            ["line", ""],
          ]);
        });

        it("should write a datasource error reason in red and end with a blank line", () => {
          queryConsole.append(
            "Error: boom",
            "select from t",
            "fileName",
            connLabel,
            true,
            "QSQL",
            false,
            undefined,
            undefined,
            true,
          );

          assert.deepStrictEqual(writes, [
            ["parts", [{ text: "Error: boom", error: true }]],
            ["line", ""],
          ]);
        });
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
        assert.ok(appendLineSpy.calledWith("<<<"));
        assert.strictEqual(appendLineSpy.lastCall.args[0], "");
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
        assert.strictEqual(appendLineSpy.lastCall.args[0], "");
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
