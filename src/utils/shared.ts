/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

export function normalizeAssemblyTarget(assemblyTarget: string): string {
  if (!assemblyTarget?.trim()) {
    return "";
  }

  const parts = assemblyTarget.trim().split(/\s+/);
  const [dirtyAssembly, ...rest] = parts;
  const assembly = dirtyAssembly.replace(/-qe$/, "");

  return [assembly, ...rest].join(" ");
}

export function stripUnprintableChars(text: string): string {
  return text
    .replace(/\p{Cc}/gu, "")
    .replace(/\p{Co}/gu, "")
    .replace(/\p{Cn}/gu, "");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : `${error}`;
}
