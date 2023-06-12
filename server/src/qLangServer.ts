import fs from "fs";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
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
import { getTypeKeywordAtPosition } from "./utils/qParserUtils";

export default class QLangServer {
  public connection: Connection;
  public documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument
  );
  public qLangParserRef: CompletionItem[] = [];
  public hoverMap = new Map<string, string>();
  private analyzer: AnalyzerUtil;
  private onCallHierarchy: CallHierarchyHandler;

  private constructor(connection: Connection, analyzer: AnalyzerUtil) {
    this.connection = connection;
    this.analyzer = analyzer;
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
      this.analyzer.analyzeServerCache(code)
    );
    this.connection.onNotification("analyzeSourceCode", (cfg) =>
      this.analyzer.analyzeWorkspace(cfg)
    );
    this.connection.onNotification("prepareOnHover", (hoverItems) =>
      this.generateHoverMap(hoverItems)
    );
    this.connection.onRequest("onQueryBlock", (params) =>
      this.onQueryBlock(params)
    );
    // languages
    this.onCallHierarchy = new CallHierarchyHandler(analyzer);
    this.connection.languages.callHierarchy.onPrepare(
      this.teste()
      // this.onCallHierarchy.onPrepare.bind(this)
    );
    this.connection.languages.callHierarchy.onIncomingCalls(
      this.onCallHierarchy.onIncomingCalls.bind(this)
    );
    this.connection.languages.callHierarchy.onOutgoingCalls(
      this.onCallHierarchy.onOutgoingCalls.bind(this)
    );
    this.connection.languages.semanticTokens.on(
      this.onSemanticsTokens.bind(this)
    );
  }

  public teste(): any {
    return (params: PrepareRenameParams) => {
      const doc = this.documents.get(params.textDocument.uri);
      this.connection.console.warn("doc");
      this.connection.console.warn(JSON.stringify(doc));
      if (doc) {
        this.connection.console.warn(
          JSON.stringify(getTypeKeywordAtPosition(doc, params.position))
        );
      }
      return this.onCallHierarchy.onPrepare.bind(this)(params);
    };
  }

  public static async initialize(
    connection: Connection,
    { workspaceFolders }: InitializeParams
  ): Promise<QLangServer> {
    const workspaceFolder = workspaceFolders ? workspaceFolders[0].uri : "";
    const parser = await initializeParser();
    return AnalyzerUtil.fromRoot(connection, workspaceFolder, parser).then(
      (analyzer) => {
        return new QLangServer(connection, analyzer);
      }
    );
  }

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
    return this.analyzer.getKeywordAtPosition(
      params.textDocument.uri,
      params.position
    );
  }

  private getSignatureHelpAtPosition(
    params: ReferenceParams | TextDocumentPositionParams
  ): SignatureHelp | undefined {
    const node = this.analyzer.getNonNullNodeAtPosition(
      params.textDocument.uri,
      params.position
    );
    if (node) {
      const callNode = this.analyzer.getCallNode(node);
      const signatureHelp = this.analyzer.getSignatureHelp(
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
      globalId = this.analyzer
        .getServerIds()
        .filter((item) => String(item.label).startsWith("."))
        .concat(
          this.analyzer
            .getAllSymbols()
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
      symbols = this.analyzer.getSymbolsForUri(params.textDocument.uri);
      new Set(symbols).forEach((symbol) => {
        completionItem.push({ label: symbol, kind: CompletionItemKind.Enum });
      });
    } else {
      completionItem = this.qLangParserRef.filter((item) =>
        String(item.label).startsWith(keyword?.text ? keyword.text : "")
      );
      localId = this.analyzer
        .getServerIds()
        .filter((id) => !id.label.startsWith("."))
        .concat(
          this.analyzer
            .getLocalIds(params.textDocument.uri, keyword?.containerName ?? "")
            .map((symbol) => {
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
    return this.analyzer.getDefinitionByUriKeyword(
      params.textDocument.uri,
      keyword
    );
  }

  private onDidChangeContent(_change: any): void {
    this.analyzer.analyzeDocument(_change.document.uri, _change.document);
    this.analyzer.analyzeLoadFiles(_change.document.uri);
    const diagnostics = this.validateTextDocument(_change.document);
    this.connection.sendDiagnostics({ uri: _change.document.uri, diagnostics });
  }

  private onDidChangeWatchedFiles(change: DidChangeWatchedFilesParams): void {
    const changedFiles: string[] = [];
    change.changes.forEach((event) => {
      if (event.type === FileChangeType.Deleted) {
        this.analyzer.remove(event.uri);
      } else {
        changedFiles.push(event.uri);
      }
    });
    changedFiles.forEach((file) => {
      const filepath = URI.parse(file).fsPath;
      if (!AnalyzerUtil.matchFile(filepath)) return;
      try {
        this.analyzer.analyzeDocument(
          file,
          TextDocument.create(file, "q", 1, fs.readFileSync(filepath, "utf8"))
        );
        this.analyzer.analyzeLoadFiles(file);
      } catch (error) {
        this.connection.console.warn(`Cannot analyze ${file}`);
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
    return this.analyzer
      .getSyntaxNodeLocationsByUriKeyword(params.textDocument.uri, keyword)
      .map((syn) => {
        return { range: syn.range };
      });
  }

  private onDocumentSymbol(params: DocumentSymbolParams): SymbolInformation[] {
    return this.analyzer.getSymbolsByUri(params.textDocument.uri);
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
    const node = this.analyzer.getNodeAtPosition(
      params.textDocument.uri,
      params.position
    );
    if (node) {
      const blockNode = this.analyzer.getLv1Node(node);
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
    return this.analyzer.findReferences(keyword, params.textDocument.uri);
  }

  private onRenameRequest(
    params: RenameParams
  ): WorkspaceEdit | null | undefined {
    const keyword = this.getKeywordAtPosition(params);
    const changes: { [uri: string]: TextEdit[] } = {};
    if (keyword) {
      const locations = this.analyzer.findReferences(
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
    return this.analyzer.getSemanticTokens(document.uri);
  }

  private onSignatureHelp(
    params: SignatureHelpParams
  ): SignatureHelp | undefined {
    return this.getSignatureHelpAtPosition(params);
  }

  private onWorkspaceSymbol(
    params: WorkspaceSymbolParams
  ): SymbolInformation[] {
    return this.analyzer.search(params.query);
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
    this.connection.console.info(
      `${request} ${isKeyword} msg=${msg} where?: ${where}`
    );
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

  private generateHoverMap(hoverItems: string[][]): void {
    this.hoverMap = new Map<string, string>();
    for (const item of hoverItems) {
      this.hoverMap.set(item[0], item[1]);
    }
  }

  private validateTextDocument(textDocument: TextDocument): Diagnostic[] {
    const text = textDocument.getText();
    const pattern = /^[}\])]/gm;
    let m: RegExpExecArray | null;

    const diagnostics: Diagnostic[] = [];
    while ((m = pattern.exec(text)) !== null) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(m.index),
          end: textDocument.positionAt(m.index + m[0].length),
        },
        message: `require a space before ${m[0]}`,
        source: "q-lang-server",
      };
      diagnostic.relatedInformation = [
        {
          location: {
            uri: textDocument.uri,
            range: Object.assign({}, diagnostic.range),
          },
          message: "Multiline expressions",
        },
      ];
      diagnostics.push(diagnostic);
    }
    return diagnostics;
  }
}
