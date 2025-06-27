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

import { globSync } from "glob";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Connection,
  DefinitionParams,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationParams,
  DidChangeWatchedFilesParams,
  DocumentSymbol,
  DocumentSymbolParams,
  FileChangeType,
  InitializeParams,
  LSPAny,
  Location,
  Range,
  ReferenceParams,
  RenameParams,
  SelectionRange,
  SelectionRangeParams,
  SemanticTokens,
  SemanticTokensParams,
  ServerCapabilities,
  SymbolKind,
  TextDocumentChangeEvent,
  TextDocumentIdentifier,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { Position, TextDocument } from "vscode-languageserver-textdocument";

import { lint } from "./linter";
import {
  FindKind,
  Token,
  findIdentifiers,
  inLambda,
  amended,
  parse,
  identifier,
  tokenId,
  assigned,
  lambda,
  assignable,
  inParam,
  namespace,
  relative,
  testblock,
  EndOfLine,
  SemiColon,
  WhiteSpace,
  RCurly,
  local,
  lamdaDefinition,
} from "./parser";

interface Settings {
  debug: boolean;
  linting: boolean;
  refactoring: "Workspace" | "Window";
}

const defaultSettings: Settings = {
  debug: false,
  linting: false,
  refactoring: "Workspace",
};

interface Tokenized {
  uri: string;
  tokens: Token[];
}

export default class QLangServer {
  declare private connection: Connection;
  declare private params: InitializeParams;
  declare private settings: Settings;
  declare private cached: Map<string, Token[]>;
  declare public documents: TextDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.settings = defaultSettings;
    this.cached = new Map();
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.documents.onDidClose(this.onDidClose.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onDidChangeWatchedFiles(
      this.onDidChangeWatchedFiles.bind(this),
    );
    this.connection.languages.callHierarchy.onPrepare(
      this.onPrepareCallHierarchy.bind(this),
    );
    this.connection.languages.callHierarchy.onIncomingCalls(
      this.onIncomingCallsCallHierarchy.bind(this),
    );
    this.connection.languages.callHierarchy.onOutgoingCalls(
      this.onOutgoingCallsCallHierarchy.bind(this),
    );
    this.connection.languages.semanticTokens.on(
      this.onSemanticTokens.bind(this),
    );
    this.connection.onDidChangeConfiguration(
      this.onDidChangeConfiguration.bind(this),
    );
    this.connection.onRequest(
      "kdb.qls.expressionRange",
      this.onExpressionRange.bind(this),
    );
    this.connection.onRequest(
      "kdb.qls.parameterCache",
      this.onParameterCache.bind(this),
    );
    this.connection.onSelectionRanges(this.onSelectionRanges.bind(this));
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentSymbolProvider: true,
      referencesProvider: true,
      definitionProvider: true,
      renameProvider: true,
      completionProvider: { resolveProvider: false },
      selectionRangeProvider: true,
      callHierarchyProvider: true,
      semanticTokensProvider: {
        full: true,
        legend: {
          tokenTypes: ["variable", "function"],
          tokenModifiers: ["declaration", "readonly"],
        },
      },
    };
  }

  public setSettings(settings: LSPAny) {
    this.settings = {
      debug: settings.debug_parser || false,
      linting: settings.linting || false,
      refactoring: settings.refactoring || "Workspace",
    };
  }

  public onDidChangeConfiguration({ settings }: DidChangeConfigurationParams) {
    if ("kdb" in settings) {
      this.setSettings(settings.kdb);
    }
  }

  /* istanbul ignore next */
  public onDidChangeWatchedFiles({ changes }: DidChangeWatchedFilesParams) {
    try {
      this.parseFiles(
        changes.reduce((matches, change) => {
          if (change.type === FileChangeType.Deleted) {
            this.cached.delete(change.uri);
          } else {
            matches.push(fileURLToPath(change.uri));
          }
          return matches;
        }, [] as string[]),
      );
    } catch (error) {
      this.connection.window.showErrorMessage(`${error}`);
    }
  }

  public onDidChangeContent({
    document,
  }: TextDocumentChangeEvent<TextDocument>) {
    const uri = document.uri;
    this.cached.delete(uri);
    if (this.settings.linting) {
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

  public onDidClose({ document }: TextDocumentChangeEvent<TextDocument>) {
    this.connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  }

  public onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): DocumentSymbol[] {
    const tokens = this.parse(textDocument);
    if (this.settings.debug) {
      return tokens.map((token) => createDebugSymbol(token));
    }
    return tokens
      .filter(
        (token) =>
          !inLambda(token) &&
          ((assignable(token) && assigned(token)) || lambda(token)),
      )
      .map((token) => createSymbol(token, tokens));
  }

  public onReferences({ textDocument, position }: ReferenceParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.context({ uri: textDocument.uri, tokens })
      .map((document) =>
        findIdentifiers(FindKind.Reference, document.tokens, source).map(
          (token) => Location.create(document.uri, rangeFromToken(token)),
        ),
      )
      .flat();
  }

  public onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Location[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.context({ uri: textDocument.uri, tokens })
      .map((document) =>
        findIdentifiers(FindKind.Definition, document.tokens, source).map(
          (token) => Location.create(document.uri, rangeFromToken(token)),
        ),
      )
      .flat();
  }

  public onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    const all = this.settings.refactoring === "Workspace";
    return this.context({ uri: textDocument.uri, tokens }, all).reduce(
      (edit, document) => {
        const refs = findIdentifiers(FindKind.Rename, document.tokens, source);
        if (refs.length > 0) {
          const name = <Token>{
            image: newName,
            namespace: source?.namespace,
          };
          edit.changes![document.uri] = refs.map((token) =>
            TextEdit.replace(rangeFromToken(token), relative(name, token)),
          );
        }
        return edit;
      },
      { changes: {} } as WorkspaceEdit,
    );
  }

  public onCompletion({
    textDocument,
    position,
  }: CompletionParams): CompletionItem[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    return this.context({ uri: textDocument.uri, tokens })
      .map((document) =>
        findIdentifiers(FindKind.Completion, document.tokens, source).map(
          (token) => {
            return {
              label: token.image,
              labelDetails: {
                detail: ` .${namespace(token)}`,
              },
              kind: CompletionItemKind.Variable,
              insertText: relative(token, source),
            };
          },
        ),
      )
      .flat();
  }

  public onExpressionRange({
    textDocument,
    position,
  }: TextDocumentPositionParams) {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    if (!source || !source.exprs) {
      return null;
    }
    return expressionToRange(tokens, source.exprs);
  }

  public onParameterCache({
    textDocument,
    position,
  }: TextDocumentPositionParams) {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    if (!source) {
      return null;
    }
    const lambda = inLambda(source);
    if (!lambda) {
      return null;
    }
    const scoped = tokens.filter((token) => inLambda(token) === lambda);
    if (scoped.length === 0) {
      return null;
    }
    const curly = scoped[scoped.length - 1];
    if (!curly || curly.tokenType !== RCurly) {
      return null;
    }
    const params = scoped.filter((token) => inParam(token));
    if (params.length === 0) {
      return null;
    }
    const bracket = params[params.length - 1];
    if (!bracket) {
      return null;
    }
    const args = params
      .filter((token) => assigned(token))
      .map((token) => token.image);
    if (args.length === 0) {
      return null;
    }
    return {
      params: args,
      start: rangeFromToken(bracket).end,
      end: rangeFromToken(curly).start,
    };
  }

  public onSelectionRanges({
    textDocument,
    positions,
  }: SelectionRangeParams): SelectionRange[] {
    const tokens = this.parse(textDocument);
    const ranges: SelectionRange[] = [];

    for (const position of positions) {
      const source = positionToToken(tokens, position);
      if (source) {
        ranges.push(SelectionRange.create(rangeFromToken(source)));
      }
    }
    return ranges;
  }

  public onPrepareCallHierarchy({
    textDocument,
    position,
  }: CallHierarchyPrepareParams): CallHierarchyItem[] {
    const tokens = this.parse(textDocument);
    const source = positionToToken(tokens, position);
    if (source && assignable(source)) {
      return [
        {
          data: true,
          kind: SymbolKind.Variable,
          name: source.image,
          uri: textDocument.uri,
          range: rangeFromToken(source),
          selectionRange: rangeFromToken(source),
        },
      ];
    }
    return [];
  }

  public onIncomingCallsCallHierarchy({
    item,
  }: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] {
    const tokens = this.parse({ uri: item.uri });
    const source = positionToToken(tokens, item.range.end);
    return item.data
      ? this.context({ uri: item.uri, tokens })
          .map((document) =>
            findIdentifiers(FindKind.Reference, document.tokens, source)
              .filter((token) => !assigned(token))
              .map((token) => {
                const lambda = inLambda(token);
                return {
                  from: {
                    kind: lambda ? SymbolKind.Object : SymbolKind.Function,
                    name: token.image,
                    uri: document.uri,
                    range: rangeFromToken(lambda || token),
                    selectionRange: rangeFromToken(token),
                  },
                  fromRanges: [],
                } as CallHierarchyIncomingCall;
              }),
          )
          .flat()
      : [];
  }

  public onOutgoingCallsCallHierarchy({
    item,
  }: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] {
    const tokens = this.parse({ uri: item.uri });
    const source = positionToToken(tokens, item.range.end);
    return item.data
      ? this.context({ uri: item.uri, tokens })
          .map((document) =>
            findIdentifiers(FindKind.Reference, document.tokens, source)
              .filter((token) => inLambda(token) && !assigned(token))
              .map((token) => {
                return {
                  to: {
                    kind: SymbolKind.Object,
                    name: token.image,
                    uri: document.uri,
                    range: rangeFromToken(inLambda(token)!),
                    selectionRange: rangeFromToken(token),
                  },
                  fromRanges: [],
                } as CallHierarchyOutgoingCall;
              }),
          )
          .flat()
      : [];
  }

  public onSemanticTokens({
    textDocument,
  }: SemanticTokensParams): SemanticTokens {
    const tokens = this.parse({ uri: textDocument.uri });
    const result = { data: [] } as SemanticTokens;
    let range: Range = Range.create(0, 0, 0, 0);
    let line = 0;
    let character = 0;
    let delta = 0;
    for (const token of tokens) {
      if (assignable(token)) {
        const kind = lamdaDefinition(token) ? 1 : local(token, tokens) ? 0 : -1;
        if (kind >= 0) {
          line = range.start.line;
          character = range.start.character;
          range = rangeFromToken(token);
          delta = range.start.line - line;
          result.data.push(
            delta,
            delta ? range.start.character : range.start.character - character,
            token.image.length,
            kind,
            3,
          );
        }
      }
    }
    return result;
  }

  /* istanbul ignore next */
  public scan() {
    const folders = this.params.workspaceFolders;
    if (folders) {
      try {
        for (const folder of folders) {
          this.parseFiles(
            globSync("**/*.{q,quke}", {
              dot: true,
              absolute: true,
              nodir: true,
              follow: false,
              ignore: ["**/node_modules/**/*", "**/build/**/*"],
              cwd: fileURLToPath(folder.uri),
            }),
          );
        }
      } catch (error) {
        this.connection.window.showErrorMessage(`${error}`);
      }
    }
  }

  /* istanbul ignore next */
  private parseFiles(matches: string[]) {
    for (const match of matches) {
      const file = readFileSync(match, "utf-8");
      this.cached.set(pathToFileURL(match).toString(), parse(file));
    }
  }

  private parse(textDocument: TextDocumentIdentifier): Token[] {
    const uri = textDocument.uri;
    let tokens = this.cached.get(uri);
    if (!tokens) {
      const document = this.documents.get(uri);
      if (!document) {
        return [];
      }
      tokens = parse(document.getText());
      this.cached.set(uri, tokens);
    }
    return tokens;
  }

  private context({ uri, tokens }: Tokenized, all = true): Tokenized[] {
    if (all) {
      this.documents.all().forEach((document) => {
        const path = document.uri.startsWith("file://")
          ? fileURLToPath(document.uri)
          : "";
        this.cached.set(
          path ? pathToFileURL(path).toString() : document.uri,
          document.uri === uri ? tokens : parse(document.getText()),
        );
      });
      return Array.from(this.cached.entries(), (entry) => ({
        uri: entry[0],
        tokens: entry[1],
      }));
    }
    return this.documents.all().map((document) => ({
      uri: document.uri,
      tokens: document.uri === uri ? tokens : parse(document.getText()),
    }));
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

function expressionToRange(tokens: Token[], expression: number) {
  const exprs = tokens.filter(
    (token) =>
      token.exprs === expression &&
      token.tokenType !== EndOfLine &&
      token.tokenType !== SemiColon &&
      token.tokenType !== WhiteSpace,
  );
  const first = exprs[0];
  if (!first) {
    return null;
  }
  const last = exprs[exprs.length - 1];
  const start = rangeFromToken(first);
  const end = last ? rangeFromToken(last) : start;

  return Range.create(start.start, end.end);
}

function createSymbol(token: Token, tokens: Token[]): DocumentSymbol {
  const range = rangeFromToken(token);
  return DocumentSymbol.create(
    lambda(token)
      ? testblock(token)
        ? token.image.trim()
        : " "
      : inLambda(token) && !amended(token)
        ? token.image
        : identifier(token),
    (amended(token) && "Amend") || undefined,
    lambda(token)
      ? SymbolKind.Object
      : inParam(token)
        ? SymbolKind.Array
        : SymbolKind.Variable,
    range,
    range,
    tokens
      .filter(
        (child) =>
          inLambda(child) === token &&
          ((assigned(child) && assignable(child)) || lambda(child)),
      )
      .map((child) => createSymbol(child, tokens)),
  );
}

function createDebugSymbol(token: Token): DocumentSymbol {
  const range = rangeFromToken(token);
  return DocumentSymbol.create(
    tokenId(token),
    `${token.tokenType.name} ${token.namespace ? `(${token.namespace})` : ""} ${
      token.error !== undefined ? `E=${token.error}` : ""
    } ${
      token.exprs ? `X=${token.exprs}` : ""
    } ${token.order ? `O=${token.order}` : ""} ${
      token.tangled ? `T=${tokenId(token.tangled)}` : ""
    } ${token.scope ? `S=${tokenId(token.scope)}` : ""} ${
      token.assignment
        ? `A=${token.assignment.map((token) => tokenId(token)).join(" ")}`
        : ""
    }`,
    SymbolKind.Variable,
    range,
    range,
  );
}
