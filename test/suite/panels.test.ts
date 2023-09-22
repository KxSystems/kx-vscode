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
import * as vscode from "vscode";
import { defaultDataSourceFile } from "../../src/models/dataSource";
import { DataSourcesPanel } from "../../src/panels/datasource";
import { KdbResultsViewProvider } from "../../src/services/resultsPanelProvider";

describe("WebPanels", () => {
  describe("DataSourcesPanel", () => {
    const dsTest = defaultDataSourceFile;
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
    });

    describe("convertToGrid()", () => {
      it("should return '<p>No results to show</p>' if queryResult is an empty string", () => {
        const inputQueryResult = "";
        const expectedOutput = "<p>No results to show</p>";
        const actualOutput = resultsPanel.convertToGrid(inputQueryResult);
        assert.strictEqual(actualOutput, expectedOutput);
      });

      it("should return a string with the query result if queryResult is a string with one value", () => {
        const inputQueryResult = "test string";
        const expectedOutput = "<p>test string</p>";
        const actualOutput = resultsPanel.convertToGrid(inputQueryResult);
        assert.strictEqual(actualOutput, expectedOutput);
      });
    });
  });
});
