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
import * as sinon from "sinon";
import * as vscode from "vscode";
import { ext } from "../../src/extensionVariables";
import { createDefaultDataSourceFile } from "../../src/models/dataSource";
import { DataSourcesPanel } from "../../src/panels/datasource";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";
import * as utils from "../../src/utils/execution";
import { InsightsNode } from "../../src/services/kdbTreeProvider";
import { TreeItemCollapsibleState } from "vscode";
import { NewConnectionPannel } from "../../src/panels/newConnection";
import { InsightsConnection } from "../../src/classes/insightsConnection";

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
        const actualString = resultsPanel.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should remove single quotes, double quotes, and backticks", () => {
        const inputString = `'test' "string" \`with\` quotes`;
        const expectedString = "test string with quotes";
        const actualString = resultsPanel.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should remove ${ and } characters", () => {
        const inputString = "test ${string} with ${variables}";
        const expectedString = "test string} with variables}";
        const actualString = resultsPanel.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should transform an array of strings into a single string", () => {
        const inputString = ["test", "string", "with", "array"];
        const expectedString = "test string with array";
        const actualString = resultsPanel.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
      });

      it("should return a number", () => {
        const inputString = 123;
        const expectedString = 123;
        const actualString = resultsPanel.sanitizeString(inputString);
        assert.strictEqual(actualString, expectedString);
        assert.ok(typeof actualString === "number");
      });
    });

    describe("isVisible()", () => {
      const uriTest: vscode.Uri = vscode.Uri.parse("test");
      let resultsPanel: KdbResultsViewProvider;
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
      it("should convert results to grid format for inisights", () => {
        const results = {
          rows: [
            { prop1: "value1", prop2: "value2" },
            { prop1: "value3", prop2: "value4" },
          ],
          meta: { prop1: "type1", prop2: "type2" },
        };

        const expectedOutput = JSON.stringify({
          defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            flex: 1,
            minWidth: 100,
          },
          rowData: [
            { prop1: "value1", prop2: "value2" },
            { prop1: "value3", prop2: "value4" },
          ],
          columnDefs: [
            {
              field: "prop1",
              headerName: "prop1",
              headerTooltip: "type1",
              cellDataType: "text",
            },
            {
              field: "prop2",
              headerName: "prop2",
              headerTooltip: "type2",
              cellDataType: "text",
            },
          ],
          domLayout: "autoHeight",
          pagination: true,
          paginationPageSize: 100,
          enableCellTextSelection: true,
          ensureDomOrder: true,
          suppressContextMenu: true,
          suppressDragLeaveHidesColumns: true,
          tooltipShowDelay: 200,
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = resultsPanel.convertToGrid(results, true);
        assert.equal(output, expectedOutput);

        // Restore the stub
        stub.restore();
      });

      it("should convert results to grid format with empty rows ", () => {
        const results = {
          rows: [],
          meta: { prop1: "type1", prop2: "type2" },
        };

        const expectedOutput = JSON.stringify({
          defaultColDef: {
            sortable: true,
            resizable: true,
            filter: true,
            flex: 1,
            minWidth: 100,
          },
          rowData: [],
          columnDefs: [
            {
              field: "prop1",
              headerName: "prop1",
              headerTooltip: "type1",
              cellDataType: "text",
            },
            {
              field: "prop2",
              headerName: "prop2",
              headerTooltip: "type2",
              cellDataType: "text",
            },
          ],
          domLayout: "autoHeight",
          pagination: true,
          paginationPageSize: 100,
          enableCellTextSelection: true,
          ensureDomOrder: true,
          suppressContextMenu: true,
          suppressDragLeaveHidesColumns: true,
          tooltipShowDelay: 200,
        });

        // Mock ext.connectionNode
        const stub = sinon.stub(ext, "activeConnection");
        stub.get(() => insightsConn);

        const output = resultsPanel.convertToGrid(results, true);
        assert.equal(output, expectedOutput);

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
        const actualOutput = resultsPanel.generateCoumnDefs(input, false);
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
        const actualOutput = resultsPanel.generateCoumnDefs(input, false);
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
        exportToCsvStub.notCalled;
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
        const actualOutput = resultsPanel.convertToCsv(inputQueryResult);
        assert.deepStrictEqual(actualOutput, expectedOutput);
      });
    });

    describe("_getWebviewContent", () => {
      const uriTest: vscode.Uri = vscode.Uri.parse("test");

      let resultsPanel: KdbResultsViewProvider;
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
        resultsPanel = new KdbResultsViewProvider(uriTest);
        resultsPanel["_view"] = view;
      });

      it("returns a table", () => {
        const input = [
          { id: 1, test: "test1" },
          { id: 2, test: "test2" },
        ];
        const expectedOutput = `"rowData":[{"id":1,"test":"test1"},{"id":2,"test":"test2"}],"columnDefs":[{"field":"id","headerName":"id"},{"field":"test","headerName":"test"}]`;
        const stub = sinon
          .stub(resultsPanel, "convertToGrid")
          .returns(expectedOutput);
        const actualOutput = resultsPanel["_getWebviewContent"](input);
        assert.strictEqual(typeof actualOutput, "string");
        assert.ok(actualOutput.includes(expectedOutput));
        stub.restore();
      });

      it("returns string results", () => {
        const input = "Test";
        const expectedOutput = `<p class="results-txt">Test</p>`;
        const actualOutput = resultsPanel["_getWebviewContent"](input);
        assert.strictEqual(typeof actualOutput, "string");
        assert.ok(actualOutput.includes(expectedOutput));
      });

      it("returns no results", () => {
        const input = "";
        const expectedOutput = `<p>No results to show</p>`;
        const actualOutput = resultsPanel["_getWebviewContent"](input);
        assert.strictEqual(typeof actualOutput, "string");
        assert.ok(actualOutput.includes(expectedOutput));
      });
    });
  });

  describe("kdbNewConnectionPanel", () => {
    const uriTest: vscode.Uri = vscode.Uri.parse("test");

    beforeEach(() => {
      NewConnectionPannel.render(uriTest);
    });

    afterEach(() => {
      NewConnectionPannel.close();
    });

    it("should create a new panel", () => {
      assert.ok(
        NewConnectionPannel.currentPanel,
        "NewConnectionPannel.currentPanel should be truthy",
      );
    });

    it("should close", () => {
      NewConnectionPannel.close();
      assert.strictEqual(
        NewConnectionPannel.currentPanel,
        undefined,
        "NewConnectionPannel.currentPanel should be undefined",
      );
    });

    it("should make sure the Create New Connection panel is rendered, check if the web component exists", () => {
      const expectedHtml = `<kdb-new-connection-view/>`;
      const actualHtml = NewConnectionPannel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component",
      );
    });
  });
});
