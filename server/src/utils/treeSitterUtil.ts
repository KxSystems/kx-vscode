import { Range, uinteger } from "vscode-languageserver/node";
import { SyntaxNode } from "web-tree-sitter";

export const forEach = (
  node: SyntaxNode,
  cb: (n: SyntaxNode) => void
): void => {
  cb(node);
  node.children.forEach((n) => forEach(n, cb));
};

export const forEachAndSkip = (
  node: SyntaxNode,
  skipNodeType: string,
  cb: (n: SyntaxNode) => void
): void => {
  cb(node);
  node.children.forEach((n) => {
    if (n.type !== skipNodeType) {
      forEachAndSkip(n, skipNodeType, cb);
    }
  });
};

export const range = (n: SyntaxNode): Range =>
  Range.create(
    n.startPosition.row,
    n.startPosition.column,
    n.endPosition.row,
    n.endPosition.column
  );

export const token = (n: SyntaxNode): uinteger[] => [
  n.startPosition.row,
  n.startPosition.column,
  n.endPosition.column - n.startPosition.column,
];

export const isDefinition = (n: SyntaxNode): boolean => n.type === "assignment";

export const isLoadingFile = (n: SyntaxNode): boolean =>
  /^\\l\s+(\/[^/ ]*)+\.q$/.test(n.text) && n.type === "system_statement";

export const isReference = (n: SyntaxNode): boolean =>
  ["local_identifier", "global_identifier"].includes(n.type) ||
  (n.type === "constant_symbol" && n.text.startsWith("`."));

export const isSeparator = (n: SyntaxNode): boolean => n.type === "separator";

export const isSymbol = (n: SyntaxNode): boolean =>
  n.type === "constant_symbol";

export const isNamespace = (n: SyntaxNode): boolean => n.type === "namespace";

export const isNamespaceEnd = (n: SyntaxNode): boolean =>
  n.type === "namespace_end";

export const isFunctionBody = (node: SyntaxNode): boolean =>
  node.type === "function_body";

export const extractParams = (n: SyntaxNode): string[] => {
  const paramNodes = n.firstNamedChild?.namedChildren || [];
  return paramNodes.map((n) => n.text);
};

export const hasParams = (n: SyntaxNode): boolean =>
  n.firstNamedChild?.type === "formal_parameters";

export const findParent = (
  start: SyntaxNode,
  predicate: (n: SyntaxNode) => boolean
): SyntaxNode | null => {
  let node = start.parent;
  while (node !== null) {
    if (predicate(node)) {
      return node;
    }
    node = node.parent;
  }
  return null;
};

export const findParentNotInTypes = (
  start: SyntaxNode,
  types: string[],
  predicate: (n: SyntaxNode) => boolean
): SyntaxNode | null => {
  let node = start.parent;
  while (node !== null) {
    if (predicate(node)) {
      return node;
    } else if (types.includes(node.type)) {
      return null;
    }
    node = node.parent;
  }
  return null;
};

export const findParentInRoot = (start: SyntaxNode): SyntaxNode => {
  let node = start;
  while (node.parent !== null && node.parent.type !== "script") {
    node = node.parent;
  }
  return node || start.children[0];
};
