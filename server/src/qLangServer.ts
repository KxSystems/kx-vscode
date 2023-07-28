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
  DocumentHighlightKind,
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
import { AnalyzerContent, GlobalSettings, Keyword } from "./utils/analyzer";

export default class QLangServer {
  public connection: Connection;
  public documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );
  public defaultSettings: GlobalSettings = { maxNumberOfProblems: 1000 };
  public globalSettings: GlobalSettings = this.defaultSettings;
  public documentSettings: Map<string, Thenable<GlobalSettings>> = new Map();
  public analyzer: AnalyzerContent;
  // private callHierarchy: CallHierarchyHandler;

  private constructor(connection: Connection, analyzer: AnalyzerContent) {
    this.connection = connection;
    this.analyzer = analyzer;
    this.documents.listen(this.connection);
    this.documents.onDidClose((e) => {
      this.documentSettings.delete(e.document.uri);
    });
    this.documents.onDidChangeContent((change) => {
      this.validateTextDocument(change.document);
    });
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
    const rootUri = workspaceFolders ? workspaceFolders[0].uri : "";
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
      hoverProvider: true,
      // Whether the server supports providing document highlights for a symbol.
      documentHighlightProvider: true,
      // Whether the server supports providing definitions for a symbol.
      definitionProvider: true,
      // Whether the server supports providing symbols for a document.
      documentSymbolProvider: true,
      // Whether the server supports finding references to a symbol.
      referencesProvider: true, //done
      // Whether the server supports renaming a symbol.
      renameProvider: { prepareProvider: true }, //done
      // Whether the server supports providing semantic tokens for a document.
      semanticTokensProvider: {
        documentSelector: null,
        legend: {
          tokenTypes: ["variable", "parameter", "type", "class"],
          tokenModifiers: [],
        },
        full: true,
      },
      // Whether the server supports providing call hierarchy information for a symbol.
      callHierarchyProvider: true,
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
    return [
      DocumentHighlight.create(
        {
          start: { line: position.line + 1, character: position.character },
          end: { line: position.line + 1, character: position.character + 5 },
        },
        DocumentHighlightKind.Write
      ),
    ];
  }

  private onDefinition(params: TextDocumentPositionParams): Location[] {
    let keyword = this.getKeyword(params);
    if (!keyword) {
      return [];
    }

    // If the keyword starts with a dot followed by a space, remove the dot from the keyword text.
    if (keyword.startsWith(". ")) {
      keyword = keyword.substring(2);
    }
    // Otherwise, if the keyword starts with a dot, remove the dot from the keyword text.
    else if (keyword.startsWith(".")) {
      keyword = keyword.substring(1);
    }
    // Return the definition location for the keyword.
    return this.analyzer.getDefinitionByUriKeyword(
      params.textDocument.uri,
      keyword
    );
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
    const keyword = this.getKeyword(params);
    const document = this.documents.get(params.textDocument.uri);
    if (!keyword || !document) {
      return [];
    }

    return this.analyzer.getReferences(keyword, document) ?? [];
  }

  private onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null | undefined {
    // Create a new TextDocumentPositionParams object with the textDocument and position properties.
    const params: TextDocumentPositionParams = { textDocument, position };
    // Get the keyword at the given position in the document.
    const keyword = this.getKeyword(params);
    const document = this.documents.get(params.textDocument.uri);
    // If there is no keyword, return null.
    if (!keyword || !document) {
      return null;
    }
    // Find all references to the symbol in the document and create a workspace edit to rename them.
    const locations = this.analyzer.getReferences(keyword, document);
    const changes = locations.reduce((acc, location) => {
      const uri = location.uri;
      const range = location.range;
      const textEdit = TextEdit.replace(range, newName);
      if (!acc[uri]) {
        acc[uri] = [textEdit];
      } else {
        acc[uri].push(textEdit);
      }
      return acc;
    }, {} as { [uri: string]: TextEdit[] });
    // If there are changes, return a workspace edit with the changes.
    if (Object.keys(changes).length > 0) {
      return { changes };
    }
    // Otherwise, return null.
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
    const settings = await this.getDocumentSettings(textDocument.uri);
    const text = textDocument.getText();
    const pattern = /\b[A-Z]{2,}\b/g;
    let m: RegExpExecArray | null;

    let problems = 0;
    const diagnostics: Diagnostic[] = [];
    while (
      (m = pattern.exec(text)) &&
      problems < settings.maxNumberOfProblems
    ) {
      problems++;
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(m.index),
          end: textDocument.positionAt(m.index + m[0].length),
        },
        message: `${m[0]} is all uppercase.`,
        source: "ex",
      };
      diagnostic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: "Spelling matters",
        },
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: "Particularly for names",
        },
      ];

      diagnostics.push(diagnostic);
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
