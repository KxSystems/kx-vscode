/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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
import { pathToFileURL } from "url";
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
    const uri = pathToFileURL("test.q").toString();
    const document = TextDocument.create(uri, "q", 1, content);
    const position = document.positionAt(offset || content.length);
    const textDocument = TextDocumentIdentifier.create(uri);
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
        async getConfiguration() {
          return undefined;
        },
      },
      languages: {
        callHierarchy: {
          onPrepare() {},
          onIncomingCalls() {},
          onOutgoingCalls() {},
        },
        semanticTokens: {
          on() {},
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
      assert.ok(capabilities.semanticTokensProvider);
    });
  });

  describe("onDocumentSymbol", () => {
    it("should return symbols", async () => {
      const params = createDocument("a:1;b:{[c]d:c+1;e::1;d}");
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 3);
    });
    it("should skip table and sql", async () => {
      const params = createDocument(")([]a:1;b:2);select a:1 from(");
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 0);
    });
    it("should account for \\d can be only one level deep", async () => {
      const params = createDocument("\\d .foo.bar\na:1");
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, ".foo.a");
    });
    it("should account for bogus \\d", async () => {
      const params = createDocument("\\d\na:1");
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
    it("should account for bogus \\d foo", async () => {
      const params = createDocument("\\d foo\na:1");
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
    it('should account for bogus system"d', async () => {
      const params = createDocument('system"d";a:1');
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, "a");
    });
    it('should account for bogus system"d', async () => {
      const params = createDocument("a:1;system");
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 1);
    });
    it('should account for only static system"d', async () => {
      const params = createDocument('a:1;system"d .foo";b:1');
      const result = await server.onDocumentSymbol(params);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[1].name, "b");
    });
  });

  describe("onReferences", () => {
    it("should return empty array for no text", async () => {
      const params = createDocument("");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 0);
    });
    it("should return empty array for bogus assignment", async () => {
      const params = createDocument(":");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 0);
    });
    it("should return empty array for bogus function", async () => {
      const params = createDocument("{");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 0);
    });
    it("should return references in anonymous functions", async () => {
      const params = createDocument("{a:1;a");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should support imlplicit arguments", async () => {
      const params = createDocument("x:1;y:1;z:1;{x+y+z};x");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should find globals in functions", async () => {
      const params = createDocument("a:1;{a");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should find locals in functions", async () => {
      const params = createDocument("a:1;{a:2;a");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
    it("should apply namespace to globals in functions", async () => {
      const params = createDocument(
        "\\d .foo\na:1;f:{a::2};\\d .\n.foo.f[];.foo.a",
      );
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 3);
    });
    it("should return references for quke", async () => {
      const params = createDocument("FEATURE\nfeature\nshould\nEXPECT\na:1;a");
      const result = await server.onReferences({ ...params, context });
      assert.strictEqual(result.length, 2);
    });
  });

  describe("onDefinition", () => {
    it("should return definitions", async () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = await server.onDefinition(params);
      assert.strictEqual(result.length, 1);
    });
    it("should return local definitions", async () => {
      const params = createDocument("a:1;b:{[c]d:1;d");
      const result = await server.onDefinition(params);
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onRenameRequest", () => {
    it("should rename identifiers", async () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = await server.onRenameRequest({
        ...params,
        newName: "newName",
      });
      assert.ok(result);
      assert.strictEqual(result.changes[params.textDocument.uri].length, 2);
    });
  });

  describe("onCompletion", () => {
    it("should complete identifiers", async () => {
      const params = createDocument("a:1;b:{[c]d:c+1;d};b");
      const result = await server.onCompletion(params);
      assert.strictEqual(result.length, 2);
    });
  });

  describe("onExpressionRange", () => {
    it("should return the range of the expression", async () => {
      const params = createDocument("a:1;");
      const result = await server.onExpressionRange(params);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 3);
    });
    it("should return the range of the expression", async () => {
      const params = createDocument("a");
      const result = await server.onExpressionRange(params);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 1);
    });
    it("should return null", async () => {
      const params = createDocument("");
      const result = await server.onExpressionRange(params);
      assert.strictEqual(result, null);
    });
    it("should return null", async () => {
      const params = createDocument(";");
      const result = await server.onExpressionRange(params);
      assert.strictEqual(result, null);
    });
    it("should return null", async () => {
      const params = createDocument("/a:1");
      const result = await server.onExpressionRange(params);
      assert.strictEqual(result, null);
    });
  });

  describe("onExpressionRange", () => {
    it("should return range for simple expression", async () => {
      const params = createDocument("a:1;");
      const result = await server.onExpressionRange(params);
      assert.ok(result);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 3);
    });
    it("should return range for lambda", async () => {
      const params = createDocument("a:{b:1;b};");
      const result = await server.onExpressionRange(params);
      assert.ok(result);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 9);
    });
    it("should skip comments", async () => {
      const params = createDocument("a:1 /comment", 1);
      const result = await server.onExpressionRange(params);
      assert.ok(result);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 0);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 3);
    });
  });

  describe("omParameterCache", () => {
    it("should cache paramater", async () => {
      const params = createDocument("{[a;b]}");
      const result = await server.onParameterCache(params);
      assert.ok(result);
      assert.deepEqual(result.params, ["a", "b"]);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 6);
      assert.strictEqual(result.end.line, 0);
      assert.strictEqual(result.end.character, 6);
    });
    it("should cache paramater", async () => {
      const params = createDocument("{[a;b]\n }");
      const result = await server.onParameterCache(params);
      assert.ok(result);
      assert.deepEqual(result.params, ["a", "b"]);
      assert.strictEqual(result.start.line, 0);
      assert.strictEqual(result.start.character, 6);
      assert.strictEqual(result.end.line, 1);
      assert.strictEqual(result.end.character, 1);
    });
    it("should return null", async () => {
      const params = createDocument("{[]}");
      const result = await server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
    it("should return null", async () => {
      const params = createDocument("{}");
      const result = await server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
    it("should return null", async () => {
      const params = createDocument("a:1;");
      const result = await server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
    it("should return null", async () => {
      const params = createDocument("");
      const result = await server.onParameterCache(params);
      assert.strictEqual(result, null);
    });
  });

  describe("onSelectionRanges", () => {
    it("should return identifier range", async () => {
      const params = createDocument(".test.ref");
      const result = await server.onSelectionRanges({
        textDocument: params.textDocument,
        positions: [params.position],
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].range.start.character, 0);
      assert.strictEqual(result[0].range.end.character, 9);
    });
  });

  describe("onPrepareCallHierarchy", () => {
    it("should prepare call hierarchy", async () => {
      const params = createDocument("a:1;a");
      const result = await server.onPrepareCallHierarchy(params);
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onIncomingCallsCallHierarchy", () => {
    it("should return incoming calls", async () => {
      const params = createDocument("a:1;a");
      const items = await server.onPrepareCallHierarchy(params);
      const result = await server.onIncomingCallsCallHierarchy({
        item: items[0],
      });
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onOutgoingCallsCallHierarchy", () => {
    it("should return outgoing calls", async () => {
      const params = createDocument("a:1;{a");
      const items = await server.onPrepareCallHierarchy(params);
      const result = await server.onOutgoingCallsCallHierarchy({
        item: items[0],
      });
      assert.strictEqual(result.length, 1);
    });
  });

  describe("onSemanticTokens", () => {
    it("should tokenize local variables", async () => {
      const params = createDocument("a:{[b;c]d:1;b*c*d}");
      const result = await server.onSemanticTokens(params);
      assert.strictEqual(result.data.length, 35);
    });

    it("should ignore qualified variables", async () => {
      const params = createDocument("a:{.ns.b:1;.ns.b}");
      const result = await server.onSemanticTokens(params);
      assert.strictEqual(result.data.length, 5);
    });

    it("should detect empty lists", async () => {
      const params = createDocument("a:{b:();b}");
      const result = await server.onSemanticTokens(params);
      assert.strictEqual(result.data.length, 15);
    });
  });

  describe("onDidClose", () => {
    it("should send epmty diagnostics", () => {
      const stub = sinon.stub(connection, "sendDiagnostics");
      server.onDidClose({ document: <TextDocument>{ uri: "" } });
      assert.ok(stub.calledOnce);
    });
  });
});
