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

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  DefinitionParams,
  DocumentSymbol,
  DocumentSymbolParams,
  InitializeParams,
  Location,
  Position,
  Range,
  ReferenceParams,
  RenameParams,
  ServerCapabilities,
  SymbolKind,
  TextDocumentIdentifier,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { Identifier, Token, TokenKind, parse } from "./parser";

function rangeFromToken(token: Token): Range {
  return Range.create(
    (token.startLine || 1) - 1,
    (token.startColumn || 1) - 1,
    (token.endLine || 1) - 1,
    token.endColumn || 1,
  );
}

function hasPosition(token: Token, position: Position) {
  const { start, end } = rangeFromToken(token);
  return (
    start.line <= position.line &&
    end.line >= position.line &&
    start.character <= position.character &&
    end.character >= position.character
  );
}

const enum FindKind {
  Reference,
  Definition,
  Rename,
  Completion,
}

export default class QLangServer {
  private declare connection: Connection;
  private declare params: InitializeParams;
  private declare documents: TextDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
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

  public onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return [];
    }

    const tokens = parse(document.getText());

    return tokens
      .filter((token) => token.kind === TokenKind.Assignment && !token.scope)
      .map((token) =>
        DocumentSymbol.create(
          token.identifier || token.image,
          undefined,
          token.lambda ? SymbolKind.Object : SymbolKind.Variable,
          rangeFromToken(token),
          rangeFromToken(token),
          tokens
            .filter(
              (child) =>
                child.scope &&
                child.scope === token.lambda &&
                child.kind === TokenKind.Assignment,
            )
            .map((token) =>
              DocumentSymbol.create(
                token.image,
                undefined,
                token.argument ? SymbolKind.Array : SymbolKind.Variable,
                rangeFromToken(token),
                rangeFromToken(token),
              ),
            ),
        ),
      );
  }

  public onReferences({ textDocument, position }: ReferenceParams): Location[] {
    return this.findIdentifiers(FindKind.Reference, textDocument, position).map(
      (token) => Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Location[] {
    return this.findIdentifiers(
      FindKind.Definition,
      textDocument,
      position,
    ).map((token) => Location.create(textDocument.uri, rangeFromToken(token)));
  }

  public onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null {
    const edits = this.findIdentifiers(
      FindKind.Rename,
      textDocument,
      position,
    ).map((token) => TextEdit.replace(rangeFromToken(token), newName));
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
    return this.findIdentifiers(
      FindKind.Completion,
      textDocument,
      position,
    ).map((token) => ({
      label: token.identifier || token.image,
      kind: token.lambda
        ? CompletionItemKind.Function
        : CompletionItemKind.Variable,
    }));
  }

  private findIdentifiers(
    kind: FindKind,
    textDocument: TextDocumentIdentifier,
    position: Position,
  ): Token[] {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return [];
    }
    const tokens = parse(document.getText());
    const source = tokens.find((token) => hasPosition(token, position));
    if (!source) {
      return [];
    }

    const isLocal = (source: Token) =>
      source.scope &&
      tokens.find(
        (token) =>
          token.scope === source.scope &&
          token.kind === TokenKind.Assignment &&
          token.identifier === source.identifier,
      );

    switch (kind) {
      case FindKind.Rename:
      case FindKind.Reference:
        return isLocal(source)
          ? tokens.filter(
              (token) =>
                token.tokenType === Identifier &&
                token.identifier === source.identifier &&
                token.scope === source.scope,
            )
          : tokens.filter(
              (token) =>
                token.tokenType === Identifier &&
                token.identifier === source.identifier &&
                !isLocal(token),
            );
      case FindKind.Definition:
        return isLocal(source)
          ? tokens.filter(
              (token) =>
                token.kind === TokenKind.Assignment &&
                token.identifier === source.identifier &&
                token.scope === source.scope,
            )
          : tokens.filter(
              (token) =>
                token.kind === TokenKind.Assignment &&
                token.identifier === source.identifier &&
                !isLocal(token),
            );
      case FindKind.Completion:
        return tokens.filter(
          (token) =>
            token.kind === TokenKind.Assignment &&
            (!token.scope || token.scope === source.scope),
        );
    }
  }
}
