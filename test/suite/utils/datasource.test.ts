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
import mock from "mock-fs";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as dataSourceUtils from "../../../src/utils/dataSource";

describe("dataSource", () => {
  it("convertTimeToTimestamp", () => {
    const result = dataSourceUtils.convertTimeToTimestamp("2021-01-01");
    assert.strictEqual(result, "2021-01-01T00:00:00.000000000");
  });

  it("convertTimeToTimestamp", () => {
    const result = dataSourceUtils.convertTimeToTimestamp("testTime");
    assert.strictEqual(result, "");
  });

  it("getConnectedInsightsNode", () => {
    const result = dataSourceUtils.getConnectedInsightsNode();
    assert.strictEqual(result, "");
  });

  it("checkFileFromInsightsNode", () => {
    const file = "test";
    const result = dataSourceUtils.checkFileFromInsightsNode(file);
    assert.strictEqual(result, false);
  });

  it("checkIfTimeParamIsCorrect", () => {
    const result = dataSourceUtils.checkIfTimeParamIsCorrect(
      "2021-01-01",
      "2021-01-02",
    );
    assert.strictEqual(result, true);
    const result2 = dataSourceUtils.checkIfTimeParamIsCorrect(
      "2021-01-02",
      "2021-01-01",
    );
    assert.strictEqual(result2, false);
  });

  describe("oldFilesExists", () => {
    let createKdbDataSourcesFolderStub: sinon.SinonStub;

    beforeEach(() => {
      createKdbDataSourcesFolderStub = sinon.stub(
        dataSourceUtils,
        "createKdbDataSourcesFolder",
      );
    });

    afterEach(() => {
      sinon.restore();
      mock.restore();
    });

    it("should return false if there are no files in the directory", () => {
      ext.context = {} as vscode.ExtensionContext;
      sinon.stub(ext, "context").value({
        globalStorageUri: {
          fsPath: "/temp/",
        },
      });
      mock({
        "path/to/directory": {},
      });

      createKdbDataSourcesFolderStub.returns("path/to/directory");

      const result = dataSourceUtils.oldFilesExists();

      assert.equal(result, false);
    });
  });

  describe("getPartialDatasourceFile", () => {
    it("should return qsql datatsource", () => {
      const res = dataSourceUtils.getPartialDatasourceFile("query");
      assert.strictEqual(res.dataSource.selectedType, "QSQL");
    });
    it("should return sql datatsource", () => {
      const res = dataSourceUtils.getPartialDatasourceFile(
        "query",
        "dap",
        true,
      );
      assert.strictEqual(res.dataSource.selectedType, "SQL");
    });
  });
});
