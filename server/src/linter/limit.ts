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

import { Entity, EntityType, QAst, getNameScope } from "../parser";

const DEFAULT_MAX_LINE_LENGTH = 200;
const DEFAULT_MAX_CONSTANTS = 255;
const DEFAULT_MAX_LOCALS = 1;
const DEFAULT_MAX_GLOBALS = 1;

export function lineLength({ script }: QAst): Entity[] {
  const problems: Entity[] = [];

  const symbols = script.filter(
    (entity) => entity.type === EntityType.ENDOFLINE
  );

  for (let i = 0; i < symbols.length; i++) {
    const start = i === 0 ? 0 : symbols[i - 1].endOffset;

    if (symbols[i].endOffset - start > DEFAULT_MAX_LINE_LENGTH + 1) {
      problems.push(symbols[i]);
    }
  }

  return problems;
}

export function tooManyConstants({ script }: QAst): Entity[] {
  const scopes = new Set(script.map((entity) => getNameScope(entity)));

  for (const entity of script) {
    for (const scope of scopes) {
      if (scope === getNameScope(entity)) {
        if (scope) {
          if (!scope.related) {
            scope.related = [];
          }
          scope.related.push(entity);
        }
      }
    }
  }

  const problems: Entity[] = [];

  for (const scope of scopes) {
    if (
      scope &&
      scope.related &&
      scope.related.length > DEFAULT_MAX_CONSTANTS
    ) {
      problems.push(scope);
    }
  }

  return problems;
}

export function tooManyGlobals({ script }: QAst): Entity[] {
  const scopes = new Set(script.map((entity) => getNameScope(entity)));
  console.log(scopes);
  return [];
}

export function tooManyLocals({ script }: QAst): Entity[] {
  const scopes = new Set(script.map((entity) => getNameScope(entity)));
  console.log(scopes);
  return [];
}
