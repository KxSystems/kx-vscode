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
      const params = createDocument("a:1;b:{[c]d:c+1;e::1;d};b");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 2);
    });
    it("should skip table and sql", () => {
      const params = createDocument("select a:1 from;([]a:1);a");
      const result = server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 0);
    });
  });

  describe("onReferences", () => {
    it("should return references", () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = server.onReferences({
        ...params,
        context: { includeDeclaration: true },
      });
      assert.strictEqual(result.length, 2);
    });
    it("should return references for quke", () => {
      const params = createDocument(`
      feature
      bench
      replicate
      FEATURE
          before
          after
          before each
          after each
          should
            EXPECT
              a:1;a
      `);
      const result = server.onReferences({
        ...params,
        context: { includeDeclaration: true },
      });
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
      const params = createDocument(
        '\\d .a\nsystem "d .a"\na:1;b:{[c]d:c+1;d};b',
      );
      const result = server.onCompletion(params);
      assert.strictEqual(result.length, 2);
    });
  });
});
