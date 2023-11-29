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
import { lint } from "../../server/src/linter";
import { QParser, analyze } from "../../server/src/parser";

describe("linter", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("ASSIGN_RESERVED_WORD", () => {
    it("should lint assignment", () => {
      const cst = QParser.parse(`
        til: 0;
      `);
      const ast = analyze(cst);
      const results = lint(ast);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, "ASSIGN_RESERVED_WORD");
    });
  });

  describe("DEPRECATED_DATETIME", () => {
    it("should lint datetime", () => {
      const cst = QParser.parse(`
        2000.01.01T12:00:00.000
      `);
      const ast = analyze(cst);
      const results = lint(ast);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].name, "DEPRECATED_DATETIME");
    });
  });
});
