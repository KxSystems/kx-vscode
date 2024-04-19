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
  InitializeParams,
  Location,
  Range,
  RenameParams,
  ServerCapabilities,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { TokenType, IdentifierPattern, scope, analyze } from "./parser";
import { KeywordPattern } from "./parser/keywords";
import { QParser } from "./parser/parser";

export default class QLangServer {
  private connection: Connection;
  private params: InitializeParams;
  public documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument,
  );

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.documents.listen(this.connection);
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { resolveProvider: false },
      definitionProvider: true,
      renameProvider: true,
    };
  }

  private onCompletion(): CompletionItem[] {
    return [];
  }

  private onDefinition(): Location[] {
    return [];
  }

  private onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null | undefined {
    let match = IdentifierPattern.exec(newName);
    if (!match || match[0] !== newName) {
      return null;
    }
    match = KeywordPattern.exec(newName);
    if (match && match[0] === newName) {
      return null;
    }
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return null;
    }
    const cst = QParser.parse(document.getText());
    if (QParser.errors.length > 0) {
      return null;
    }
    const offset = document.offsetAt(position);
    const { script, assign } = analyze(cst);
    const symbol = script.find(
      (entity) =>
        entity.type === TokenType.IDENTIFIER &&
        offset >= entity.startOffset &&
        offset <= entity.endOffset,
    );
    if (!symbol) {
      return null;
    }
    let targets;
    const symbolScope = scope(symbol);
    const local = assign.find(
      (entity) =>
        symbol.image === entity.image &&
        symbolScope &&
        symbolScope === scope(entity),
    );
    if (local) {
      const exists = assign.find(
        (entity) => entity.image === newName && symbolScope === scope(entity),
      );
      if (exists) {
        return null;
      }
      targets = script.filter(
        (entity) =>
          symbol.image === entity.image &&
          symbolScope &&
          symbolScope === scope(entity) &&
          entity.type === TokenType.IDENTIFIER,
      );
    } else {
      const global = assign.find(
        (entity) => !scope(entity) && symbol.image === entity.image,
      );
      if (!global) {
        return null;
      }
      const exists = assign.find(
        (entity) => !scope(entity) && entity.image === newName,
      );
      if (exists) {
        return null;
      }
      targets = script.filter((entity) => {
        if (
          entity.type !== TokenType.IDENTIFIER ||
          entity.image !== symbol.image
        ) {
          return false;
        }
        const scoped = scope(entity);
        const local = assign.find(
          (ident) =>
            ident.image === entity.image && scoped && scope(ident) === scoped,
        );
        return !local;
      });
    }
    const edits = targets.map((entity) => {
      const start = document.positionAt(entity.startOffset);
      const end = document.positionAt(entity.endOffset);
      const range = Range.create(start, end);
      return TextEdit.replace(range, newName);
    });
    if (edits.length > 0) {
      return {
        changes: {
          [textDocument.uri]: edits,
        },
      };
    }
    return null;
  }
}
