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

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
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
  DidChangeWatchedFilesParams,
  DocumentSymbol,
  DocumentSymbolParams,
  InitializeParams,
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

const logger = "qLangServer";

const enum MessageKind {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
}

interface Tokenized {
  uri: string;
  tokens: Token[];
}

export default class QLangServer {
  declare private connection: Connection;
  declare private params: InitializeParams;
  declare private opened: Set<string>;
  declare private cached: Map<string, Token[]>;
  declare public documents: TextDocuments<TextDocument>;

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection;
    this.params = params;
    this.opened = new Set();
    this.cached = new Map();
    this.documents = new TextDocuments(TextDocument);
    this.documents.listen(this.connection);
    this.documents.onDidOpen(this.onDidOpen.bind(this));
    this.documents.onDidClose(this.onDidClose.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
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
    this.connection.onDidChangeWatchedFiles(
      this.onDidChangeWatchedFiles.bind(this),
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
      textDocumentSync: TextDocumentSyncKind.Incremental,
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

  private async getDebug(uri: string): Promise<boolean> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.debug",
    });
    return res ?? false;
  }

  private async getLinting(uri: string): Promise<boolean> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.linting",
    });
    return res ?? false;
  }

  private async getRefactoring(uri: string): Promise<"Workspace" | "Window"> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.refactoring",
    });
    return res ?? "Workspace";
  }

  private async getConnectionMap(
    uri: string,
  ): Promise<{ [key: string]: string }> {
    const res = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "kdb.connectionMap",
    });
    return res ?? {};
  }

  notify(
    message: string,
    kind: MessageKind,
    options: {
      logger?: string;
      params?: any;
    } = {},
    telemetry?: string | boolean,
  ) {
    this.connection.sendNotification("notify", {
      message,
      kind,
      options,
      telemetry,
    });
  }

  public onDidChangeWatchedFiles({ changes }: DidChangeWatchedFilesParams) {
    for (const change of changes) {
      this.cached.delete(change.uri);
    }
  }

  public onDidOpen({ document }: TextDocumentChangeEvent<TextDocument>) {
    this.opened.add(document.uri);
  }

  public async onDidChangeContent({
    document,
  }: TextDocumentChangeEvent<TextDocument>) {
    const uri = document.uri;

    if (this.opened.has(uri)) this.opened.delete(uri);
    else this.cached.delete(uri);

    if (await this.getLinting(uri)) {
      const diagnostics = lint(await this.parse(uri)).map((item) =>
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

  public async onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): Promise<DocumentSymbol[]> {
    const tokens = await this.parse(textDocument.uri);
    if (await this.getDebug(textDocument.uri)) {
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

  public async onReferences({
    textDocument,
    position,
  }: ReferenceParams): Promise<Location[]> {
    const tokens = await this.parse(textDocument.uri);
    const source = positionToToken(tokens, position);
    return (await this.context(textDocument.uri))
      .map((document) =>
        findIdentifiers(FindKind.Reference, document.tokens, source).map(
          (token) => Location.create(document.uri, rangeFromToken(token)),
        ),
      )
      .flat();
  }

  public async onDefinition({
    textDocument,
    position,
  }: DefinitionParams): Promise<Location[]> {
    const tokens = await this.parse(textDocument.uri);
    const source = positionToToken(tokens, position);
    return (await this.context(textDocument.uri))
      .map((document) =>
        findIdentifiers(FindKind.Definition, document.tokens, source).map(
          (token) => Location.create(document.uri, rangeFromToken(token)),
        ),
      )
      .flat();
  }

  public async onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): Promise<WorkspaceEdit> {
    const tokens = await this.parse(textDocument.uri);
    const source = positionToToken(tokens, position);
    return (await this.context(textDocument.uri)).reduce(
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

  public async onCompletion({
    textDocument,
    position,
  }: CompletionParams): Promise<CompletionItem[]> {
    const tokens = await this.parse(textDocument.uri);
    const source = positionToToken(tokens, position);
    return (await this.context(textDocument.uri))
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

  public async onExpressionRange({
    textDocument,
    position,
  }: TextDocumentPositionParams) {
    const tokens = await this.parse(textDocument.uri);
    const source = positionToToken(tokens, position);
    if (!source || !source.exprs) {
      return null;
    }
    return expressionToRange(tokens, source.exprs);
  }

  public async onParameterCache({
    textDocument,
    position,
  }: TextDocumentPositionParams) {
    const tokens = await this.parse(textDocument.uri);
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

  public async onSelectionRanges({
    textDocument,
    positions,
  }: SelectionRangeParams): Promise<SelectionRange[]> {
    const tokens = await this.parse(textDocument.uri);
    const ranges: SelectionRange[] = [];

    for (const position of positions) {
      const source = positionToToken(tokens, position);
      if (source) {
        ranges.push(SelectionRange.create(rangeFromToken(source)));
      }
    }
    return ranges;
  }

  public async onPrepareCallHierarchy({
    textDocument,
    position,
  }: CallHierarchyPrepareParams): Promise<CallHierarchyItem[]> {
    const tokens = await this.parse(textDocument.uri);
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

  public async onIncomingCallsCallHierarchy({
    item,
  }: CallHierarchyIncomingCallsParams): Promise<CallHierarchyIncomingCall[]> {
    const tokens = await this.parse(item.uri);
    const source = positionToToken(tokens, item.range.end);
    return item.data
      ? (await this.context(item.uri))
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

  public async onOutgoingCallsCallHierarchy({
    item,
  }: CallHierarchyOutgoingCallsParams): Promise<CallHierarchyOutgoingCall[]> {
    const tokens = await this.parse(item.uri);
    const source = positionToToken(tokens, item.range.end);
    return item.data
      ? (await this.context(item.uri))
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

  public async onSemanticTokens({
    textDocument,
  }: SemanticTokensParams): Promise<SemanticTokens> {
    const tokens = await this.parse(textDocument.uri);
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

  private async parse(uri: string): Promise<Token[]> {
    let tokens = this.cached.get(uri);
    if (!tokens) {
      const document = this.documents.get(uri);
      let text: string;
      if (document) {
        text = document.getText();
      } else {
        const path = fileURLToPath(uri);
        try {
          text = await readFile(path, { encoding: "utf8" });
        } catch (error) {
          this.notify(`Unable to read '${path}'.`, MessageKind.DEBUG, {
            logger,
            params: `${error}`,
          });
          text = "";
        }
      }
      tokens = text ? parse(text) : [];
      this.cached.set(uri, tokens);
    }
    return tokens;
  }

  private async related(uri: string): Promise<string[]> {
    let res = [uri];
    const folders = await this.connection.workspace.getWorkspaceFolders();

    if (!folders) {
      return res;
    }

    let workspace: string | undefined;

    for (const folder of folders) {
      if (uri.replace(folder.uri, "").startsWith("/")) {
        workspace = folder.uri;
        break;
      }
    }

    if (!workspace) {
      return res;
    }

    const map = await this.getConnectionMap(uri);
    const connections = new Map<string, string[]>();
    let current: string | undefined;

    for (const key of Object.keys(map)) {
      const target = map[key];
      let uris = connections.get(target);

      if (!uris) {
        uris = [];
        connections.set(target, uris);
      }
      uris.push(workspace + "/" + key);

      if (uri.endsWith(key)) current = target;
    }

    if (current) {
      res = connections.get(current) || res;
    }

    return res;
  }

  private async context(uri: string): Promise<Tokenized[]> {
    const res: Tokenized[] = [];
    const refactoring = await this.getRefactoring(uri);
    if (refactoring === "Workspace") {
      for (const item of await this.related(uri)) {
        res.push({ uri: item, tokens: await this.parse(item) });
      }
    } else if (refactoring === "Window") {
      for (const item of this.documents.all()) {
        res.push({ uri: item.uri, tokens: await this.parse(item.uri) });
      }
    }
    return res;
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
