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

import { IToken } from "chevrotain";
import { TestBegin } from "./ranges";
import { EndOfLine, LCurly, TestBlock, WhiteSpace } from "./tokens";
import { Identifier } from "./keywords";

export interface Token extends IToken {
  index?: number;
  order?: number;
  scope?: Token;
  argument?: Token;
  namespace?: string;
  assignable?: boolean;
  assignment?: Token;
}

export function isLambda(token: Token | undefined): boolean {
  return (
    !token ||
    token.tokenType === LCurly ||
    token.tokenType === TestBegin ||
    token.tokenType === TestBlock
  );
}

export function lookAround(
  tokens: Token[],
  token: Token,
  delta: number,
): Token | undefined {
  let count = 0;
  let index = delta < 0 ? token.index! - 1 : token.index! + 1;
  let current: Token | undefined;
  while (count < Math.abs(delta) && (current = tokens[index])) {
    index = delta < 0 ? index - 1 : index + 1;
    if (current.tokenType === WhiteSpace || current.tokenType === EndOfLine) {
      continue;
    }
    count++;
  }
  return current;
}

export function isFullyQualified(token: Token) {
  return token.image.startsWith(".");
}

export function isLocal(tokens: Token[], target: Token) {
  if (!target.scope) {
    return false;
  }
  if (!target.scope.argument) {
    if (target.image === "x" || target.image === "y" || target.image === "z") {
      return true;
    }
  }
  return !!tokens.find(
    (token) =>
      !isFullyQualified(token) &&
      token.assignable &&
      token.assignment &&
      token.scope === target.scope &&
      token.image === target.image,
  );
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
  if (!source || !source.assignable) {
    return [];
  }
  switch (kind) {
    case FindKind.Rename:
    case FindKind.Reference:
      return isLocal(tokens, source)
        ? tokens.filter(
            (token) =>
              token.tokenType === Identifier &&
              token.assignable &&
              token.image === source.image &&
              token.scope === source.scope,
          )
        : tokens.filter(
            (token) =>
              token.tokenType === Identifier &&
              token.assignable &&
              token.image === source.image &&
              !isLocal(tokens, token),
          );
    case FindKind.Definition:
      return isLocal(tokens, source)
        ? tokens.filter(
            (token) =>
              token.assignment &&
              token.assignable &&
              token.image === source.image &&
              token.scope === source.scope,
          )
        : tokens.filter(
            (token) =>
              token.assignment &&
              token.assignable &&
              token.image === source.image &&
              !isLocal(tokens, token),
          );
    case FindKind.Completion:
      const completions: Token[] = [];
      tokens
        .filter(
          (token) =>
            token.assignment &&
            token.assignable &&
            (token.image.startsWith(".") ||
              token.namespace === source.namespace) &&
            (!token.scope || token.scope === source.scope),
        )
        .forEach(
          (token) =>
            !completions.find((item) => item.image === token.image) &&
            completions.push(token),
        );
      return completions;
  }
}
