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

import { Token, TokenType, QAst, scope } from "../parser";

export function assignReservedWord({ assign }: QAst): Token[] {
  return assign.filter((entity) => entity.type === TokenType.KEYWORD);
}

export function invalidAssign({ assign }: QAst): Token[] {
  return assign.filter((entity) => entity.type === TokenType.LITERAL);
}

export function declaredAfterUse({ script, assign }: QAst): Token[] {
  return script.filter((entity, index) => {
    if (entity.type === TokenType.IDENTIFIER) {
      const declared = assign.find(
        (symbol) =>
          scope(symbol) === scope(entity) && symbol.image === entity.image
      );
      return declared && script.indexOf(declared) > index;
    }
    return false;
  });
}

export function unusedParam({ script, assign }: QAst): Token[] {
  return assign
    .filter(
      (entity) =>
        entity.type === TokenType.IDENTIFIER && entity.tag === "PARAMETER"
    )
    .filter(
      (entity) =>
        !script.find(
          (symbol) =>
            symbol !== entity &&
            symbol.image === entity.image &&
            symbol.type === TokenType.IDENTIFIER &&
            scope(symbol) === scope(entity)
        )
    );
}

export function unusedVar({ script, assign }: QAst): Token[] {
  const locals = assign.filter((entity) => scope(entity));

  return assign
    .filter(
      (entity) =>
        entity.type === TokenType.IDENTIFIER && entity.tag !== "PARAMETER"
    )
    .filter(
      (entity) =>
        !script.find(
          (symbol) =>
            symbol !== entity &&
            symbol.image === entity.image &&
            symbol.type === TokenType.IDENTIFIER &&
            (scope(symbol) === scope(entity) ||
              !locals.find((local) => local.image === symbol.image))
        )
    );
}
