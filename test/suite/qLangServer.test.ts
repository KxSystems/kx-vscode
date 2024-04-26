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
  Position,
  Range,
  TextDocumentIdentifier,
} from "vscode-languageserver";
import QLangServer from "../../server/src/qLangServer";
import { TextDocument } from "vscode-languageserver-textdocument";

describe("qLangServer", () => {
  let server: QLangServer;

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
    it("should return golobals", () => {
      const textDocument = TextDocumentIdentifier.create("test.q");
      sinon
        .stub(server.documents, "get")
        .value(() => TextDocument.create("test.q", "q", 1, "a:1"));
      const result = server.onDocumentSymbol({ textDocument });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
  });

  describe("onReferences", () => {
    it("should return golobal references", () => {
      const position = Position.create(0, 5);
      const context = {
        includeDeclaration: true,
      };
      const textDocument = TextDocumentIdentifier.create("test.q");
      sinon
        .stub(server.documents, "get")
        .value(() => TextDocument.create("test.q", "q", 1, "a:1;a"));
      const result = server.onReferences({
        textDocument,
        position,
        context,
      });
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result[0].range, Range.create(0, 0, 0, 1));
      assert.deepStrictEqual(result[1].range, Range.create(0, 4, 0, 5));
    });
  });

  describe("onDefinition", () => {
    it("should return golobal definition", () => {
      const position = Position.create(0, 5);
      const textDocument = TextDocumentIdentifier.create("test.q");
      sinon
        .stub(server.documents, "get")
        .value(() => TextDocument.create("test.q", "q", 1, "a:1;a"));
      const result = server.onDefinition({
        textDocument,
        position,
      });
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].range, Range.create(0, 0, 0, 1));
    });
  });

  describe("onRenameRequest", () => {
    it("should rename golobal identifiers", () => {
      const position = Position.create(0, 5);
      const newName = "b";
      const textDocument = TextDocumentIdentifier.create("test.q");
      sinon
        .stub(server.documents, "get")
        .value(() => TextDocument.create("test.q", "q", 1, "a:1;a"));
      const result = server.onRenameRequest({
        textDocument,
        position,
        newName,
      });
      assert.ok(result);
      assert.strictEqual(result.changes[textDocument.uri].length, 2);
    });
  });

  describe("onCompletion", () => {
    it("should complete golobal identifiers", () => {
      const position = Position.create(0, 5);
      const textDocument = TextDocumentIdentifier.create("test.q");
      sinon
        .stub(server.documents, "get")
        .value(() => TextDocument.create("test.q", "q", 1, "a:1;a"));
      const result = server.onCompletion({
        textDocument,
        position,
      });
      assert.strictEqual(result.length, 1);
    });
    it("should filter out duplicates", () => {
      const position = Position.create(0, 5);
      const textDocument = TextDocumentIdentifier.create("test.q");
      sinon
        .stub(server.documents, "get")
        .value(() => TextDocument.create("test.q", "q", 1, "a:1;a;a:2;a"));
      const result = server.onCompletion({
        textDocument,
        position,
      });
      assert.strictEqual(result.length, 1);
    });
  });
});
