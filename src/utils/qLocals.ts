/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import { parse } from "../../server/src/parser/parser";
import { LCurly } from "../../server/src/parser/tokens";
import {
  Token,
  assignable,
  identifier,
  inLambda,
  lamdaDefinition,
} from "../../server/src/parser/utils";

export interface QFunctionInfo {
  /** Function name it is assigned to (e.g. `g`, `.ns.f`). */
  name: string;
  /** 1-based line of the function's opening `{` (origin of its source offsets). */
  startLine: number;
}

/**
 * Identify the function whose body encloses a 1-based source line, returning its
 * name and the line of its opening `{`. Used to translate a DAP breakpoint line
 * into a bytecode index relative to the function's own source.
 *
 * (Local variable names are no longer derived here; the debugger reads them from
 * q at runtime via `.dbg.locals`.)
 */
export function functionAt(
  text: string,
  line: number,
): QFunctionInfo | undefined {
  let tokens: Token[];
  try {
    tokens = parse(text);
  } catch {
    return undefined;
  }

  const lambda = lambdaAtLine(tokens, line);
  if (!lambda) return undefined;

  // Find the identifier this lambda is assigned to.
  for (const token of tokens) {
    if (assignable(token) && lamdaDefinition(token) === lambda) {
      return { name: token.image, startLine: lambda.startLine ?? line };
    }
  }
  return undefined;
}

/**
 * Locates a source line within the lambda-nesting tree, for arming a native
 * breakpoint on the (possibly nested) lambda that encloses it.
 */
export interface QLambdaPath {
  /**
   * Global name of the OUTERMOST enclosing function (e.g. `g`, `.ns.f`). It must
   * be armable with `get`, so the outermost lambda has to be assigned at top
   * level; a nested lambda is reached from it by {@link path}, not by name.
   */
  name: string;
  /**
   * Source-order child-lambda indices leading from {@link name} down to the
   * innermost lambda enclosing the line (empty = the named function itself). q
   * stores each nested lambda as a `type 100h` constant of its parent's `value`,
   * in source order, so index `path[k]` selects the k-th descent. The debugger's
   * `.dbg.nested` walks this path.
   */
  path: number[];
  /** 1-based line of the innermost enclosing lambda's opening `{`. */
  startLine: number;
  /** 1-based line of the outermost (named) function's opening `{`. */
  rootLine: number;
}

/**
 * Resolve a 1-based source line to the chain of `{…}` lambdas enclosing it,
 * expressed as a top-level function name plus a descent path of child-lambda
 * indices. This generalises {@link functionAt} to lambdas nested to any depth,
 * including anonymous or locally-named ones (which carry no global name of their
 * own but are reachable as constants of the outermost function). Returns
 * undefined when the line is not inside a lambda, or the outermost enclosing
 * lambda is not assigned to a global name (so it cannot be armed).
 */
export function lambdaPathAt(
  text: string,
  line: number,
): QLambdaPath | undefined {
  let tokens: Token[];
  try {
    tokens = parse(text);
  } catch {
    return undefined;
  }

  const innermost = lambdaAtLine(tokens, line);
  // Only plain `{…}` lambdas nest as `value` constants; a test block (qcumber)
  // is not navigable this way, so it is not a supported breakpoint host.
  if (!innermost || innermost.tokenType !== LCurly) return undefined;

  // Enclosing-lambda chain, outermost first.
  const chain: Token[] = [];
  for (
    let cur: Token | undefined = innermost;
    cur;
    cur = enclosingLambda(cur)
  ) {
    if (cur.tokenType !== LCurly) return undefined;
    chain.unshift(cur);
  }
  const root = chain[0];

  const named = tokens.find(
    (t) => assignable(t) && lamdaDefinition(t) === root,
  );
  if (!named) return undefined;

  const path: number[] = [];
  for (let i = 1; i < chain.length; i++) {
    const idx = childLambdas(tokens, chain[i - 1]).indexOf(chain[i]);
    if (idx === -1) return undefined; // defensive: chain child must be a child
    path.push(idx);
  }

  return {
    name: identifier(named),
    path,
    startLine: innermost.startLine ?? line,
    rootLine: root.startLine ?? line,
  };
}

/** The `{` lambda directly enclosing `lambda`, or undefined at the top level. */
function enclosingLambda(lambda: Token): Token | undefined {
  for (let scope = lambda.scope; scope; scope = scope.scope) {
    if (scope.tokenType === LCurly) return scope;
  }
  return undefined;
}

/** Direct child `{` lambdas of `parent`, in source order. */
function childLambdas(tokens: Token[], parent: Token): Token[] {
  return tokens
    .filter((t) => t.tokenType === LCurly && enclosingLambda(t) === parent)
    .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));
}

/** Innermost lambda enclosing any token on the given 1-based line. */
function lambdaAtLine(tokens: Token[], line: number): Token | undefined {
  const onLine = tokens.filter((t) => (t.startLine ?? 0) === line);
  for (const token of onLine) {
    const lambda = inLambda(token);
    if (lambda) return lambda;
  }
  return undefined;
}

/** A statement-separating `;` position within a lambda body. */
export interface QSeparator {
  /** 1-based source line of the `;`. */
  line: number;
  /** 1-based source column of the `;`. */
  column: number;
}

/**
 * Statement-separating `;` positions within the lambda enclosing a 1-based source
 * line. A `;` separates statements when its scope is a SEQUENTIAL context: the
 * lambda body itself, or an `if[…]`/`while[…]`/`do[…]`/`$[…]` bracket (whose
 * `;`-separated parts run in sequence). A `;` in an application `f[a;b]`, an index
 * `x[i;j]`, a param list `[x;y]`, or a list `(a;b)` is an argument separator, not a
 * statement boundary, and is excluded. This lets stepping advance through the
 * sub-statements of a control construct even when it is written on one line.
 * (A bare newline never separates statements inside `{…}`; only `;` does.)
 */
export function lambdaStatementSeparators(
  text: string,
  line: number,
): QSeparator[] {
  let tokens: Token[];
  try {
    tokens = parse(text);
  } catch {
    return [];
  }
  const lambda = lambdaAtLine(tokens, line);
  if (!lambda) return [];
  return tokens
    .filter(
      (t) =>
        t.tokenType?.name === "SemiColon" &&
        inLambda(t) === lambda &&
        sequentialScope(t.scope),
    )
    .map((t) => ({ line: t.startLine ?? 0, column: t.startColumn ?? 0 }));
}

/**
 * The default namespace in effect at a 1-based source line, as a prefix (e.g.
 * `.utils`, or `""` for the root namespace), by scanning `\d` directives above
 * the line. A program that switches namespace with `\d .utils` defines a bare
 * `run:{…}` as `.utils.run`, so the adapter must qualify the parser's bare name
 * before arming a trap or reading locals. `\d .` (or `\d`) resets to root. Only
 * top-level `\d` command lines are considered (q forbids `\d` inside a lambda).
 */
export function namespaceAt(text: string, line: number): string {
  const lines = text.split("\n");
  const directive = /^\s*\\d\s+(\.[A-Za-z][\w.]*|\.)\s*$/;
  let ns = "";
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    const m = lines[i].match(directive);
    if (m) ns = m[1] === "." ? "" : m[1];
  }
  return ns;
}

/**
 * Whether a scope token sequences the `;`-separated statements directly inside it:
 * the lambda body (`{…}`), or a control/cond bracket (`if`/`while`/`do`/`$`),
 * identified by the bracket's `tangled` head token. Application/index/param/list
 * brackets are not sequential.
 */
function sequentialScope(scope?: Token): boolean {
  const type = scope?.tokenType?.name;
  if (type === "LCurly") return true;
  if (type !== "LBracket") return false;
  const head = scope?.tangled?.tokenType?.name;
  return head === "Control" || head === "Cond";
}
