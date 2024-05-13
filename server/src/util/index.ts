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

import { Position, Range } from "vscode-languageserver";
import { Identifier, Token } from "../parser";

export function rangeFromToken(token: Token): Range {
  return Range.create(
    (token.startLine || 1) - 1,
    (token.startColumn || 1) - 1,
    (token.endLine || 1) - 1,
    token.endColumn || 1,
  );
}

export function positionToToken(tokens: Token[], position: Position) {
  return tokens.find((token) => {
    const { start, end } = rangeFromToken(token);
    return (
      start.line <= position.line &&
      end.line >= position.line &&
      start.character <= position.character &&
      end.character >= position.character
    );
  });
}

export function isLocal(tokens: Token[], target: Token) {
  if (!target.scope) {
    return false;
  }
  /*
  if (target.scope.nullary) {
    if (
      target.identifier === "x" ||
      target.identifier === "y" ||
      target.identifier === "z"
    ) {
      return true;
    }
  }
  */
  return !!tokens.find(
    (token) =>
      token.assignment &&
      token.assignable &&
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
