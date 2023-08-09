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

import { CharStreams, CommonTokenStream } from "antlr4";
import fs from "fs";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import qLexer from "./antlrGrammars/qLexer";
import qParser from "./antlrGrammars/qParser";
import { qLangParserItems } from "./qLangParser";

export async function initializeParser(): Promise<qParser> {
  const input = "";
  const chars = CharStreams.fromString(input);
  const lexer = new qLexer(chars);
  const tokens = new CommonTokenStream(lexer);
  const parser = new qParser(tokens);
  parser.buildParseTrees = true;
  return parser;
}

export function getQLangParserRef(): CompletionItem[] {
  const qLangParser: CompletionItem[] = qLangParserItems.map(
    (item: CompletionItem) => {
      item.kind = Number(item.kind) as CompletionItemKind;
      return item;
    }
  );
  return qLangParser;
}

export const qLangParser = getQLangParserRef();
export const qLangSampleParser = fs.readFileSync(
  `${__dirname}/../grammars/qLangSamples.q`,
  "utf8"
);
