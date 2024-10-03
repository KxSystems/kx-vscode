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
  let connection: Connection;

  function createDocument(content: string, offset?: number) {
    content = content.trim();
    const document = TextDocument.create("test.q", "q", 1, content);
    const position = document.positionAt(offset || content.length);
    const textDocument = TextDocumentIdentifier.create("test.q");
    sinon.stub(server.documents, "get").value(() => document);
    sinon.stub(server.documents, "all").value(() => [document]);
    return {
      textDocument,
      position,
    };
  }

  beforeEach(async () => {
    connection = <Connection>(<unknown>{
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
      onSelectionRanges() {},
      onDidChangeWatchedFiles() {},
      workspace: {
        async getWorkspaceFolders() {
          return [];
        },
      },
      languages: {
        callHierarchy: {
          onPrepare() {},
          onIncomingCalls() {},
          onOutgoingCalls() {},
        },
      },
      sendDiagnostics() {},
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
      assert.ok(capabilities.selectionRangeProvider);
      assert.ok(capabilities.callHierarchyProvider);
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

  describe("onExpressionRange", () => {
    it("should return the range of the expression", () => {
      const params = createDocument("a:1;");
      const result = server.onExpressionRange(params);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 3);
    });
    it("should return the range of the expression", () => {
      const params = createDocument("a");
      const result = server.onExpressionRange(params);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 1);
    });
    it("should return null", () => {
      const params = createDocument("");
      const result = server.onExpressionRange(params);
      assert.strictEqual(result, null);
    });
    it("should return null", () => {
      const params = createDocument(";");
      const result = server.onExpressionRange(params);
      assert.strictEqual(result, null);
    });
    it("should return null", () => {
      const params = createDocument("/a:1");
      const result = server.onExpressionRange(params);
      assert.strictEqual(result, null);
    });
  });

  describe("onExpressionRange", () => {
    it("should return range for simple expression", () => {
      const params = createDocument("a:1;");
      const result = server.onExpressionRange(params);
      assert.ok(result);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 3);
    });
    it("should return range for lambda", () => {
      const params = createDocument("a:{b:1;b};");
      const result = server.onExpressionRange(params);
      assert.ok(result);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 9);
    });
    it("should skip comments", () => {
      const params = createDocument("a:1 /comment", 1);
      const result = server.onExpressionRange(params);
      assert.ok(result);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 3);
    });
  });

  describe("omParameterCache", () => {
    it("should cache paramater", () => {
      const params = createDocument("{[a;b]}");
      const result = server.onParameterCache(params);
      assert.ok(result);
      assert.deepEqual(result.params, ["a", "b"]);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 6);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 6);
    });
    it("should cache paramater", () => {
      const params = createDocument("{[a;b]\n }");
      const result = server.onParameterCache(params);
      assert.ok(result);
      assert.deepEqual(result.params, ["a", "b"]);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 6);
      assert.strictEqual(result.end.line, 1);
      assert.strictEqual(result.end.character, 1);
    });
    it("should return null", () => {
      const params = createDocument("{[]}");
      const result = server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
    it("should return null", () => {
      const params = createDocument("{}");
      const result = server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
    it("should return null", () => {
      const params = createDocument("a:1;");
      const result = server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
    it("should return null", () => {
      const params = createDocument("");
      const result = server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
  });

  describe("onSelectionRanges", () => {
    it("should return identifier range", () => {
      const params = createDocument(".test.ref");
      const result = server.onSelectionRanges({
        textDocument: params.textDocument,
        positions: [params.position],
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].range.start.character, 0);
      assert.strictEqual(result[0].range.end.character, 9);
    });
  });

  describe("onPrepareCallHierarchy", () => {
    it("should prepare call hierarchy", () => {
      const params = createDocument("a:1;a");
      const result = server.onPrepareCallHierarchy(params);
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onIncomingCallsCallHierarchy", () => {
    it("should return incoming calls", () => {
      const params = createDocument("a:1;a");
      const items = server.onPrepareCallHierarchy(params);
      const result = server.onIncomingCallsCallHierarchy({ item: items[0] });
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onOutgoingCallsCallHierarchy", () => {
    it("should return outgoing calls", () => {
      const params = createDocument("a:1;{a");
      const items = server.onPrepareCallHierarchy(params);
      const result = server.onOutgoingCallsCallHierarchy({ item: items[0] });
      assert.strictEqual(result.length, 1);
    });
  });

  describe("setSettings", () => {
    let defaultSettings = {
      debug: false,
      linting: false,
      refactoring: "Workspace",
    };
    it("should use default settings for empty", () => {
      server.setSettings({});
      assert.deepEqual(server["settings"], defaultSettings);
    });
    it("should use default settings for empty coming from client", () => {
      server.onDidChangeConfiguration({ settings: { kdb: {} } });
      assert.deepEqual(server["settings"], defaultSettings);
    });
  });

  describe("onDidClose", () => {
    it("should send epmty diagnostics", () => {
      const stub = sinon.stub(connection, "sendDiagnostics");
      server.onDidClose({ document: <TextDocument>{ uri: "" } });
      assert.ok(stub.calledOnce);
    });
  });

  describe("scan", () => {
    it("should scan empty workspace", () => {
      sinon
        .stub(connection.workspace, "getWorkspaceFolders")
        .value(async () => []);
      server.scan();
    });
  });

  describe("onDidChangeWatchedFiles", () => {
    it("should parse empty match", () => {
      sinon
        .stub(connection.workspace, "getWorkspaceFolders")
        .value(async () => []);
      server.onDidChangeWatchedFiles({ changes: [] });
    });
  });
});
