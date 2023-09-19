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
  CompletionItem,
  Connection,
  InitializeParams,
  ReferenceParams,
  TextDocumentPositionParams,
} from "vscode-languageserver";
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

  it("onCompletion should return empty array for no keyword", () => {
    const getKeywordStub = sinon.stub(server, <any>"getKeyword");
    getKeywordStub.value(() => undefined);
    const result = server.onCompletion(<TextDocumentPositionParams>{
      textDocument: { uri: undefined },
      position: undefined,
    });
    assert.strictEqual(result.length, 0);
  });

  it("onCompletionResolve should return a value", async () => {
    const item = <CompletionItem>{ label: "test" };
    const result = await server.onCompletionResolve(item);
    assert.strictEqual(result, item);
  });

  it("onHover should return null for no keyword", async () => {
    const getKeywordStub = sinon.stub(server, <any>"getEntireKeyword");
    getKeywordStub.value(() => undefined);
    const result = await server.onHover(<TextDocumentPositionParams>{
      textDocument: { uri: undefined },
      position: undefined,
    });
    assert.strictEqual(result, null);
  });

  it("onDocumentHighlight should return empty array for no document", () => {
    const result = server.onDocumentHighlight(<TextDocumentPositionParams>{
      textDocument: { uri: undefined },
      position: undefined,
    });
    assert.strictEqual(result.length, 0);
  });

  it("onDefinition should return empty array for no document", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server.onDefinition(<TextDocumentPositionParams>{
      textDocument: { uri: undefined },
      position: undefined,
    });
    assert.strictEqual(result.length, 0);
  });

  it("onDocumentSymbol should return empty array for no document", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server.onDocumentSymbol(<TextDocumentPositionParams>{
      textDocument: { uri: undefined },
      position: undefined,
    });
    assert.strictEqual(result.length, 0);
  });

  it("onPrepareCallHierarchy should return empty array for no document", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server.onPrepareCallHierarchy(<TextDocumentPositionParams>{
      textDocument: { uri: undefined },
      position: undefined,
    });
    assert.strictEqual(result.length, 0);
  });

  it("onIncomingCallsCallHierarchy should return empty array for no item", () => {
    const result = server.onIncomingCallsCallHierarchy(<
      CallHierarchyIncomingCallsParams
    >{
      item: { name: undefined },
    });
    assert.strictEqual(result.length, 0);
  });

  // TODO
  it("onOutgoingCallsCallHierarchy", () => {});

  it("onReferences should return empty array for no document", () => {
    const getStub = sinon.stub(server.documents, "get");
    getStub.value(() => undefined);
    const result = server.onReferences(<ReferenceParams>{
      textDocument: { uri: undefined },
    });
    assert.strictEqual(result.length, 0);
  });

  // TODO
  it("onRenameRequest", () => {});

  // TODO
  it("onSemanticsTokens", () => {});
});
