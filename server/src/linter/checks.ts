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
  DateTimeLiteral,
  InfinityLiteral,
  Keyword,
  NumberLiteral,
  Operator,
  StringEscape,
  SymbolLiteral,
  Token,
  lookAround,
} from "../parser";
import { StringEnd } from "../parser/ranges";

const validEscapes = ["n", "r", "t", "\\", "/", '"'];

export function deprecatedDatetime(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.tokenType === DateTimeLiteral);
}

export function assignReservedWord(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) =>
      token.assignable && token.assignment && token.tokenType === Keyword,
  );
}

export function invalidAssign(tokens: Token[]): Token[] {
  return tokens.filter((token) => {
    if (token.assignable && token.assignment) {
      switch (token.tokenType) {
        case StringEnd:
        case SymbolLiteral:
          return true;
        case NumberLiteral:
          const value = parseFloat(token.image);
          return value < 0 || value > 2;
      }
    }
    return false;
  });
}

export function fixedSeed(tokens: Token[]): Token[] {
  return tokens.filter((token) => {
    if (token.tokenType === InfinityLiteral) {
      let prev = lookAround(tokens, token, -1);
      if (prev?.tokenType === Operator && prev.image === "?") {
        prev = lookAround(tokens, prev, -1);
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
  return tokens
    .filter((token) => token.tokenType === StringEscape)
    .filter((token) => {
      const escapes = /\\([0-9]{3}|.{1})/g;
      let match, value;
      while ((match = escapes.exec(token.image))) {
        if (validEscapes.indexOf(match[1]) !== -1) {
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
  return [];
}

export function unusedVar(tokens: Token[]): Token[] {
  return [];
}

export function declaredAfterUse(tokens: Token[]): Token[] {
  return [];
}
