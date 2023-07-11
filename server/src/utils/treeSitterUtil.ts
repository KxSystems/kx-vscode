import { Range, uinteger } from "vscode-languageserver/node";
import { SyntaxNode } from "web-tree-sitter";

export const forEach = (
  node: SyntaxNode,
  callback: (node: SyntaxNode) => void
): void => {
  callback(node);
  node.children.forEach((child) => forEach(child, callback));
};

export const forEachAndSkip = (
  node: SyntaxNode,
  skipNodeType: string,
  callback: (node: SyntaxNode) => void
): void => {
  callback(node);
  node.children.forEach((child) => {
    if (child.type !== skipNodeType) {
      forEachAndSkip(child, skipNodeType, callback);
    }
  });
};

export const range = (node: SyntaxNode): Range =>
  Range.create(
    node.startPosition.row,
    node.startPosition.column,
    node.endPosition.row,
    node.endPosition.column
  );

export const token = (node: SyntaxNode): uinteger[] => [
  node.startPosition.row,
  node.startPosition.column,
  node.endPosition.column - node.startPosition.column,
];

export const isDefinition = (node: SyntaxNode): boolean =>
  node.type === "assignment";

/**
 * Returns true if the given `SyntaxNode` represents a system statement that loads a file.
 */
export const isLoadingFile = (node: SyntaxNode): boolean =>
  /^\\l\s+(\/[^/ ]*)+\.q$/.test(node.text) && node.type === "system_statement";

/**
 * Returns true if the given `SyntaxNode` represents a reference.
 */
export const isReference = (node: SyntaxNode): boolean =>
  ["local_identifier", "global_identifier"].includes(node.type) ||
  (node.type === "constant_symbol" && node.text.startsWith("`."));

/**
 * Returns true if the given `SyntaxNode` represents a separator.
 */
export const isSeparator = (node: SyntaxNode): boolean =>
  node.type === "separator";

/**
 * Returns true if the given `SyntaxNode` represents a constant symbol.
 */
export const isSymbol = (node: SyntaxNode): boolean =>
  node.type === "constant_symbol";

/**
 * Returns true if the given `SyntaxNode` represents a namespace.
 */
export const isNamespace = (node: SyntaxNode): boolean =>
  node.type === "namespace";

/**
 * Returns true if the given `SyntaxNode` represents a namespace end.
 */
export const isNamespaceEnd = (node: SyntaxNode): boolean =>
  node.type === "namespace_end";

/**
 * Returns true if the given `SyntaxNode` represents a function body.
 */
export const isFunctionBody = (node: SyntaxNode): boolean =>
  node.type === "function_body";

/**
 * Extracts the parameter names from the given `SyntaxNode`.
 */
export const extractParams = (node: SyntaxNode): string[] => {
  const paramNodes = node.firstNamedChild?.namedChildren ?? [];
  return paramNodes.map((paramNode) => paramNode.text);
};

/**
 * Returns true if the given `SyntaxNode` has formal parameters.
 */
export const hasParams = (node: SyntaxNode): boolean =>
  node.firstNamedChild?.type === "formal_parameters";

/**
 * Finds the first ancestor of the given `SyntaxNode` that satisfies the given predicate.
 * Returns `null` if no ancestor satisfies the predicate.
 */
export const findParent = (
  start: SyntaxNode,
  predicate: (node: SyntaxNode) => boolean
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

/**
 * Finds the first ancestor of the given `SyntaxNode` that satisfies the given predicate,
 * but is not of any of the given types.
 * Returns `null` if no ancestor satisfies the predicate or is of any of the given types.
 */
export const findParentNotInTypes = (
  start: SyntaxNode,
  types: string[],
  predicate: (node: SyntaxNode) => boolean
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

/**
 * Finds the first ancestor of the given `SyntaxNode` that is a child of the root node.
 * Returns the given `SyntaxNode` if it is already a child of the root node.
 */
export const findParentInRoot = (start: SyntaxNode): SyntaxNode => {
  let node = start;
  while (node.parent !== null && node.parent.type !== "script") {
    node = node.parent;
  }
  return node || start.children[0];
};

export const getContainerName = (node: SyntaxNode): string | null => {
  let container: SyntaxNode | null = node.parent;
  while (container !== null) {
    if (isSymbol(container)) {
      return container.text?.trim() ?? null;
    }
    container = container.parent;
  }
  return null;
};

export const getSymbols = (node: SyntaxNode): SyntaxNode[] => {
  const symbols: SyntaxNode[] = [];
  forEach(node, (n: SyntaxNode) => {
    if (isSymbol(n) && getContainerName(n) === "") {
      symbols.push(n);
    }
  });
  return symbols;
};
