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

import { Position, TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  DefinitionParams,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationParams,
  DocumentSymbol,
  DocumentSymbolParams,
  InitializeParams,
  LSPAny,
  Location,
  Range,
  ReferenceParams,
  RenameParams,
  ServerCapabilities,
  SymbolKind,
  TextDocumentChangeEvent,
  TextDocumentIdentifier,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import {
  FindKind,
  LCurly,
  Token,
  children,
  findIdentifiers,
  isLambda,
  parse,
} from "./parser";
import { lint } from "./linter";

interface Settings {
  debug: boolean;
  linting: boolean;
}

const defaultSettings: Settings = { debug: false, linting: false };

export default class QLangServer {
  private declare connection: Connection;
  private declare params: InitializeParams;
  private declare settings: Settings;
  public declare documents: TextDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.settings = defaultSettings;
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.documents.onDidClose(this.onDidClose.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onDidChangeConfiguration(
      this.onDidChangeConfiguration.bind(this),
    );
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentSymbolProvider: true,
      referencesProvider: true,
      definitionProvider: true,
      renameProvider: true,
      completionProvider: { resolveProvider: false },
    };
  }

  public setSettings(settings: LSPAny) {
    this.settings = settings;
  }

  public onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
    if ("kdb" in settings) {
      const kdb = settings.kdb;
      this.setSettings({
        debug: kdb.debug || false,
        linting: kdb.linting || false,
      });
    }
  }

  public onDidClose({ document }: TextDocumentChangeEvent<TextDocument>) {
    this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  }

  public onDidChangeContent({
    document,
  }: TextDocumentChangeEvent<TextDocument>) {
    if (this.settings.linting) {
      const uri = document.uri;
      const diagnostics = lint(this.parse(document)).map((item) =>
        Diagnostic.create(
          rangeFromToken(item.token),
          item.message,
          item.severity as DiagnosticSeverity,
          item.code,
          item.source,
        ),
      );
      this.connection.sendDiagnostics({ uri, diagnostics });
    }
  }

  public onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] {
    const tokens = this.parse(textDocument);
    if (this.settings.debug) {
      return tokens.map((token) => createDebugSymbol(token));
    }
    return tokens
      .filter((token) => token.assignable && token.assignment && !token.scope)
      .map((token) => createSymbol(token));
  }

  public onReferences({ textDocument, position }: ReferenceParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return findIdentifiers(FindKind.Reference, tokens, source).map((token) =>
      Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return findIdentifiers(FindKind.Definition, tokens, source).map((token) =>
      Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    const edits = findIdentifiers(FindKind.Rename, tokens, source).map(
      (token) => TextEdit.replace(rangeFromToken(token), newName),
    );
    return edits.length === 0
      ? null
      : {
          changes: {
            [textDocument.uri]: edits,
          },
        };
  }

  public onCompletion({
    textDocument,
    position,
  }: CompletionParams): CompletionItem[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return findIdentifiers(FindKind.Completion, tokens, source).map(
      (token) => ({
        label: token.image,
        kind:
          token.assignment?.tokenType === LCurly
            ? CompletionItemKind.Function
            : CompletionItemKind.Variable,
      }),
    );
  }

  private parse(textDocument: TextDocumentIdentifier): Token[] {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return [];
    }
    return parse(document.getText());
  }
}

function rangeFromToken(token: Token): Range {
  return Range.create(
    (token.startLine || 1) - 1,
    (token.startColumn || 1) - 1,
    (token.endLine || 1) - 1,
    token.endColumn || 1,
  );
}

function positionToToken(tokens: Token[], position: Position) {
  return tokens.find((token) => {
    const { start, end } = rangeFromToken(token);
    return (
      start.line <= position.line &&
      end.line >= position.line &&
      start.character <= position.character &&
      end.character >= position.character
    );
  });
}

function createSymbol(token: Token): DocumentSymbol {
  return DocumentSymbol.create(
    token.image.trim(),
    undefined,
    isLambda(token.assignment) ? SymbolKind.Object : SymbolKind.Variable,
    rangeFromToken(token),
    rangeFromToken(token),
    children(token.assignment)
      .filter((child) => child.assignable && child.assignment)
      .map((child) => createSymbol(child)),
  );
}

function createDebugSymbol(token: Token): DocumentSymbol {
  return DocumentSymbol.create(
    (token.image.trim() || " ").slice(0, 10),
    `${token.tokenType.name} ${token.namespace ? `(${token.namespace})` : ""} ${
      token.order || ""
    } ${token.assignment ? "A" : ""}${token.local ? "L" : ""}${
      token.scope ? "S" : ""
    }${token.error ? "E" : ""}`,
    SymbolKind.Variable,
    rangeFromToken(token),
    rangeFromToken(token),
  );
}
