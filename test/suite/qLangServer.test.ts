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
import {
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CompletionItem,
  Connection,
  DocumentSymbolParams,
  InitializeParams,
  Position,
  PublishDiagnosticsParams,
  ReferenceParams,
  RenameParams,
  SemanticTokensParams,
  SignatureHelpParams,
  TextDocumentIdentifier,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import QLangServer from "../../server/src/qLangServer";

describe("qLangServer tests", () => {
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
      onNotification() {},
      onCompletion() {},
      onCompletionResolve() {},
      onHover() {},
      onDocumentHighlight() {},
      onDefinition() {},
      onDocumentSymbol() {},
      onReferences() {},
      onRenameRequest() {},
      sendDiagnostics() {},
      languages: {
        semanticTokens: {
          on() {},
        },
        callHierarchy: {
          onPrepare() {},
          onIncomingCalls() {},
          onOutgoingCalls() {},
        },
      },
      console: {
        error() {},
        warn() {},
        info() {},
      },
      workspace: {
        getConfiguration() {},
      },
    });

    const params = <InitializeParams>{
      workspaceFolders: null,
    };

    server = await QLangServer.initialize(connection, params);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("capabilities should return a value", () => {
    assert.ok(server.capabilities());
  });

  it("debugWithLogs should log a warning message", () => {
    const warnStub = sinon.stub(server.connection.console, "warn");
    let ok = false;
    warnStub.value(() => (ok = true));
    server.debugWithLogs("request", "msg");
    assert.ok(ok);
  });

  it("writeConsoleMsg should log an error message", () => {
    const errorStub = sinon.stub(server.connection.console, "error");
    let ok = false;
    errorStub.value(() => (ok = true));
    server.writeConsoleMsg("msg", "error");
    assert.ok(ok);
  });

  it("writeConsoleMsg should log an info message", () => {
    const infoStub = sinon.stub(server.connection.console, "info");
    let ok = false;
    infoStub.value(() => (ok = true));
    server.writeConsoleMsg("msg", "info");
    assert.ok(ok);
  });

  it("onCompletion should return an empty array", () => {
    const getKeywordStub = sinon.stub(server, <any>"getKeyword");
    getKeywordStub.value(() => undefined);
    const result = server["onCompletion"](<TextDocumentPositionParams>{
      textDocument: TextDocumentIdentifier.create("/test/test.q"),
      position: Position.create(0, 0),
    });
    assert.strictEqual(result.length, 0);
  });

  it("onCompletion should return a value", () => {
    const doc = TextDocument.create("/test/test.q", "q", 1, "aco");
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 3);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const result = server["onCompletion"](<TextDocumentPositionParams>{
      textDocument,
      position,
    });
    assert.ok(result.length > 0);
  });

  it("onCompletionResolve should return a value", async () => {
    const item = <CompletionItem>{ label: "test" };
    const result = await server["onCompletionResolve"](item);
    assert.strictEqual(result, item);
  });

  it("onHover should return null", async () => {
    const getKeywordStub = sinon.stub(server, <any>"getEntireKeyword");
    getKeywordStub.value(() => undefined);
    const result = await server["onHover"](<TextDocumentPositionParams>{
      textDocument: TextDocumentIdentifier.create("/test/test.q"),
      position: Position.create(0, 0),
    });
    assert.strictEqual(result, null);
  });

  it("onHover should return a value", async () => {
    const doc = TextDocument.create("/test/test.q", "q", 1, "acos");
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 1);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const result = await server["onHover"](<TextDocumentPositionParams>{
      textDocument,
      position,
    });
    // TODO
    assert.ok(result);
  });

  it("onDocumentHighlight should return an empty array", () => {
    const result = server["onDocumentHighlight"](<TextDocumentPositionParams>{
      textDocument: TextDocumentIdentifier.create("/test/test.q"),
      position: Position.create(0, 0),
    });
    assert.strictEqual(result.length, 0);
  });

  it("onDefinition should return an empty array", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server["onDefinition"](<TextDocumentPositionParams>{
      textDocument: TextDocumentIdentifier.create("/test/test.q"),
      position: Position.create(0, 0),
    });
    assert.strictEqual(result.length, 0);
  });

  it("onDefinition should return a value", () => {
    const doc = TextDocument.create(
      "/test/test.q",
      "q",
      1,
      "test_func: {[x] x*x};\ntest_func[2];"
    );
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(1, 1);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const valuesStub = sinon.stub(
      server.analyzer["uriToTextDocument"],
      "values"
    );
    valuesStub.value(() => [doc]);
    const result = server["onDefinition"](<TextDocumentPositionParams>{
      textDocument,
      position,
    });
    assert.ok(result.length > 0);
  });

  it("onDocumentSymbol should return an empty array", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server["onDocumentSymbol"](<TextDocumentPositionParams>{
      textDocument: TextDocumentIdentifier.create("/test/test.q"),
      position: Position.create(0, 0),
    });
    assert.strictEqual(result.length, 0);
  });

  it("onDocumentSymbol should return a value", () => {
    const doc = TextDocument.create("/test/test.q", "q", 1, "a:1; b:2;");
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 3);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const result = server["onDocumentSymbol"](<DocumentSymbolParams>{
      textDocument,
      position,
    });
    // TODO PR-103
    assert.strictEqual(result.length, 0);
  });

  it("onPrepareCallHierarchy should return an empty array", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server["onPrepareCallHierarchy"](<
      TextDocumentPositionParams
    >{
      textDocument: TextDocumentIdentifier.create("/test/test.q"),
      position: Position.create(0, 0),
    });
    assert.strictEqual(result.length, 0);
  });

  it("onPrepareCallHierarchy should return a value", () => {
    const doc = TextDocument.create("/test/test.q", "q", 1, "a:1; b:2;");
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 3);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const result = server["onPrepareCallHierarchy"](<
      TextDocumentPositionParams
    >{
      textDocument,
      position,
    });
    // TODO
    assert.strictEqual(result.length, 0);
  });

  it("onIncomingCallsCallHierarchy should return an empty array", () => {
    const result = server.onIncomingCallsCallHierarchy(<
      CallHierarchyIncomingCallsParams
    >{
      item: { name: undefined },
    });
    assert.strictEqual(result.length, 0);
  });

  it("onOutgoingCallsCallHierarchy should return a value", () => {
    const result = server.onOutgoingCallsCallHierarchy({
      item: <CallHierarchyItem>{ uri: "test", name: "test" },
    });
    // TODO
    assert.ok(result);
  });

  it("onReferences should return an empty array", () => {
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 0);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server["onReferences"](<ReferenceParams>{
      textDocument,
      position,
    });
    assert.strictEqual(result.length, 0);
  });

  it("onReferences should return a value", () => {
    const doc = TextDocument.create(
      "/test/test.q",
      "q",
      1,
      "test_func: {[x] x*x};\ntest_func[2];"
    );
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(1, 1);
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const valuesStub = sinon.stub(
      server.analyzer["uriToTextDocument"],
      "values"
    );
    valuesStub.value(() => [doc]);
    const result = server["onReferences"](<ReferenceParams>{
      textDocument,
      position,
    });
    assert.ok(result.length > 0);
  });

  it("onRenameRequest should return a value", () => {
    const doc = TextDocument.create("/test/test.q", "q", 1, "SOMEVAR:1");
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 0);
    const newName = "CHANGEDVAR";
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const result = server["onRenameRequest"](<RenameParams>{
      textDocument,
      position,
      newName,
    });
    // TODO
    assert.strictEqual(result, null);
  });

  it("onSignatureHelp should return a value", () => {
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const position = Position.create(0, 0);
    const result = server["onSignatureHelp"](<SignatureHelpParams>{
      textDocument,
      position,
    });
    // TODO
    assert.strictEqual(result, undefined);
  });

  it("onSemanticsTokens should return a value", () => {
    const doc = TextDocument.create("/test/test.q", "q", 1, "TOKEN:1");
    const textDocument = TextDocumentIdentifier.create("/test/test.q");
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => doc);
    const result = server["onSemanticsTokens"](<SemanticTokensParams>{
      textDocument,
    });
    // TODO
    assert.strictEqual(result.data.length, 0);
  });

  it("validateTextDocument should publish a diagnostic", async () => {
    const sendDiagnosticsStub = sinon.stub(
      server.connection,
      "sendDiagnostics"
    );
    let result: PublishDiagnosticsParams;
    sendDiagnosticsStub.value(
      async (params: PublishDiagnosticsParams) => (result = params)
    );
    const doc = TextDocument.create("/test/test.q", "q", 1, "SOMEVAR:1");
    await server["validateTextDocument"](doc);
    assert.strictEqual(result.diagnostics.length, 1);
  });
});
