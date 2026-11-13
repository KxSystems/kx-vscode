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
import { readFileSync } from "fs";
import { join } from "path";

import { Structure } from "../../../server/src/structure";

const fixtures = join(
  __dirname,
  "../../../../test/suite/server/fixtures/debugger",
);

const oracle: Record<
  string,
  {
    top: unknown[];
    lambdaPath: unknown[];
    separators: unknown[][];
    identifiers: unknown[][];
  }
> = JSON.parse(readFileSync(join(fixtures, "oracle.json"), "utf8"));

describe("Structure", () => {
  for (const [file, expected] of Object.entries(oracle)) {
    describe(file, () => {
      const text = readFileSync(join(fixtures, file), "utf8");
      const lines = text.split("\n");
      const structure = new Structure(text);

      it("topLevelStatements", () => {
        assert.deepStrictEqual(structure.topLevelStatements(), expected.top);
      });

      it("lambdaPath", () => {
        expected.lambdaPath.forEach((value, line) =>
          assert.deepStrictEqual(structure.lambdaPath(line), value, `${line}`),
        );
      });

      it("statementSeparators", () => {
        expected.separators.forEach((value, line) =>
          assert.deepStrictEqual(
            structure.statementSeparators(line),
            value,
            `${line}`,
          ),
        );
      });

      it("identifiersOnLines", () => {
        expected.identifiers.forEach((value, line) => {
          if (!lines[line].startsWith("\\")) {
            assert.deepStrictEqual(
              structure.identifiersOnLines(line, line),
              value,
              `${line}`,
            );
          }
        });
      });
    });
  }

  it("skips command arguments in identifiersOnLines", () => {
    const structure = new Structure("\\d .foo\n\\l lib.q\nf:{x}");
    assert.deepStrictEqual(structure.identifiersOnLines(0, 1), []);
    assert.deepStrictEqual(structure.identifiersOnLines(2, 2), [
      { name: "f", canon: ".foo.f" },
      { name: "x", canon: ".foo.x" },
    ]);
  });

  it("ignores brackets inside strings", () => {
    const structure = new Structure('a:"{[(";\nb:2');
    assert.deepStrictEqual(
      structure.topLevelStatements().map(({ text }) => text),
      ['a:"{[(";', "b:2"],
    );
  });

  it("normalizes CRLF line endings", () => {
    const structure = new Structure("a:1\r\nf:{\r\n  x}\r\n");
    assert.deepStrictEqual(structure.topLevelStatements(), [
      { startLine: 0, startChar: 0, endLine: 0, text: "a:1", namespace: "." },
      {
        startLine: 1,
        startChar: 0,
        endLine: 2,
        text: "f:{\n  x}",
        namespace: ".",
      },
    ]);
  });

  it("returns nothing for an empty file", () => {
    const structure = new Structure("");
    assert.deepStrictEqual(structure.topLevelStatements(), []);
    assert.strictEqual(structure.lambdaPath(0), null);
    assert.deepStrictEqual(structure.statementSeparators(0), []);
    assert.deepStrictEqual(structure.identifiersOnLines(0, 0), []);
  });
  describe("anonymous lambdas", () => {
    const text = "{\n    a: 1;\n    a\n    }[]";

    it("leaves an anonymous root unresolved by default", () => {
      assert.strictEqual(new Structure(text).lambdaPath(1), null);
    });

    it("reports an anonymous root by its position when asked", () => {
      assert.deepStrictEqual(new Structure(text).lambdaPath(1, true), {
        name: "",
        path: [],
        startLine: 0,
        rootLine: 0,
        rootColumn: 0,
      });
    });

    it("lists the unassigned root lambdas of a statement", () => {
      const structure = new Structure("each[{x+1}; til 3]\nf:{x}\n{y}[]");
      assert.deepStrictEqual(structure.rootLambdas(0, 2), [
        { line: 0, column: 5, endLine: 0, endColumn: 10 },
        { line: 2, column: 0, endLine: 2, endColumn: 3 },
      ]);
    });
  });

  describe("column aware lookups", () => {
    const text = "foo:{\n    {\n        x*2\n        } each til 3\n    }";

    it("treats a lambda's braces as part of its parent", () => {
      const structure = new Structure(text);
      assert.deepStrictEqual(structure.lambdaPath(3, false, 8)?.path, []);
      assert.deepStrictEqual(structure.lambdaPath(3)?.path, [0]);
      assert.deepStrictEqual(structure.lambdaPath(1, false, 4)?.path, []);
    });

    it("lists the lambdas inside the statement being executed", () => {
      assert.deepStrictEqual(new Structure(text).statementLambdas(3, 10), [
        { name: "foo", path: [0], line: 1, column: 4, rootLine: 0 },
      ]);
    });

    it("keeps to the statement holding the position", () => {
      const structure = new Structure("f:{a:{x}[1]; b:{y}[2]}");
      assert.deepStrictEqual(
        structure.statementLambdas(0, 15).map((t) => t.column),
        [15],
      );
      assert.deepStrictEqual(
        structure.statementLambdas(0, 3).map((t) => t.column),
        [5],
      );
    });

    it("finds nothing outside a lambda", () => {
      assert.deepStrictEqual(new Structure("a:1").statementLambdas(0, 0), []);
    });
  });
});
