/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import type { PythonEnvironment } from "@vscode/python-environments";

const SAFE_POSIX = /^[\w@+=:,./-]+$/;
const SAFE_CMD = /^[\w@+:./\\-]+$/;
const PREFIX = "KX_REPL_ARG_";

function unwrap(arg: string, shell: string) {
  const quoted = shell === "cmd" ? /^"(.*)"$/s : /^(?:"(.*)"|'(.*)')$/s;
  const match = quoted.exec(arg);
  return match ? (match[1] ?? match[2]) : arg;
}

export function quote(arg: string, shell: string, env: Record<string, string>) {
  const value = unwrap(arg, shell);
  if ((shell === "cmd" ? SAFE_CMD : SAFE_POSIX).test(value)) return value;
  let index = 0;
  while (PREFIX + index in env) index++;
  const name = PREFIX + index;
  env[name] = value;
  return shell === "cmd" ? `"%${name}%"` : `"$${name}"`;
}

export function activationCommand(
  environment: PythonEnvironment,
  shell: string,
  env: Record<string, string>,
): string {
  const { shellActivation, activation } = environment.execInfo;
  const commands =
    shellActivation?.get(shell) ??
    shellActivation?.get("unknown") ??
    activation;
  return (commands ?? [])
    .map(({ executable, args = [] }) =>
      [executable, ...args].map((arg) => quote(arg, shell, env)).join(" "),
    )
    .join(" && ");
}
