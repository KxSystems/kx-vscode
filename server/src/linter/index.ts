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

import { Diagnostic } from "vscode-languageserver";
import { Token } from "../parser";
import { rangeFromToken } from "../util";
import { Rules } from "./rules";

const enabled = [
  "DEPRECATED_DATETIME",
  "ASSIGN_RESERVED_WORD",
  "INVALID_ASSIGN",
  "FIXED_SEED",
  "INVALID_ESCAPE",
  "UNUSED_PARAM",
  "UNUSED_VAR",
  "DECLARED_AFTER_USE",
];

export function lint(tokens: Token[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  Rules.filter(
    (rule) => rule.check && enabled.indexOf(rule.code) !== -1,
  ).forEach((rule) =>
    rule.check!(tokens).forEach((token) =>
      diagnostics.push(
        Diagnostic.create(
          rangeFromToken(token),
          rule.message,
          rule.severity,
          rule.code,
          "tsqlint",
        ),
      ),
    ),
  );
  return diagnostics;
}
