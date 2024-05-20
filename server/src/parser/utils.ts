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
import {
  DoubleColon,
  LBracket,
  LCurly,
  LParen,
  TestBlock,
  TestLambdaBlock,
} from "./tokens";
import { Identifier, LSql } from "./keywords";
import { TestBegin } from "./ranges";

export const enum SyntaxError {
  InvalidEscape,
}

export interface Token extends IToken {
  index?: number;
  order?: number;
  namespace?: string;
  scope?: Token;
  tangled?: Token;
  assignment?: Token[];
  error?: SyntaxError;
}

function inScope(token: Token, ...scopeType: TokenType[]): Token | undefined {
  let scope;
  while ((scope = token.scope)) {
    for (const type of scopeType) {
      if (scope.tokenType === type) {
        return scope;
      }
    }
    token = scope;
  }
  return undefined;
}

export function inList(token: Token) {
  return inScope(token, LParen);
}

export function inBracket(token: Token) {
  return inScope(token, LBracket);
}

export function inLambda(token: Token) {
  return inScope(token, LCurly, TestBegin, TestBlock, TestLambdaBlock);
}

export function inSql(token: Token) {
  return inScope(token, LSql);
}

export function inTable(token: Token) {
  const paren = inList(token);
  return paren && paren.tangled?.tokenType === LBracket;
}

export function inParam(token: Token) {
  const lambda = inLambda(token);
  const bracket = inBracket(token);
  return lambda && bracket && lambda.tangled === bracket;
}

export function identifier(token: Token) {
  if (token.image.startsWith(".")) {
    return token.image;
  }
  if (token.assignment && inLambda(token)) {
    return token.image;
  }
  if (token.namespace) {
    return `.${token.namespace}.${token.image}`;
  }
  return token.image;
}

export function isLambda(token?: Token) {
  return (
    token &&
    (token.tokenType === LCurly ||
      token.tokenType === TestBegin ||
      token.tokenType === TestBlock ||
      token.tokenType === TestLambdaBlock)
  );
}

export function isAmend(token: Token) {
  return token.assignment && token.assignment[0].tokenType === DoubleColon;
}

export function ordered(token: Token, next: Token) {
  return (token.order && next.order && next.order > token.order) || false;
}

export function assigned(token: Token) {
  return token.assignment && token.assignment[1];
}

export function assignable(token: Token) {
  return token.tokenType === Identifier && !inSql(token) && !inTable(token);
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
