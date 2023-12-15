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
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  CompletionItem,
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  DocumentHighlight,
  DocumentSymbolParams,
  Hover,
  InitializeParams,
  Location,
  Position,
  Range,
  ReferenceParams,
  RenameParams,
  SemanticTokens,
  SemanticTokensParams,
  ServerCapabilities,
  SignatureHelp,
  SignatureHelpParams,
  SymbolInformation,
  SymbolKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { lint } from "./linter";
import { RuleSeverity } from "./linter/rules";
import { TokenType, IdentifierPattern, scope, analyze } from "./parser";
import { KeywordPattern } from "./parser/keywords";
import { QParser } from "./parser/parser";
import { AnalyzerContent, GlobalSettings, Keyword } from "./utils/analyzer";
import { IToken } from "chevrotain";

export default class QLangServer {
  public connection: Connection;
  public documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );
  public defaultSettings: GlobalSettings = { maxNumberOfProblems: 1000 };
  public globalSettings: GlobalSettings = this.defaultSettings;
  public documentSettings: Map<string, Thenable<GlobalSettings>> = new Map();
  public analyzer: AnalyzerContent;

  private constructor(connection: Connection, analyzer: AnalyzerContent) {
    this.connection = connection;
    this.analyzer = analyzer;
    this.documents.listen(this.connection);
    this.documents.onDidSave(() => {
      this.analyzer.analyzeWorkspace();
    });
    this.documents.onDidClose((e) => {
      this.connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
      this.documentSettings.delete(e.document.uri);
    });
    this.documents.onDidChangeContent(async (change) => {
      await this.validateTextDocument(change.document);
    });
    this.connection.onNotification("analyzeSourceCode", (config) =>
      this.analyzer.analyzeWorkspace(config)
    );
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onDocumentHighlight(this.onDocumentHighlight.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    // Semantic Tokens
    this.connection.languages.semanticTokens.on(
      this.onSemanticsTokens.bind(this)
    );
    // Call Hierarchy
    this.connection.languages.callHierarchy.onPrepare(
      this.onPrepareCallHierarchy.bind(this)
    );
    this.connection.languages.callHierarchy.onIncomingCalls(
      this.onIncomingCallsCallHierarchy.bind(this)
    );
    this.connection.languages.callHierarchy.onOutgoingCalls(
      this.onOutgoingCallsCallHierarchy.bind(this)
    );
  }

  public static async initialize(
    connection: Connection,
    { workspaceFolders }: InitializeParams
  ): Promise<QLangServer> {
    // Get the URI of the root folder, if it exists.
    const rootUri =
      workspaceFolders && workspaceFolders.length > 0
        ? workspaceFolders[0].uri
        : "";
    const analyzer = await AnalyzerContent.fromRoot(connection, rootUri);
    const server = new QLangServer(connection, analyzer);
    // Write a console message to indicate that the server is being initialized.
    server.writeConsoleMsg(
      "Initializing QLang Language Server for QLang VSCode extension",
      "info"
    );

    return server;
  }

  public capabilities(): ServerCapabilities {
    return {
      // The kind of text document synchronization that the server supports.
      textDocumentSync: TextDocumentSyncKind.Full,
      // Whether the server supports resolving additional information for a completion item.
      completionProvider: { resolveProvider: true },
      // Whether the server supports providing hover information for a symbol.
      // hoverProvider: true,
      // Whether the server supports providing document highlights for a symbol.
      // documentHighlightProvider: true,
      // Whether the server supports providing definitions for a symbol.
      definitionProvider: true,
      // Whether the server supports providing symbols for a document.
      // documentSymbolProvider: true,
      // Whether the server supports finding references to a symbol.
      referencesProvider: true,
      // Whether the server supports renaming a symbol.
      renameProvider: true,
      // renameProvider: { prepareProvider: true },
      // Whether the server supports providing semantic tokens for a document.
      /*
      semanticTokensProvider: {
        documentSelector: null,
        legend: {
          tokenTypes: ["variable", "parameter", "type", "class"],
          tokenModifiers: [],
        },
        full: true,
      },
      */
      // Whether the server supports providing call hierarchy information for a symbol - disabled for the moment.
      callHierarchyProvider: false,
    };
  }

  public debugWithLogs(
    request: string,
    msg: string,
    place?: string | null,
    keyword?: Keyword | null
  ) {
    const where = place ? place : " not specified ";
    const isKeyword = keyword ? `keyword=${JSON.stringify(keyword)}` : "";
    this.writeConsoleMsg(
      `${request} ${isKeyword} msg=${msg} where?: ${where}`,
      "warn"
    );
  }

  public writeConsoleMsg(msg: string, type: string): void {
    switch (type) {
      case "error":
        this.connection.console.error(msg);
        break;
      case "warn":
        this.connection.console.warn(msg);
        break;
      case "info":
      default:
        this.connection.console.info(msg);
        break;
    }
  }

  private onCompletion(params: TextDocumentPositionParams): CompletionItem[] {
    const keyword = this.getKeyword(params);
    if (!keyword) {
      return [];
    }
    return this.analyzer.getCompletionItems(keyword);
  }

  private async onCompletionResolve(
    item: CompletionItem
  ): Promise<CompletionItem> {
    return item;
  }

  private async onHover(
    params: TextDocumentPositionParams
  ): Promise<Hover | null> {
    const keyword = this.getEntireKeyword(params);
    if (!keyword) {
      return null;
    }
    return this.analyzer.getHoverInfo(keyword);
  }

  // TODO: Document highlight
  private onDocumentHighlight(
    params: TextDocumentPositionParams
  ): DocumentHighlight[] | null {
    const position = params.position;
    return [];
  }

  private onDefinition(params: TextDocumentPositionParams): Location[] {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const position = params.position;
    const wordRange = this.analyzer.getWordRangeAtPosition(document, position);
    if (!wordRange) {
      return [];
    }

    const keyword = document.getText(wordRange) + ":";

    const definitions = this.analyzer.getDefinitions(keyword);
    if (!definitions) {
      return [];
    }

    return definitions.map((definition) => {
      return Location.create(
        definition.uri,
        Range.create(
          Position.create(
            definition.range.start.line,
            definition.range.start.character
          ),
          Position.create(
            definition.range.end.line,
            definition.range.end.character
          )
        )
      );
    });
  }

  private onDocumentSymbol(params: DocumentSymbolParams): SymbolInformation[] {
    const document = this.documents.get(params.textDocument.uri);
    if (document) {
      return this.analyzer.getSymbols(document);
    }
    return [];
  }

  public onPrepareCallHierarchy({
    textDocument,
    position,
  }: CallHierarchyPrepareParams): CallHierarchyItem[] {
    const document = this.documents.get(textDocument.uri);
    if (!document) {
      return [];
    }
    const range = this.getCurrentWordRange(position, document);
    if (!range) {
      return [];
    }
    const keyword = document.getText(range);
    const symbolInformation = this.analyzer
      .getSymbolsByUri(textDocument.uri)
      .filter((symbol) => symbol.name === keyword);
    if (
      symbolInformation.length > 0 &&
      symbolInformation[0].kind === SymbolKind.Function
    ) {
      return [
        {
          name: keyword,
          kind: SymbolKind.Function,
          uri: textDocument.uri,
          range: range,
          selectionRange: range,
        },
      ];
    }
    return [];
  }

  public onIncomingCallsCallHierarchy({
    item,
  }: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] {
    const containerName = item.name;
    if (!containerName) {
      return [];
    }
    const items = this.analyzer.getCallHierarchyItemByKeyword(containerName);
    return items.map((item) => ({ from: item, fromRanges: [item.range] }));
  }

  public onOutgoingCallsCallHierarchy({
    item,
  }: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] {
    const globalId = this.analyzer.getGlobalIdByUriContainerName(
      item.uri,
      item.name
    );
    return globalId
      .map((keyword: string) =>
        this.analyzer.getCallHierarchyItemByKeyword(keyword)
      )
      .flat(1)
      .map((el) => ({ to: el, fromRanges: [el.range] }));
  }

  private onReferences(params: ReferenceParams): Location[] | null {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const position = params.position;
    const wordRange = this.analyzer.getWordRangeAtPosition(document, position);
    if (!wordRange) {
      return [];
    }

    const word = document.getText(wordRange);
    this.writeConsoleMsg(`onReferences: word=${word}`, "info");
    return this.analyzer.getReferences(word, document);
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
        offset <= entity.endOffset
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
        symbolScope === scope(entity)
    );
    if (local) {
      const exists = assign.find(
        (entity) => entity.image === newName && symbolScope === scope(entity)
      );
      if (exists) {
        return null;
      }
      targets = script.filter(
        (entity) =>
          symbol.image === entity.image &&
          symbolScope &&
          symbolScope === scope(entity) &&
          entity.type === TokenType.IDENTIFIER
      );
    } else {
      const global = assign.find(
        (entity) => !scope(entity) && symbol.image === entity.image
      );
      if (!global) {
        return null;
      }
      const exists = assign.find(
        (entity) => !scope(entity) && entity.image === newName
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
            ident.image === entity.image && scoped && scope(ident) === scoped
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

  private onSignatureHelp({
    textDocument,
    position,
  }: SignatureHelpParams): SignatureHelp | undefined {
    const params: TextDocumentPositionParams = { textDocument, position };
    return undefined;
  }

  private getDocumentSettings(resource: string): Thenable<GlobalSettings> {
    let result = this.documentSettings.get(resource);
    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: resource,
        section: "qLanguageServer",
      });
      this.documentSettings.set(resource, result);
    }
    return result;
  }

  private onSemanticsTokens({
    textDocument,
  }: SemanticTokensParams): SemanticTokens {
    // Get the semantic tokens for the given document.
    const tokens = this.analyzer.getSemanticTokens(textDocument?.uri);
    // If there are tokens, return them.
    return tokens ?? { data: [] };
  }

  private async validateTextDocument(
    textDocument: TextDocument
  ): Promise<void> {
    if (!textDocument.uri.toString().endsWith(".q")) {
      return;
    }
    const text = textDocument.getText();
    const cst = QParser.parse(text);
    const diagnostics: Diagnostic[] = [];
    let problems = QParser.errors.length;
    if (problems > 99) {
      problems = 99;
    }
    for (let i = 0; i < problems; i++) {
      const error = QParser.errors[i];
      let offset = -1;
      if ("previousToken" in error) {
        const token = error.previousToken as IToken;
        offset = token.startOffset || -1;
      }
      if (offset < 0) {
        offset = error.token.startOffset || 0;
      }
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(offset),
          end: textDocument.positionAt(offset),
        },
        message: (error.message || error.name).replace(/\s+/g, " "),
        source: "kdb.QParser",
      };
      diagnostics.push(diagnostic);
    }
    if (problems === 0) {
      const ast = analyze(cst);
      const results = lint(ast);
      for (const result of results) {
        const severity =
          result.severity === RuleSeverity.ERROR
            ? DiagnosticSeverity.Error
            : result.severity === RuleSeverity.WARNING
            ? DiagnosticSeverity.Warning
            : result.severity === RuleSeverity.INFO
            ? DiagnosticSeverity.Information
            : DiagnosticSeverity.Hint;
        for (const problem of result.problems) {
          const diagnostic: Diagnostic = {
            severity,
            range: {
              start: textDocument.positionAt(problem.startOffset),
              end: textDocument.positionAt(problem.endOffset),
            },
            message: result.message,
            source: "kdb.QLinter",
          };
          diagnostics.push(diagnostic);
        }
      }
    }
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  }

  private getKeyword(params: TextDocumentPositionParams): string | undefined {
    const document = this.documents.get(params.textDocument.uri);
    if (document) {
      return this.analyzer.getCurrentWord(params, document);
    } else return undefined;
  }

  private getEntireKeyword(
    params: TextDocumentPositionParams
  ): string | undefined {
    const document = this.documents.get(params.textDocument.uri);
    if (document) {
      return this.analyzer.getCurrentEntireWord(params, document);
    } else return undefined;
  }

  private getCurrentWordRange(
    position: Position,
    document: TextDocument
  ): Range | undefined {
    const text = document.getText();
    const wordRegex = /[\w]+(?:[^\w\s\.][\w]+)*/g;
    let match;
    while ((match = wordRegex.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      const range = Range.create(
        document.positionAt(start),
        document.positionAt(end)
      );
      if (range) {
        return range;
      }
    }
    return undefined;
  }
}
