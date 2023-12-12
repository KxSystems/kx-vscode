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

const DEFAULT_MAX_LINE_LENGTH = 200;
const DEFAULT_MAX_LOCALS = 110;
const DEFAULT_MAX_GLOBALS = 110;
const DEFAULT_MAX_CONSTANTS = 239;

export function lineLength({ script }: QAst): Token[] {
  const problems: Token[] = [];

  const symbols = script.filter(
    (entity) => entity.type === TokenType.SEMICOLON
  );

  for (let i = 0; i < symbols.length; i++) {
    const start = i === 0 ? 0 : symbols[i - 1].endOffset;

    if (symbols[i].endOffset - start > DEFAULT_MAX_LINE_LENGTH + 1) {
      problems.push(symbols[i]);
    }
  }

  return problems;
}

export function tooManyConstants({ script }: QAst): Token[] {
  const counts = new Map<Token, number>();

  script
    .filter((entity) => scope(entity))
    .forEach((entity) => {
      if (entity.type === TokenType.IDENTIFIER) {
        const scoped = scope(entity);
        if (scoped) {
          let count = counts.get(scoped);
          if (!count) {
            count = 0;
          }
          count++;
          counts.set(scoped, count);
        }
      }
    });

  const problems: Token[] = [];

  for (const entry of counts.entries()) {
    if (entry[1] > DEFAULT_MAX_CONSTANTS) {
      problems.push(entry[0]);
    }
  }

  return problems;
}

export function tooManyGlobals({ script, assign }: QAst): Token[] {
  const counts = new Map<Token, number>();

  const globals = assign.filter((entity) => !scope(entity));

  script
    .filter((entity) => scope(entity))
    .forEach((entity) => {
      const scoped = scope(entity);
      if (scoped) {
        let count = counts.get(scoped);
        if (!count) {
          count = 0;
        }
        if (globals.find((symbol) => symbol.image === entity.image)) {
          count++;
        }
        counts.set(scoped, count);
      }
    });

  const problems: Token[] = [];

  for (const entry of counts.entries()) {
    if (entry[1] > DEFAULT_MAX_GLOBALS) {
      problems.push(entry[0]);
    }
  }

  return problems;
}

export function tooManyLocals({ assign }: QAst): Token[] {
  const counts = new Map<Token, number>();

  assign
    .filter((entity) => scope(entity))
    .forEach((entity) => {
      const scoped = scope(entity);
      if (scoped) {
        let count = counts.get(scoped);
        if (!count) {
          count = 0;
        }
        if (
          assign.find(
            (symbol) =>
              scope(symbol) === scoped && entity.image === symbol.image
          )
        ) {
          count++;
        }
        counts.set(scoped, count);
      }
    });

  const problems: Token[] = [];

  for (const entry of counts.entries()) {
    if (entry[1] > DEFAULT_MAX_LOCALS) {
      problems.push(entry[0]);
    }
  }

  return problems;
}
