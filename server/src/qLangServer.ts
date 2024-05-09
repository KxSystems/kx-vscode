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
  DidChangeConfigurationParams,
  DocumentSymbol,
  DocumentSymbolParams,
  InitializeParams,
  LSPAny,
  Location,
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
import { Identifier, IdentifierKind, Token, TokenKind, parse } from "./parser";
import { getLabel, isLocal, positionToToken, rangeFromToken } from "./util";
import { lint } from "./linter";

const enum FindKind {
  Reference,
  Definition,
  Rename,
  Completion,
}

interface Settings {
  linting: boolean;
}

const defaultSettings: Settings = { linting: false };

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
      if ("linting" in settings.kdb) {
        this.setSettings({ linting: settings.kdb.linting });
      }
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
      const diagnostics = lint(this.parse(document));
      this.connection.sendDiagnostics({ uri, diagnostics });
    }
  }

  public onDocumentSymbol_Debug({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] {
    return this.parse(textDocument).map((token) =>
      DocumentSymbol.create(
        token.image,
        `${token.tokenType.name} (${token.reverse})`,
        SymbolKind.Variable,
        rangeFromToken(token),
        rangeFromToken(token),
      ),
    );
  }

  public onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] {
    const tokens = this.parse(textDocument);
    return tokens
      .filter((token) => token.kind === TokenKind.Assignment && !token.scope)
      .map((token) =>
        DocumentSymbol.create(
          getLabel(token),
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
                token.identifierKind === IdentifierKind.Argument
                  ? SymbolKind.Array
                  : SymbolKind.Variable,
                rangeFromToken(token),
                rangeFromToken(token),
              ),
            ),
        ),
      );
  }

  public onReferences({ textDocument, position }: ReferenceParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.findIdentifiers(FindKind.Reference, tokens, source).map(
      (token) => Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.findIdentifiers(FindKind.Definition, tokens, source).map(
      (token) => Location.create(textDocument.uri, rangeFromToken(token)),
    );
  }

  public onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    const edits = this.findIdentifiers(FindKind.Rename, tokens, source).map(
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
    return this.findIdentifiers(FindKind.Completion, tokens, source).map(
      (token) => ({
        label: getLabel(token, source),
        kind: token.lambda
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

  private findIdentifiers(
    kind: FindKind,
    tokens: Token[],
    source?: Token,
  ): Token[] {
    if (!source || source.identifierKind === IdentifierKind.Unassignable) {
      return [];
    }
    switch (kind) {
      case FindKind.Rename:
      case FindKind.Reference:
        return isLocal(tokens, source)
          ? tokens.filter(
              (token) =>
                token.tokenType === Identifier &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                token.scope === source.scope,
            )
          : tokens.filter(
              (token) =>
                token.tokenType === Identifier &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                !isLocal(tokens, token),
            );
      case FindKind.Definition:
        return isLocal(tokens, source)
          ? tokens.filter(
              (token) =>
                token.kind === TokenKind.Assignment &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                token.scope === source.scope,
            )
          : tokens.filter(
              (token) =>
                token.kind === TokenKind.Assignment &&
                token.identifierKind !== IdentifierKind.Unassignable &&
                token.identifier === source.identifier &&
                !isLocal(tokens, token),
            );
      case FindKind.Completion:
        const completions: Token[] = [];
        tokens
          .filter(
            (token) =>
              token.kind === TokenKind.Assignment &&
              token.identifierKind !== IdentifierKind.Unassignable &&
              (token.identifier?.startsWith(".") ||
                token.namespace === source.namespace) &&
              (!token.scope || token.scope === source.scope),
          )
          .forEach(
            (token) =>
              !completions.find(
                (item) => item.identifier === token.identifier,
              ) && completions.push(token),
          );
        return completions;
    }
  }
}
