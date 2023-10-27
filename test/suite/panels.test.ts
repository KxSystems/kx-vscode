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
        "DataSourcesPanel.currentPanel should be truthy"
      );
    });

    it("should close", () => {
      DataSourcesPanel.close();
      assert.strictEqual(
        DataSourcesPanel.currentPanel,
        undefined,
        "DataSourcesPanel.currentPanel should be undefined"
      );
    });

    it("should make sure the datasource is rendered, check if the web component exists", () => {
      const expectedHtml = `<kdb-data-source-view></kdb-data-source-view>`;
      const actualHtml = DataSourcesPanel.currentPanel._panel.webview.html;
      assert.ok(
        actualHtml.indexOf(expectedHtml) !== -1,
        "Panel HTML should include expected web component"
      );
    });
  });

  describe("ResultsPanelProvider", () => {
    const uriTest: vscode.Uri = vscode.Uri.parse("test");
    let resultsPanel: KdbResultsViewProvider;

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
      it("should return 'gridOptions' if queryResult is an empty string", () => {
        const inputQueryResult = [{ a: "1" }, { a: "2" }, { a: "3" }];
        const expectedOutput =
          '{"defaultColDef":{"sortable":true,"resizable":true,"filter":true,"flex":1,"minWidth":100},"rowData":[{"a":"1"},{"a":"2"},{"a":"3"}],"columnDefs":[{"field":"a"}],"domLayout":"autoHeight","pagination":true,"paginationPageSize":100,"cacheBlockSize":100,"enableCellTextSelection":true,"ensureDomOrder":true,"suppressContextMenu":true}';
        const actualOutput = resultsPanel.convertToGrid(inputQueryResult);
        assert.strictEqual(actualOutput, expectedOutput);
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
        const expectedOutput = `"rowData":[{"id":"1","test":"test1"},{"id":"2","test":"test2"}],"columnDefs":[{"field":"id"},{"field":"test"}]`;
        const actualOutput = resultsPanel["_getWebviewContent"](input);
        assert.strictEqual(typeof actualOutput, "string");
        assert.ok(actualOutput.includes(expectedOutput));
      });

      it("returns no results", () => {
        const input = "Test";
        const expectedOutput = `<p>Test</p>`;
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
});
