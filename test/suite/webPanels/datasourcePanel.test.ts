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

import assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { createDefaultDataSourceFile } from "../../../src/models/dataSource";
import { DataSourcesPanel } from "../../../src/panels/datasource";
import * as loggers from "../../../src/utils/loggers";

describe("DataSourcesPanel", () => {
  const dsTest = createDefaultDataSourceFile();
  const uriTest: vscode.Uri = vscode.Uri.parse("test");

  let kdbOutputLogStub: sinon.SinonStub;

  beforeEach(() => {
    DataSourcesPanel.render(uriTest, dsTest);
    kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
  });

  afterEach(() => {
    DataSourcesPanel.close();
    kdbOutputLogStub.restore();
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
