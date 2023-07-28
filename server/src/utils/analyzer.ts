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

import {
  CompletionItem,
  CompletionItemKind,
  Hover,
  Location,
  Range,
  SymbolInformation,
  SymbolKind,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
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

export class AnalyzerContent {
  public static async getHoverInfo(keyword: string): Promise<Hover | null> {
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

  public static getQLangParserRef(): CompletionItem[] {
    const qLangParserItemsWithKind: CompletionItem[] = qLangParserItems.map(
      (item: CompletionItem) => {
        item.kind = item.kind as CompletionItemKind;
        return item;
      }
    );

    return qLangParserItemsWithKind;
  }

  public static getCurrentWord(
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

  public static getCompletionItems(keyword: string): CompletionItem[] {
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

  public static getDefinitionByDocKeyword(
    document: TextDocument,
    keyword: string
  ): Location[] {
    const symbols: SymbolInformation[] = [];
    //TODO: add logic here
    return symbols.map((s) => s.location);
  }

  public static getReferences(
    keyword: string,
    document: TextDocument
  ): Location[] {
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
