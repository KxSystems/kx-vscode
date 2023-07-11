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
