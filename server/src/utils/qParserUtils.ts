import * as fs from "fs";
import * as path from "path";
import Parser from "tree-sitter";
import * as ls from "vscode-languageserver";
import { Position, TextDocument } from "vscode-languageserver-textdocument";

export type Keyword = {
  containerName: string;
  text: string;
  type: string;
  range: ls.Range;
};

// Add the path to your grammar file here
const qGrammarPath = path.join(
  __dirname,
  "..",
  "..",
  "grammar",
  "q.grammar.json"
);

// Load the Q grammar file
const qGrammar = JSON.parse(fs.readFileSync(qGrammarPath, "utf8"));

// Create a new parser for the Q grammar
const qParser = new Parser();
qParser.setLanguage(qGrammar);

/**
 * Get the type keyword at the given position in the given document.
 *
 * @param document The document to parse.
 * @param position The position to get the type keyword at.
 * @returns The type keyword at the given position, or null if there is no type keyword at that position.
 */
export function getTypeKeywordAtPosition(
  document: TextDocument,
  position: Position
): Keyword | null {
  // Parse the document using the Q parser
  const rootNode = qParser.parse(document.getText()).rootNode;

  // Find the node at the given position
  const nodeAtPosition = rootNode.descendantForPosition({
    row: position.line,
    column: position.character,
  });

  // Check if the node is a type keyword
  if (nodeAtPosition.type === "type.q") {
    // Return the type keyword information
    return {
      containerName: "",
      text: nodeAtPosition.text,
      type: "type",
      range: {
        start: {
          line: nodeAtPosition.startPosition.row,
          character: nodeAtPosition.startPosition.column,
        },
        end: {
          line: nodeAtPosition.endPosition.row,
          character: nodeAtPosition.endPosition.column,
        },
      },
    };
  }

  // No type keyword found at the given position
  return null;
}
