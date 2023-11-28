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
import { CharLiteral, QLexer, QParser } from "../../server/src/parser";

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

describe("QParser", () => {
  describe("comments", () => {
    it("should ignore block", () => {
      QParser.parse("/\na:\n1\n\\");
      assert.deepEqual(QParser.errors, []);
    });

    it("should ignore line", () => {
      QParser.parse("/a:\n");
      assert.deepEqual(QParser.errors, []);
    });

    it("should ignore inline", () => {
      QParser.parse("a: 1 /a:\n");
      assert.deepEqual(QParser.errors, []);
    });

    it("should not ignore overloaded slash", () => {
      QParser.parse("a: ,/ a:\n");
      assert.strictEqual(QParser.errors.length, 1);
    });
  });

  describe("script", () => {
    it("should parse empty", () => {
      QParser.parse("");
      assert.deepEqual(QParser.errors, []);
    });
  });

  describe("statement", () => {
    it("should parse empty", () => {
      QParser.parse(";\n\r\n;");
      assert.deepEqual(QParser.errors, []);
    });
  });

  describe("expression", () => {
    describe("identifier", () => {
      it("should parse", () => {
        QParser.parse("absolute;");
        assert.deepEqual(QParser.errors, []);
      });

      it("should parse namespaced", () => {
        QParser.parse(".absolute.value;");
        assert.deepEqual(QParser.errors, []);
      });
    });

    describe("assignment", () => {
      it("should parse", () => {
        QParser.parse("a:1;");
        assert.deepEqual(QParser.errors, []);
      });

      it("should parse multiple", () => {
        QParser.parse("a:b:c:1;");
        assert.deepEqual(QParser.errors, []);
      });

      it("should parse multiline", () => {
        QParser.parse("a\n :b:c:\r\n 1;");
        assert.deepEqual(QParser.errors, []);
      });

      it("should parse indexed", () => {
        QParser.parse("a[1]:1;");
        assert.deepEqual(QParser.errors, []);
      });

      it("should parse infixed", () => {
        QParser.parse("a[1]+:1;");
        assert.deepEqual(QParser.errors, []);
      });
    });
  });
});
