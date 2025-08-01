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
import * as sinon from "sinon";

import { ext } from "../../../src/extensionVariables";
import { DCDS } from "../../../src/ipc/c";
import {
  DDateClass,
  DDateTimeClass,
  DTimestampClass,
} from "../../../src/ipc/cClasses";
import * as QTable from "../../../src/ipc/QTable";
import { ServerType } from "../../../src/models/connectionsModels";
import { DataSourceTypes } from "../../../src/models/dataSource";
import * as queryUtils from "../../../src/utils/queryUtils";

describe("queryUtils", () => {
  it("sanitizeQuery", () => {
    const query1 = "`select from t";
    const query2 = "select from t;";
    const sanitizedQuery1 = queryUtils.sanitizeQuery(query1);
    const sanitizedQuery2 = queryUtils.sanitizeQuery(query2);

    assert.strictEqual(sanitizedQuery1, "`select from t ");
    assert.strictEqual(sanitizedQuery2, "select from t");
  });

  describe("getValueFromArray", () => {
    let inputSample: DCDS = undefined;
    beforeEach(() => {
      inputSample = {
        class: "203",
        columns: ["Value"],
        meta: { Value: 7 },
        rows: [],
      };
    });

    it("should return the value of the 'Value' property if the input is an array with a single object with a 'Value' property", () => {
      inputSample.rows = [{ Value: "hello" }];
      const expectedOutput = [{ Value: "hello" }];
      const actualOutput = queryUtils.getValueFromArray(inputSample);

      assert.deepEqual(actualOutput.rows, expectedOutput);
    });

    it("should return the input array if it is not an array with a single object with a 'Value' property", () => {
      inputSample.rows = [{ Value: "hello" }, { Value: "world" }];
      const expectedOutput = [{ Value: "hello" }, { Value: "world" }];
      const actualOutput = queryUtils.getValueFromArray(inputSample);

      assert.deepStrictEqual(actualOutput.rows, expectedOutput);
    });

    it("should return the input array if it is an empty array", () => {
      const expectedOutput: any[] = [];
      const actualOutput = queryUtils.getValueFromArray(inputSample);

      assert.deepStrictEqual(actualOutput.rows, expectedOutput);
    });
  });

  describe("handleWSResults", () => {
    afterEach(() => {
      sinon.restore();
      ext.isResultsTabVisible = false;
    });

    it("should return no results found", () => {
      const ab = new ArrayBuffer(128);
      const result = queryUtils.handleWSResults(ab);

      assert.strictEqual(result, "No results found.");
    });

    it("should return the result of getValueFromArray if the results are an array with a single object with a 'Value' property", () => {
      const ab = new ArrayBuffer(128);
      const expectedOutput = {
        class: "203",
        columns: ["Value"],
        meta: { Value: 7 },
        rows: [{ Value: "10" }],
      };

      ext.isResultsTabVisible = true;
      sinon.stub(QTable.default, "toLegacy").returns(expectedOutput);
      const convertRowsSpy = sinon.spy(queryUtils, "convertRows");
      const result = queryUtils.handleWSResults(ab);

      sinon.assert.notCalled(convertRowsSpy);
      assert.strictEqual(result, expectedOutput);
    });
  });

  describe("handleScratchpadTableRes", () => {
    let inputSample: DCDS = undefined;
    beforeEach(() => {
      inputSample = {
        class: "203",
        columns: ["Value"],
        meta: { Value: 7 },
        rows: [],
      };
    });

    it("should convert bigint values to number", () => {
      inputSample.rows = [
        { key1: BigInt(123), key2: "value2" },
        { key3: BigInt(456), key4: "value4" },
      ];
      const expected = [
        { Index: 1, key1: 123, key2: "value2" },
        { Index: 2, key3: 456, key4: "value4" },
      ];
      const result = queryUtils.handleScratchpadTableRes(inputSample);

      assert.deepStrictEqual(result.rows, expected);
    });

    it("should not modify other values", () => {
      inputSample.rows = [
        { key1: "value1", key2: "value2" },
        { key3: "value3", key4: "value4" },
      ];
      const result = queryUtils.handleScratchpadTableRes(inputSample);

      assert.deepStrictEqual(result.rows, inputSample.rows);
    });

    it("should return case results is string type", () => {
      const result = queryUtils.handleScratchpadTableRes("test");

      assert.strictEqual(result, "test");
    });

    it("should return same results case results.rows is undefined", () => {
      inputSample.rows = undefined;
      const result = queryUtils.handleScratchpadTableRes(inputSample);

      assert.strictEqual(result, inputSample);
    });

    it("should return same results case results.rows is an empty array", () => {
      const result = queryUtils.handleScratchpadTableRes(inputSample);

      assert.strictEqual(result, inputSample);
    });
  });

  describe("checkIfIsQDateTypes", () => {
    it("should return string representation of DTimestampClass instance", () => {
      const input = { Value: new DTimestampClass(978350400000, 0) };
      const expectedOutput = input.Value.toString();
      const output = queryUtils.checkIfIsQDateTypes(input);

      assert.strictEqual(output, expectedOutput);
    });

    it("should return string representation of DDateTimeClass instance", () => {
      const input = { Value: new DDateTimeClass(978350400000) };
      const expectedOutput = input.Value.toString();
      const output = queryUtils.checkIfIsQDateTypes(input);

      assert.strictEqual(output, expectedOutput);
    });

    it("should return string representation of DDateClass instance", () => {
      const input = { Value: new DDateClass(978350400000) };
      const expectedOutput = input.Value.toString();
      const output = queryUtils.checkIfIsQDateTypes(input);

      assert.strictEqual(output, expectedOutput);
    });

    it("should return input as is when Value is not an instance of DTimestampClass, DDateTimeClass, or DDateClass", () => {
      const input = {
        Value:
          "not an instance of DTimestampClass, DDateTimeClass, or DDateClass",
      };
      const output = queryUtils.checkIfIsQDateTypes(input);

      assert.deepStrictEqual(output, input);
    });
  });

  describe("addIndexKey", () => {
    it("should add index key to array of objects", () => {
      const input = [
        { prop1: "value1", prop2: "value2" },
        { prop1: "value3", prop2: "value4" },
      ];
      const expectedOutput = [
        { Index: 1, prop1: "value1", prop2: "value2" },
        { Index: 2, prop1: "value3", prop2: "value4" },
      ];
      const output = queryUtils.addIndexKey(input);

      assert.deepStrictEqual(output, expectedOutput);
    });

    it("should add index key to single object", () => {
      const input = { prop1: "value1", prop2: "value2" };
      const expectedOutput = [{ Index: 1, prop1: "value1", prop2: "value2" }];
      const output = queryUtils.addIndexKey(input);

      assert.deepStrictEqual(output, expectedOutput);
    });

    it("should return empty array when input is empty array", () => {
      const input = [];
      const expectedOutput = [];
      const output = queryUtils.addIndexKey(input);

      assert.deepStrictEqual(output, expectedOutput);
    });

    it("should not add index key when it already exists", () => {
      const input = [{ Index: 5, prop1: "value1", prop2: "value2" }];
      const expectedOutput = [{ Index: 5, prop1: "value1", prop2: "value2" }];
      const output = queryUtils.addIndexKey(input);

      assert.deepStrictEqual(output, expectedOutput);
    });

    it("should add index key to non-array input", () => {
      const input = "not an array";
      const expectedOutput = [{ Index: 1, Value: "not an array" }];
      const output = queryUtils.addIndexKey(input);

      assert.deepStrictEqual(output, expectedOutput);
    });
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
    const expectedRes = ["a  b  \n------\n1  2  \n3  4  \n\n"].toString();
    const result = queryUtils.convertRows(rows);

    assert.equal(result, expectedRes);
  });

  describe("convertRowsToConsole", () => {
    it("should work with headers", () => {
      const rows = ["a#$#;header;#$#b", "1#$#;#$#2", "3#$#;#$#4"];
      const expectedRes = ["a  b  ", "------", "1  2  ", "3  4  "];
      const result = queryUtils.convertRowsToConsole(rows);

      assert.deepEqual(result, expectedRes);
    });

    it("should work without headers", () => {
      const rows = ["a#$#;#$#1", "b#$#;#$#2", "c#$#;#$#3"];
      const expectedRes = ["a| 1  ", "b| 2  ", "c| 3  "];
      const result = queryUtils.convertRowsToConsole(rows);

      assert.deepEqual(result, expectedRes);
    });

    it("should work with empty rows", () => {
      const rows = [];
      const expectedRes = [];
      const result = queryUtils.convertRowsToConsole(rows);

      assert.deepEqual(result, expectedRes);
    });
  });

  it("getConnectionType", () => {
    const params: ServerType[] = [
      ServerType.INSIGHTS,
      ServerType.KDB,
      ServerType.undefined,
    ];
    const expectedRes = ["insights", "kdb", "undefined"];

    for (let i = 0; i < params.length; i++) {
      const result = queryUtils.getConnectionType(params[i]);

      assert.equal(result, expectedRes[i]);
    }
  });

  describe("handleWSError", () => {
    let sandbox: sinon.SinonSandbox;
    const abTest = new Uint8Array([
      1, 2, 0, 0, 114, 1, 0, 0, 0, 0, 2, 0, 0, 0, 99, 11, 0, 17, 0, 0, 0, 0,
      114, 99, 118, 84, 83, 0, 99, 111, 114, 114, 0, 112, 114, 111, 116, 111,
      99, 111, 108, 0, 108, 111, 103, 67, 111, 114, 114, 0, 99, 108, 105, 101,
      110, 116, 0, 104, 116, 116, 112, 0, 97, 112, 105, 0, 117, 115, 101, 114,
      78, 97, 109, 101, 0, 117, 115, 101, 114, 73, 68, 0, 116, 105, 109, 101,
      111, 117, 116, 0, 116, 111, 0, 112, 118, 86, 101, 114, 0, 114, 101, 102,
      86, 105, 110, 116, 97, 103, 101, 0, 114, 99, 0, 97, 99, 0, 97, 105, 0, 0,
      0, 17, 0, 0, 0, 101, 0, 244, 0, 168, 200, 104, 217, 55, 151, 10, 254, 148,
      230, 16, 238, 61, 245, 76, 4, 178, 72, 184, 185, 138, 80, 65, 216, 245,
      103, 119, 0, 10, 0, 36, 0, 0, 0, 57, 52, 101, 54, 49, 48, 101, 101, 45,
      51, 100, 102, 53, 45, 52, 99, 48, 52, 45, 98, 50, 52, 56, 45, 98, 56, 98,
      57, 56, 97, 53, 48, 52, 49, 100, 56, 245, 58, 49, 48, 46, 57, 46, 49, 51,
      56, 46, 49, 57, 50, 58, 53, 48, 53, 48, 0, 245, 111, 99, 116, 101, 116,
      115, 116, 114, 101, 97, 109, 0, 245, 46, 107, 120, 105, 46, 113, 115, 113,
      108, 0, 245, 0, 254, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 249,
      96, 234, 0, 0, 0, 0, 0, 0, 244, 0, 0, 16, 97, 231, 55, 151, 10, 249, 134,
      0, 0, 0, 0, 0, 0, 0, 249, 1, 0, 0, 0, 0, 0, 0, 128, 251, 10, 0, 251, 10,
      0, 10, 0, 54, 0, 0, 0, 85, 110, 101, 120, 112, 101, 99, 116, 101, 100, 32,
      101, 114, 114, 111, 114, 32, 40, 110, 49, 48, 41, 32, 101, 110, 99, 111,
      117, 110, 116, 101, 114, 101, 100, 32, 101, 120, 101, 99, 117, 116, 105,
      110, 103, 32, 46, 107, 120, 105, 46, 113, 115, 113, 108, 0, 0, 0, 0, 0, 0,
    ]);

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should handle qe/sql & gateway/data error", () => {
      const ab = new ArrayBuffer(10);
      const result = queryUtils.handleWSError(ab);

      assert.deepStrictEqual(result, { error: "Query error" });
    });

    it("should handle unknown error", () => {
      const ab = new ArrayBuffer(8);
      const result = queryUtils.handleWSError(ab);

      assert.deepStrictEqual(result, { error: "Query error" });
    });

    it("should handle qe/sql error", () => {
      const result = queryUtils.handleWSError(abTest.buffer);

      assert.deepStrictEqual(result, {
        error: "Unexpected error (n10) encountered executing .kxi.qsql",
      });
    });
  });

  describe("addQueryHistory", () => {
    it("addQueryHistory", () => {
      const query = "SELECT * FROM table";
      const connectionName = "test";
      const connectionType = ServerType.KDB;

      ext.kdbQueryHistoryList.length = 0;

      queryUtils.addQueryHistory(
        query,
        "fileName",
        connectionName,
        connectionType,
        true,
      );
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
    });

    it("addQueryHistory in python", () => {
      const query = "SELECT * FROM table";
      const connectionName = "test";
      const connectionType = ServerType.KDB;

      ext.kdbQueryHistoryList.length = 0;

      queryUtils.addQueryHistory(
        query,
        connectionName,
        "fileName",
        connectionType,
        true,
        true,
      );
      assert.strictEqual(ext.kdbQueryHistoryList.length, 1);
    });
  });

  describe("formatScratchpadStacktrace", () => {
    it("should format a Scratchpad stacktrace correctly", () => {
      const stacktrace = [
        { name: "g", isNested: false, text: ["{a:x*2;a", "+y}"] },
        { name: "f", isNested: false, text: ["{", "g[x;2#y]}"] },
        { name: "", isNested: false, text: ["", 'f[3;"hello"]'] },
      ];
      const formatted = queryUtils.formatScratchpadStacktrace(stacktrace);

      assert.strictEqual(
        formatted,
        '[2] g{a:x*2;a+y}\n             ^\n[1] f{g[x;2#y]}\n      ^\n[0] f[3;"hello"]\n    ^',
      );
    });

    it("should format a Scratchpad stacktrace with nested function correctly", () => {
      const stacktrace = [
        { name: "f", isNested: true, text: ["{a:x*2;a", "+y}"] },
        { name: "f", isNested: false, text: ["{", "{a:x*2;a+y}[x;2#y]}"] },
        { name: "", isNested: false, text: ["", 'f[3;"hello"]'] },
      ];
      const formatted = queryUtils.formatScratchpadStacktrace(stacktrace);

      assert.strictEqual(
        formatted,
        '[2] f @ {a:x*2;a+y}\n                ^\n[1] f{{a:x*2;a+y}[x;2#y]}\n      ^\n[0] f[3;"hello"]\n    ^',
      );
    });
  });

  describe("selectDSType", () => {
    it("should return correct DataSourceTypes for given input", function () {
      assert.equal(queryUtils.selectDSType("API"), DataSourceTypes.API);
      assert.equal(queryUtils.selectDSType("QSQL"), DataSourceTypes.QSQL);
      assert.equal(queryUtils.selectDSType("SQL"), DataSourceTypes.SQL);
    });

    it("should return undefined for unknown input", function () {
      assert.equal(queryUtils.selectDSType("unknown"), undefined);
    });
  });

  describe("normalizeQSQLQuery", () => {
    it("should trim query", () => {
      const res = queryUtils.normalizeQSQLQuery("  a:1  ");

      assert.strictEqual(res, "a:1");
    });

    it("should remove block comment", () => {
      let res = queryUtils.normalizeQSQLQuery("/\nBlock Comment\n\\\na:1");
      assert.strictEqual(res, "a:1");
      res = queryUtils.normalizeQSQLQuery("/\r\nBlock Comment\r\n\\\r\na:1");
      assert.strictEqual(res, "a:1");
    });

    it("should remove single line comment", () => {
      let res = queryUtils.normalizeQSQLQuery("/ single line comment\na:1");
      assert.strictEqual(res, "a:1");
      res = queryUtils.normalizeQSQLQuery("/ single line comment\r\na:1");
      assert.strictEqual(res, "a:1");
    });

    it("should remove line comment", () => {
      const res = queryUtils.normalizeQSQLQuery("a:1 / line comment");

      assert.strictEqual(res, "a:1");
    });

    it("should ignore line comment in a string", () => {
      const res = queryUtils.normalizeQSQLQuery('a:"1 / not line comment"');

      assert.strictEqual(res, 'a:"1 / not line comment"');
    });

    it("should replace EOS with semicolon", () => {
      let res = queryUtils.normalizeQSQLQuery("a:1\na");
      assert.strictEqual(res, "a:1;a");
      res = queryUtils.normalizeQSQLQuery("a:1\r\na");
      assert.strictEqual(res, "a:1;a");
    });

    it("should escpae new lines in strings", () => {
      let res = queryUtils.normalizeQSQLQuery('a:"a\n \nb"');
      assert.strictEqual(res, 'a:"a\\n \\nb"');
      res = queryUtils.normalizeQSQLQuery('a:"a\r\n \r\nb"');
      assert.strictEqual(res, 'a:"a\\n \\nb"');
    });
  });

  describe("resultToBase64", () => {
    const png = [
      "0x89",
      "0x50",
      "0x4e",
      "0x47",
      "0x0d",
      "0x0a",
      "0x1a",
      "0x0a",
    ];
    const img = Array.from({ length: 59 }, () => "0x00");

    it("should return undefined for undefined", () => {
      const result = queryUtils.resultToBase64(undefined);

      assert.strictEqual(result, undefined);
    });

    it("should return undefined for just signature", () => {
      const result = queryUtils.resultToBase64(png);

      assert.strictEqual(result, undefined);
    });

    it("should return undefined for bad signature", () => {
      const result = queryUtils.resultToBase64([
        ...png.map((v) => parseInt(v, 16) + 1),
        ...img,
      ]);

      assert.strictEqual(result, undefined);
    });

    it("should return base64 for minimum img str", () => {
      const result = queryUtils.resultToBase64([...png, ...img]);

      assert.ok(result);
    });

    it("should return base64 for minimum img num", () => {
      const result = queryUtils.resultToBase64([
        ...png.map((v) => parseInt(v, 16)),
        ...img.map((v) => parseInt(v, 16)),
      ]);

      assert.ok(result);
    });

    it("should return base64 for minimum img str for structuredText", () => {
      const result = queryUtils.resultToBase64({
        columns: { values: [...png, ...img] },
      });

      assert.ok(result);
    });

    it("should return base64 for minimum img str for structuredText v2", () => {
      const result = queryUtils.resultToBase64({
        columns: [{ values: [...png, ...img] }],
      });

      assert.ok(result);
    });

    it("should return undefined for bogus structuredText", () => {
      const result = queryUtils.resultToBase64({
        columns: {},
      });

      assert.strictEqual(result, undefined);
    });

    it("should return undefined for bogus structuredText v2", () => {
      const result = queryUtils.resultToBase64({
        columns: [],
      });

      assert.strictEqual(result, undefined);
    });

    it("should return base64 from windows q server", () => {
      const result = queryUtils.resultToBase64([
        ...png.map((v) => `${v}\r`),
        ...img.map((v) => `${v}\r`),
      ]);

      assert.ok(result);
    });
  });

  describe("normalizeQuery", () => {
    it("should return normalized query under query limit", () => {
      const query = "1234567890".repeat(25000);
      const res = queryUtils.normalizeQuery(query);

      assert.strictEqual(res, query);
    });

    it("should throw when limit reached", () => {
      const query = "1234567890".repeat(25000) + "1";

      assert.throws(() => queryUtils.normalizeQuery(query));
    });
  });

  describe("normalizePyQuery", () => {
    it("should escape double quotes", () => {
      const res = queryUtils.normalizePyQuery('a="test"');

      assert.strictEqual(res, 'a=\\"test\\"');
    });
  });

  describe("getQSQLWrapper", () => {
    let queryWrappeStub: sinon.SinonStub;

    it("should normalize q code", () => {
      const res = queryUtils.getQSQLWrapper("a:1;\na");

      assert.strictEqual(res, "a:1;;a");
    });

    it("should normalize python code using wrapper", () => {
      assert.throws(() => {
        queryUtils.getQSQLWrapper(``, true);
        sinon.assert.calledOnce(queryWrappeStub);
      });
    });
  });

  describe("needsScratchpad", () => {
    it("should return the promise", async () => {
      const res = await queryUtils.needsScratchpad(
        "test",
        Promise.resolve("test"),
      );

      assert.strictEqual(res, "test");
    });

    it("should reset scratchpad started status", async () => {
      ext.scratchpadStarted.add("test");
      queryUtils.resetScratchpadStarted("test");
      assert.strictEqual(ext.scratchpadStarted.has("test"), false);
    });
  });
});
