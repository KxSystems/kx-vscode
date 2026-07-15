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
import {
  Token,
  assignable,
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
