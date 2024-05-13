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
  Identifier,
  InfinityLiteral,
  NumberLiteral,
  Operator,
  StringEscape,
  Token,
} from "../parser";
import { isLocal } from "../util";

function seek(tokens: Token[], token: Token, count = 1) {
  if (token.index !== undefined) {
    const result = tokens[token.index + count];
    if (result) {
      return result;
    }
  }
  return undefined;
}

export function deprecatedDatetime(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.tokenType === DateTimeLiteral);
}

export function assignReservedWord(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.image === "assignReservedWord");
}

export function invalidAssign(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.image === "invalidAssign");
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
  const valid = ["n", "r", "t", "\\", "/", '"'];
  return tokens
    .filter((token) => token.tokenType === StringEscape)
    .filter((token) => {
      const escapes = /\\([0-9]{3}|.{1})/g;
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
    .filter((token) => token.argument)
    .filter((arg) => {
      return !tokens.find(
        (token) =>
          token !== arg &&
          token.assignment &&
          token.tokenType === Identifier &&
          token.scope === arg.scope &&
          token.image === arg.image,
      );
    });
}

export function unusedVar(tokens: Token[]): Token[] {
  return tokens
    .filter((token) => token.assignment && !token.argument)
    .filter((token) => {
      if (isLocal(tokens, token)) {
        return !tokens.find(
          (target) =>
            target !== token &&
            target.image === token.image &&
            target.tokenType === Identifier &&
            !target.assignment &&
            target.scope === token.scope,
        );
      }
      return !tokens.find(
        (target) =>
          target !== token &&
          target.image === token.image &&
          target.tokenType === Identifier &&
          !target.assignment &&
          !isLocal(tokens, target),
      );
    });
}

export function declaredAfterUse(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.image === "declaredAfterUse");
}
