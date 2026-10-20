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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOOL = path.resolve(import.meta.dirname, "..");
const REPO = path.resolve(TOOL, "..", "..");
const WORK = process.env.MT_WORK || path.join(TOOL, ".work");

const p = (...a: string[]) => path.join(WORK, ...a);
const ensure = (d: string) => (fs.mkdirSync(d, { recursive: true }), d);
const readJson = (f: string) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isAlive(pid: number) {
  try {
    // Despite the name, this doesn't kill the process, just "sends" a null signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Parsed command line: positional args in `_`, `--flag [value]` by name. */
interface ParsedArgs {
  _: string[];
  [flag: string]: any;
}

/** Minimal `--flag value` / `--flag` parser; positional args go in `_`. */
function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith("--")) out[k] = true;
      else {
        out[k] = nxt;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

export {
  fs,
  os,
  path,
  TOOL,
  REPO,
  WORK,
  p,
  ensure,
  readJson,
  sleep,
  isAlive,
  parseArgs,
};
export type { ParsedArgs };
