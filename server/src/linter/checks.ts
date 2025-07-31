/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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
  SyntaxError,
  Token,
  amended,
  assignable,
  assigned,
  identifier,
  inLambda,
  inParam,
  ordered,
  qualified,
} from "../parser";

export function deprecatedDatetime(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.tokenType === DateTimeLiteral);
}

export function invalidEscape(tokens: Token[]): Token[] {
  return tokens.filter((token) => token.error === SyntaxError.InvalidEscape);
}

export function unusedParam(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) =>
      inParam(token) &&
      assigned(token) &&
      assignable(token) &&
      !tokens.find(
        (target) =>
          !assigned(target) &&
          inLambda(target) === inLambda(token) &&
          identifier(target) === identifier(token),
      ),
  );
}

export function unusedVar(tokens: Token[]): Token[] {
  return tokens.filter(
    (token) =>
      !inParam(token) &&
      !amended(token) &&
      !qualified(token) &&
      inLambda(token) &&
      assigned(token) &&
      assignable(token) &&
      !tokens.find(
        (target) =>
          !assigned(target) &&
          inLambda(target) === inLambda(token) &&
          identifier(target) === identifier(token),
      ),
  );
}

export function declaredAfterUse(tokens: Token[]): Token[] {
  return tokens
    .filter(
      (token) =>
        !amended(token) &&
        !qualified(token) &&
        assigned(token) &&
        assignable(token),
    )
    .sort((a, b) =>
      identifier(a) < identifier(b)
        ? -1
        : identifier(a) > identifier(b)
          ? 1
          : (a.order || 0) - (b.order || 0),
    )
    .filter((e, i, a) => !a[i - 1] || identifier(e) !== identifier(a[i - 1]))
    .filter((token) =>
      tokens.find(
        (target) =>
          !assigned(target) &&
          inLambda(target) === inLambda(token) &&
          identifier(target) === identifier(token) &&
          ordered(target, token),
      ),
    );
}
