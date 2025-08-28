/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import { SyntaxError, Token } from "./utils";

export function checkEscape(token: Token) {
  let value;

  switch (token.image.slice(1)) {
    case "n":
    case "r":
    case "t":
    case "\\":
    case "/":
    case '"':
      break;
    default:
      value = parseInt(token.image.slice(1));
      if (!value || value < 100 || value > 377) {
        token.error = SyntaxError.InvalidEscape;
      }
      break;
  }
}
