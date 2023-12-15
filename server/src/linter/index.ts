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

import { Token, QAst } from "../parser";
import { RuleSeverity, Rules } from "./rules";

const enabled = [
  "ASSIGN_RESERVED_WORD",
  "INVALID_ASSIGN",
  //"DECLARED_AFTER_USE",
  "UNUSED_PARAM",
  "UNUSED_VAR",
  "TOO_MANY_CONSTANTS",
  "TOO_MANY_GLOBALS",
  "TOO_MANY_LOCALS",
  "DEPRECATED_DATETIME",
];

export interface LintResult {
  name: string;
  message: string;
  severity: RuleSeverity;
  problems: Token[];
}

export function lint(ast: QAst) {
  return Rules.filter((rule) => enabled.find((name) => rule.name === name))
    .map((rule) => {
      const result: LintResult = {
        name: rule.name,
        message: rule.message,
        severity: rule.severity,
        problems: rule.check(ast),
      };
      return result;
    })
    .filter((result) => result.problems.length > 0);
}
