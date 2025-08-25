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
import * as vscode from "vscode";

import { ext } from "../../../src/extensionVariables";
import { ExecutionTypes } from "../../../src/models/execution";
import { QueryResultType } from "../../../src/models/queryResult";
import * as executionUtils from "../../../src/utils/execution";
import { getPartialDatasourceFile } from "../../../src/utils/dataSource";
import {
  createDefaultDataSourceFile,
  DataSourceTypes,
} from "../../../src/models/dataSource";
import { CellKind } from "../../../src/models/notebook";

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

  describe("getQuery", () => {
    let dummyDsFiles;
    beforeEach(() => {
      dummyDsFiles = createDefaultDataSourceFile();
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => "",
        },
      };
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
    });

    it("should return QSQL string for QSQL datasource", () => {
      dummyDsFiles.dataSource.selectedType = DataSourceTypes.QSQL;
      dummyDsFiles.dataSource.qsql = { query: "select from t" };
      const result = executionUtils.getQuery(dummyDsFiles);
      assert.strictEqual(result, "select from t");
    });

    it("should return SQL string for SQL datasource", () => {
      dummyDsFiles.dataSource.selectedType = DataSourceTypes.SQL;
      dummyDsFiles.dataSource.sql = { query: "SELECT * FROM table" };
      const result = executionUtils.getQuery(dummyDsFiles);
      assert.strictEqual(result, "SELECT * FROM table");
    });

    it("should return entire DSFILE if DSFILE is not QSQL or SQL", () => {
      dummyDsFiles.dataSource.selectedType = DataSourceTypes.API;
      const result = executionUtils.getQuery(dummyDsFiles);
      assert.deepStrictEqual(result, dummyDsFiles);
    });

    it("should return querySelection if execution type is querySelection or PythonQuerySelection", () => {
      const selectedText = "This is the selected text.";
      const fullDocument =
        "This is the selected text. This is the rest of the document.";

      const mockSelection = {
        active: new vscode.Position(0, 0),
        start: new vscode.Position(0, 0),
        end: new vscode.Position(0, 27),
        isEmpty: false,
      };

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: mockSelection,
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range | vscode.Selection) => {
            if (range) {
              return selectedText;
            }
            return fullDocument;
          },
        },
      };

      const result = executionUtils.getQuery(
        undefined,
        ExecutionTypes.QuerySelection,
      );
      assert.strictEqual(result, selectedText);
      const resultPython = executionUtils.getQuery(
        undefined,
        ExecutionTypes.PythonQuerySelection,
      );
      assert.strictEqual(resultPython, selectedText);
    });

    it("should return the entire document text if there is no selection execution type and no DSFile", () => {
      const sampleText = "This is a sample document text.";
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => sampleText,
        },
      };
      let result = executionUtils.getQuery(undefined, ExecutionTypes.QueryFile);
      assert.strictEqual(result, sampleText);

      result = executionUtils.getQuery(
        undefined,
        ExecutionTypes.PythonQueryFile,
      );
      assert.strictEqual(result, sampleText);

      result = executionUtils.getQuery(
        undefined,
        ExecutionTypes.NotebookDataQuerySQL,
      );
      assert.strictEqual(result, sampleText);

      result = executionUtils.getQuery(
        undefined,
        ExecutionTypes.NotebookDataQueryQSQL,
      );
      assert.strictEqual(result, sampleText);

      result = executionUtils.getQuery(
        undefined,
        ExecutionTypes.NotebookDataQueryPython,
      );
      assert.strictEqual(result, sampleText);
    });
  });

  describe("retrieveEditorText", () => {
    beforeEach(() => {
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => "",
        },
      };
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
    });

    it("should return undefined if no active editor", () => {
      ext.activeTextEditor = undefined;
      const result = executionUtils.retrieveEditorText();
      assert.strictEqual(result, undefined);
    });

    it("should return entire document text if execution type is QueryFile", () => {
      const sampleText = "This is a sample document text.";
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => sampleText,
        },
      };
      const result = executionUtils.retrieveEditorText();
      assert.strictEqual(result, sampleText);
    });
  });

  describe("retrieveEditorSelectionToExecute", () => {
    beforeEach(() => {
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => "",
        },
      };
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
    });

    it("should return undefined if no active editor", () => {
      ext.activeTextEditor = undefined;
      const result = executionUtils.retrieveEditorSelectionToExecute();
      assert.strictEqual(result, undefined);
    });

    it("should return selected text if there is a selection", () => {
      const selectedText = "This is the selected text.";
      const fullDocument =
        "This is the selected text. This is the rest of the document.";

      const mockSelection = {
        active: new vscode.Position(0, 0),
        start: new vscode.Position(0, 0),
        end: new vscode.Position(0, 27),
        isEmpty: false,
      };

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: mockSelection,
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range | vscode.Selection) => {
            if (range) {
              return selectedText;
            }
            return fullDocument;
          },
        },
      };

      const result = executionUtils.retrieveEditorSelectionToExecute();
      assert.strictEqual(result, selectedText);
    });

    it("should return entire document text if there is no selection", () => {
      const sampleText = "This is a sample document text.";
      const lineText = "This is a sample document text.";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(0, 0),
          new vscode.Position(0, 0),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => sampleText,
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.retrieveEditorSelectionToExecute();
      assert.strictEqual(result, lineText);
    });
  });

  describe("retrieveQueryData", () => {
    afterEach(() => {
      ext.activeTextEditor = undefined;
    });

    it("should return undefined if no active editor and no query string", () => {
      ext.activeTextEditor = undefined;
      const result = executionUtils.retrieveQueryData();
      assert.strictEqual(result, undefined);
    });

    it("should return the query string if provided", () => {
      const queryString = "This is a query string.";
      const result = executionUtils.retrieveQueryData(queryString);
      assert.strictEqual(result, queryString);
    });

    it("should return selection of document if no query string provided", () => {
      const selectedText = "This is the selected text.";
      const fullDocument =
        "This is the selected text. This is the rest of the document.";

      const mockSelection = {
        active: new vscode.Position(0, 0),
        start: new vscode.Position(0, 0),
        end: new vscode.Position(0, 27),
        isEmpty: false,
      };

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: mockSelection,
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range | vscode.Selection) => {
            if (range) {
              return selectedText;
            }
            return fullDocument;
          },
        },
      };

      const result = executionUtils.retrieveQueryData();
      assert.strictEqual(result, selectedText);
    });
  });

  describe("getDSExecutionType", () => {
    it("should return the selected type from DS file", () => {
      const dummyDsFiles = createDefaultDataSourceFile();
      dummyDsFiles.dataSource.selectedType = DataSourceTypes.QSQL;
      const result = executionUtils.getDSExecutionType(dummyDsFiles);
      assert.strictEqual(result, DataSourceTypes.QSQL);

      dummyDsFiles.dataSource.selectedType = DataSourceTypes.SQL;
      const result2 = executionUtils.getDSExecutionType(dummyDsFiles);
      assert.strictEqual(result2, DataSourceTypes.SQL);

      dummyDsFiles.dataSource.selectedType = DataSourceTypes.API;
      const result3 = executionUtils.getDSExecutionType(dummyDsFiles);
      assert.strictEqual(result3, DataSourceTypes.API);

      dummyDsFiles.dataSource.selectedType = DataSourceTypes.UDA;
      const result4 = executionUtils.getDSExecutionType(dummyDsFiles);
      assert.strictEqual(result4, DataSourceTypes.UDA);
    });

    it("should return DataSourceTypes.QSQL if no DS file provided", () => {
      const result = executionUtils.getDSExecutionType();
      assert.strictEqual(result, DataSourceTypes.QSQL);
    });
  });

  describe("defineNotepadExecutionType", () => {
    it("should return PopulateScratchpadPython for python cell type with variable", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.PYTHON,
        undefined,
        "var",
      );
      assert.strictEqual(result, ExecutionTypes.PopulateScratchpadPython);
    });

    it("should return PopulateScratchpad for q cell type with variable", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.Q,
        undefined,
        "var",
      );
      assert.strictEqual(result, ExecutionTypes.PopulateScratchpad);
    });

    it("should return NotebookDataQueryPython for python cell type with no variable and with target", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.PYTHON,
        "target",
        undefined,
      );
      assert.strictEqual(result, ExecutionTypes.NotebookDataQueryPython);
    });

    it("should return NotebookQueryPython for python cell type with no variable and no target", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.PYTHON,
        undefined,
        undefined,
      );
      assert.strictEqual(result, ExecutionTypes.NotebookQueryPython);
    });

    it("should return NotebookQueryQSQL for q cell type with no variable and no target", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.Q,
        undefined,
        undefined,
      );
      assert.strictEqual(result, ExecutionTypes.NotebookQueryQSQL);
    });

    it("should return NotebookDataQueryQSQL for q cell type with no variable and with target", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.Q,
        "target",
        undefined,
      );
      assert.strictEqual(result, ExecutionTypes.NotebookDataQueryQSQL);
    });

    it("should return NotebookDataQuerySQL for sql cell type with no variable", () => {
      const result = executionUtils.defineNotepadExecutionType(
        CellKind.SQL,
        undefined,
        undefined,
      );
      assert.strictEqual(result, ExecutionTypes.NotebookDataQuerySQL);
    });
  });

  describe("getExecutionQueryContext", () => {
    beforeEach(() => {
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => "",
        },
      };
    });

    afterEach(() => {
      ext.activeTextEditor = undefined;
    });

    it("should return default context '.' when no active editor", () => {
      ext.activeTextEditor = undefined;
      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, ".");
    });

    it("should return default context '.' when no system command is found", () => {
      const sampleText = "select from table\ncount from trades";
      const lineText = "count from trades";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(1, 0),
          new vscode.Position(1, 17),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return "select from table\ncount from trades";
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, ".");
    });

    it("should return context from system command with 'system \"d'", () => {
      const sampleText = 'system "d /home/data"\nselect from table';
      const lineText = "select from table";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(1, 0),
          new vscode.Position(1, 17),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return 'system "d /home/data"\nselect from table';
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, "/home/data");
    });

    it("should return context from \\d command", () => {
      const sampleText = "\\d /var/logs\ncount from table";
      const lineText = "count from table";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(1, 0),
          new vscode.Position(1, 16),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return "\\d /var/logs\ncount from table";
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, "/var/logs");
    });

    it("should return last matching context when multiple system commands exist", () => {
      const sampleText =
        'system "d /first/path"\n\\d /second/path\nselect from table';
      const lineText = "select from table";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(2, 0),
          new vscode.Position(2, 17),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return 'system "d /first/path"\n\\d /second/path\nselect from table';
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, "/second/path");
    });

    it("should handle fullText scenario when lineNum is not a number", () => {
      const sampleText = 'system "d /workspace"\nselect from trades';

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: {
          end: { line: "notANumber" as any },
          active: new vscode.Position(0, 0),
        },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => sampleText,
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, "/workspace");
    });

    it("should handle system command with extra spaces", () => {
      const sampleText = 'system  "d    /path/with/spaces"\nquery here';
      const lineText = "query here";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(1, 0),
          new vscode.Position(1, 10),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return 'system  "d    /path/with/spaces"\nquery here';
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, "/path/with/spaces");
    });

    it("should handle \\d command with extra spaces", () => {
      const sampleText = "\\d   /another/path\nsome query";
      const lineText = "some query";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(1, 0),
          new vscode.Position(1, 10),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return "\\d   /another/path\nsome query";
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, "/another/path");
    });

    it("should return default context when pattern matches but no capture group", () => {
      const sampleText = "system d\nselect from table";
      const lineText = "select from table";

      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: new vscode.Selection(
          new vscode.Position(1, 0),
          new vscode.Position(1, 17),
        ),
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: (range?: vscode.Range) => {
            if (range) {
              return "system d\nselect from table";
            }
            return sampleText;
          },
          lineAt: (line: number) => ({
            text: lineText,
            lineNumber: line,
            range: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line, lineText.length),
            ),
            rangeIncludingLineBreak: new vscode.Range(
              new vscode.Position(line, 0),
              new vscode.Position(line + 1, 0),
            ),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: false,
          }),
        },
      };

      const result = executionUtils.getExecutionQueryContext();
      assert.strictEqual(result, ".");
    });
  });
});
