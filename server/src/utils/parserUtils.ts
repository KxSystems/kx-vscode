import csvParser from "csv-parser";
import fs from "fs";
import { CompletionItem, CompletionItemKind } from "vscode-languageserver/node";
import Parser from "web-tree-sitter";

export async function initializeParser(): Promise<Parser> {
  await Parser.init();
  const parser = new Parser();

  /**
   * See https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web#generate-wasm-language-files
   *
   */
  const lang = await Parser.Language.load(
    `${__dirname}/../../grammars/parser-q.wasm`
  );

  parser.setLanguage(lang);
  return parser;
}

export function getQLangParserRef(): CompletionItem[] {
  const qLangParser: CompletionItem[] = [];
  fs.createReadStream(`${__dirname}/../../grammars/qLang.csv`)
    .pipe(csvParser())
    .on("res", (res: CompletionItem) => {
      res.kind = Number(res.kind) as CompletionItemKind;
      qLangParser.push(res);
    });
  return qLangParser;
}

export const qLangParser = getQLangParserRef();
export const qLangSampleParser = fs.readFileSync(
  `${__dirname}/../../grammars/qLang.csv`,
  "utf8"
);
