/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TreeItemCollapsibleState } from "vscode";

import { InsightsConnection } from "../../src/classes/insightsConnection";
import { ext } from "../../src/extensionVariables";
import { createDefaultDataSourceFile } from "../../src/models/dataSource";
import { StructuredTextResults } from "../../src/models/queryResult";
import { DataSourcesPanel } from "../../src/panels/datasource";
import { NewConnectionPannel } from "../../src/panels/newConnection";
import { InsightsNode, KdbNode } from "../../src/services/kdbTreeProvider";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";
import * as coreUtils from "../../src/utils/core";
import * as utils from "../../src/utils/execution";
import * as renderer from "../../src/utils/resultsRenderer";

describe("WebPanels", () => {
  describe("DataSourcesPanel", () => {
    const dsTest = createDefaultDataSourceFile();
    const uriTest: vscode.Uri = vscode.Uri.parse("test");

    beforeEach(() => {
      DataSourcesPanel.render(uriTest, dsTest);
    });

    afterEach(() => {
      DataSourcesPanel.close();
    });

    it("should create a new panel", () => {
      assert.ok(
        DataSourcesPanel.currentPanel,
        "DataSourcesPanel.currentPanel should be truthy",
      );
    });

    it("should close", () => {
      DataSourcesPanel.close();
      assert.strictEqual(
        DataSourcesPanel.currentPanel,
        undefined,
        "DataSourcesPanel.currentPanel should be undefined",
      );
    });

    it("should make sure the datasource is rendered, check if the web component exists", () => {
      const expectedHtml = `<kdb-data-source-view></kdb-data-source-view>`;
      const actualHtml = DataSourcesPanel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component",
      );
    });
  });

  describe("ResultsPanelProvider", () => {
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    let resultsPanel: KdbResultsViewProvider;
    let viewStub: any;

    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    const insightsConn = new InsightsConnection(
      "insightsservername",
      insightsNode,
    );
    beforeEach(() => {
      resultsPanel = new KdbResultsViewProvider(uriTest);
      viewStub = {
        show: sinon.stub(),
      };
      resultsPanel["_view"] = viewStub;
    });

    describe("defineAgGridTheme()", () => {
      it("should return 'ag-theme-alpine' if the color theme is not dark", () => {
        resultsPanel._colorTheme = { kind: vscode.ColorThemeKind.Light };
        const expectedTheme = "ag-theme-alpine";
        const actualTheme = resultsPanel.defineAgGridTheme();
        assert.strictEqual(actualTheme, expectedTheme);
      });

      it("should return 'ag-theme-alpine-dark' if the color theme is dark", () => {
        resultsPanel._colorTheme = { kind: vscode.ColorThemeKind.Dark };
        const expectedTheme = "ag-theme-alpine-dark";
        const actualTheme = resultsPanel.defineAgGridTheme();
        assert.strictEqual(actualTheme, expectedTheme);
      });
    });
    describe("sanitizeString()", () => {
      it("should remove leading and trailing whitespace", () => {
        const inputString = "  test string  ";
        const expectedString = "test string";
        const actualString = renderer.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should remove single quotes, double quotes, and backticks", () => {
        const inputString = `'test' "string" \`with\` quotes`;
        const expectedString = "test string with quotes";
        const actualString = renderer.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should remove ${ and } characters", () => {
        const inputString = "test ${string} with ${variables}";
        const expectedString = "test string} with variables}";
        const actualString = renderer.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should transform an array of strings into a single string", () => {
        const inputString = ["test", "string", "with", "array"];
        const expectedString = "test string with array";
        const actualString = renderer.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should return a number", () => {
        const inputString = 123;
        const expectedString = 123;
        const actualString = renderer.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
        assert.ok(typeof actualString === "number");
      });
    });

    describe("isVisible()", () => {
      const uriTest: vscode.Uri = vscode.Uri.parse("test");
      let resultsPanel: KdbResultsViewProvider;
      const view: vscode.WebviewView = {
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
        resultsPanel = new KdbResultsViewProvider(uriTest);
      });
      it("should return false if the panel is not visible", () => {
        const actualVisibility = resultsPanel.isVisible();
        assert.strictEqual(actualVisibility, false);
      });

      it("should return false if the panel visible", () => {
        resultsPanel["_view"] = view;
        const actualVisibility = resultsPanel.isVisible();
        assert.strictEqual(actualVisibility, true);
      });
    });

    describe("convertToGrid()", () => {
      it("should convert results to grid format for insights", () => {
        const results = {
          data: {
            rows: [
              { prop1: "value1", prop2: "value2" },
              { prop1: "value3", prop2: "value4" },
            ],
            meta: { prop1: "type1", prop2: "type2" },
          },
        };

        const expectedOutput = JSON.stringify({
          rowData: [
            { index: 1, prop1: "value1", prop2: "value2" },
            { index: 2, prop1: "value3", prop2: "value4" },
          ],
          columnDefs: [
            { field: "index", headerName: "Index", cellDataType: "number" },
            {
              field: "prop1",
              headerName: "prop1 [type1]",
              cellDataType: "text",
            },
            {
              field: "prop2",
              headerName: "prop2 [type2]",
              cellDataType: "text",
            },
          ],
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = renderer.convertToGrid(results, true);
        assert.equal(JSON.stringify(output), expectedOutput);

        // Restore the stub
        stub.restore();
      });

      it("should convert results to grid format for insights above 1.12", () => {
        const results: StructuredTextResults = {
          columns: [
            {
              name: "prop1",
              type: "type1",
              values: ["value1", "value2"],
              order: [1, 0],
            },
            {
              name: "prop2",
              type: "type2",
              values: ["value3", "value4"],
              order: [1, 0],
            },
          ],
          count: 2,
        };

        const expectedOutput = JSON.stringify({
          rowData: [
            { index: 1, prop1: "value1", prop2: "value3" },
            { index: 2, prop1: "value2", prop2: "value4" },
          ],
          columnDefs: [
            { field: "index", headerName: "Index", cellDataType: "number" },
            {
              field: "prop1",
              headerName: "prop1 [type1]",
              cellDataType: "text",
              cellRendererParams: { disabled: false },
            },
            {
              field: "prop2",
              headerName: "prop2 [type2]",
              cellDataType: "text",
              cellRendererParams: { disabled: false },
            },
          ],
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = renderer.convertToGrid(results, true, 1.12);
        assert.equal(JSON.stringify(output), expectedOutput);

        // Restore the stub
        stub.restore();
      });

      it("should convert results to grid format with empty rows", () => {
        const results = {
          data: {
            rows: [],
            meta: { prop1: "type1", prop2: "type2" },
          },
        };

        const expectedOutput = JSON.stringify({
          rowData: [],
          columnDefs: [
            { field: "index", headerName: "Index", cellDataType: "number" },
            {
              field: "prop1",
              headerName: "prop1 [type1]",
              cellDataType: "text",
            },
            {
              field: "prop2",
              headerName: "prop2 [type2]",
              cellDataType: "text",
            },
          ],
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = renderer.convertToGrid(results, true);
        assert.equal(JSON.stringify(output), expectedOutput);

        // Restore the stub
        stub.restore();
      });

      it("should convert results to grid format when queryResult[0] is an array of objects", () => {
        const results = {
          data: {
            rows: [
              [{ sym: "a" }, { sym: "b" }, { sym: "c" }],
              [{ val: 1 }, { val: 2 }, { val: 3 }],
            ],
            meta: { sym: "type1", val: "type2" },
          },
        };

        const expectedOutput = JSON.stringify({
          rowData: [
            { index: 1, sym: "a", val: 1 },
            { index: 2, sym: "b", val: 2 },
            { index: 3, sym: "c", val: 3 },
          ],
          columnDefs: [
            { field: "index", headerName: "Index", cellDataType: "number" },
            { field: "sym", headerName: "sym [type1]", cellDataType: "text" },
            { field: "val", headerName: "val [type2]", cellDataType: "text" },
          ],
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = renderer.convertToGrid(results, true);
        assert.equal(JSON.stringify(output), expectedOutput);

        // Restore the stub
        stub.restore();
      });

      it("should convert results to grid format when queryResult[0] is an array of non-objects", () => {
        const results = {
          data: { rows: [[1, 2, 3]], meta: { value: "type1" } },
        };

        const expectedOutput = JSON.stringify({
          rowData: [{ index: 1, value: "1,2,3" }],
          columnDefs: [
            { field: "index", headerName: "Index", cellDataType: "number" },
            {
              field: "value",
              headerName: "value [type1]",
              cellDataType: "text",
            },
          ],
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = renderer.convertToGrid(results, true);
        assert.equal(JSON.stringify(output), expectedOutput);

        // Restore the stub
        stub.restore();
      });
    });

    describe("generateColumnDefs", () => {
      it("should return an array of column definitions if the results are not empty", () => {
        const input = [
          { prop1: "value1", prop2: "value2" },
          { prop1: "value3", prop2: "value4" },
        ];
        const expectedOutput = [
          {
            field: "prop1",
            headerName: "prop1",
            cellDataType: "text",
          },
          {
            field: "prop2",
            headerName: "prop2",
            cellDataType: "text",
          },
        ];
        const actualOutput = renderer.generateCoumnDefs(input, false);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });

      it("should return the results if the results are array of strings", () => {
        const input = ["value1", "value2"];
        const expectedOutput = [
          {
            field: "value1",
            headerName: "value1",
            cellDataType: "text",
          },
          {
            field: "value2",
            headerName: "value2",
            cellDataType: "text",
          },
        ];
        const actualOutput = renderer.generateCoumnDefs(input, false);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });
    });

    describe("removeEndCommaFromStrings", () => {
      it("should remove the comma from the end of a string if it ends with a comma", () => {
        const input = ["hello,", "world,"];
        const expectedOutput = ["hello", "world"];
        const actualOutput = resultsPanel.removeEndCommaFromStrings(input);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });

      it("should not modify a string if it does not end with a comma", () => {
        const input = ["hello", "world"];
        const expectedOutput = ["hello", "world"];
        const actualOutput = resultsPanel.removeEndCommaFromStrings(input);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });

      it("should return an empty array if the input is an empty array", () => {
        const input: string[] = [];
        const expectedOutput: string[] = [];
        const actualOutput = resultsPanel.removeEndCommaFromStrings(input);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });
    });

    describe("exportToCsv()", () => {
      it("should show error message if no results to export", () => {
        const windowMock = sinon.mock(vscode.window);
        const workspaceMock = sinon.mock(vscode.workspace);
        const exportToCsvStub = sinon.stub(utils, "exportToCsv");
        windowMock
          .expects("showErrorMessage")
          .once()
          .withArgs("No results to export");

        ext.resultPanelCSV = "";

        workspaceMock.expects("getWorkspaceFolder").never();

        resultsPanel.exportToCsv();

        windowMock.verify();
        workspaceMock.verify();
        assert.deepStrictEqual(exportToCsvStub.notCalled, true);
      });
    });

    describe("convertToCsv()", () => {
      it("should return string array from objects", () => {
        const inputQueryResult = [
          { a: "1", b: "1" },
          { a: "2", b: "2" },
          { a: "3", b: "3" },
        ];
        const expectedOutput = ["a,b", "1,1", "2,2", "3,3"];
        const actualOutput = renderer.convertToCsv(inputQueryResult);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });
    });

    describe("updateWebView", () => {
      const uriTest: vscode.Uri = vscode.Uri.parse("test");

      let resultsPanel: KdbResultsViewProvider;
      let postMessageStub: sinon.SinonStub;
      let kdbOutputLogStub: sinon.SinonStub;
      let convertToGridStub: sinon.SinonStub;

      beforeEach(() => {
        resultsPanel = new KdbResultsViewProvider(uriTest);
        resultsPanel["_view"] = {
          webview: {
            postMessage: sinon.stub(),
          },
        } as any;
        postMessageStub = resultsPanel["_view"].webview
          .postMessage as sinon.SinonStub;
        kdbOutputLogStub = sinon.stub(coreUtils, "kdbOutputLog");
        convertToGridStub = sinon.stub(renderer, "convertToGrid");
      });

      afterEach(() => {
        sinon.restore();
      });

      it("should log an error if there is no view to update", () => {
        resultsPanel["_view"] = undefined;
        resultsPanel.updateWebView("test");
        sinon.assert.calledWith(
          kdbOutputLogStub,
          "[Results Tab] No view to update",
          "ERROR",
        );
      });

      it("should handle string queryResult", () => {
        const queryResult = "test string";
        resultsPanel.updateWebView(queryResult);
        sinon.assert.calledWith(postMessageStub, {
          command: "setResultsContent",
          results: `<p class="results-txt">test string</p>`,
        });
      });

      it("should handle number queryResult", () => {
        const queryResult = 123;
        resultsPanel.updateWebView(queryResult);
        sinon.assert.calledWith(postMessageStub, {
          command: "setResultsContent",
          results: `<p class="results-txt">123</p>`,
        });
      });

      it("should handle empty string queryResult", () => {
        const queryResult = "";
        resultsPanel.updateWebView(queryResult);
        sinon.assert.calledWith(postMessageStub, {
          command: "setResultsContent",
          results: "<p>No results to show</p>",
        });
      });

      it("should handle object queryResult and call convertToGrid", () => {
        const queryResult = { data: "test" };
        const gridOptions = { columnDefs: [], rowData: [] };
        convertToGridStub.returns(gridOptions);
        resultsPanel.updateWebView(queryResult);
        sinon.assert.calledWith(
          convertToGridStub,
          queryResult,
          resultsPanel.isInsights,
        );
        sinon.assert.calledWith(postMessageStub, {
          command: "loading",
        });
        sinon.assert.calledWith(
          postMessageStub,
          sinon
            .match({
              command: "setGridDatasource",
              results: [],
              columnDefs: [],
              theme: "legacy",
            })
            .and(sinon.match.has("themeColor", sinon.match.string)),
        );
      });

      it("should handle null queryResult", () => {
        const queryResult = null;
        resultsPanel.updateWebView(queryResult);
        sinon.assert.calledWith(postMessageStub, {
          command: "setResultsContent",
          results: "",
        });
      });
    });

    describe("_getWebviewContent", () => {
      const uriTest: vscode.Uri = vscode.Uri.parse("test");

      let resultsPanel: KdbResultsViewProvider;
      const view: vscode.WebviewView = {
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
        resultsPanel = new KdbResultsViewProvider(uriTest);
        resultsPanel["_view"] = view;
      });

      it("should render the results tab", () => {
        const expectedOutput = ` id="results" class="results-view-container"`;
        const actualOutput = resultsPanel["_getWebviewContent"]();
        assert.ok(actualOutput.includes(expectedOutput));
      });
    });

    describe("updateResults", () => {
      it("should show the view and update the web view with insights", () => {
        const queryResults = { data: "test" };
        const isInsights = true;
        const connVersion = 1.11;

        const updateWebViewStub = sinon.stub(resultsPanel, "updateWebView");

        resultsPanel.updateResults(queryResults, isInsights, connVersion);

        assert.equal(viewStub.show.calledOnceWith(true), true);
        assert.equal(resultsPanel.isInsights, true);
        assert.equal(
          updateWebViewStub.calledOnceWith(queryResults, connVersion),
          true,
        );
      });

      it("should show the view and update the web view without insights", () => {
        const queryResults = { data: "test" };
        const isInsights = false;
        const connVersion = 1.11;

        const updateWebViewStub = sinon.stub(resultsPanel, "updateWebView");

        resultsPanel.updateResults(queryResults, isInsights, connVersion);

        assert.equal(viewStub.show.calledOnceWith(true), true);
        assert.equal(resultsPanel.isInsights, false);
        assert.equal(
          updateWebViewStub.calledOnceWith(queryResults, connVersion),
          true,
        );
      });

      it("should not update the web view if _view is not defined", () => {
        resultsPanel["_view"] = undefined;
        const queryResults = { data: "test" };
        const isInsights = true;
        const connVersion = 1.11;

        const updateWebViewStub = sinon.stub(resultsPanel, "updateWebView");

        resultsPanel.updateResults(queryResults, isInsights, connVersion);

        assert.equal(viewStub.show.called, false);
        assert.equal(updateWebViewStub.called, false);
      });
    });
    describe("exportToCsv", () => {
      it("should show an error message if there are no results to export", () => {
        sinon.stub(ext, "resultPanelCSV").value("");
        const showErrorMessageStub = sinon.stub(
          vscode.window,
          "showErrorMessage",
        );

        resultsPanel.exportToCsv();

        assert.equal(
          showErrorMessageStub.calledOnceWith("No results to export"),
          true,
        );
      });

      it("should export to CSV if there are results and a folder is open", () => {
        sinon.stub(ext, "resultPanelCSV").value("some,csv,data");
        const workspaceUri = vscode.Uri.parse("file:///path/to/workspace");
        sinon
          .stub(vscode.workspace, "workspaceFolders")
          .value([{ uri: workspaceUri }]);
        const exportToCsvStub = sinon.stub(utils, "exportToCsv");

        resultsPanel.exportToCsv();

        assert.equal(exportToCsvStub.calledOnceWith(workspaceUri), true);
      });
    });

    describe("updatedExtractRowData", () => {
      it("should correctly extract row data from structured text results", () => {
        const results: StructuredTextResults = {
          columns: [
            {
              name: "date",
              type: "dates",
              order: [0, 1, 2],
              values: ["2024.10.21", "2024.10.22", "2024.10.23"],
            },
            {
              name: "instance",
              type: "symbols",
              order: [0, 1, 2],
              values: ["`inst1", "`inst2", "`inst3"],
            },
          ],
          count: 3,
        };

        const expectedRowData = [
          { date: "2024.10.21", instance: "`inst1" },
          { date: "2024.10.22", instance: "`inst2" },
          { date: "2024.10.23", instance: "`inst3" },
        ];

        const rowData = renderer.updatedExtractRowData(results);

        assert.deepEqual(rowData, expectedRowData);
      });

      it("should handle empty results correctly", () => {
        const results: StructuredTextResults = {
          columns: [],
          count: 0,
        };

        const expectedRowData: any[] = [];

        const rowData = renderer.updatedExtractRowData(results);

        assert.deepEqual(rowData, expectedRowData);
      });
    });

    describe("updatedExtractColumnDefs", () => {
      it("should correctly extract column definitions from structured text results", () => {
        const results: StructuredTextResults = {
          columns: [
            {
              name: "date",
              type: "dates",
              order: [0, 1, 2],
              values: ["2024.10.21", "2024.10.22", "2024.10.23"],
            },
            {
              name: "instance",
              type: "symbols",
              order: [0, 1, 2],
              values: ["`inst1", "`inst2", "`inst3"],
            },
          ],
          count: 3,
        };

        const expectedColumnDefs = [
          {
            field: "date",
            headerName: "date [dates]",
            cellDataType: "text",
            cellRendererParams: { disabled: false },
          },
          {
            field: "instance",
            headerName: "instance [symbols]",
            cellDataType: "text",
            cellRendererParams: { disabled: false },
          },
        ];

        const columnDefs = renderer.updatedExtractColumnDefs(results);

        assert.deepEqual(columnDefs, expectedColumnDefs);
      });

      it("should handle empty columns correctly", () => {
        const results: StructuredTextResults = {
          columns: [],
          count: 0,
        };

        const expectedColumnDefs: any[] = [];

        const columnDefs = renderer.updatedExtractColumnDefs(results);

        assert.deepEqual(columnDefs, expectedColumnDefs);
      });
    });
  });

  describe("kdbNewConnectionPanel", () => {
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "insightsservername",
        alias: "insightsserveralias",
        auth: true,
      },
      TreeItemCollapsibleState.None,
    );

    const kdbNode = new KdbNode(
      [],
      "kdbnode1",
      {
        serverName: "kdbservername",
        serverPort: "kdbserverport",
        auth: true,
        serverAlias: "kdbserveralias",
        managed: false,
        tls: true,
      },
      TreeItemCollapsibleState.None,
    );

    const localNode = new KdbNode(
      [],
      "local",
      {
        serverName: "kdbservername",
        serverPort: "kdbserverport",
        auth: false,
        serverAlias: "local",
        managed: true,
        tls: false,
      },
      TreeItemCollapsibleState.None,
    );

    afterEach(() => {
      NewConnectionPannel.close();
    });

    it("should create a new panel", () => {
      NewConnectionPannel.render(uriTest);
      assert.ok(
        NewConnectionPannel.currentPanel,
        "NewConnectionPannel.currentPanel should be truthy",
      );
    });

    it("should close teh panel if open", () => {
      NewConnectionPannel.render(uriTest);
      NewConnectionPannel.render(uriTest);
      assert.ok(
        !NewConnectionPannel.currentPanel,
        "NewConnectionPannel.currentPanel should be falsy",
      );
    });

    it("should close", () => {
      NewConnectionPannel.render(uriTest);
      NewConnectionPannel.close();
      assert.strictEqual(
        NewConnectionPannel.currentPanel,
        undefined,
        "NewConnectionPannel.currentPanel should be undefined",
      );
    });

    it("should make sure the Create New Connection panel is rendered, check if the web component exists", () => {
      NewConnectionPannel.render(uriTest);
      const expectedHtml = `<kdb-new-connection-view/>`;
      const actualHtml = NewConnectionPannel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component",
      );
    });

    it("should render panel with edit connection data for insights", () => {
      NewConnectionPannel.render(uriTest, insightsNode);
      const expectedHtml = `<kdb-new-connection-view/>`;
      const actualHtml = NewConnectionPannel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component",
      );
    });

    it("should render panel with edit connection data for kdb", () => {
      NewConnectionPannel.render(uriTest, kdbNode);
      const expectedHtml = `<kdb-new-connection-view/>`;
      const actualHtml = NewConnectionPannel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component",
      );
    });

    it("should render panel with edit connection data for local", () => {
      NewConnectionPannel.render(uriTest, localNode);
      const expectedHtml = `<kdb-new-connection-view/>`;
      const actualHtml = NewConnectionPannel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component",
      );
    });

    it("should refreshLabels", () => {
      NewConnectionPannel.render(uriTest);
      NewConnectionPannel.refreshLabels();
      assert.ok(
        NewConnectionPannel.currentPanel,
        "NewConnectionPannel.currentPanel should be truthy",
      );
    });
  });
});
