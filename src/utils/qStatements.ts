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

export interface QStatement {
  /** 1-based first source line of the statement. */
  startLine: number;
  /** 1-based last source line of the statement. */
  endLine: number;
  /** The statement's source text (may span multiple lines). */
  text: string;
}

/**
 * Split q source into top-level statements, preserving multi-line function
 * definitions as single units. Statement boundaries are end-of-line/semicolon
 * tokens that sit at the top level (no enclosing `{`/`(`/`[`/string), so a
 * `f:{ ... }` spanning several lines stays one statement.
 *
 * The debug adapter loads a program statement-by-statement so it can arm
 * breakpoints on a function after its definition executes but before any later
 * top-level call that would hit them.
 */
export function splitTopLevelStatements(text: string): QStatement[] {
  const lines = text.split("\n");

  // Lines (1-based) after which a top-level statement completes.
  const boundaries = new Set<number>();
  try {
    for (const token of parse(text)) {
      const name = token.tokenType?.name;
      const topLevel = token.scope === undefined;
      if (topLevel && (name === "EndOfLine" || name === "SemiColon")) {
        boundaries.add(token.startLine ?? 0);
      }
    }
  } catch {
    // Fall back to one statement per line on parse failure.
    return lines.map((l, i) => ({
      startLine: i + 1,
      endLine: i + 1,
      text: l,
    }));
  }

  const statements: QStatement[] = [];
  let start = 1;
  for (let line = 1; line <= lines.length; line++) {
    const isLast = line === lines.length;
    if (boundaries.has(line) || isLast) {
      const text = lines.slice(start - 1, line).join("\n");
      if (text.trim().length > 0) {
        statements.push({ startLine: start, endLine: line, text });
      }
      start = line + 1;
    }
  }
  return statements;
}
