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
import * as fs from "node:fs";
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

    it("should work with rows with newlines", () => {
      const rows = ["a#$#;header;#$#b", "a1\na2#$#;#$#b1\nb2", "3#$#;#$#4"];
      const expectedRes = [
        "a   b   ",
        "--------",
        "a1  \na2  b1  \n    b2  ",
        "3   4   ",
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

    it("should preserve the repeat count of timing system commands", () => {
      assert.strictEqual(
        queryUtils.normalizeQuery("\\ts:1000 1+2"),
        'system"ts:1000 1+2"',
      );
      assert.strictEqual(
        queryUtils.normalizeQuery("\\ts 1+2"),
        'system"ts 1+2"',
      );
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
