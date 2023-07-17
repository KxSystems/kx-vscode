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
import Parser, { Tree } from "web-tree-sitter";
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
  public getAllSymbolsFlattened(): SymbolInformation[] {
    return Array.from(this.uriToDefinition.values())
      .flatMap((nameToSymInfo) => Array.from(nameToSymInfo.values()))
      .flat();
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

  public getNodeCallParser(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeCall = TreeSitterUtil.findParentNotInTypes(
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
    return nodeCall;
  }

  public getDefinitionByUriKeyword(uri: string, keyword: Keyword): Location[] {
    const symbols: SymbolInformation[] = [];

    if (keyword.type === "local_identifier") {
      symbols.push(
        ...(this.uriToDefinition
          .get(uri)
          ?.get(keyword.text)
          ?.filter(
            (symbol) => symbol.containerName === keyword.containerName
          ) || [])
      );
    }

    if (symbols.length === 0) {
      this.uriToDefinition.forEach((nameToSymInfo) => {
        symbols.push(...(nameToSymInfo.get(keyword.text) || []));
      });
    }
    return symbols.map((s) => s.location);
  }

  public getErrors(uri: DocumentUri): Diagnostic[] {
    const tree = this.uriToTree.get(uri);
    const content = this.uriToFileContent.get(uri);
    const problems: Diagnostic[] = [];
    if (tree && content) {
      TreeSitterUtil.forEach(tree.rootNode, (node) => {
        if (node.type === "ERROR") {
          problems.push(
            Diagnostic.create(
              TreeSitterUtil.range(node),
              "Failed to parse expression",
              DiagnosticSeverity.Error
            )
          );
        }
      });
    }
    return problems;
  }

  public getGlobalIdByUriContainerName(
    uri: DocumentUri,
    containerName: string
  ): string[] {
    const containerMap = this.uriToGlobalId.get(uri);
    return containerMap?.get(containerName) ?? [];
  }

  public getLocalIds(
    uri: DocumentUri,
    containerName: string
  ): SymbolInformation[] {
    const ids: SymbolInformation[] = [];
    ids.push(
      ...this.getAllSymbolsFlattened().filter(
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

  public getKeywordAtPosition(uri: string, position: Position): Keyword | null {
    const { rootNode } = this.uriToTree.get(uri) || {};
    const node = rootNode?.descendantForPosition({
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
    const { rootNode } = this.uriToTree.get(uri) || {};
    return (
      rootNode?.descendantForPosition({
        row: position.line,
        column: position.character,
      }) || null
    );
  }

  public getNonNullNodeAtPosition(
    uri: DocumentUri,
    position: Position
  ): Parser.SyntaxNode | null {
    const node = this.getNodeAtPosition(uri, position);
    return node?.childCount === 0 && node.text.trim() !== "" ? node : null;
  }

  public getRootNode(node: Parser.SyntaxNode): Parser.SyntaxNode {
    return TreeSitterUtil.findParentInRoot(node);
  }

  public getSemanticTokens(uri: DocumentUri): SemanticTokens {
    const semanticTokensBuilder: SemanticTokensBuilder | undefined =
      this.uriToSemanticTokens.get(uri);
    return semanticTokensBuilder?.build() ?? { data: [] };
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
    const { uriToSymbol, serverSymbols } = this;
    const srcSymbols: string[] = uriToSymbol.get(uri) ?? [];
    return [...serverSymbols, ...srcSymbols];
  }

  public getSyntaxNodesByUriKeyword(
    uri: DocumentUri,
    keyword: Keyword
  ): Parser.SyntaxNode[] {
    const { uriToTree, uriToFileContent } = this;
    const tree: Tree | undefined = uriToTree.get(uri);
    const content: string | undefined = uriToFileContent.get(uri);
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
        (syn: Parser.SyntaxNode) =>
          this.getContainerName(syn) === keyword.containerName
      );
    }
  }

  public getSyntaxNodeLocationsByUriKeyword(
    uri: DocumentUri,
    keyword: Keyword
  ): Location[] {
    const { getSyntaxNodesByUriKeyword } = this;
    const syntaxNodes: Parser.SyntaxNode[] = getSyntaxNodesByUriKeyword(
      uri,
      keyword
    );
    return syntaxNodes.map((syntaxNode: Parser.SyntaxNode) =>
      Location.create(uri, TreeSitterUtil.range(syntaxNode))
    );
  }

  //finders
  public find(query: string): SymbolInformation[] {
    const { getFuseInstance } = this;
    const fuse: Fuse<SymbolInformation> = getFuseInstance();
    const searchResults: Fuse.FuseResult<SymbolInformation>[] =
      fuse.search(query);
    return searchResults.map(
      ({ item }: Fuse.FuseResult<SymbolInformation>) => item
    );
  }

  public findReferences(keyword: Keyword, uri: DocumentUri): Location[] {
    const { uriToTree, getSyntaxNodeLocationsByUriKeyword } = this;
    let locations: Location[] = [];
    if (keyword.type === "global_identifier" || keyword.containerName === "") {
      uriToTree.forEach((_, u: DocumentUri) =>
        locations.push(...getSyntaxNodeLocationsByUriKeyword(u, keyword))
      );
    } else {
      locations = getSyntaxNodeLocationsByUriKeyword(uri, keyword);
    }
    return locations;
  }

  //other funcs
  public pushSymbolInformation(
    name: string,
    uri: DocumentUri,
    node: Parser.SyntaxNode,
    containerName: string,
    kind: SymbolKind
  ): void {
    const { uriToDefinition } = this;
    let def = uriToDefinition.get(uri)?.get(name);
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
      uriToDefinition.get(uri)?.set(name, def);
    }
  }

  public remove(uri: DocumentUri): void {
    const { uriToDefinition, uriToFileContent, uriToTextDocument, uriToTree } =
      this;
    uriToDefinition.delete(uri);
    uriToFileContent.delete(uri);
    uriToTextDocument.delete(uri);
    uriToTree.delete(uri);
  }

  // analyze

  public analyzeSourceCode({
    globsPattern = ["**/src/**/*.q"],
    ignorePattern = ["**/tmp"],
  }: { globsPattern?: string[]; ignorePattern?: string[] } = {}): void {
    if (this.rootPath && fs.existsSync(this.rootPath)) {
      this.uriToTextDocument = new Map<DocumentUri, TextDocument>();
      this.uriToTree = new Map<DocumentUri, Parser.Tree>();
      this.uriToFileContent = new Map<DocumentUri, string>();
      this.uriToDefinition = new Map<DocumentUri, nameToSymbolInformation>();
      this.uriToSymbol = new Map<DocumentUri, string[]>();
      this.nameToSignatureHelp = new Map<string, SignatureHelp>();

      this.writeConsoleMsg(`Checking into the opened Source Code`, "info");

      const ignoreMatch = picomatch(ignorePattern);
      const includeMatch = picomatch(globsPattern);
      AnalyzerUtil.matchFile = (test: string) =>
        !ignoreMatch(test) && includeMatch(test);
      const qFiles: string[] = [];
      klaw(this.rootPath, { filter: (item) => !ignoreMatch(item) })
        .on("error", (err: Error) => {
          this.writeConsoleMsg(
            `Error when we tried to analyze the Source Code`,
            "error"
          );
          this.writeConsoleMsg(err.message, "error");
        })
        .on("data", (item) => {
          if (includeMatch(item.path)) qFiles.push(item.path);
        })
        .on("end", () => {
          if (qFiles.length == 0) {
            this.writeConsoleMsg("No q files found", "warn");
          } else {
            this.writeConsoleMsg(`${qFiles.length} q files founded.`, "info");
            qFiles.forEach((filepath: string) => this.analyzeFile(filepath));
            this.uriToLoadFile?.forEach((_, uri) => this.analyzeLoadFiles(uri));
          }
        });
      this.analyzeServerCache("");
    }
  }

  public analyzeLoadFiles(uri: DocumentUri): void {
    const { uriToLoadFile, uriToTree } = this;
    const filesToLoad = uriToLoadFile.get(uri);
    if (filesToLoad) {
      filesToLoad.forEach((f: string) => {
        const fileUri = URI.file(f).toString();
        if (!uriToTree.get(fileUri)) {
          this.analyzeFile(f);
        }
      });
    }
  }

  public analyzeFile(filepath: string): void {
    const uri: DocumentUri = URI.file(filepath).toString();
    try {
      const fileContent: string = fs.readFileSync(filepath, "utf8");
      this.writeConsoleMsg(`Analyzing file: ${uri}`, "info");
      this.analyzeDocument(uri, TextDocument.create(uri, "q", 1, fileContent));
    } catch (error: unknown) {
      const { message } = error as Error;
      this.writeConsoleMsg(
        `There is an error when we tried to analyzing ${uri}.`,
        "error"
      );
      this.writeConsoleMsg(`Error message: ${message}`, "error");
    }
  }

  public analyzeDocument(
    uri: DocumentUri,
    document: TextDocument
  ): Diagnostic[] {
    const {
      uriToTextDocument,
      uriToTree,
      uriToDefinition,
      uriToFileContent,
      uriToSymbol,
      uriToSemanticTokens,
      uriToCallHierarchy,
      uriToGlobalId,
      uriToLoadFile,
    } = this;
    const content = document.getText();
    const tree = this.parser.parse(content);
    uriToTextDocument.set(uri, document);
    uriToTree.set(uri, tree);
    uriToDefinition.set(uri, new Map<string, SymbolInformation[]>());
    uriToFileContent.set(uri, content);
    uriToSymbol.set(uri, []);
    uriToSemanticTokens.set(uri, new SemanticTokensBuilder());
    const callHierarchyMap = new Map<string, CallHierarchyItem[]>();
    uriToCallHierarchy.set(uri, callHierarchyMap);
    const globalIdMap = new Map<string, string[]>();
    uriToGlobalId.set(uri, globalIdMap);
    uriToLoadFile.set(uri, []);
    const problems: Diagnostic[] = [];
    let namespace = "";
    const tokens: number[][] = [];
    TreeSitterUtil.forEach(tree.rootNode, (node: Parser.SyntaxNode) => {
      if (node.type === "ERROR") {
        problems.push(
          Diagnostic.create(
            TreeSitterUtil.range(node),
            "Failed to parse an expression",
            DiagnosticSeverity.Error
          )
        );
      } else if (TreeSitterUtil.isDefinition(node)) {
        this.analyzeNodeDefinition(node, uri, namespace);
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
        uriToSymbol.get(uri)?.push(node.text.trim());
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
          uriToLoadFile.get(uri)?.push(matches[0]);
        }
      }
    });
    const semanticTokensBuilder =
      uriToSemanticTokens.get(uri) ?? new SemanticTokensBuilder();
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

    function searchMissingNodes(node: Parser.SyntaxNode) {
      if (node.isMissing()) {
        problems.push(
          Diagnostic.create(
            TreeSitterUtil.range(node),
            `Syntax error: expected "${node.type}" somewhere in the file`,
            DiagnosticSeverity.Warning
          )
        );
      } else if (node.hasError()) {
        node.children.forEach(searchMissingNodes);
      }
    }
    searchMissingNodes(tree.rootNode);
    return problems;
  }

  public analyzeServerCache(content: string): void {
    const source = this.qLangSampleParserSrc + content;
    const tree = this.parser.parse(source);
    this.serverIds = [];
    this.serverSymbols = [];
    TreeSitterUtil.forEach(tree.rootNode, (node: Parser.SyntaxNode) => {
      if (!TreeSitterUtil.isDefinition(node)) {
        return;
      }
      const namedNode = node.firstChild;
      if (!namedNode) {
        return;
      }
      const name = namedNode.text.trim();
      const defNode = node.children[2]?.firstChild;
      const detail = `${name}:${defNode?.text?.trim() ?? ""}`;
      let completionItemKind: CompletionItemKind = CompletionItemKind.Variable;
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
      this.serverIds.push({
        label: name,
        kind: completionItemKind,
        detail: detail,
      });
    });
    this.serverSymbols = TreeSitterUtil.getSymbols(tree.rootNode)
      .filter((symbol) => this.getContainerName(symbol) === "")
      .map((symbol) => symbol.text.trim());
  }

  // misc functions
  public debugWithLogs(request: string, msg: string, place?: string | null) {
    const where = place ? place : " not specified ";
    this.writeConsoleMsg(`${request} msg=${msg} where?: ${where}`, "warn");
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

  // Private
  private getContainerName(node: Parser.SyntaxNode): string {
    const functionBody = TreeSitterUtil.findParent(
      node,
      (node) => node.type === "function_body"
    );
    if (functionBody?.parent?.type === "expression_statement") {
      const assignmentStatement = functionBody.parent.parent;
      if (
        assignmentStatement?.namedChild(1)?.firstNamedChild?.type ===
        "function_body"
      ) {
        const functionNamed = assignmentStatement.firstNamedChild;
        return functionNamed?.text.trim() || "";
      } else {
        return `LAMBDA-${functionBody.parent.startPosition.row}-${functionBody.parent.startPosition.column}`;
      }
    } else if (functionBody?.parent?.type === "call") {
      return `LAMBDA-${functionBody.parent.startPosition.row}-${functionBody.parent.startPosition.column}`;
    }
    return "";
  }

  private getFuseInstance(): Fuse<SymbolInformation> {
    // If a `Fuse` instance has already been created, return the existing instance.
    if (this.fuseInstance) {
      return this.fuseInstance;
    }

    // Otherwise, create a new `Fuse` instance for the list of flattened symbols.
    const flattenedSymbols = this.getAllSymbolsFlattened();
    this.fuseInstance = new Fuse(flattenedSymbols, { keys: ["name"] });
    return this.fuseInstance;
  }

  private analyzeNodeDefinition(
    node: Parser.SyntaxNode,
    uri: DocumentUri,
    namespace: string
  ): void {
    const named: Parser.SyntaxNode | null = node.firstChild;
    if (named === null) {
      return;
    }
    const containerName: string = this.getContainerName(node) ?? "";
    const { text, type } = named;
    const name: string =
      namespace === "" || type === "global_identifier"
        ? text.trim()
        : `${namespace}.${text.trim()}`;
    let symbolKind: SymbolKind = SymbolKind.Variable;
    const defNode: Parser.SyntaxNode | null | undefined =
      node.children[2]?.firstChild;
    if (defNode?.type === "function_body") {
      symbolKind = SymbolKind.Function;
    }
    if (
      containerName !== "" &&
      namespace === "" &&
      type === "local_identifier"
    ) {
      this.pushSymbolInformation(name, uri, node, containerName, symbolKind);
      return;
    }
    if (
      defNode?.type === "function_body" &&
      defNode?.firstNamedChild?.type === "formal_parameters"
    ) {
      symbolKind = SymbolKind.Function;
      const paramNodes: Parser.SyntaxNode[] =
        defNode.firstNamedChild.namedChildren;
      const params: ParameterInformation[] = TreeSitterUtil.extractParams(
        defNode
      ).map((param: string) => ParameterInformation.create(param));
      if (params.length > 0) {
        const sigInfo: SignatureInformation = SignatureInformation.create(
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
        const paramNodes: Parser.SyntaxNode[] | undefined =
          defNode.firstNamedChild.firstNamedChild?.namedChildren;
        params = TreeSitterUtil.extractParams(defNode.firstNamedChild).map(
          (param: string) => ParameterInformation.create(param)
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
      const projections: boolean[] = defNode.namedChildren.map(
        (node: Parser.SyntaxNode) => node.type !== "null_statement"
      );
      projections.shift();
      params = params.filter((_, i) => !projections[i]);
      if (params.length > 0) {
        symbolKind = SymbolKind.Function;
        const sigInfo: SignatureInformation = SignatureInformation.create(
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
  }
}
