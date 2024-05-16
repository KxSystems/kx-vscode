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
import { LCurly, TestBlock, TestLambdaBlock } from "./tokens";
import { Identifier } from "./keywords";

export const enum SyntaxError {
  InvalidEscape,
}

export interface Token extends IToken {
  index?: number;
  order?: number;
  scope?: Token;
  scopped?: Token[];
  argument?: Token;
  namespace?: string;
  assignable?: boolean;
  assignment?: Token;
  local?: boolean;
  children?: Token[];
  error?: SyntaxError;
}

export function children(token: Token) {
  if (!token.children) {
    token.children = [];
  }
  return token.children;
}

export function scopped(token: Token) {
  if (!token.scopped) {
    token.scopped = [];
  }
  return token.scopped;
}

export function isLambda(token: Token | undefined): boolean {
  return (
    !token ||
    token.tokenType === LCurly ||
    token.tokenType === TestBegin ||
    token.tokenType === TestBlock ||
    token.tokenType === TestLambdaBlock
  );
}

export function isFullyQualified(token: Token) {
  return token.image.startsWith(".");
}

export function isLocal(target: Token) {
  if (!target.scope) {
    return false;
  }
  if (!target.scope.argument) {
    if (target.image === "x" || target.image === "y" || target.image === "z") {
      return true;
    }
  }
  return !!target.local;
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
      return isLocal(source)
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
              !isLocal(token),
          );
    case FindKind.Definition:
      return isLocal(source)
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
              !isLocal(token),
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
