import Fuse from "fuse.js";
import fs from "graceful-fs";
import klaw from "klaw";
import picomatch from "picomatch";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import {
  CallHierarchyItem,
  CompletionItem,
  CompletionItemKind,
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  DocumentUri,
  Location,
  ParameterInformation,
  Range,
  SemanticTokens,
  SemanticTokensBuilder,
  SignatureHelp,
  SignatureInformation,
  SymbolInformation,
  SymbolKind,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import Parser from "web-tree-sitter";
import { qLangParser, qLangSampleParser } from "./parserUtils";
import * as TreeSitterUtil from "./treeSitterUtil";

type nameToGlobalId = Map<string, string[]>;
type nameToSymbolInformation = Map<string, SymbolInformation[]>;
type nameToCallHierarchyItem = Map<string, CallHierarchyItem[]>;
export type Keyword = {
  containerName: string;
  text: string;
  type: string;
  range: Range;
};

export default class AnalyzerUtil {
  static matchFile: (test: string) => boolean;
  private uriToTextDocument = new Map<string, TextDocument>();
  private uriToGlobalId = new Map<string, nameToGlobalId>();
  private uriToDefinition = new Map<DocumentUri, nameToSymbolInformation>();
  private uriToCallHierarchy = new Map<string, nameToCallHierarchyItem>();
  private uriToSemanticTokens = new Map<DocumentUri, SemanticTokensBuilder>();
  private uriToSymbol = new Map<DocumentUri, string[]>();
  private serverIds: CompletionItem[] = [];
  private nameToSignatureHelp = new Map<string, SignatureHelp>();
  private fuseInstance: Fuse<SymbolInformation> | null = null;
  private serverSymbols: string[] = [];
  private uriToTree = new Map<DocumentUri, Parser.Tree>();
  private uriToFileContent = new Map<DocumentUri, string>();
  private rootPath: string | undefined | null;
  private parser: Parser;
  private connection: Connection;
  private workspaceFolder: URI;
  private reservedWord: string[];
  private qLangSampleParserSrc: string;
  private uriToLoadFile = new Map<DocumentUri, string[]>();

  public static async fromRoot(
    connection: Connection,
    workspaceFolder: string,
    parser: Parser
  ): Promise<AnalyzerUtil> {
    return new AnalyzerUtil(parser, connection, workspaceFolder);
  }
  public constructor(
    parser: Parser,
    connection: Connection,
    workspaceFolder: string
  ) {
    this.parser = parser;
    this.connection = connection;
    this.workspaceFolder = URI.parse(workspaceFolder);
    this.rootPath = this.workspaceFolder.fsPath;
    this.reservedWord = qLangParser.map((item) => item.label);
    this.qLangSampleParserSrc = qLangSampleParser;
  }

  // Public Getters
  public getAllSymbols(): SymbolInformation[] {
    return Array.from(this.uriToDefinition.values())
      .flatMap((nameToSymInfo) => Array.from(nameToSymInfo.values()))
      .flat();
  }

  public getAllVariableSymbols(): SymbolInformation[] {
    return this.getAllSymbols().filter(
      (symbol) => symbol.kind === SymbolKind.Variable
    );
  }

  public getCallHierarchyItemByUriKeyword(
    uri: DocumentUri,
    keyword: string
  ): CallHierarchyItem[] {
    return this.uriToCallHierarchy.get(uri)?.get(keyword) ?? [];
  }

  public getCallHierarchyItemByKeyword(keyword: string): CallHierarchyItem[] {
    const items: CallHierarchyItem[] = [];
    for (const callHierarchyMap of this.uriToCallHierarchy.values()) {
      for (const item of callHierarchyMap.get(keyword) ?? []) {
        items.push(item);
      }
    }
    return items;
  }

  public getCallNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const call = TreeSitterUtil.findParentNotInTypes(
      node,
      [
        "table",
        "exit_statement",
        "function_exit_expression",
        "ctrl_statement",
        "function_ctrl_expression",
        "formal_parameters",
      ],
      (parser) => parser.type === "call"
    );
    return call;
  }

  public getDefinitionByUriKeyword(uri: string, keyword: Keyword): Location[] {
    const symbols: SymbolInformation[] = [];

    if (keyword.type === "local_identifier") {
      symbols.push(
        ...(this.uriToDefinition
          .get(uri)
          ?.get(keyword.text)
          ?.filter((sym) => sym.containerName === keyword.containerName) || [])
      );
    }

    if (symbols.length === 0) {
      this.uriToDefinition.forEach((nameToSymInfo) => {
        symbols.push(...(nameToSymInfo.get(keyword.text) || []));
      });
    }
    return symbols.map((s) => s.location);
  }

  public getGlobalIdByUriContainerName(
    uri: DocumentUri,
    containerName: string
  ): string[] {
    return this.uriToGlobalId.get(uri)?.get(containerName) ?? [];
  }

  public getLocalIds(
    uri: DocumentUri,
    containerName: string
  ): SymbolInformation[] {
    const ids: SymbolInformation[] = [];
    ids.push(
      ...this.getAllSymbols().filter(
        (s) => !s.containerName && !s.name.startsWith(".")
      )
    );
    if (containerName !== "") {
      this.uriToDefinition.get(uri)?.forEach((symInfos) =>
        symInfos.forEach((s) => {
          if (s.containerName === containerName) ids.push(s);
        })
      );
    }

    return ids;
  }

  public getLv1Node(node: Parser.SyntaxNode): Parser.SyntaxNode {
    return TreeSitterUtil.findParentInRoot(node);
  }

  public getKeywordAtPosition(uri: string, position: Position): Keyword | null {
    const document = this.uriToTree.get(uri);
    if (!document?.rootNode) {
      return null;
    }
    const node = document.rootNode.descendantForPosition({
      row: position.line,
      column: position.character,
    });
    if (!node || node.childCount > 0 || node.text.trim() === "") {
      return null;
    }
    return {
      type: node.type,
      text: node.text.trim(),
      range: TreeSitterUtil.range(node),
      containerName: this.getContainerName(node),
    };
  }

  public getNodeAtPosition(
    uri: DocumentUri,
    position: Position
  ): Parser.SyntaxNode | null {
    const document = this.uriToTree.get(uri);
    if (!document?.rootNode) {
      return null;
    }
    return document.rootNode.descendantForPosition({
      row: position.line,
      column: position.character,
    });
  }

  public getNonNullNodeAtPosition(
    uri: DocumentUri,
    position: Position
  ): Parser.SyntaxNode | null {
    const node = this.getNodeAtPosition(uri, position);
    if (!node || node.childCount > 0 || node.text.trim() === "") {
      return null;
    }
    return node;
  }

  public getSemanticTokens(uri: DocumentUri): SemanticTokens {
    return this.uriToSemanticTokens.get(uri)?.build() ?? { data: [] };
  }

  public getServerIds(): CompletionItem[] {
    return this.serverIds;
  }

  public getSignatureHelp(query: string): SignatureHelp | undefined {
    return this.nameToSignatureHelp.get(query);
  }

  public getSymbolsByUri(uri: DocumentUri): SymbolInformation[] {
    const nameToSymInfos = this.uriToDefinition.get(uri)?.values();
    return nameToSymInfos ? Array.from(nameToSymInfos).flat() : [];
  }

  public getSymbolsForUri(uri: DocumentUri): string[] {
    const srcSymbols = this.uriToSymbol.get(uri) ?? [];
    return [...this.serverSymbols, ...srcSymbols];
  }

  public getSyntaxNodesByUriKeyword(
    uri: DocumentUri,
    keyword: Keyword
  ): Parser.SyntaxNode[] {
    const tree = this.uriToTree.get(uri);
    const content = this.uriToFileContent.get(uri);
    const synNodes: Parser.SyntaxNode[] = [];
    if (tree && content) {
      TreeSitterUtil.forEach(tree.rootNode, (node) => {
        if (
          TreeSitterUtil.isReference(node) &&
          (node.text.trim() === keyword.text ||
            node.text.trim().substring(1) === keyword.text)
        ) {
          synNodes.push(node);
        }
      });
    }

    if (keyword.type === "global_identifier" || keyword.containerName === "") {
      return synNodes;
    } else {
      return synNodes.filter(
        (syn) => this.getContainerName(syn) === keyword.containerName
      );
    }
  }

  public getSyntaxNodeLocationsByUriKeyword(
    uri: DocumentUri,
    keyword: Keyword
  ): Location[] {
    const syntaxNodes = this.getSyntaxNodesByUriKeyword(uri, keyword);
    return syntaxNodes.map((syntaxNode) =>
      Location.create(uri, TreeSitterUtil.range(syntaxNode))
    );
  }

  public getSyntaxNodeByType(
    uri: DocumentUri,
    type: string
  ): Parser.SyntaxNode[] {
    const tree = this.uriToTree.get(uri);
    const synNodes: Parser.SyntaxNode[] = [];
    if (tree) {
      TreeSitterUtil.forEach(tree.rootNode, (node) => {
        if (node.type === type) {
          synNodes.push(node);
        }
      });
    }
    return synNodes;
  }

  //finders / searchers
  public search(query: string): SymbolInformation[] {
    const fuse = this.getFuseInstance();
    const searchResults = fuse.search(query);
    return searchResults.map((result) => result.item);
  }

  public findReferences(keyword: Keyword, uri: DocumentUri): Location[] {
    let locations: Location[] = [];
    if (keyword.type === "global_identifier" || keyword.containerName === "") {
      this.uriToTree.forEach((_, u) =>
        locations.push(...this.getSyntaxNodeLocationsByUriKeyword(u, keyword))
      );
    } else {
      locations = this.getSyntaxNodeLocationsByUriKeyword(uri, keyword);
    }
    return locations;
  }

  public findOccurrences(uri: string, query: string): Location[] {
    const tree = this.uriToTree.get(uri);
    const content = this.uriToFileContent.get(uri);
    const locations: Location[] = [];
    if (tree && content) {
      TreeSitterUtil.forEach(tree.rootNode, (node) => {
        if (TreeSitterUtil.isReference(node) && node.text.trim() === query) {
          locations.push(Location.create(uri, TreeSitterUtil.range(node)));
        }
      });
    }
    return locations;
  }

  public findSymbolDefinitions(uri: string): SymbolInformation[] {
    const definitions: SymbolInformation[] = [];
    const nameToSymbolInformation = this.uriToDefinition.get(uri)?.values();
    if (nameToSymbolInformation) {
      for (const symbolInformation of nameToSymbolInformation) {
        definitions.push(...symbolInformation);
      }
    }
    return definitions;
  }

  public findSymbolsMatchingKeyword(
    exactMatch: boolean,
    keyword: string
  ): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];
    this.uriToDefinition.forEach((nameToSymInfo) => {
      nameToSymInfo.forEach((symbol, name) => {
        const match = exactMatch ? name === keyword : name.startsWith(keyword);
        if (match) {
          symbols.push(...symbol);
        }
      });
    });
    return symbols;
  }

  //other funcs
  public pushSymbolInformation(
    name: string,
    uri: string,
    node: Parser.SyntaxNode,
    containerName: string,
    kind: SymbolKind
  ): void {
    let def = this.uriToDefinition.get(uri)?.get(name);
    const symInfo = SymbolInformation.create(
      name,
      kind,
      TreeSitterUtil.range(node),
      uri,
      containerName
    );
    if (def) {
      def.push(symInfo);
    } else {
      def = [symInfo];
      this.uriToDefinition.get(uri)?.set(name, def);
    }
  }

  public remove(uri: string): void {
    this.uriToDefinition.delete(uri);
    this.uriToFileContent.delete(uri);
    this.uriToTextDocument.delete(uri);
    this.uriToTree.delete(uri);
  }

  // analyze

  public analyzeWorkspace(cfg: {
    globsPattern: string[];
    ignorePattern: string[];
  }): void {
    if (this.rootPath && fs.existsSync(this.rootPath)) {
      this.uriToTextDocument = new Map<string, TextDocument>();
      this.uriToTree = new Map<DocumentUri, Parser.Tree>();
      this.uriToFileContent = new Map<DocumentUri, string>();
      this.uriToDefinition = new Map<DocumentUri, nameToSymbolInformation>();
      this.uriToSymbol = new Map<DocumentUri, string[]>();
      this.nameToSignatureHelp = new Map<string, SignatureHelp>();

      const globsPattern = cfg.globsPattern ?? ["**/src/**/*.q"];
      const ignorePattern = cfg.ignorePattern ?? ["**/tmp"];

      const lookupStartTime = Date.now();
      const getTimePassed = (): string =>
        `${(Date.now() - lookupStartTime) / 1000} seconds`;

      const ignoreMatch = picomatch(ignorePattern);
      const includeMatch = picomatch(globsPattern);
      AnalyzerUtil.matchFile = (test) =>
        !ignoreMatch(test) && includeMatch(test);
      const qSrcFiles: string[] = [];
      klaw(this.rootPath, { filter: (item) => !ignoreMatch(item) })
        .on("error", (err: Error) => {
          this.connection.console.warn(err.message);
        })
        .on("data", (item) => {
          if (includeMatch(item.path)) qSrcFiles.push(item.path);
        })
        .on("end", () => {
          if (qSrcFiles.length == 0) {
            this.connection.console.warn(
              `Failed to find any source files using the glob "${globsPattern}". Some feature will not be available.`
            );
          } else {
            this.connection.console.info(
              `Glob found ${qSrcFiles.length} files after ${getTimePassed()}`
            );

            qSrcFiles.forEach((filepath: string) => this.analyzeFile(filepath));
            this.uriToLoadFile.forEach((_, uri) => this.analyzeLoadFiles(uri));

            this.connection.console.info(`Analyzing took ${getTimePassed()}`);
          }
        });
      this.analyzeServerCache("");
    }
  }

  public analyzeLoadFiles(uri: DocumentUri): void {
    this.uriToLoadFile.get(uri)?.forEach((f) => {
      if (!this.uriToTree.get(URI.file(f).toString())) this.analyzeFile(f);
    });
  }

  public analyzeFile(filepath: string): void {
    const uri = URI.file(filepath).toString();
    try {
      const fileContent = fs.readFileSync(filepath, "utf8");
      this.connection.console.info(`Analyzing ${uri}`);
      this.analyzeDocument(uri, TextDocument.create(uri, "q", 1, fileContent));
    } catch (error) {
      const { message } = error as Error;
      this.connection.console.warn(`Failed analyzing ${uri}.`);
      this.connection.console.warn(`Error: ${message}`);
    }
  }

  public analyzeDocument(
    uri: DocumentUri,
    document: TextDocument
  ): Diagnostic[] {
    const content = document.getText();
    const tree = this.parser.parse(content);
    this.uriToTextDocument.set(uri, document);
    this.uriToTree.set(uri, tree);
    this.uriToDefinition.set(uri, new Map<string, SymbolInformation[]>());
    this.uriToFileContent.set(uri, content);
    this.uriToSymbol.set(uri, []);
    this.uriToSemanticTokens.set(uri, new SemanticTokensBuilder());
    const callHierarchyMap = new Map<string, CallHierarchyItem[]>();
    this.uriToCallHierarchy.set(uri, callHierarchyMap);
    const globalIdMap = new Map<string, string[]>();
    this.uriToGlobalId.set(uri, globalIdMap);
    this.uriToLoadFile.set(uri, []);
    const problems: Diagnostic[] = [];
    let namespace = "";
    const tokens: number[][] = [];
    TreeSitterUtil.forEach(tree.rootNode, (node: Parser.SyntaxNode) => {
      if (node.type === "ERROR") {
        problems.push(
          Diagnostic.create(
            TreeSitterUtil.range(node),
            "Failed to parse expression",
            DiagnosticSeverity.Error
          )
        );
      } else if (TreeSitterUtil.isDefinition(node)) {
        const named = node.firstChild;
        if (named === null) {
          return;
        }
        const containerName = this.getContainerName(node) ?? "";
        const name =
          namespace === "" || named.type === "global_identifier"
            ? named.text.trim()
            : `${namespace}.${named.text.trim()}`;
        let symbolKind = SymbolKind.Variable as SymbolKind;
        const defNode = node.children[2]?.firstChild;
        if (defNode?.type === "function_body") {
          symbolKind = SymbolKind.Function;
        }
        if (
          containerName !== "" &&
          namespace === "" &&
          named.type === "local_identifier"
        ) {
          this.pushSymbolInformation(
            name,
            uri,
            node,
            containerName,
            symbolKind
          );
          return;
        }
        if (
          defNode?.type === "function_body" &&
          defNode?.firstNamedChild?.type === "formal_parameters"
        ) {
          symbolKind = SymbolKind.Function;
          const paramNodes = defNode.firstNamedChild.namedChildren;
          const params = TreeSitterUtil.extractParams(defNode).map((param) =>
            ParameterInformation.create(param)
          );
          if (params.length > 0) {
            const sigInfo = SignatureInformation.create(
              `${name}[${params
                .map((parameterInformation) => parameterInformation.label)
                .join(";")}]`,
              undefined,
              ...params
            );
            this.nameToSignatureHelp.set(name, {
              signatures: [sigInfo],
              activeParameter: 0,
              activeSignature: 0,
            });
            paramNodes.forEach((node) => {
              this.pushSymbolInformation(
                node.text,
                uri,
                node,
                name,
                SymbolKind.Variable
              );
            });
          }
        } else if (defNode?.type === "call" && defNode.firstNamedChild) {
          let params: ParameterInformation[] = [];
          if (defNode.firstNamedChild.type === "function_body") {
            const paramNodes =
              defNode.firstNamedChild.firstNamedChild?.namedChildren;
            params = TreeSitterUtil.extractParams(defNode.firstNamedChild).map(
              (param) => ParameterInformation.create(param)
            );
            if (params.length > 0 && paramNodes) {
              paramNodes.forEach((node) => {
                this.pushSymbolInformation(
                  node.text,
                  uri,
                  node,
                  this.getContainerName(node),
                  SymbolKind.Variable
                );
              });
            }
          } else if (TreeSitterUtil.isReference(defNode.firstNamedChild)) {
            params =
              this.getSignatureHelp(defNode.firstNamedChild.text)?.signatures[0]
                .parameters ?? [];
          }
          const projections = defNode.namedChildren.map(
            (node) => node.type !== "null_statement"
          );
          projections.shift();
          params = params.filter((_, i) => !projections[i]);
          if (params.length > 0) {
            symbolKind = SymbolKind.Function;
            const sigInfo = SignatureInformation.create(
              `${name}[${params
                .map((parameterInformation) => parameterInformation.label)
                .join(";")}]`,
              undefined,
              ...params
            );
            this.nameToSignatureHelp.set(name, {
              signatures: [sigInfo],
              activeParameter: 0,
              activeSignature: 0,
            });
          }
        }
        this.pushSymbolInformation(name, uri, node, containerName, symbolKind);
      } else if (TreeSitterUtil.isSeparator(node)) {
        if (node.text[0] !== ";") {
          problems.push(
            Diagnostic.create(
              TreeSitterUtil.range(node),
              "Missing a semicolon",
              DiagnosticSeverity.Hint
            )
          );
        }
      } else if (TreeSitterUtil.isNamespace(node)) {
        namespace = node.firstChild?.text ?? "";
      } else if (TreeSitterUtil.isNamespaceEnd(node)) {
        namespace = "";
      } else if (TreeSitterUtil.isSymbol(node)) {
        this.uriToSymbol.get(uri)?.push(node.text.trim());
      } else if (TreeSitterUtil.isFunctionBody(node)) {
        const params = TreeSitterUtil.hasParams(node)
          ? TreeSitterUtil.extractParams(node).filter(
              (param) => !this.reservedWord.includes(param)
            )
          : ["x", "y", "z"];
        TreeSitterUtil.forEachAndSkip(node, "function_body", (node) => {
          if (params.length > 0 && node.type === "local_identifier") {
            const param = node.text.trim();
            if (params.includes(param)) {
              const token = TreeSitterUtil.token(node);
              token.push(1, 0);
              tokens.push(token);
            }
          } else if (node.type === "global_identifier") {
            const name = node.text.trim();
            const callHierarchy = callHierarchyMap.get(name) ?? [];
            const containerName = this.getContainerName(node);
            const globalId = globalIdMap.get(containerName) ?? [];
            callHierarchy.push({
              kind: SymbolKind.Function,
              name: containerName,
              range: TreeSitterUtil.range(node),
              selectionRange: TreeSitterUtil.range(node),
              uri: uri,
              data: name,
            });
            callHierarchyMap.set(name, callHierarchy);
            globalId.push(name);
            globalIdMap.set(containerName, globalId);
          }
        });
      } else if (TreeSitterUtil.isLoadingFile(node)) {
        const matches = node.text.match(/(\/[^/ ]*)+\.q/);
        if (matches) {
          this.uriToLoadFile.get(uri)?.push(matches[0]);
        }
      }
    });
    const semanticTokensBuilder =
      this.uriToSemanticTokens.get(uri) ?? new SemanticTokensBuilder();
    tokens
      .sort((t1, t2) => (t1[0] == t2[0] ? t1[1] - t2[1] : t1[0] - t2[0]))
      .forEach((token) =>
        semanticTokensBuilder.push(
          token[0],
          token[1],
          token[2],
          token[3],
          token[4]
        )
      );

    problems.push(...this.findMissingNodes(tree.rootNode));
    return problems;
  }

  public analyzeServerCache(content: string): void {
    const source = this.qLangSampleParserSrc + content;
    const tree = this.parser.parse(source);
    this.serverIds = [];
    this.serverSymbols = [];
    TreeSitterUtil.forEach(tree.rootNode, (n: Parser.SyntaxNode) => {
      if (TreeSitterUtil.isDefinition(n)) {
        const named = n.firstChild;
        if (!named) {
          return;
        }
        const name = named.text.trim();
        const defNode = n.children[2]?.firstChild;
        let completionItemKind: CompletionItemKind =
          CompletionItemKind.Variable;
        if (
          defNode?.type === "function_body" &&
          defNode?.firstNamedChild?.type === "formal_parameters"
        ) {
          completionItemKind = CompletionItemKind.Function;
          const params = TreeSitterUtil.extractParams(defNode).map((param) =>
            ParameterInformation.create(param)
          );
          if (params.length > 0) {
            const sigInfo = SignatureInformation.create(
              `${name}[${params.map((p) => p.label).join(";")}]`,
              undefined,
              ...params
            );
            this.nameToSignatureHelp.set(name, {
              signatures: [sigInfo],
              activeParameter: 0,
              activeSignature: 0,
            });
          }
        } else if (defNode?.type === "call" && defNode.firstNamedChild) {
          let params: ParameterInformation[] = [];
          if (defNode.firstNamedChild.type === "function_body") {
            params = TreeSitterUtil.extractParams(defNode.firstNamedChild).map(
              (param) => ParameterInformation.create(param)
            );
          } else if (TreeSitterUtil.isReference(defNode.firstNamedChild)) {
            params =
              this.getSignatureHelp(defNode.firstNamedChild.text)?.signatures[0]
                .parameters ?? [];
          }
          const projections = defNode.namedChildren.map(
            (n) => n.type !== "null_statement"
          );
          projections.shift();
          params = params.filter((_, i) => !projections[i]);
          if (params.length > 0) {
            completionItemKind = CompletionItemKind.Function;
            const sigInfo = SignatureInformation.create(
              `${name}[${params.map((p) => p.label).join(";")}]`,
              undefined,
              ...params
            );
            this.nameToSignatureHelp.set(name, {
              signatures: [sigInfo],
              activeParameter: 0,
              activeSignature: 0,
            });
          }
        }
        this.serverIds.push({ label: name, kind: completionItemKind });
      } else if (TreeSitterUtil.isSymbol(n)) {
        if (this.getContainerName(n) === "") {
          this.serverSymbols.push(n.text.trim());
        }
      }
    });
  }

  // Private Getters
  private getContainerName(node: Parser.SyntaxNode): string {
    const body = TreeSitterUtil.findParent(
      node,
      (node) => node.type === "function_body"
    );
    if (body?.parent?.type === "expression_statement") {
      if (body?.parent?.parent?.type === "assignment") {
        const assignment = body.parent.parent;
        if (
          assignment?.namedChild(1)?.firstNamedChild?.type === "function_body"
        ) {
          const functionNamed = assignment.firstNamedChild;
          return functionNamed?.text.trim() ?? "";
        }
      } else {
        return `LAMBDA-${body.parent.startPosition.row}-${body.parent.startPosition.column}`;
      }
    } else if (body?.parent?.type === "call") {
      return `LAMBDA-${body.parent.startPosition.row}-${body.parent.startPosition.column}`;
    }
    return "";
  }

  private getFuseInstance(): Fuse<SymbolInformation> {
    if (!this.fuseInstance) {
      const symbols = this.getAllSymbols();
      this.fuseInstance = new Fuse(symbols, { keys: ["name"] });
    }
    return this.fuseInstance;
  }

  private findMissingNodes(node: Parser.SyntaxNode) {
    const problems: Diagnostic[] = [];
    if (node.isMissing()) {
      problems.push(
        Diagnostic.create(
          TreeSitterUtil.range(node),
          `Syntax error: expected "${node.type}" somewhere in the file`,
          DiagnosticSeverity.Warning
        )
      );
    } else if (node.hasError()) {
      node.children.forEach(this.findMissingNodes);
    }
    return problems;
  }
}
