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

// Case-fold only where the filesystem is case-insensitive. We compare segments
// ourselves rather than leaning on `path.relative`, which is inherently
// case-insensitive on the win32 `path` module regardless of `process.platform`.
function segments(fsPath: string): string[] {
  const fold = process.platform === "win32";
  return path
    .normalize(fsPath)
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((seg) => (fold ? seg.toLowerCase() : seg));
}

/**
 * True when `targetFsPath` is `baseFsPath` itself or lives beneath it. Separator
 * and sibling-prefix safe (e.g. `/ws/foo` does not contain `/ws/foobar`).
 */
export function pathContains(
  baseFsPath: string,
  targetFsPath: string,
): boolean {
  const base = segments(baseFsPath);
  const target = segments(targetFsPath);
  if (target.length < base.length) {
    return false;
  }
  return base.every((seg, i) => seg === target[i]);
}

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

/**
 * Pick the most-specific (longest base directory) live candidate whose base
 * directory contains `targetFsPath`. Candidates without a base directory (the
 * DEFAULT REPL) or that have exited are ignored.
 */
export function selectRepl<T extends { baseFsPath?: string; exited: boolean }>(
  targetFsPath: string,
  candidates: Iterable<T>,
): T | undefined {
  let best: T | undefined;
  let bestLength = -1;
  for (const candidate of candidates) {
    const base = candidate.baseFsPath;
    if (candidate.exited || !base) {
      continue;
    }
    if (base.length > bestLength && pathContains(base, targetFsPath)) {
      best = candidate;
      bestLength = base.length;
    }
  }
  return best;
}
