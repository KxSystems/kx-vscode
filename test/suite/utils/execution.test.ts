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

import { ExecutionTypes } from "../../../src/models/execution";
import { QueryResultType } from "../../../src/models/queryResult";
import * as executionUtils from "../../../src/utils/execution";

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
    assert.strictEqual(result, "test");
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
    const result = executionUtils.convertResultToVector(resultRows).toString();
    assert.equal(result, expectedRes);
  });

  describe("convertArrayOfArraysToObjects", () => {
    it("should return an empty array if the input is not an array", () => {
      const result = executionUtils.convertArrayOfArraysToObjects(null);
      assert.deepStrictEqual(result, null);
    });

    it("should return the input array if it is empty", () => {
      const result = executionUtils.convertArrayOfArraysToObjects([]);
      assert.deepStrictEqual(result, []);
    });

    it("should return the input array if the first row is not an array", () => {
      const result = executionUtils.convertArrayOfArraysToObjects([1, 2, 3]);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it("should return the input array if the first row is empty", () => {
      const result = executionUtils.convertArrayOfArraysToObjects([[]]);
      assert.deepStrictEqual(result, [[]]);
    });

    it("should return an empty array if any row has a different length than the first row", () => {
      const result = executionUtils.convertArrayOfArraysToObjects([
        [1, 2],
        [3],
      ]);
      assert.deepStrictEqual(result, []);
    });

    it("should convert an array of arrays to an array of objects", () => {
      const input = [
        [{ b: 0 }, { b: 1 }, { b: 2 }],
        [{ a: 0 }, { a: 1 }, { a: 2 }],
      ];
      const expectedOutput = [
        { b: 0, a: 0 },
        { b: 1, a: 1 },
        { b: 2, a: 2 },
      ];
      const result = executionUtils.convertArrayOfArraysToObjects(input);
      assert.deepStrictEqual(result, expectedOutput);
    });
  });

  describe("convertArrayOfObjectsToArrays", () => {
    it("convertStringToArray handles string with separator", () => {
      const input = "key1 | value1\nkey2 | value2";
      const expectedOutput = [
        { Index: 1, Key: "key1", Value: "value1" },
        { Index: 2, Key: "key2", Value: "value2" },
      ];
      const output = executionUtils.convertStringToArray(input);
      assert.deepStrictEqual(output, expectedOutput);
    });

    it("convertStringToArray handles string without separator", () => {
      const input = "value1\nvalue2";
      const expectedOutput = [
        { Index: 1, Value: "value1" },
        { Index: 2, Value: "value2" },
      ];
      const output = executionUtils.convertStringToArray(input);
      assert.deepStrictEqual(output, expectedOutput);
    });

    it("convertStringToArray handles string with field names and lengths", () => {
      const input = "name age\n---\nJohn 25\nDoe  30";
      const expectedOutput = [
        { Index: 1, name: "John", age: "25" },
        { Index: 2, name: "Doe", age: "30" },
      ];
      const output = executionUtils.convertStringToArray(input);
      assert.deepStrictEqual(output, expectedOutput);
    });

    it("convertStringToArray filters out lines starting with '-'", () => {
      const input = "key1 | value1\nkey2 | value2\nkey3 | value3";
      const expectedOutput = [
        { Index: 1, Key: "key1", Value: "value1" },
        { Index: 2, Key: "key2", Value: "value2" },
        { Index: 3, Key: "key3", Value: "value3" },
      ];
      const output = executionUtils.convertStringToArray(input);
      assert.deepStrictEqual(output, expectedOutput);
    });

    it("convertStringToArray handles single value results", () => {
      const input = "2001.01.01D12:00:00.000000000\n";
      const expectedOutput = [
        { Index: 1, Value: "2001.01.01D12:00:00.000000000" },
      ];
      const output = executionUtils.convertStringToArray(input);
      assert.deepStrictEqual(output, expectedOutput);
    });

    it("convertStringToArray handles single line with multiple value results", () => {
      const input =
        "2001.01.01D12:00:00.000000000 2001.01.01D12:00:00.000000001\n";
      const expectedOutput = [
        { Index: 1, Value: "2001.01.01D12:00:00.000000000" },
        { Index: 2, Value: "2001.01.01D12:00:00.000000001" },
      ];
      const output = executionUtils.convertStringToArray(input);
      assert.deepStrictEqual(output, expectedOutput);
    });
  });

  describe("isExecutionPython", () => {
    it("should return true for Python execution types", () => {
      assert.strictEqual(
        executionUtils.isExecutionPython(
          ExecutionTypes.NotebookDataQueryPython,
        ),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.NotebookQueryPython),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(
          ExecutionTypes.PopulateScratchpadPython,
        ),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.PythonDataQueryFile),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(
          ExecutionTypes.PythonDataQuerySelection,
        ),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.PythonQueryFile),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.PythonQuerySelection),
        true,
      );
    });

    it("should return false for non-Python execution types", () => {
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.DataQueryFile),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.DataQuerySelection),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.NotebookDataQueryQSQL),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.NotebookDataQuerySQL),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.NotebookQueryQSQL),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.PopulateScratchpad),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.QueryDatasource),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.QueryFile),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(ExecutionTypes.QuerySelection),
        false,
      );
    });

    it("should handle invalid execution type gracefully", () => {
      assert.strictEqual(
        executionUtils.isExecutionPython(999 as ExecutionTypes),
        false,
      );
      assert.strictEqual(
        executionUtils.isExecutionPython(-1 as ExecutionTypes),
        false,
      );
    });
  });

  describe("isExecutionNotebook", () => {
    it("should return true for Notebook execution types", () => {
      assert.strictEqual(
        executionUtils.isExecutionNotebook(
          ExecutionTypes.NotebookDataQueryPython,
        ),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(
          ExecutionTypes.NotebookDataQueryQSQL,
        ),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.NotebookDataQuerySQL),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.NotebookQueryPython),
        true,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.NotebookQueryQSQL),
        true,
      );
    });

    it("should return undefined for non-Notebook execution types", () => {
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.DataQueryFile),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.DataQuerySelection),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.PopulateScratchpad),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(
          ExecutionTypes.PopulateScratchpadPython,
        ),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.PythonDataQueryFile),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(
          ExecutionTypes.PythonDataQuerySelection,
        ),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.PythonQueryFile),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.PythonQuerySelection),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.QueryDatasource),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.QueryFile),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(ExecutionTypes.QuerySelection),
        undefined,
      );
    });

    it("should handle invalid execution type gracefully", () => {
      assert.strictEqual(
        executionUtils.isExecutionNotebook(999 as ExecutionTypes),
        undefined,
      );
      assert.strictEqual(
        executionUtils.isExecutionNotebook(-1 as ExecutionTypes),
        undefined,
      );
    });
  });
});
