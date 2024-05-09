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

import {
  CharLiteral,
  Colon,
  DateTimeLiteral,
  DoubleColon,
  Identifier,
  IdentifierKind,
  InfinityLiteral,
  Keyword,
  NumberLiteral,
  Operator,
  SymbolLiteral,
  Token,
  TokenKind,
} from "../parser";

function seek(tokens: Token[], token: Token, count = 1) {
  if (token.index !== undefined) {
    const result = tokens[token.index + count];
    if (result) {
      return result;
    }
  }
  return undefined;
}

function isNextAssignment(tokens: Token[], token: Token) {
  const next = seek(tokens, token);
  if (next) {
    if (next.tokenType === Colon || next.tokenType === DoubleColon) {
      return true;
    }
  }
  return false;
}

export function deprecatedDatetime(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.tokenType === DateTimeLiteral);
}

export function assignReservedWord(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) => token.tokenType === Keyword && isNextAssignment(tokens, token),
  );
}

export function invalidAssign(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) =>
      isNextAssignment(tokens, token) &&
      (token.tokenType === CharLiteral ||
        token.tokenType === SymbolLiteral ||
        token.tokenType === NumberLiteral),
  );
}

export function fixedSeed(tokens: Token[]): Token[] {
  return tokens.filter((token) => {
    if (token.tokenType === InfinityLiteral) {
      let prev = seek(tokens, token, -1);
      if (prev?.tokenType === Operator && prev.image === "?") {
        prev = seek(tokens, token, -2);
        if (prev?.tokenType === NumberLiteral) {
          const value = parseFloat(prev.image);
          if (value >= 0) {
            return true;
          }
        }
      }
    }
    return false;
  });
}

export function invalidEscape(tokens: Token[]): Token[] {
  const valid = ["n", "r", "t", "/", "\\"];
  return tokens
    .filter((token) => token.tokenType === CharLiteral)
    .filter((token) => {
      const escapes = /\\(\S*)/g;
      let match, value;
      while ((match = escapes.exec(token.image))) {
        if (valid.indexOf(match[1]) !== -1) {
          continue;
        }
        value = parseInt(match[1]);
        if (value && value >= 100 && value <= 377) {
          continue;
        }
        return true;
      }
      return false;
    });
}

export function unusedParam(tokens: Token[]): Token[] {
  return tokens
    .filter((token) => token.identifierKind === IdentifierKind.Argument)
    .filter((arg) => {
      return !tokens.find(
        (token) =>
          token !== arg &&
          token.kind !== TokenKind.Assignment &&
          token.tokenType === Identifier &&
          token.scope === arg.scope &&
          token.identifier === arg.identifier,
      );
    });
}

export function unusedVar(tokens: Token[]): Token[] {
  return [];
}

export function declaredAfterUse(tokens: Token[]): Token[] {
  return [];
}
