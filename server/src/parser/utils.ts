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

import { IToken, TokenType } from "chevrotain";
import { DoubleColon, LBracket, RCurly, RParen } from "./tokens";
import { RSql } from "./keywords";

export const enum SyntaxError {
  InvalidEscape,
}

export interface Token extends IToken {
  index?: number;
  order?: number;
  scope?: Token;
  scopped?: Token[];
  tangled?: Token;
  namespace?: string;
  assignment?: Token[];
  error?: SyntaxError;
}

export function inScope(token: Token, type: TokenType): Token | undefined {
  let scope;
  while ((scope = token.scope)) {
    if (scope.tokenType === type) {
      return scope;
    }
    token = scope;
  }
  return undefined;
}

export function inLambda(token: Token) {
  return inScope(token, RCurly);
}

export function inSql(token: Token) {
  return inScope(token, RSql);
}

export function inTable(token: Token) {
  const scope = inScope(token, RParen);
  return scope && scope.tangled?.tokenType === LBracket;
}

export function isQualified(token: Token) {
  return token.image.startsWith(".");
}

export function isAmend(token: Token) {
  return token.assignment && token.assignment[0].tokenType === DoubleColon;
}

export const enum AssignmentType {
  None,
  Lambda,
  Variable,
}

export function assignmentType(token: Token): AssignmentType {
  if (!token.assignment) {
    return AssignmentType.None;
  }
  const assigned = token.assignment[1]?.tokenType;
  if (!assigned) {
    return AssignmentType.None;
  }
  return assigned === RCurly ? AssignmentType.Lambda : AssignmentType.Variable;
}

export function tokenId(token: Token) {
  return (token.tokenType.tokenTypeIdx?.toString(16) || "").padStart(2, "0");
}

export const enum FindKind {
  Reference,
  Definition,
  Rename,
  Completion,
}

export function findIdentifiers(
  kind: FindKind,
  tokens: Token[],
  source?: Token,
): Token[] {
  if (!source) {
    return [];
  }
  switch (kind) {
    case FindKind.Rename:
    case FindKind.Reference:
      return [];
    case FindKind.Definition:
      return [];
    case FindKind.Completion:
      const completions: Token[] = [];
      return completions;
  }
}
