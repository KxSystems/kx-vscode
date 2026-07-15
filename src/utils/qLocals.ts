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
import { Token } from "../../server/src/parser/utils";
import {
  assignable,
  assigned,
  inLambda,
  inParam,
  lamdaDefinition,
} from "../../server/src/parser/utils";

/**
 * Determine the local variable names (parameters and assigned locals) of a q
 * function, so the debugger can query their values in a suspended frame.
 *
 * The native backtrace only prints a display excerpt of a function, so local
 * names are recovered from the actual source text using the language parser.
 * The function is matched by its name (as reported by the backtrace frame) with
 * a line-based fallback for anonymous/edge cases.
 *
 * @param text full source of the file the frame belongs to
 * @param name function name from the frame (e.g. `g`, `.ns.f`), may be empty
 * @param line 1-based current line of the frame (fallback anchor)
 */
export function functionLocalsAt(
  text: string,
  name: string,
  line?: number,
): string[] {
  let tokens: Token[];
  try {
    tokens = parse(text);
  } catch {
    return [];
  }

  const lambda = name
    ? lambdaOfDefinition(tokens, name)
    : line !== undefined
      ? lambdaAtLine(tokens, line)
      : undefined;

  if (!lambda) return [];

  const names = new Set<string>();
  for (const token of tokens) {
    if (!assignable(token)) continue;
    if (inLambda(token) !== lambda) continue;
    if (assigned(token) || inParam(token)) {
      names.add(token.image);
    }
  }
  return [...names];
}

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

/** Find the lambda a named function is assigned to (e.g. `g` in `g:{...}`). */
function lambdaOfDefinition(tokens: Token[], name: string): Token | undefined {
  for (const token of tokens) {
    if (!assignable(token) || token.image !== name) continue;
    const lambda = lamdaDefinition(token);
    if (lambda) return lambda;
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
