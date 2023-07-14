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

import fs from "fs";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import Parser from "web-tree-sitter";
import { qLangParserItems } from "./qLangParser";

export async function initializeParser(): Promise<Parser> {
  await Parser.init();
  const parser = new Parser();

  /**
   * See https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web#generate-wasm-language-files
   *
   */
  const lang = await Parser.Language.load(
    `${__dirname}/../grammars/parser-q.wasm`
  );

  parser.setLanguage(lang);
  return parser;
}

export function getQLangParserRef(): CompletionItem[] {
  const qLangParserItemsWithKind: CompletionItem[] = qLangParserItems.map(
    (item: CompletionItem) => {
      item.kind = item.kind as CompletionItemKind;
      return item;
    }
  );

  return qLangParserItemsWithKind;
}

export const qLangParser = getQLangParserRef();
export const qLangSampleParser = fs.readFileSync(
  `${__dirname}/../grammars/qLangSamples.q`,
  "utf8"
);
