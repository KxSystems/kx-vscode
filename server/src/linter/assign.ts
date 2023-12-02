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

import { Entity, EntityType, QAst, getNameScope, isLiteral } from "../parser";

export function assignReservedWord({ assign }: QAst): Entity[] {
  return assign.filter((entity) => entity.type === EntityType.KEYWORD);
}

export function invalidAssign({ assign }: QAst): Entity[] {
  return assign.filter((entity) => isLiteral(entity));
}

export function declaredAfterUse({ script, assign }: QAst): Entity[] {
  return script.filter((entity, index) => {
    if (entity.type === EntityType.IDENTIFIER) {
      const declared = assign.find(
        (symbol) =>
          getNameScope(symbol) === getNameScope(entity) &&
          symbol.image === entity.image
      );
      return declared && script.indexOf(declared) > index;
    }
    return false;
  });
}

export function unusedParam({ script, assign }: QAst): Entity[] {
  return assign
    .filter(
      (entity) =>
        entity.type === EntityType.IDENTIFIER &&
        entity.scope?.type === EntityType.LBRACKET
    )
    .filter(
      (entity) =>
        !script.find(
          (symbol) =>
            symbol !== entity &&
            symbol.image === entity.image &&
            symbol.type === EntityType.IDENTIFIER &&
            getNameScope(symbol) === getNameScope(entity)
        )
    );
}

export function unusedVar({ script, assign }: QAst): Entity[] {
  const locals = assign.filter((entity) => getNameScope(entity));

  return assign
    .filter((entity) => entity.type === EntityType.IDENTIFIER)
    .filter(
      (entity) =>
        !script.find(
          (symbol) =>
            symbol !== entity &&
            symbol.image === entity.image &&
            symbol.type === EntityType.IDENTIFIER &&
            (getNameScope(symbol) === getNameScope(entity) ||
              !locals.find((local) => local.image === symbol.image))
        )
    );
}
