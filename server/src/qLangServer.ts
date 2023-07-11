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
    this.connection.onNotification("analyzeSourceCode", (config) =>
      this.AnalyzerUtil.analyzeSourceCode(config)
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
    // Get the URI of the root folder, if it exists.
    const rootUri = workspaceFolders ? workspaceFolders[0].uri : "";
    // Initialize the parser.
    const parser = await initializeParser();
    // Create a new `QLangServer` instance with the given connection and analyzer.
    const analyzer = await AnalyzerUtil.fromRoot(connection, rootUri, parser);
    const server = new QLangServer(connection, analyzer);
    // Write a console message to indicate that the server is being initialized.
    server.writeConsoleMsg(
      "Initializing QLang Language Server for QLang VSCode extension",
      "info"
    );

    return server;
  }

  // Capabilities following https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/
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
      // Whether the server supports providing symbols for the workspace.
      workspaceSymbolProvider: true,
      // Whether the server supports finding references to a symbol.
      referencesProvider: true,
      // Whether the server supports renaming a symbol.
      renameProvider: { prepareProvider: true },
      // Whether the server supports providing signature help for a symbol.
      signatureHelpProvider: { triggerCharacters: ["[", ";"] },
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

  // Getters
  private getKeywordAtPosition(
    referenceOrPositionParams: ReferenceParams | TextDocumentPositionParams
  ): Keyword | null {
    // Get the URI and position from the `referenceOrPositionParams` object.
    const uri = referenceOrPositionParams.textDocument?.uri;
    const position = referenceOrPositionParams.position;
    // If either `uri` or `position` is `undefined`, return `null`.
    if (!uri || !position) {
      return null;
    }
    // Get the `Keyword` object at the given position in the document.
    return this.AnalyzerUtil.getKeywordAtPosition(uri, position);
  }

  /**
   * Returns the signature help for the symbol at the given position in the document, or `undefined` if no signature help is available.
   */
  private getSignatureHelpAtPosition(
    referenceOrPositionParams: ReferenceParams | TextDocumentPositionParams
  ): SignatureHelp | undefined {
    // Get the symbol node at the given position in the document.
    const symbolNode = this.AnalyzerUtil.getNonNullNodeAtPosition(
      referenceOrPositionParams.textDocument.uri,
      referenceOrPositionParams.position
    );
    // If no symbol node is found, return `undefined`.
    if (!symbolNode) {
      return undefined;
    }
    // Get the call node for the symbol node.
    const callNode = this.AnalyzerUtil.getNodeCallParser(symbolNode);
    // Get the signature help for the call node.
    const signatureHelp = this.AnalyzerUtil.getSignatureHelp(
      callNode?.firstNamedChild?.text ?? ""
    );
    // If both the call node and signature help are available, set the active parameter index and return the signature help.
    if (callNode && signatureHelp) {
      let activeParameterIndex = -1;
      for (const child of callNode.namedChildren) {
        if (symbolNode.startIndex > child.endIndex) {
          activeParameterIndex += 1;
        }
      }
      signatureHelp.activeParameter = activeParameterIndex;
      return signatureHelp;
    }
    // Otherwise, return `undefined`.
    return undefined;
  }

  // on actions funcs
  private onCompletion(params: TextDocumentPositionParams): CompletionItem[] {
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition({
      ...params,
      position: {
        line: params.position.line,
        character: Math.max(params.position.character - 1, 0),
      },
    });
    // Initialize the arrays of completion items.
    const completionItems: CompletionItem[] = [];
    const localIds: CompletionItem[] = [];
    const globalIds: CompletionItem[] = [];
    // If the keyword starts with a dot, add global symbols to the completion items.
    if (keyword?.text.startsWith(".")) {
      completionItems.push(
        ...this.qLangParserRef.filter((item) =>
          String(item.label).startsWith(".")
        )
      );
      globalIds.push(
        ...this.AnalyzerUtil.getServerIds()
          .filter((item) => String(item.label).startsWith("."))
          .flatMap((_item) =>
            this.AnalyzerUtil.getAllSymbolsFlattened()
              .filter((symbol) => String(symbol.name).startsWith("."))
              .map((symbol) => ({
                label: symbol.name,
                kind:
                  symbol.kind === SymbolKind.Function
                    ? CompletionItemKind.Method
                    : CompletionItemKind.Variable,
                detail: symbol.containerName,
              }))
          )
      );
      const flags = new Set<string>(completionItems.map((item) => item.label));
      globalIds.forEach((item) => {
        if (!flags.has(item.label)) {
          completionItems.push(item);
          flags.add(item.label);
        }
      });
    }
    // If the keyword starts with a backtick, add enum symbols to the completion items.
    else if (keyword?.text.startsWith("`")) {
      const symbolNames = this.AnalyzerUtil.getSymbolsForUri(
        params.textDocument.uri
      );
      symbolNames.forEach((symbolName) => {
        completionItems.push({
          label: symbolName,
          kind: CompletionItemKind.Enum,
        });
      });
    }
    // Otherwise, add local and server symbols to the completion items.
    else {
      completionItems.push(
        ...this.qLangParserRef.filter((item) =>
          String(item.label).startsWith(keyword?.text ?? "")
        )
      );
      localIds.push(
        ...this.AnalyzerUtil.getServerIds()
          .filter((id) => !id.label.startsWith("."))
          .flatMap((_id) =>
            this.AnalyzerUtil.getLocalIds(
              params.textDocument.uri,
              keyword?.containerName ?? ""
            ).map((symbol) => ({
              label: symbol.name,
              kind:
                symbol.kind === SymbolKind.Function
                  ? CompletionItemKind.Method
                  : CompletionItemKind.Variable,
            }))
          )
      );
      const flags = new Set<string>(completionItems.map((item) => item.label));
      localIds.forEach((item) => {
        if (!flags.has(item.label)) {
          completionItems.push(item);
          flags.add(item.label);
        }
      });
    }
    // Remove duplicate entries from the completion items and return the result.
    return this.removeDuplicateEntries(completionItems);
  }

  private async onCompletionResolve(
    item: CompletionItem
  ): Promise<CompletionItem> {
    // If the label starts with a dot followed by a space, remove the dot from the label.
    if (item.label.startsWith(". ")) {
      item.label = item.label.substring(2);
    }
    // Otherwise, if the label starts with a dot, remove the dot from the label.
    else if (item.label.startsWith(".")) {
      item.label = item.label.substring(1);
    }
    // Return the resolved completion item.
    return item;
  }

  private onDefinition(params: TextDocumentPositionParams): Location[] {
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition(params);
    // If there is no keyword, return an empty array.
    if (!keyword) {
      return [];
    }
    // If the keyword starts with a dot followed by a space, remove the dot from the keyword text.
    if (keyword.text.startsWith(". ")) {
      keyword.text = keyword.text.substring(2);
    }
    // Otherwise, if the keyword starts with a dot, remove the dot from the keyword text.
    else if (keyword.text.startsWith(".")) {
      keyword.text = keyword.text.substring(1);
    }
    // Return the definition location for the keyword.
    return this.AnalyzerUtil.getDefinitionByUriKeyword(
      params.textDocument.uri,
      keyword
    );
  }

  private onDidChangeContent({ document }: { document?: TextDocument }): void {
    // If there is no document, return.
    if (!document) {
      return;
    }
    // Analyze the document and load files.
    this.AnalyzerUtil.analyzeDocument(document.uri, document);
    this.AnalyzerUtil.analyzeLoadFiles(document.uri);
    // Generate diagnostics and send them to the client.
    const diagnostics = this.generateDiagnostics(document);
    this.connection.sendDiagnostics({ uri: document.uri, diagnostics });
  }

  private onDidChangeWatchedFiles(change: DidChangeWatchedFilesParams): void {
    // Initialize an array of changed files.
    const changedFiles: string[] = [];
    // Iterate over the changes and add the URIs of the changed files to the array.
    change.changes.forEach(({ type, uri }) => {
      if (type === FileChangeType.Deleted) {
        this.AnalyzerUtil.remove(uri);
      } else {
        changedFiles.push(uri);
      }
    });
    // Iterate over the changed files and analyze them.
    changedFiles.forEach((file) => {
      const filepath = URI.parse(file).fsPath;
      // If the file does not match the file pattern, skip it.
      if (!AnalyzerUtil.matchFile(filepath)) {
        return;
      }
      // Analyze the document and load files.
      try {
        const content = fs.readFileSync(filepath, { encoding: "utf8" });
        const document = TextDocument.create(file, "q", 1, content);
        this.AnalyzerUtil.analyzeDocument(file, document);
        this.AnalyzerUtil.analyzeLoadFiles(file);
      } catch (error) {
        this.writeConsoleMsg(`Error trying to analyze ${file}`, "error");
      }
    });
  }

  private onDocumentHighlight({
    textDocument,
    position,
  }: TextDocumentPositionParams): DocumentHighlight[] | null {
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition({ textDocument, position });
    // If there is no keyword, return an empty array.
    if (!keyword) {
      return [];
    }
    // Return the document highlights for the keyword.
    return (
      this.AnalyzerUtil.getSyntaxNodeLocationsByUriKeyword(
        textDocument?.uri,
        keyword
      )?.map(({ range }) => ({ range })) ?? []
    );
  }

  private onDocumentSymbol({
    textDocument,
  }: DocumentSymbolParams): SymbolInformation[] {
    // Return the symbol information for the symbols in the document.
    return this.AnalyzerUtil.getSymbolsByUri(textDocument?.uri) ?? [];
  }

  /**
   * Returns the hover information for the symbol at the given position in the document.
   */
  private async onHover({
    textDocument,
    position,
  }: TextDocumentPositionParams): Promise<Hover | null> {
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition({ textDocument, position });
    // If there is no keyword, return null.
    if (!keyword) {
      return null;
    }
    // If the keyword is a reference to a QLangParser symbol, return the symbol information.
    const ref = this.qLangParserRef.find((item) => item.label === keyword.text);
    if (ref) {
      const content = {
        language: "q",
        value: `/ ${ref.detail}\n${ref.documentation}` ?? "",
      };
      return { contents: content };
    }
    // If the keyword is in the hover map, return the hover information.
    if (this.hoverMap.has(keyword.text)) {
      const content = {
        language: "q",
        value: this.hoverMap.get(keyword.text) ?? "",
      };
      return { contents: content };
    }
    // Otherwise, return null.
    return null;
  }

  private onPrepareRename({
    textDocument,
    position,
  }: PrepareRenameParams): Range | null {
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition({ textDocument, position });
    // If the keyword is a local or global identifier, return its range.
    if (
      keyword?.type === "local_identifier" ||
      keyword?.type === "global_identifier"
    ) {
      return keyword.range ?? null;
    }
    // Otherwise, return null.
    return null;
  }

  private onQueryBlock({
    textDocument,
    position,
  }: TextDocumentPositionParams): { query: string; number: number } {
    // Get the syntax node at the given position in the document.
    const node = this.AnalyzerUtil.getNodeAtPosition(
      textDocument?.uri,
      position
    );
    // If there is a syntax node at the given position, get the root node of its block and return its text and line number.
    if (node) {
      const blockNode = this.AnalyzerUtil.getRootNode(node);
      return {
        query: blockNode.text ?? "",
        number: blockNode.endPosition.row + 1 ?? 0,
      };
    }
    // Otherwise, return an empty query and line number 0.
    return { query: "", number: 0 };
  }

  /**
   * Returns the locations of references to the symbol at the given position in the document.
   */
  private onReferences({
    textDocument,
    position,
  }: ReferenceParams): Location[] | null {
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition({ textDocument, position });
    // If there is no keyword, return null.
    if (!keyword) {
      return null;
    }
    // If the keyword starts with "`.", treat it as a global identifier.
    switch (true) {
      case keyword.text.startsWith("`."):
        keyword.type = "global_identifier";
        keyword.text = keyword.text.substring(1);
        break;
      default:
        break;
    }
    // Return the locations of references to the symbol in the document.
    return this.AnalyzerUtil.findReferences(keyword, textDocument?.uri) ?? [];
  }

  private onRenameRequest({
    textDocument,
    position,
    newName,
  }: RenameParams): WorkspaceEdit | null | undefined {
    // Create a new TextDocumentPositionParams object with the textDocument and position properties.
    const params: TextDocumentPositionParams = { textDocument, position };
    // Get the keyword at the given position in the document.
    const keyword = this.getKeywordAtPosition(params);
    // If there is no keyword, return null.
    if (!keyword) {
      return null;
    }
    // Find all references to the symbol in the document and create a workspace edit to rename them.
    const locations = this.AnalyzerUtil.findReferences(
      keyword,
      textDocument?.uri
    );
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

  private onSemanticsTokens({
    textDocument,
  }: SemanticTokensParams): SemanticTokens {
    // Get the semantic tokens for the given document.
    const tokens = this.AnalyzerUtil.getSemanticTokens(textDocument?.uri);
    // If there are tokens, return them.
    return tokens ?? { data: [] };
  }

  private onSignatureHelp({
    textDocument,
    position,
  }: SignatureHelpParams): SignatureHelp | undefined {
    // Get the signature help for the function at the given position in the document.
    return this.getSignatureHelpAtPosition({ textDocument, position });
  }

  private onWorkspaceSymbol({
    query,
  }: WorkspaceSymbolParams): SymbolInformation[] {
    // Get the symbol information for the symbols that match the given query.
    return this.AnalyzerUtil.find(query) ?? [];
  }

  public onPrepareCallHierarchy({
    textDocument,
    position,
  }: CallHierarchyPrepareParams): CallHierarchyItem[] {
    // Get the call hierarchy items for the given document position.
    return this.callHierarchy.onPrepare({ textDocument, position }) ?? [];
  }

  public onIncomingCallsCallHierarchy({
    item,
  }: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] {
    // Get the incoming call hierarchy items for the given call hierarchy item.
    return this.callHierarchy.onIncomingCalls({ item }) ?? [];
  }

  public onOutgoingCallsCallHierarchy({
    item,
  }: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] {
    // Get the outgoing call hierarchy items for the given call hierarchy item.
    return this.callHierarchy.onOutgoingCalls({ item }) ?? [];
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
    // For each hover item, add it to the hover map.
    hoverItems.forEach((item) => {
      const [key, value] = item;
      if (key && value) {
        this.hoverMap.set(key, value);
      }
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
