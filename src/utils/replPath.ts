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

import path from "node:path";

/**
 * Build the KX module search path (`QPATH`) for a REPL based in `baseFsPath`.
 * Prepends the base directory's `mod` folder so `use` resolves project-local
 * modules, keeping any existing `QPATH` (or the global `$QHOME/mod`) as a
 * fallback so global modules still resolve.
 */
export function moduleSearchPath(
  baseFsPath: string,
  currentQPath: string | undefined,
  qhome: string | undefined,
  delimiter: string = path.delimiter,
): string {
  const modPath = path.join(baseFsPath, "mod");
  const fallback = currentQPath || (qhome ? path.join(qhome, "mod") : "");
  return fallback ? `${modPath}${delimiter}${fallback}` : modPath;
}
