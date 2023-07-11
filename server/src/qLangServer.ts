import fs from "fs";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  CompletionItem,
  CompletionItemKind,
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeWatchedFilesParams,
  DocumentHighlight,
  DocumentSymbolParams,
  FileChangeType,
  Hover,
  InitializeParams,
  Location,
  PrepareRenameParams,
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
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit,
  WorkspaceEdit,
  WorkspaceSymbolParams,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import AnalyzerUtil, { Keyword } from "./utils/analyzerUtil";
import CallHierarchyHandler from "./utils/handlersUtils";
import { initializeParser, qLangParser } from "./utils/parserUtils";

export default class QLangServer {
  public connection: Connection;
  public documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );
  public qLangParserRef: CompletionItem[] = [];
  public hoverMap = new Map<string, string>();
  private AnalyzerUtil: AnalyzerUtil;
  private callHierarchy: CallHierarchyHandler;

  private constructor(connection: Connection, AnalyzerUtil: AnalyzerUtil) {
    this.connection = connection;
    this.AnalyzerUtil = AnalyzerUtil;
    this.qLangParserRef = qLangParser;
    this.documents.listen(this.connection);
    // on actions
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onWorkspaceSymbol(this.onWorkspaceSymbol.bind(this));
    this.connection.onDidChangeWatchedFiles(
      this.onDidChangeWatchedFiles.bind(this)
    );
    this.connection.onDocumentHighlight(this.onDocumentHighlight.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    this.connection.onPrepareRename(this.onPrepareRename.bind(this));
    this.connection.onRenameRequest(this.onRenameRequest.bind(this));
    this.connection.onSignatureHelp(this.onSignatureHelp.bind(this));
    // analyzer
    this.connection.onNotification("analyzeServerCache", (code) =>
      this.AnalyzerUtil.analyzeServerCache(code)
    );
    this.connection.onNotification("analyzeSourceCode", (cfg) =>
      this.AnalyzerUtil.analyzeWorkspace(cfg)
    );
    this.connection.onNotification("prepareOnHover", (hoverItems) =>
      this.prepareOnHover(hoverItems)
    );
    this.connection.onRequest("onQueryBlock", (params) =>
      this.onQueryBlock(params)
    );
    // Call Hierarchy
    this.callHierarchy = new CallHierarchyHandler(AnalyzerUtil);
    this.connection.languages.callHierarchy.onPrepare(
      this.onPrepareCallHierarchy.bind(this)
    );
    this.connection.languages.callHierarchy.onIncomingCalls(
      this.onIncomingCallsCallHierarchy.bind(this)
    );
    this.connection.languages.callHierarchy.onOutgoingCalls(
      this.onOutgoingCallsCallHierarchy.bind(this)
    );
    // Semantic Tokens
    this.connection.languages.semanticTokens.on(
      this.onSemanticsTokens.bind(this)
    );
  }

  public static async initialize(
    connection: Connection,
    { workspaceFolders }: InitializeParams
  ): Promise<QLangServer> {
    const workspaceFolder = workspaceFolders ? workspaceFolders[0].uri : "";
    const parser = await initializeParser();
    return AnalyzerUtil.fromRoot(connection, workspaceFolder, parser).then(
      (analyzer) => {
        const server = new QLangServer(connection, analyzer);
        server.writeConsoleMsg(
          "Initializing kdb Language Server for kdb vscode extension",
          "info"
        );
        return server;
      }
    );
  }

  // Capabilities following https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        resolveProvider: true,
      },
      hoverProvider: true,
      documentHighlightProvider: true,
      definitionProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      referencesProvider: true,
      renameProvider: {
        prepareProvider: true,
      },
      signatureHelpProvider: {
        triggerCharacters: ["[", ";"],
      },
      semanticTokensProvider: {
        documentSelector: null,
        legend: {
          tokenTypes: ["variable", "parameter", "type", "class"],
          tokenModifiers: [],
        },
        full: true,
      },
      callHierarchyProvider: true,
    };
  }

  // Getters
  private getKeywordAtPosition(
    params: ReferenceParams | TextDocumentPositionParams
  ): Keyword | null {
    return this.AnalyzerUtil.getKeywordAtPosition(
      params.textDocument.uri,
      params.position
    );
  }

  private getSignatureHelpAtPosition(
    params: ReferenceParams | TextDocumentPositionParams
  ): SignatureHelp | undefined {
    const node = this.AnalyzerUtil.getNonNullNodeAtPosition(
      params.textDocument.uri,
      params.position
    );
    if (node) {
      const callNode = this.AnalyzerUtil.getCallNode(node);
      const signatureHelp = this.AnalyzerUtil.getSignatureHelp(
        callNode?.firstNamedChild?.text ?? ""
      );
      if (callNode && signatureHelp) {
        let index = -1;
        for (const child of callNode.namedChildren) {
          if (node.startIndex > child.endIndex) index += 1;
        }
        signatureHelp.activeParameter = index;
        return signatureHelp;
      }
    }
    return undefined;
  }

  // on actions funcs
  private onCompletion(params: TextDocumentPositionParams): CompletionItem[] {
    const keyword = this.getKeywordAtPosition({
      ...params,
      position: {
        line: params.position.line,
        character: Math.max(params.position.character - 1, 0),
      },
    });

    let symbols: string[] = [];
    let localId: CompletionItem[] = [];
    let globalId: CompletionItem[] = [];
    let completionItem: CompletionItem[] = [];

    if (keyword?.text.startsWith(".")) {
      completionItem = this.qLangParserRef.filter((item) =>
        String(item.label).startsWith(".")
      );
      globalId = this.AnalyzerUtil.getServerIds()
        .filter((item) => String(item.label).startsWith("."))
        .concat(
          this.AnalyzerUtil.getAllSymbols()
            .filter((symbol) => String(symbol.name).startsWith("."))
            .map((symbol) => {
              return {
                label: symbol.name,
                kind:
                  symbol.kind === SymbolKind.Function
                    ? CompletionItemKind.Method
                    : CompletionItemKind.Variable,
                detail: symbol.containerName,
              };
            })
        );
      const flags = new Map<string, boolean>();
      completionItem.forEach((item) => flags.set(item.label, true));
      globalId.forEach((item) => {
        if (!flags.get(item.label)) {
          completionItem.push(item);
          flags.set(item.label, true);
        }
      });
    } else if (keyword?.text.startsWith("`")) {
      symbols = this.AnalyzerUtil.getSymbolsForUri(params.textDocument.uri);
      new Set(symbols).forEach((symbol) => {
        completionItem.push({ label: symbol, kind: CompletionItemKind.Enum });
      });
    } else {
      completionItem = this.qLangParserRef.filter((item) =>
        String(item.label).startsWith(keyword?.text ? keyword.text : "")
      );
      localId = this.AnalyzerUtil.getServerIds()
        .filter((id) => !id.label.startsWith("."))
        .concat(
          this.AnalyzerUtil.getLocalIds(
            params.textDocument.uri,
            keyword?.containerName ?? ""
          ).map((symbol) => {
            return {
              label: symbol.name,
              kind:
                symbol.kind === SymbolKind.Function
                  ? CompletionItemKind.Method
                  : CompletionItemKind.Variable,
            };
          })
        );
      const flags = new Map<string, boolean>();
      completionItem.forEach((item) => {
        flags.set(item.label, true);
      });
      localId.forEach((item) => {
        if (!flags.get(item.label)) {
          completionItem.push(item);
          flags.set(item.label, true);
        }
      });
    }
    completionItem = this.removeDuplicateEntries(completionItem);
    return completionItem;
  }

  private async onCompletionResolve(
    item: CompletionItem
  ): Promise<CompletionItem> {
    if (item.label.startsWith(".")) {
      item.label = item.label.slice(1);
    }
    return item;
  }

  private onDefinition(params: TextDocumentPositionParams): Location[] {
    const keyword = this.getKeywordAtPosition(params);
    if (!keyword) {
      return [];
    } else if (keyword.text.startsWith("`.")) {
      keyword.text = keyword.text.substring(1);
    }
    return this.AnalyzerUtil.getDefinitionByUriKeyword(
      params.textDocument.uri,
      keyword
    );
  }

  private onDidChangeContent(_change: any): void {
    this.AnalyzerUtil.analyzeDocument(_change.document.uri, _change.document);
    this.AnalyzerUtil.analyzeLoadFiles(_change.document.uri);
    const diagnostics = this.generateDiagnostics(_change.document);
    this.connection.sendDiagnostics({ uri: _change.document.uri, diagnostics });
  }

  private onDidChangeWatchedFiles(change: DidChangeWatchedFilesParams): void {
    const changedFiles: string[] = [];
    change.changes.forEach((event) => {
      if (event.type === FileChangeType.Deleted) {
        this.AnalyzerUtil.remove(event.uri);
      } else {
        changedFiles.push(event.uri);
      }
    });
    changedFiles.forEach((file) => {
      const filepath = URI.parse(file).fsPath;
      if (!AnalyzerUtil.matchFile(filepath)) return;
      try {
        this.AnalyzerUtil.analyzeDocument(
          file,
          TextDocument.create(file, "q", 1, fs.readFileSync(filepath, "utf8"))
        );
        this.AnalyzerUtil.analyzeLoadFiles(file);
      } catch (error) {
        this.writeConsoleMsg(`Error trying to analyze ${file}`, "error");
      }
    });
  }

  private onDocumentHighlight(
    params: TextDocumentPositionParams
  ): DocumentHighlight[] | null {
    const keyword = this.getKeywordAtPosition(params);
    if (!keyword) {
      return [];
    }
    return this.AnalyzerUtil.getSyntaxNodeLocationsByUriKeyword(
      params.textDocument.uri,
      keyword
    ).map((syn) => {
      return { range: syn.range };
    });
  }

  private onDocumentSymbol(params: DocumentSymbolParams): SymbolInformation[] {
    return this.AnalyzerUtil.getSymbolsByUri(params.textDocument.uri);
  }

  private async onHover(
    params: TextDocumentPositionParams
  ): Promise<Hover | null> {
    const keyword = this.getKeywordAtPosition(params);
    if (!keyword) {
      return null;
    }
    const ref = this.qLangParserRef.filter(
      (item) => item.label === keyword.text
    )[0];
    if (ref) {
      const content = {
        language: "q",
        value: ("/ " + ref.detail + "\n" + ref.documentation) as string,
      };
      return { contents: content };
    }
    if (this.hoverMap.has(keyword.text)) {
      const content = {
        language: "q",
        value: this.hoverMap.get(keyword.text) ?? "",
      };
      return { contents: content };
    }
    return null;
  }

  private onPrepareRename(params: PrepareRenameParams): Range | null {
    const keyword = this.getKeywordAtPosition(params);
    if (
      keyword?.type === "local_identifier" ||
      keyword?.type === "global_identifier"
    ) {
      return keyword.range;
    }
    return null;
  }

  private onQueryBlock(params: TextDocumentPositionParams): {
    query: string;
    number: number;
  } {
    const node = this.AnalyzerUtil.getNodeAtPosition(
      params.textDocument.uri,
      params.position
    );
    if (node) {
      const blockNode = this.AnalyzerUtil.getRootNode(node);
      return { query: blockNode.text, number: blockNode.endPosition.row + 1 };
    } else {
      return { query: "", number: 0 };
    }
  }

  private onReferences(params: ReferenceParams): Location[] | null {
    const keyword = this.getKeywordAtPosition(params);
    if (!keyword) {
      return null;
    } else if (keyword.text.startsWith("`.")) {
      keyword.type = "global_identifier";
      keyword.text = keyword.text.substring(1);
    }
    return this.AnalyzerUtil.findReferences(keyword, params.textDocument.uri);
  }

  private onRenameRequest(
    params: RenameParams
  ): WorkspaceEdit | null | undefined {
    const keyword = this.getKeywordAtPosition(params);
    const changes: { [uri: string]: TextEdit[] } = {};
    if (keyword) {
      const locations = this.AnalyzerUtil.findReferences(
        keyword,
        params.textDocument.uri
      );
      locations.forEach((location) => {
        const uri = location.uri;
        const range = location.range;
        const textEdit = TextEdit.replace(range, params.newName);

        if (!changes[uri]) {
          changes[uri] = [textEdit];
        } else {
          changes[uri].push(textEdit);
        }
      });
    }
    if (Object.keys(changes).length > 0) {
      return { changes };
    }
    return null;
  }

  private onSemanticsTokens(params: SemanticTokensParams): SemanticTokens {
    const document = params.textDocument;
    return this.AnalyzerUtil.getSemanticTokens(document.uri);
  }

  private onSignatureHelp(
    params: SignatureHelpParams
  ): SignatureHelp | undefined {
    return this.getSignatureHelpAtPosition(params);
  }

  private onWorkspaceSymbol(
    params: WorkspaceSymbolParams
  ): SymbolInformation[] {
    return this.AnalyzerUtil.search(params.query);
  }

  public onPrepareCallHierarchy(
    params: CallHierarchyPrepareParams
  ): CallHierarchyItem[] {
    return this.callHierarchy.onPrepare(params);
  }

  public onIncomingCallsCallHierarchy(
    params: CallHierarchyIncomingCallsParams
  ): CallHierarchyIncomingCall[] {
    return this.callHierarchy.onIncomingCalls(params);
  }

  public onOutgoingCallsCallHierarchy(
    params: CallHierarchyOutgoingCallsParams
  ): CallHierarchyOutgoingCall[] {
    return this.callHierarchy.onOutgoingCalls(params);
  }

  // misc funcs

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

  private removeDuplicateEntries(
    completionItem: CompletionItem[]
  ): CompletionItem[] {
    completionItem = completionItem.filter(
      (value, index, self) =>
        index === self.findIndex((t) => t.label === value.label)
    );
    return completionItem;
  }

  private prepareOnHover(hoverItems: string[][]): void {
    hoverItems.forEach((item) => {
      this.hoverMap.set(item[0], item[1]);
    });
  }

  private generateDiagnostics(textDocument: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const errors = this.AnalyzerUtil.getErrors(textDocument.uri);
    errors.forEach((error: any) => {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(error.startIndex),
          end: textDocument.positionAt(error.endIndex),
        },
        message: error.message,
      };
      diagnostics.push(diagnostic);
    });
    return diagnostics;
  }
}
