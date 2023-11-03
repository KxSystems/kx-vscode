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
import { QLexer } from "../../server/src/parser/lexer";
import { CharLiteral } from "../../server/src/parser/literals";

describe("QLexer", () => {
  describe("CharLiteral", () => {
    it("should tokenize string", () => {
      const lexed = QLexer.tokenize('"char"');
      assert.strictEqual(lexed.tokens.length, 1);
      assert.strictEqual(lexed.tokens[0].tokenType, CharLiteral);
    });

    it("should tokenize empty string", () => {
      const lexed = QLexer.tokenize('""');
      assert.strictEqual(lexed.tokens.length, 1);
      assert.strictEqual(lexed.tokens[0].tokenType, CharLiteral);
    });
  });
});
