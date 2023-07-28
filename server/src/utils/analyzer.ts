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

import { DocumentUri, TextDocument } from "vscode-languageserver-textdocument";
import {
  CallHierarchyItem,
  CompletionItem,
  CompletionItemKind,
  Connection,
  Hover,
  Location,
  Range,
  SemanticTokensBuilder,
  SignatureHelp,
  SymbolInformation,
  SymbolKind,
  TextDocumentPositionParams,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import { qLangSampleParser } from "./parserUtils";
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
type nameToGlobalId = Map<string, string[]>;
type nameToSymbolInformation = Map<string, SymbolInformation[]>;
type nameToCallHierarchyItem = Map<string, CallHierarchyItem[]>;

export class AnalyzerContent {
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
  private workspaceFolder: URI;
  private rootPath: string | undefined | null;
  private reservedWord: string[];
  private qLangSampleParserSrc: string;

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

  public getCurrentWord(
    textDocumentPosition: TextDocumentPositionParams,
    document: TextDocument
  ): string {
    if (document) {
      const textBeforeCursor = document.getText({
        start: { line: textDocumentPosition.position.line, character: 0 },
        end: textDocumentPosition.position,
      });
      const currentWordMatch = textBeforeCursor.match(/([a-zA-Z0-9.]+)$/);
      const currentWord = currentWordMatch ? currentWordMatch[1] : "";
      return currentWord;
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
    const symbols: SymbolInformation[] = [];
    const lines = document.getText().split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(new RegExp(`\\b${keyword}\\b`));
      if (match) {
        const position = {
          line: i,
          character: match.index,
        };
        if (position.character) {
          symbols.push({
            name: keyword,
            kind: SymbolKind.Variable,
            location: Location.create(document.uri, {
              start: { line: position.line, character: position.character },
              end: {
                line: position.line,
                character: position.character + keyword.length,
              },
            }),
          });
        }
      }
    }
    const qLangParserLabels = qLangParserItems.map((item) => item.label);
    const filteredSymbols = symbols.filter(
      (symbol) => !qLangParserLabels.includes(symbol.name)
    );
    return filteredSymbols.map((symbol) => symbol.location);
  }
}
