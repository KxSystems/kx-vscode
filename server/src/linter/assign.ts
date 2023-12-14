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
  assign = assign.filter(
    (token) => token.type === TokenType.IDENTIFIER && token.tag === "ARGUMENT"
  );

  script = script.filter(
    (token) =>
      token.tag !== "ASSIGNED" &&
      token.tag !== "ARGUMENT" &&
      token.type === TokenType.IDENTIFIER &&
      assign.find((symbol) => symbol.image === token.image)
  );

  assign = assign.filter(
    (token) =>
      !script.find(
        (symbol) =>
          symbol.image === token.image && scope(symbol) === scope(token)
      )
  );

  return assign;
}

export function unusedVar({ script, assign }: QAst): Token[] {
  const locals = assign.filter(
    (token) => token.type === TokenType.IDENTIFIER && scope(token)
  );

  assign = assign.filter(
    (token) => token.type === TokenType.IDENTIFIER && token.tag === "ASSIGNED"
  );

  script = script.filter(
    (token) =>
      token.tag !== "ASSIGNED" &&
      token.tag !== "ARGUMENT" &&
      token.type === TokenType.IDENTIFIER &&
      assign.find((symbol) => symbol.image === token.image)
  );

  assign = assign.filter(
    (token) =>
      !script.find(
        (symbol) =>
          symbol.image === token.image &&
          (scope(symbol) === scope(token) ||
            (!scope(token) &&
              !locals.find(
                (local) =>
                  local.image === token.image && scope(local) === scope(symbol)
              )))
      )
  );

  return assign;
}
