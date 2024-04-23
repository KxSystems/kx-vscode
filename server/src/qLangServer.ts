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
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { Identifier, Token, TokenKind, parse } from "./parser";
import { IToken } from "chevrotain";

function rangeFromToken(token: IToken): Range {
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

export default class QLangServer {
  private declare connection: Connection;
  private declare params: InitializeParams;
  private declare documents: TextDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Full,
      referencesProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      completionProvider: { resolveProvider: false },
      renameProvider: true,
    };
  }

  public onReferences({
    textDocument,
    position,
  }: ReferenceParams): Location[] | undefined {
    return this.findReferences({ textDocument, position }).map((token) =>
      Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Location[] | undefined {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return;
    }

    const tokens = parse(document.getText());
    const source = tokens.find((token) => hasPosition(token, position));

    if (!source || source.tokenType !== Identifier) {
      return;
    }

    let target: Token[] = [];

    if (source.scope) {
      target = tokens.filter(
        (token) =>
          token.scope === source.scope &&
          token.kind === TokenKind.Assignment &&
          token.identifier === source.identifier,
      );
    }

    if (target.length === 0) {
      target = tokens.filter(
        (token) =>
          !token.scope &&
          token.kind === TokenKind.Assignment &&
          token.identifier === source.identifier,
      );
    }

    return target.map((token) =>
      Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] | undefined {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return;
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

  public onCompletion(): CompletionItem[] {
    return [];
  }

  public onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null {
    const edits = this.findReferences({ textDocument, position }).map((token) =>
      TextEdit.replace(rangeFromToken(token), newName),
    );
    if (edits.length > 0) {
      return {
        changes: {
          [textDocument.uri]: edits,
        },
      };
    }
    return null;
  }

  private findReferences({
    textDocument,
    position,
  }: TextDocumentPositionParams): Token[] {
    let target: Token[] = [];

    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return target;
    }

    const tokens = parse(document.getText());
    const source = tokens.find((token) => hasPosition(token, position));

    if (!source || source.tokenType !== Identifier) {
      return target;
    }

    if (source.scope) {
      target = tokens.filter(
        (token) =>
          token.scope === source.scope &&
          token.tokenType === Identifier &&
          token.identifier === source.identifier,
      );
    }

    if (target.length === 0) {
      target = tokens.filter(
        (token) =>
          !token.scope &&
          token.tokenType === Identifier &&
          token.identifier === source.identifier,
      );
    }

    return target;
  }
}
