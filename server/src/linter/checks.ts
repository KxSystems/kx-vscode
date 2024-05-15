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

import { DateTimeLiteral, SyntaxError, Token } from "../parser";

export function deprecatedDatetime(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.tokenType === DateTimeLiteral);
}

export function assignReservedWord(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) => token.error === SyntaxError.AssignedToKeyword,
  );
}

export function invalidAssign(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) => token.error === SyntaxError.AssignedToLiteral,
  );
}

export function invalidEscape(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.error === SyntaxError.InvalidEscape);
}

function unusedLocal(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) =>
      token.local &&
      token.assignable &&
      token.assignment &&
      !token.scope?.children?.find(
        (child) => child.local && child != token && child.image === token.image,
      ),
  );
}

export function unusedParam(tokens: Token[]): Token[] {
  return unusedLocal(tokens).filter((token) => token.assignment === token);
}

export function unusedVar(tokens: Token[]): Token[] {
  return unusedLocal(tokens).filter((token) => token.assignment !== token);
}

export function declaredAfterUse(tokens: Token[]): Token[] {
  return tokens
    .filter((token) => token.assignable && token.assignment)
    .filter((token) => {
      if (token.local) {
        return token.scope?.children?.find(
          (child) =>
            child.assignable &&
            !child.assignment &&
            child.order! < token.order! &&
            child.scope === token.scope &&
            child.image === token.image,
        );
      }
      return false;
    });
}
