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

import { Token, QAst, TokenType } from "../parser";

export function deprecatedDatetime({ script }: QAst): Token[] {
  return script.filter((entity) => entity.name === "DateTimeLiteral");
}

export function invalidEscape({ script }: QAst): Token[] {
  return script
    .filter((entity) => entity.name === "CharLiteral")
    .filter((entity) => {
      const image = entity.image;
      let match = image.match(/(?:\\\\|\\)/g);
      const count = match ? match.length : 0;
      if (count > 0) {
        match = image.match(/\\(?:\d{3}|[\\"rnt/])/g);
        if (count !== (match ? match.length : 0)) {
          return true;
        }
      }
      return false;
    });
}

export function fixedSeed({ script }: QAst): Token[] {
  const problems: Token[] = [];

  for (let i = 0; i < script.length; i++) {
    const token = script[i];
    if (token.type === TokenType.OPERATOR && token.image === "?") {
      let next = script[i + 1];
      if (next && next.image === "0Ng") {
        next = script[i - 1];
        if (next && next.name === "NumberLiteral") {
          const val = parseInt(next.image);
          if (val > 0) {
            problems.push(next);
          }
        }
      }
    }
  }

  return problems;
}
