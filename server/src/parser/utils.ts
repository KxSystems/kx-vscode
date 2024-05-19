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
import { DoubleColon, LBracket, RBracket, RCurly, RParen } from "./tokens";
import { Identifier, RSql } from "./keywords";

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

function inScope(token: Token, scopeType: TokenType): Token | undefined {
  let scope;
  while ((scope = token.scope)) {
    if (scope.tokenType === scopeType) {
      return scope;
    }
    token = scope;
  }
  return undefined;
}

function inBracket(token: Token) {
  return inScope(token, RBracket);
}

export function inLambda(token: Token) {
  return inScope(token, RCurly);
}

export function inSql(token: Token) {
  return inScope(token, RSql);
}

export function inTable(token: Token) {
  const scope = inScope(token, RParen);
  return scope && scope.tangled?.tangled?.tokenType === LBracket;
}

export function inParam(token: Token) {
  const lambda = inLambda(token);
  const bracket = inBracket(token);
  return (
    lambda &&
    bracket &&
    bracket.tangled &&
    bracket.tangled === lambda.tangled?.tangled
  );
}

export function identifier(token: Token) {
  if (token.tokenType !== Identifier) {
    return "";
  }
  if (token.image.startsWith(".")) {
    return token.image;
  }
  if (token.namespace) {
    return `.${token.namespace}.${token.image}`;
  }
  return token.image;
}

export function isAmend(token: Token) {
  return token.assignment && token.assignment[0].tokenType === DoubleColon;
}

export function assignedType(token: Token) {
  return token.assignment && token.assignment[1]?.tokenType;
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
