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

/* eslint @typescript-eslint/no-empty-function: 0 */

import * as assert from "assert";
import * as sinon from "sinon";
import {
  Connection,
  InitializeParams,
  TextDocumentIdentifier,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import QLangServer from "../../server/src/qLangServer";

const context = { includeDeclaration: true };

describe("qLangServer", () => {
  let server: QLangServer;

  function createDocument(content: string) {
    content = content.trim();
    const document = TextDocument.create("test.q", "q", 1, content);
    const position = document.positionAt(content.length);
    const textDocument = TextDocumentIdentifier.create("test.q");
    sinon.stub(server.documents, "get").value(() => document);
    return {
      textDocument,
      position,
    };
  }

  beforeEach(async () => {
    const connection = <Connection>(<unknown>{
      listen() {},
      onDidOpenTextDocument() {},
      onDidChangeTextDocument() {},
      onDidCloseTextDocument() {},
      onWillSaveTextDocument() {},
      onWillSaveTextDocumentWaitUntil() {},
      onDidSaveTextDocument() {},
      onDocumentSymbol() {},
      onReferences() {},
      onDefinition() {},
      onRenameRequest() {},
      onCompletion() {},
      onDidChangeConfiguration() {},
      onRequest() {},
    });

    const params = <InitializeParams>{
      workspaceFolders: null,
    };

    server = new QLangServer(connection, params);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("capabilities", () => {
    it("should support desired features", () => {
      const capabilities = server.capabilities();
      assert.ok(capabilities.textDocumentSync);
      assert.ok(capabilities.documentSymbolProvider);
      assert.ok(capabilities.referencesProvider);
      assert.ok(capabilities.definitionProvider);
      assert.ok(capabilities.renameProvider);
      assert.ok(capabilities.completionProvider);
    });
  });

  describe("onDocumentSymbol", () => {
    it("should return symbols", () => {
      const params = createDocument("a:1;b:{[c]d:c+1;e::1;d}");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 3);
    });
    it("should skip table and sql", () => {
      const params = createDocument(")([]a:1;b:2);select a:1 from(");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 0);
    });
    it("should account for \\d can be only one level deep", () => {
      const params = createDocument("\\d .foo.bar\na:1");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, ".foo.a");
    });
    it("should account for bogus \\d", () => {
      const params = createDocument("\\d\na:1");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
    it("should account for bogus \\d foo", () => {
      const params = createDocument("\\d foo\na:1");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
    it('should account for bogus system"d', () => {
      const params = createDocument('system"d";a:1');
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
    it('should account for bogus system"d', () => {
      const params = createDocument("a:1;system");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
    });
    it('should account for only static system"d', () => {
      const params = createDocument('a:1;system"d .foo";b:1');
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[1].name, "b");
    });
  });

  describe("onReferences", () => {
    it("should return empty array for no text", () => {
      const params = createDocument("");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 0);
    });
    it("should return empty array for bogus assignment", () => {
      const params = createDocument(":");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 0);
    });
    it("should return empty array for bogus function", () => {
      const params = createDocument("{");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 0);
    });
    it("should return references in anonymous functions", () => {
      const params = createDocument("{a:1;a");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should support imlplicit arguments", () => {
      const params = createDocument("x:1;y:1;z:1;{x+y+z};x");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should find globals in functions", () => {
      const params = createDocument("a:1;{a");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should find locals in functions", () => {
      const params = createDocument("a:1;{a:2;a");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should apply namespace to globals in functions", () => {
      const params = createDocument(
        "\\d .foo\na:1;f:{a::2};\\d .\n.foo.f[];.foo.a",
      );
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 3);
    });
    it("should return references for quke", () => {
      const params = createDocument("FEATURE\nfeature\nshould\nEXPECT\na:1;a");
      const result = server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
  });

  describe("onDefinition", () => {
    it("should return definitions", () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = server.onDefinition(params);
      assert.strictEqual(result.length, 1);
    });
    it("should return local definitions", () => {
      const params = createDocument("a:1;b:{[c]d:1;d");
      const result = server.onDefinition(params);
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onRenameRequest", () => {
    it("should rename identifiers", () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = server.onRenameRequest({ ...params, newName: "newName" });
      assert.ok(result);
      assert.strictEqual(result.changes[params.textDocument.uri].length, 2);
    });
  });

  describe("onCompletion", () => {
    it("should complete identifiers", () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = server.onCompletion(params);
      assert.strictEqual(result.length, 2);
    });
  });
});
