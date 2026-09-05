/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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
import * as path from "node:path";
import * as sinon from "sinon";

import { ext } from "../../../src/extensionVariables";
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

  describe("convertRows from a structured text result", () => {
    const column = (
      name: string,
      type: string,
      values: string[],
      isKey = false,
    ) => ({ name, type, values, order: [], isKey });

    it("should rule off a table with a single column", () => {
      const results = {
        count: 3,
        columns: [column("trip_id", "long", ["1546339", "97738", "626"])],
      };
      const rows = [
        { trip_id: "1546339" },
        { trip_id: "97738" },
        { trip_id: "626" },
      ];
      const result = queryUtils.convertRows(rows, 0, results);

      assert.strictEqual(
        result,
        "trip_id  \n---------\n1546339  \n97738    \n626      \n\n",
      );
    });

    it("should print a list without a header", () => {
      const results = {
        count: 3,
        columns: [column("values", "longs", ["1", "2", "3"])],
      };
      const rows = [{ values: "1" }, { values: "2" }, { values: "3" }];
      const result = queryUtils.convertRows(rows, 0, results);

      assert.strictEqual(result, "1  \n2  \n3  \n\n");
    });

    it("should separate a dictionary's key with a pipe", () => {
      const results = {
        count: 3,
        columns: [
          column("key", "symbol", ["a", "bb", "c"], true),
          column("values", "long", ["1", "2", "3"]),
        ],
      };
      const rows = [
        { key: "a", values: "1" },
        { key: "bb", values: "2" },
        { key: "c", values: "3" },
      ];
      const result = queryUtils.convertRows(rows, 0, results);

      assert.strictEqual(result, "a | 1  \nbb| 2  \nc | 3  \n\n");
    });

    it("should carry a keyed table's key through the rule", () => {
      const results = {
        count: 3,
        columns: [
          column("a", "long", ["1", "2", "3"], true),
          column("b", "long", ["4", "5", "6"]),
        ],
      };
      const rows = [
        { a: "1", b: "4" },
        { a: "2", b: "5" },
        { a: "3", b: "6" },
      ];
      const result = queryUtils.convertRows(rows, 0, results);

      assert.strictEqual(result, "a| b  \n-| ---\n1| 4  \n2| 5  \n3| 6  \n\n");
    });

    it("should show the schema of an empty result", () => {
      const results = {
        count: 0,
        columns: [
          column("isFile", "boolean", []),
          column("path", "symbol", []),
        ],
      };
      const result = queryUtils.convertRows([], 0, results);

      assert.strictEqual(
        result,
        "isFile [boolean]  path [symbol]  \n---------------------------------\n\n",
      );
    });

    it("should keep the newlines of a single value", () => {
      const lambda = "{[a;b;c]\n    c+: b;\n    c }";
      const results = {
        count: 1,
        columns: [column("values", "lambda", [lambda])],
      };
      const result = queryUtils.convertRows([{ values: lambda }], 0, results);

      assert.strictEqual(result, lambda + "\n\n");
    });

    it("should return nothing to show when there are no columns", () => {
      const result = queryUtils.convertRows([], 0, { count: 0, columns: [] });

      assert.deepStrictEqual(result, []);
    });
  });

  describe("convertRowsToConsole", () => {
    it("should work with headers", () => {
      const rows = ["#$#;header;#$#a#$#;#$#b", "1#$#;#$#2", "3#$#;#$#4"];
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

    it("should keep a column list on one line", () => {
      const rows = [
        "#$#;header;#$#id#$#;#$#components",
        '"KXI-1"#$#;#$#"Insights UI"\n"Scratchpad"',
        '"KXI-2"#$#;#$#"Pipeline UI"',
      ];
      const result = queryUtils.convertRowsToConsole(rows);

      assert.deepEqual(result, [
        "id       components                  ",
        "-------------------------------------",
        '"KXI-1"  "Insights UI" "Scratchpad"  ',
        '"KXI-2"  "Pipeline UI"               ',
      ]);
    });

    it("should cut a row that does not fit the width", () => {
      const rows = [
        "#$#;header;#$#aa#$#;#$#bb#$#;#$#cc",
        "11#$#;#$#22#$#;#$#33",
      ];
      const result = queryUtils.convertRowsToConsole(rows, 11);

      assert.deepEqual(result, ["aa  bb  c..", "-----------", "11  22  3.."]);
    });

    it("should leave a row that fits the width alone", () => {
      const rows = ["#$#;header;#$#a#$#;#$#b", "1#$#;#$#2"];
      const result = queryUtils.convertRowsToConsole(rows, 40);

      assert.deepEqual(result, ["a  b  ", "------", "1  2  "]);
    });

    it("should keep the start of a column too wide to fit", () => {
      const rows = ["#$#;header;#$#id#$#;#$#text", "1#$#;#$#0123456789abcdef"];
      const result = queryUtils.convertRowsToConsole(rows, 12);

      assert.deepEqual(result, [
        "id  text  ..",
        "------------",
        "1   012345..",
      ]);
    });

    it("should keep a row with newlines in it on one line", () => {
      const rows = [
        "#$#;header;#$#a#$#;#$#b",
        "a1\na2#$#;#$#b1\nb2",
        "3#$#;#$#4",
      ];
      const expectedRes = [
        "a      b      ",
        "--------------",
        "a1 a2  b1 b2  ",
        "3      4      ",
      ];
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

  describe("appendStacktrace", () => {
    it("should return the message alone when there is no stacktrace", () => {
      assert.strictEqual(
        queryUtils.appendStacktrace("type", undefined),
        "type",
      );
    });

    it("should append a string stacktrace as it arrived", () => {
      assert.strictEqual(
        queryUtils.appendStacktrace("type", "  [0] {1+x}\n        ^\n"),
        "type\n  [0] {1+x}\n        ^\n",
      );
    });

    it("should format a frame list before appending it", () => {
      const stacktrace = [
        { name: "f", isNested: false, text: ["{a:x*2;a", "+y}"] },
      ];

      assert.strictEqual(
        queryUtils.appendStacktrace("type", stacktrace),
        "type\n" + queryUtils.formatScratchpadStacktrace(stacktrace),
      );
    });
  });

  describe("formatScratchpadError", () => {
    it("should prefix the error message", () => {
      assert.strictEqual(
        queryUtils.formatScratchpadError({
          data: "",
          error: true,
          errorMsg: "type",
          sessionID: "1",
        }),
        "Error: type",
      );
    });

    it("should fall back to a string error when there is no message", () => {
      assert.strictEqual(
        queryUtils.formatScratchpadError({
          data: "",
          error: "Internal server error",
          sessionID: "1",
        }),
        "Error: Internal server error",
      );
    });

    it("should fall back to Unknown error when the error is a flag", () => {
      assert.strictEqual(
        queryUtils.formatScratchpadError({
          data: "",
          error: true,
          sessionID: "1",
        }),
        "Error: Unknown error",
      );
    });

    it("should explain an unknown UDA", () => {
      assert.strictEqual(
        queryUtils.formatScratchpadError({
          data: "",
          error: true,
          errorMsg:
            "Querying database using (UDA) raised - Unknown API: .kx.uda",
          sessionID: "1",
        }),
        "Error: Querying database using (UDA) raised - Unknown API: .kx.uda. " +
          "A table, label, or scope parameter may be missing or incorrect.",
      );
    });

    it("should append the stacktrace", () => {
      const stacktrace = [
        { name: "f", isNested: false, text: ["{a:x*2;a", "+y}"] },
      ];

      assert.strictEqual(
        queryUtils.formatScratchpadError({
          data: "",
          error: true,
          errorMsg: "type",
          sessionID: "1",
          stacktrace,
        }),
        "Error: type\n" + queryUtils.formatScratchpadStacktrace(stacktrace),
      );
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

    it("should remove unclosed block comment to end of input", () => {
      let res = queryUtils.normalizeQSQLQuery("a:1\n/\na:2\na:3");
      assert.strictEqual(res, "a:1");
      res = queryUtils.normalizeQSQLQuery("a:1\r\n/\r\na:2\r\na:3");
      assert.strictEqual(res, "a:1");
    });

    it("should remove single line comment", () => {
      let res = queryUtils.normalizeQSQLQuery("/ single line comment\na:1");
      assert.strictEqual(res, "a:1");
      res = queryUtils.normalizeQSQLQuery("/ single line comment\r\na:1");
      assert.strictEqual(res, "a:1");
    });

    it("should preserve line comment", () => {
      const res = queryUtils.normalizeQSQLQuery("a:1 / line comment");
      assert.strictEqual(res, "a:1 / line comment");
    });

    it("should ignore line comment in a string", () => {
      const res = queryUtils.normalizeQSQLQuery('a:"1 / not line comment"');

      assert.strictEqual(res, 'a:"1 / not line comment"');
    });

    it("should replace EOS with semicolon preserve new lines", () => {
      let res = queryUtils.normalizeQSQLQuery("a:1\na");
      assert.strictEqual(res, "a:1;\na");
      res = queryUtils.normalizeQSQLQuery("a:1\r\na");
      assert.strictEqual(res, "a:1;\r\na");
    });

    it("should preserve new lines in strings", () => {
      let res = queryUtils.normalizeQSQLQuery('a:"a\n\n b"');
      assert.strictEqual(res, 'a:"a\n\n b"');
      res = queryUtils.normalizeQSQLQuery('a:"a\r\n\r\n b"');
      assert.strictEqual(res, 'a:"a\r\n\r\n b"');
    });

    it("should convert system commands", () => {
      assert.strictEqual(
        queryUtils.normalizeQSQLQuery("\\l foo.q"),
        'system"l foo.q"',
      );
      assert.strictEqual(queryUtils.normalizeQSQLQuery("\\\\"), 'system"\\\\"');
    });

    it("should escape backslashes in system command arguments", () => {
      assert.strictEqual(
        queryUtils.normalizeQSQLQuery('\\someCommand "\\t"'),
        'system"someCommand \\"\\\\t\\""',
      );
    });

    it("should preserve the repeat count of timing system commands", () => {
      assert.strictEqual(
        queryUtils.normalizeQSQLQuery("\\ts:1000 1+2"),
        'system"ts:1000 1+2"',
      );
      assert.strictEqual(
        queryUtils.normalizeQSQLQuery("\\t:100 sum til 100"),
        'system"t:100 sum til 100"',
      );
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

    const encoded = Buffer.from(
      [...png, ...img].map((value) => parseInt(value, 16)),
    ).toString("base64");

    it("should return base64 for an encoded png", () => {
      const result = queryUtils.resultToBase64(encoded);

      assert.strictEqual(result, `data:image/png;base64,${encoded}`);
    });

    it("should return base64 for a scratchpad result carrying an encoded png", () => {
      const result = queryUtils.resultToBase64({
        error: false,
        errorMsg: "",
        data: encoded,
      });

      assert.strictEqual(result, `data:image/png;base64,${encoded}`);
    });

    it("should return base64 for an encoded png with a non zero ninth byte", () => {
      const bytes = [...png, ...img].map((value) => parseInt(value, 16));
      bytes[8] = 0x80;
      const other = Buffer.from(bytes).toString("base64");

      assert.strictEqual(other[10], "q");
      assert.strictEqual(
        queryUtils.resultToBase64(other),
        `data:image/png;base64,${other}`,
      );
    });

    it("should return undefined for a string that is not a png", () => {
      const result = queryUtils.resultToBase64("not an image");

      assert.strictEqual(result, undefined);
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

    it("should remove unclosed block comment to end of input", () => {
      let res = queryUtils.normalizeQuery("1\n/\n2\n3");
      assert.strictEqual(res, "1\r\n");
      res = queryUtils.normalizeQuery("1\r\n/\r\n2\r\n3");
      assert.strictEqual(res, "1\r\n");
    });

    it("should remove closed block comment", () => {
      const res = queryUtils.normalizeQuery("1\n/\n2\n\\\n3");
      assert.strictEqual(res, "1\r\n3");
    });
  });

  describe("normalizePyQuery", () => {
    it("should escape double quotes", () => {
      const res = queryUtils.normalizePyQuery('a="test"');

      assert.strictEqual(res, 'a=\\"test\\"');
    });
  });

  describe("getHeaders", () => {
    const jsonHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      json: true,
    };

    const structTextHeaders = {
      Accept: "application/struct-text",
      "Content-Type": "application/json",
    };

    it("should return JSON headers by default", () => {
      const res = queryUtils.getHeaders();
      assert.deepStrictEqual(res, jsonHeaders);
    });

    it("should return JSON headers with timeout", () => {
      const res = queryUtils.getHeaders(30, "json");
      assert.deepStrictEqual(res, { ...jsonHeaders, timeout: "30" });
    });

    it("should return Structured Text headers with timeout", () => {
      const res = queryUtils.getHeaders(30, "struct-text");
      assert.deepStrictEqual(res, { ...structTextHeaders, timeout: "30" });
    });
  });

  describe("queryWrapper", () => {
    let fakeFs: any;
    let fakeContext: any;

    beforeEach(() => {
      fakeFs = {
        readFileSync: sinon.stub(),
      };
      fakeContext = {
        asAbsolutePath: sinon.stub(),
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    function mockFile(mockPath: string, mockContent: string) {
      fakeContext.asAbsolutePath
        .withArgs(path.join("resources", "q", path.basename(mockPath)))
        .returns(mockPath);
      fakeFs.readFileSync.withArgs(mockPath).returns(Buffer.from(mockContent));
    }

    it("should return evaluatePy string when isPython and useAPI are true", () => {
      const result = queryUtils.queryWrapper(true, true);
      assert.strictEqual(result, ".vscode.runPyQuery");
      sinon.assert.notCalled(fakeFs.readFileSync);
    });

    it("should return evaluateQ string when isPython is false and useAPI is true", () => {
      const result = queryUtils.queryWrapper(false, true);
      assert.strictEqual(result, ".vscode.runQQuery");
      sinon.assert.notCalled(fakeFs.readFileSync);
    });

    it("should read evaluatePy.q from disk when isPython is true and useAPI is false", () => {
      const mockPath = "/mock/path/evaluatePy.q";
      const mockContent = "python_code";

      mockFile(mockPath, mockContent);

      const result = queryUtils.queryWrapper(true, false, fakeFs, fakeContext);

      assert.strictEqual(result, mockContent);
      sinon.assert.calledOnce(fakeFs.readFileSync);
      sinon.assert.calledWith(fakeFs.readFileSync, mockPath);
    });

    it("should read evaluateQ.q and formatQ.q from disk when isPython is false and useAPI is false", () => {
      mockFile("/mock/path/evaluateQ.q", "evaluateQ_code");
      mockFile("/mock/path/formatQ.q", "formatQ_code");

      const result = queryUtils.queryWrapper(false, false, fakeFs, fakeContext);

      const expected = [
        "{[args]",
        "    evaluateQ: evaluateQ_code ;",
        "    formatQ: formatQ_code ;",
        "    formatQ[args; evaluateQ args]",
        "    }",
      ].join("\n");

      assert.strictEqual(result, expected);
      sinon.assert.calledTwice(fakeFs.readFileSync);
      sinon.assert.calledWith(fakeFs.readFileSync, "/mock/path/evaluateQ.q");
      sinon.assert.calledWith(fakeFs.readFileSync, "/mock/path/formatQ.q");
    });
  });

  describe("getQSQLWrapper", () => {
    let queryWrappeStub: sinon.SinonStub;

    it("should not add extra semicolon", () => {
      const res = queryUtils.getQSQLWrapper("a:1;\na", "serialized");
      assert.strictEqual(res, "a:1;\na");
    });

    it("should normalize python code using wrapper", () => {
      assert.throws(() => {
        queryUtils.getQSQLWrapper(``, "serialized", true);
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

  describe("notifyExecution", () => {
    beforeEach(() => {
      ext.telemetry = {
        sendEvent: sinon.stub(),
      } as any;
    });

    describe("repl", () => {
      describe("File", () => {
        it("should return telemetry for q", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run | queryUtils.RunFlag.Repl,
          );
          assert.strictEqual(res, "Run.File.repl.q");
        });
        it("should return telemetry for Python", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Repl |
              queryUtils.RunFlag.Python,
          );
          assert.strictEqual(res, "Run.File.repl.py");
        });
        it("should return telemetry for SQL", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Repl |
              queryUtils.RunFlag.Sql,
          );
          assert.strictEqual(res, "Run.File.repl.sql");
        });
      });
      describe("Workbook", () => {
        it("should return telemetry for q", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Repl,
          );
          assert.strictEqual(res, "Run.Workbook.repl.q");
        });
        it("should return telemetry for Python", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Repl |
              queryUtils.RunFlag.Python,
          );
          assert.strictEqual(res, "Run.Workbook.repl.py");
        });
        it("should return telemetry for SQL", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Repl |
              queryUtils.RunFlag.Sql,
          );
          assert.strictEqual(res, "Run.Workbook.repl.sql");
        });
      });
    });
    describe("kdb", () => {
      describe("Workbook", () => {
        it("should return telemetry for q", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run | queryUtils.RunFlag.Workbook,
          );
          assert.strictEqual(res, "Run.Workbook.kdb.q");
        });
        it("should return telemetry for Python", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Python,
          );
          assert.strictEqual(res, "Run.Workbook.kdb.py");
        });
        it("should return telemetry for SQL", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Sql,
          );
          assert.strictEqual(res, "Run.Workbook.kdb.sql");
        });
      });
    });
    describe("ie", () => {
      describe("Workbook", () => {
        it("should return telemetry for q", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Insights,
          );
          assert.strictEqual(res, "Run.Workbook.ie.q");
        });
        it("should return telemetry for Python", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Insights |
              queryUtils.RunFlag.Python,
          );
          assert.strictEqual(res, "Run.Workbook.ie.py");
        });
        it("should return telemetry for SQL", () => {
          const res = queryUtils.notifyExecution(
            queryUtils.RunFlag.Run |
              queryUtils.RunFlag.Workbook |
              queryUtils.RunFlag.Insights |
              queryUtils.RunFlag.Sql,
          );
          assert.strictEqual(res, "Run.Workbook.ie.sql");
        });
      });
    });
  });
});
