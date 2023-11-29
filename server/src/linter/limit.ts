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

import { Entity, EntityType, QAst } from "../parser";

const DEFAULT_MAX_LINE_LENGTH = 200;
const DEFAULT_MAX_LOCALS = 23;
const DEFAULT_MAX_GLOBALS = 31;
const DEFAULT_MAX_CONSTANTS = 95;

export function lineLength({ symbols }: QAst): Entity[] {
  const problems: Entity[] = [];

  const eols = symbols.filter((symbol) => symbol.type === EntityType.EOL);

  for (let i = 0; i < eols.length; i++) {
    const start = i === 0 ? 0 : eols[i - 1].endOffset;

    if (eols[i].endOffset - start > DEFAULT_MAX_LINE_LENGTH) {
      problems.push(eols[i]);
    }
  }

  return problems;
}

export function tooManyConstants({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}

export function tooManyGlobals({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}

export function tooManyLocals({ symbols }: QAst): Entity[] {
  console.log(symbols);
  return [];
}
