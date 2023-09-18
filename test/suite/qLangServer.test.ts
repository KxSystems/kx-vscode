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
  EndOfLine,
  Position,
  Range,
  TextDocument,
  TextLine,
  Uri,
} from "vscode";
import QLangServer from "../../server/src/qLangServer";

describe("qLangServer tests", () => {
  let server: QLangServer;

  beforeEach(async () => {
    const connectionMock = {
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
    };

    const paramsMock = {
      processId: 0,
      rootUri: "",
      capabilities: {},
      workspaceFolders: [],
    };

    // @ts-ignore
    server = await QLangServer.initialize(connectionMock, paramsMock);
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

  it("onCompletionResolve should return a value", async () => {
    const item = { label: "test" };
    const result = await server.onCompletionResolve(item);
    assert.strictEqual(result, item);
  });

  it("onDocumentHighlight should return empty array", async () => {
    const result = server.onDocumentHighlight({
      position: null,
      textDocument: null,
    });
    assert.strictEqual(result.length, 0);
  });

  // TODO
  it("onCompletion should return empty array for no keyword", () => {});

  // TODO
  it("onDefinition should return empty array for no document", async () => {
    const getKeywordStub = sinon.stub(server.documents, "get");
    getKeywordStub.value(() => undefined);
    const result = server.onDefinition({
      textDocument: { uri: "" },
      position: undefined,
    });
    assert.strictEqual(result.length, 0);
  });

  // TODO
  it("onHover should return null for no keyword", async () => {});

  // TODO
  it("onDocumentSymbol should return empty array for no document", async () => {});

  // TODO
  it("onPrepareCallHierarchy", async () => {});

  // TODO
  it("onIncomingCallsCallHierarchy", async () => {});

  // TODO
  it("onOutgoingCallsCallHierarchy", async () => {});

  // TODO
  it("onReferences", async () => {});

  // TODO
  it("onRenameRequest", async () => {});

  // TODO
  it("onSignatureHelp", async () => {});

  // TODO
  it("onSemanticsTokens", async () => {});

  // TODO
  it("validateTextDocument", async () => {});
});

class TextDocumentMock implements TextDocument {
  fileName!: string;
  isUntitled!: boolean;
  languageId!: string;
  version!: number;
  isDirty!: boolean;
  isClosed!: boolean;
  eol!: EndOfLine;
  lineCount!: number;
  text: string;

  uri = Uri.parse("/test/test.q");

  constructor(text: string) {
    this.text = text;
  }

  getText(range?: Range): string {
    return this.text;
  }

  save(): Thenable<boolean> {
    throw new Error("Method not implemented.");
  }
  lineAt(position: Position | number | any): TextLine {
    throw new Error("Method not implemented.");
  }
  offsetAt(position: Position): number {
    throw new Error("Method not implemented.");
  }
  positionAt(offset: number): Position {
    throw new Error("Method not implemented.");
  }
  getWordRangeAtPosition(
    position: Position,
    regex?: RegExp
  ): Range | undefined {
    throw new Error("Method not implemented.");
  }
  validateRange(range: Range): Range {
    throw new Error("Method not implemented.");
  }
  validatePosition(position: Position): Position {
    throw new Error("Method not implemented.");
  }
}
