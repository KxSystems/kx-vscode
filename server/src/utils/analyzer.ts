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

import fs from "graceful-fs";
import klaw from "klaw";
import picomatch from "picomatch";
import { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import {
  CallHierarchyItem,
  CompletionItem,
  CompletionItemKind,
  Connection,
  Hover,
  Location,
  Position,
  Range,
  SemanticTokens,
  SemanticTokensBuilder,
  SignatureHelp,
  SymbolInformation,
  SymbolKind,
  TextDocumentPositionParams,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { qLangParserItems } from "./qLangParser";

export type Keyword = {
  containerName: string;
  text: string;
  type: string;
  range: Range;
};

export interface GlobalSettings {
  maxNumberOfProblems: number;
}

interface Definition {
  uri: string;
  range: Range;
}
type nameToGlobalId = Map<string, string[]>;
type nameToSymbolInformation = Map<string, SymbolInformation[]>;
type nameToCallHierarchyItem = Map<string, CallHierarchyItem[]>;

export class AnalyzerContent {
  static matchFile: (test: string) => boolean;
  private uriToTextDocument = new Map<string, TextDocument>();
  private uriToGlobalId = new Map<string, nameToGlobalId>();
  private uriToDefinition = new Map<DocumentUri, nameToSymbolInformation>();
  private uriToCallHierarchy = new Map<string, nameToCallHierarchyItem>();
  private uriToSemanticTokens = new Map<DocumentUri, SemanticTokensBuilder>();
  private uriToSymbol = new Map<DocumentUri, string[]>();
  private nameToSignatureHelp = new Map<string, SignatureHelp>();
  private uriToFileContent = new Map<DocumentUri, string>();
  private uriToLoadFile = new Map<DocumentUri, string[]>();
  private connection: Connection;
  private workspaceFolder?: URI;
  private rootPath: string | undefined | null;
  private reservedWord?: string[];
  private qLangSampleParserSrc?: string;

  public static async fromRoot(
    connection: Connection,
    workspaceFolder: string
  ): Promise<AnalyzerContent> {
    return new AnalyzerContent(connection, workspaceFolder);
  }

  public constructor(connection: Connection, workspaceFolder: string) {
    this.connection = connection;
    this.workspaceFolder = URI.parse(workspaceFolder);
    this.rootPath = this.workspaceFolder.fsPath;
    this.reservedWord = qLangParserItems.map((item) => item.label);
    // this.qLangSampleParserSrc = qLangSampleParser;
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

  public getGlobalIdByUriContainerName(
    uri: DocumentUri,
    containerName: string
  ): string[] {
    const containerMap = this.uriToGlobalId.get(uri);
    return containerMap?.get(containerName) ?? [];
  }

  public async getHoverInfo(keyword: string): Promise<Hover | null> {
    const ref = qLangParserItems.find(
      (item: CompletionItem) => item.label === keyword
    );
    if (ref) {
      const contents = {
        language: "q",
        value: `/ ${ref.detail}\n${ref.documentation}` ?? "",
      };
      return { contents };
    }
    return null;
  }

  public getQLangParserRef(): CompletionItem[] {
    const qLangParserItemsWithKind: CompletionItem[] = qLangParserItems.map(
      (item: CompletionItem) => {
        item.kind = item.kind as CompletionItemKind;
        return item;
      }
    );

    return qLangParserItemsWithKind;
  }

  public getSymbols(document: TextDocument): SymbolInformation[] {
    const text = document.getText();
    const symbols: SymbolInformation[] = [];

    // Use a regular expression to find function and variable declarations
    const declarationRegex = /(function|var|let|const)\s+([a-zA-Z0-9_]+)\s*\(/g;
    let match;
    while ((match = declarationRegex.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      const name = match[2];
      const kind =
        match[1] === "function" ? SymbolKind.Function : SymbolKind.Variable;
      const range = Range.create(
        document.positionAt(start),
        document.positionAt(end)
      );
      symbols.push(SymbolInformation.create(name, kind, range, document.uri));
    }

    // Use a regular expression to find class declarations
    const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
    while ((match = classRegex.exec(text))) {
      const start = match.index;
      const end = start + match[0].length;
      const name = match[1];
      const kind = SymbolKind.Class;
      const range = Range.create(
        document.positionAt(start),
        document.positionAt(end)
      );
      symbols.push(SymbolInformation.create(name, kind, range, document.uri));
    }

    return symbols;
  }

  public getSymbolsByUri(uri: DocumentUri): SymbolInformation[] {
    const nameToSymInfos = this.uriToDefinition.get(uri)?.values();
    return nameToSymInfos ? Array.from(nameToSymInfos).flat() : [];
  }

  public getSemanticTokens(uri: DocumentUri): SemanticTokens {
    const semanticTokensBuilder: SemanticTokensBuilder | undefined =
      this.uriToSemanticTokens.get(uri);
    return semanticTokensBuilder?.build() ?? { data: [] };
  }

  public getCurrentWord(
    textDocumentPosition: TextDocumentPositionParams,
    document: TextDocument
  ): string | undefined {
    if (document) {
      const textBeforeCursor = document.getText({
        start: { line: textDocumentPosition.position.line, character: 0 },
        end: textDocumentPosition.position,
      });
      const currentWordMatch = textBeforeCursor.match(/([a-zA-Z0-9.]+)$/);
      const currentWord = currentWordMatch ? currentWordMatch[1] : "";
      return currentWord;
    }
    return undefined;
  }

  public getCurrentEntireWord(
    textDocumentPosition: TextDocumentPositionParams,
    document: TextDocument
  ): string {
    if (document) {
      const text = document.getText();
      const wordRegex = /[\w]+(?:[^\w\s\.][\w]+)*/g;
      let match;
      while ((match = wordRegex.exec(text))) {
        const start = match.index;
        const end = start + match[0].length;
        if (
          start <= document.offsetAt(textDocumentPosition.position) &&
          end >= document.offsetAt(textDocumentPosition.position)
        ) {
          return match[0];
        }
      }
    }
    return "";
  }

  public getCompletionItems(keyword: string): CompletionItem[] {
    if (keyword) {
      const qLangParserItemsWithKind: CompletionItem[] = qLangParserItems.map(
        (item: CompletionItem) => {
          item.kind = item.kind as CompletionItemKind;
          return item;
        }
      );
      const completion = qLangParserItemsWithKind.filter(
        (item: CompletionItem) => {
          return item.label.startsWith(keyword);
        }
      );
      return completion;
    }
    return [];
  }

  public getDefinitionByUriKeyword(uri: string, keyword: string): Location[] {
    const symbols: SymbolInformation[] = [];
    if (symbols.length === 0) {
      this.uriToDefinition.forEach((nameToSymInfo) => {
        symbols.push(...(nameToSymInfo.get(keyword) || []));
      });
    }
    return symbols.map((s) => s.location);
  }

  public getReferences(keyword: string, document: TextDocument): Location[] {
    const locations = [];
    for (const doc of this.uriToTextDocument.values()) {
      const text = doc.getText();
      let offset = 0;
      let index = text.indexOf(keyword, offset);

      while (index !== -1) {
        const position = doc.positionAt(index);
        const range = this.getWordRangeAtPosition(doc, position, keyword);
        if (
          range &&
          range.start.line === position.line &&
          range.start.character === position.character
        ) {
          locations.push({ uri: doc.uri, range });
        }
        offset = index + keyword.length;
        index = text.indexOf(keyword, offset);
      }
    }
    return locations;
  }

  public getDefinitions(keyword: string): Definition[] | undefined {
    const definitions: Definition[] = [];

    for (const document of this.uriToTextDocument.values()) {
      const text = document.getText();

      let offset = 0;
      while (true) {
        const index = text.indexOf(keyword, offset);
        if (index === -1) {
          break;
        }

        const range = this.getWordRangeAtPosition(
          document,
          document.positionAt(index),
          keyword
        );
        if (range) {
          definitions.push({
            uri: document.uri,
            range: range,
          });
        }

        offset = index + keyword.length;
      }
    }

    return definitions.length > 0 ? definitions : undefined;
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

  public getWordRangeAtPosition(
    document: TextDocument,
    position: Position,
    keyword?: string
  ): Range | undefined {
    const offset = document.offsetAt(position);
    const text = document.getText();

    let start = offset;
    while (start > 0 && this.isWordCharacter(text.charAt(start - 1))) {
      start--;
    }

    let end = 0;
    if (keyword) {
      end = start + keyword.length;
      while (end < text.length && this.isWordCharacter(text.charAt(end))) {
        end++;
      }
      if (end - start !== keyword.length) {
        return undefined;
      }

      const word = text.substring(start, end);
      if (word !== keyword) {
        return undefined;
      }
      if (start > 0 && text.charAt(start - 1) === ".") {
        return undefined;
      }
    } else {
      end = offset;
      while (end < text.length && this.isWordCharacter(text.charAt(end))) {
        end++;
      }
    }

    if (start === end) {
      return undefined;
    }

    return Range.create(document.positionAt(start), document.positionAt(end));
  }

  public isWordCharacter(ch: string): boolean {
    return /\w/.test(ch);
  }

  public analyzeWorkspace({
    globsPattern = ["**/*.q"],
    ignorePattern = ["**/tmp"],
  }: { globsPattern?: string[]; ignorePattern?: string[] } = {}): void {
    if (
      this.rootPath &&
      fs.existsSync(this.rootPath) &&
      this.rootPath !== "/"
    ) {
      this.uriToTextDocument = new Map<DocumentUri, TextDocument>();
      this.uriToFileContent = new Map<DocumentUri, string>();
      this.uriToDefinition = new Map<DocumentUri, nameToSymbolInformation>();
      this.uriToSymbol = new Map<DocumentUri, string[]>();
      this.nameToSignatureHelp = new Map<string, SignatureHelp>();

      this.writeConsoleMsg(`Checking into the opened Workspace`, "info");

      const ignoreMatch = picomatch(ignorePattern);
      const includeMatch = picomatch(globsPattern);
      AnalyzerContent.matchFile = (test: string) =>
        !ignoreMatch(test) && includeMatch(test);
      const qFiles: string[] = [];
      klaw(this.rootPath, { filter: (item) => !ignoreMatch(item) })
        .on("error", (err: Error) => {
          this.writeConsoleMsg(
            `Error when we tried to analyze the Workspace`,
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
            qFiles.forEach((filepath: string) =>
              this.analyzeDocument(filepath)
            );
          }
        });
    }
  }

  public analyzeDocument(filepath: string): void {
    const uri = URI.file(filepath).toString();
    const text = fs.readFileSync(filepath, "utf8");
    const document = TextDocument.create(uri, "q", 0, text);
    this.uriToTextDocument.set(uri, document);
    this.uriToFileContent.set(uri, text);
  }
}
