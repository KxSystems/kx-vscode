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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { QueryResultType } from "../../src/models/queryResult";
import * as dataSourceUtils from "../../src/utils/dataSource";
import * as executionUtils from "../../src/utils/execution";
import * as queryUtils from "../../src/utils/queryUtils";

describe("Utils", () => {
  let windowMock: sinon.SinonMock;

  beforeEach(() => {
    windowMock = sinon.mock(vscode.window);
  });

  afterEach(() => {
    windowMock.restore();
  });

  describe("dataSource", () => {
    // need check how to mock ext variables and populate it with values
    // it("createKdbDataSourcesFolder", () => {
    //   const result = dataSourceUtils.createKdbDataSourcesFolder();
    //   assert.strictEqual(
    //     result,
    //     "/Users/username/.vscode-server/data/User/kdb/dataSources"
    //   );
    // });

    it("convertDataSourceFormToDataSourceFile", () => {
      const form = {
        name: "test",
        selectedType: "api",
        selectedApi: "test",
        selectedTable: "test",
        startTS: "test",
        endTS: "test",
        fill: "test",
      };
      const result =
        dataSourceUtils.convertDataSourceFormToDataSourceFile(form);
      assert.strictEqual(result.name, "test");
      assert.strictEqual(result.dataSource.selectedType, "api");
      assert.strictEqual(result.dataSource.api.selectedApi, "test");
      assert.strictEqual(result.dataSource.api.table, "test");
      assert.strictEqual(result.dataSource.api.startTS, "test");
      assert.strictEqual(result.dataSource.api.endTS, "test");
      assert.strictEqual(result.dataSource.api.fill, "test");
    });

    it("convertTimeToTimestamp", () => {
      const result = dataSourceUtils.convertTimeToTimestamp("2021-01-01");
      assert.strictEqual(result, "2021-01-01T00:00:00.000000000");
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
        "2021-01-02"
      );
      assert.strictEqual(result, true);
      const result2 = dataSourceUtils.checkIfTimeParamIsCorrect(
        "2021-01-02",
        "2021-01-01"
      );
      assert.strictEqual(result2, false);
    });
  });

  describe("execution", () => {
    it("runQFileTerminal", () => {
      const filename = "test";
      const result = executionUtils.runQFileTerminal(filename);
      assert.strictEqual(result, undefined);
    });

    it("handleQueryResults", () => {
      const results = "test";
      const type = QueryResultType.Error;
      const result = executionUtils.handleQueryResults(results, type);
      assert.strictEqual(result, "!@#ERROR^&*%-test");
    });

    it("convertArrayStringInVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [["a,b"], ["1,2"], ["3,4"]].toString();
      const result = executionUtils
        .convertArrayStringInVector(resultRows)
        .toString();
      assert.equal(result, expectedRes);
    });

    it("convertArrayInVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ].toString();
      const result = executionUtils.convertArrayInVector(resultRows).toString();
      assert.equal(result, expectedRes);
    });

    it("convertResultStringToVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ].toString();
      const result = executionUtils
        .convertResultStringToVector(resultRows)
        .toString();
      assert.equal(result, expectedRes);
    });

    it("convertResultToVector", () => {
      const resultRows = ["a,b", "1,2", "3,4"];
      const expectedRes = [
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ].toString();
      const result = executionUtils
        .convertResultToVector(resultRows)
        .toString();
      assert.equal(result, expectedRes);
    });
  });

  // describe("executionConsole", () => {
  //   let outputChannelMock: sinon.SinonMock;
  //   let executionConsole: executionConsoleUtils.ExecutionConsole;

  //   beforeEach(() => {
  //     outputChannelMock = sinon.mock(
  //       vscode.window.createOutputChannel("Test Output Channel")
  //       executionConsole = new executionConsoleUtils.ExecutionConsole();
  //     );
  //   });

  //   afterEach(() => {
  //     outputChannelMock.restore();
  //   });

  //   it("appendQuery", () => {
  //     const query = "test";
  //     const result = executionConsole.appendQuery(query);
  //     assert.strictEqual(result, "evaluate.q");
  //   });
  // });

  describe("queryUtils", () => {
    it("sanitizeQuery", () => {
      const query1 = "`select from t";
      const query2 = "select from t;";
      const sanitizedQuery1 = queryUtils.sanitizeQuery(query1);
      const sanitizedQuery2 = queryUtils.sanitizeQuery(query2);
      assert.strictEqual(sanitizedQuery1, "`select from t ");
      assert.strictEqual(sanitizedQuery2, "select from t");
    });

    //check how test context
    // it("queryWrapper", () => {
    //   const queryWrapper = queryUtils.queryWrapper();
    //   assert.strictEqual(queryWrapper, "evaluate.q");
    // });

    it("handleWSResults", () => {
      const ab = new ArrayBuffer(128);
      const result = queryUtils.handleWSResults(ab);
      assert.strictEqual(result, "No results found.");
    });

    it("convertRows", () => {
      const rows = [
        {
          a: 1,
          b: 2,
        },
        {
          a: 3,
          b: 4,
        },
      ];
      const expectedRes = ["a,b", "1,2", "3,4"].toString();
      const result = queryUtils.convertRows(rows);
      assert.equal(result, expectedRes);
    });

    it("convertRowsToConsole", () => {
      const rows = ["a,b", "1,2", "3,4"];
      const expectedRes = ["a  b  ", "------", "1  2  ", "3  4  "].toString();
      const result = queryUtils.convertRowsToConsole(rows);
      assert.equal(result, expectedRes);
    });
  });
});
