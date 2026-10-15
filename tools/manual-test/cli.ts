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

// Client for the manual-test driver. See README.md for the command list.
import { spawn } from "node:child_process";

import { fs, path, p, ensure, readJson, sleep, isAlive } from "./lib/common.ts";

const USAGE = `usage: node cli.ts <command> [args]
  start [--ext dir] [--workspace dir] [--vscode ver (default: pinned in driver.ts)] [--keep] [--settings '{json}']
  stop | status
  snapshot                         compact state of the whole window
  palette "<exact title>"          run a command-palette item (exact title only)
  key <Key> [<Key>...]             e.g. Control+S Escape
  type "<text>"                    type into the focused control
  click "<text | css | role=...>"  click in the workbench
  qi.type "<text>" | qi.pick "<text>" | qi.enter | esc   quick input / pickers
  button "<text>"                  click a notification or dialog button
  wv.list | wv.text [wv] [css] | wv.controls [wv] | wv.click <wv> <sel>
  wv.fill <wv> <sel> <value> | wv.select <wv> <sel> <value> | wv.check <wv> <sel> [false]
  wv.eval <wv> "<js expr>"         wv = index, text it contains, or omitted (= visible one)
  term.read [lines] | term.send "<text>" [--no-enter]
  editor.read | editor.set "<text>" | editor.type "<text>" | file.open <name>
  wait <term|snapshot|editor|webview> "<regex>" [--timeout ms] [--wv n]
  shot [name] [--sel css]          screenshot -> prints the png path
  log [lines]                      tail of the extension's kdb.log
  eval "<js>" | eval --file f.js   Playwright escape hatch: win, app, ctx, sleep
Any command accepts --json '{...}' to pass raw arguments.
Commands that print a snapshot also take --settle <ms> (default 700; raise it
for slow UI) and --no-snap. Only the flags above are flags: other text starting
with "--" is passed as text, and "--" ends flag parsing.`;

const BOOL_FLAGS = new Set(["keep", "right", "dbl", "no-enter", "no-snap"]);
const VALUE_FLAGS = new Set([
  "ext",
  "workspace",
  "vscode",
  "settings",
  "timeout",
  "wv",
  "sel",
  "json",
  "file",
  "settle",
]);

type Flags = Record<string, string | true>;

const argsFor = (cmd: string, r: string[], o: Flags): Record<string, any> => {
  const n = (v?: string) =>
    v === undefined ? undefined : /^\d+$/.test(v) ? Number(v) : v;
  switch (cmd) {
    case "palette":
      return { text: r[0] };
    case "key":
      return { keys: r };
    case "type":
    case "qi.type":
    case "qi.pick":
    case "editor.type":
    case "editor.set":
      return { text: r[0] };
    case "click":
      return {
        sel: r[0],
        button: o.right ? "right" : undefined,
        dbl: !!o.dbl,
      };
    case "button":
      return { text: r[0] };
    case "wv.text":
      return r.length > 1
        ? { wv: n(r[0]), sel: r[1] }
        : /^\d+$/.test(r[0] || "")
          ? { wv: n(r[0]) }
          : { sel: r[0] };
    case "wv.controls":
      return { wv: n(r[0]) };
    case "wv.click":
      return { wv: n(r[0]), sel: r[1] };
    case "wv.fill":
    case "wv.select":
      return { wv: n(r[0]), sel: r[1], value: r[2] };
    case "wv.check":
      return { wv: n(r[0]), sel: r[1], checked: r[2] !== "false" };
    case "wv.eval":
      return { wv: n(r[0]), js: r[1] };
    case "term.read":
      return { lines: r[0] && Number(r[0]) };
    case "term.send":
      return { text: r[0], enter: !o["no-enter"] };
    case "file.open":
      return { name: r[0] };
    case "wait":
      return {
        kind: r[0],
        match: r[1],
        timeout: o.timeout && Number(o.timeout),
        wv: n(o.wv as string | undefined),
      };
    case "shot":
      return { name: r[0], sel: o.sel };
    case "log":
      return { lines: r[0] && Number(r[0]) };
    case "eval":
      return { js: o.file ? fs.readFileSync(o.file as string, "utf8") : r[0] };
    default:
      return {};
  }
};

async function rpc(cmd: string, args: Record<string, any>) {
  const st = readJson(p("state.json"));
  if (!st || !isAlive(st.pid))
    throw new Error("driver not running: run `node cli.ts start` first");
  const res = await fetch(`http://127.0.0.1:${st.port}/`, {
    method: "POST",
    headers: { "x-token": st.token },
    body: JSON.stringify({ cmd, args }),
    signal: AbortSignal.timeout(120000),
  });
  return (await res.json()) as { result?: string; error?: string };
}

async function start(argv: string[]) {
  const st = readJson(p("state.json"));
  if (st && isAlive(st.pid))
    return `already running (pid ${st.pid}); run stop first`;
  fs.rmSync(p("start-error.txt"), { force: true });
  ensure(p("."));
  const log = fs.openSync(p("driver.log"), "w");
  const child = spawn(
    process.execPath,
    [path.join(import.meta.dirname, "driver.ts"), "serve", ...argv],
    {
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
    },
  );
  child.unref();
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const s = readJson(p("state.json"));
    if (s && isAlive(s.pid))
      return (
        `started. workspace=${s.workspace} extension=${s.extension}\n` +
        (await rpc("snapshot", {})).result
      );
    if (child.pid === undefined || !isAlive(child.pid)) break;
  }
  const err = fs.existsSync(p("start-error.txt"))
    ? fs.readFileSync(p("start-error.txt"), "utf8")
    : fs.readFileSync(p("driver.log"), "utf8");
  throw new Error("driver failed to start:\n" + err.slice(0, 1500));
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help") return console.log(USAGE);
  // Only known flags are flags: anything else (e.g. "--- comment") is text, and
  // everything after a bare `--` is text too.
  const raw: string[] = [];
  const o: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--") {
      raw.push(...rest.slice(i + 1));
      break;
    }
    const k = a.startsWith("--") ? a.slice(2) : "";
    if (BOOL_FLAGS.has(k)) o[k] = true;
    else if (VALUE_FLAGS.has(k)) {
      if (rest[i + 1] === undefined) throw new Error(`--${k} needs a value`);
      o[k] = rest[++i];
    } else raw.push(a);
  }
  if (cmd === "start") {
    const pass: string[] = [];
    for (const [k, v] of Object.entries(o))
      pass.push("--" + k, ...(v === true ? [] : [v]));
    return console.log(await start(pass));
  }
  if (cmd === "status") {
    const st = readJson(p("state.json"));
    return console.log(
      st && isAlive(st.pid)
        ? `running pid=${st.pid} workspace=${st.workspace} extension=${st.extension}`
        : "not running",
    );
  }
  const args = o.json ? JSON.parse(o.json as string) : argsFor(cmd, raw, o);
  if (o.settle) args.settle = Number(o.settle);
  if (o["no-snap"]) args.snap = false;
  const r = await rpc(cmd, args);
  if (r.error) {
    console.error("ERR " + r.error);
    process.exit(1);
  }
  console.log(r.result);
})().catch((e) => (console.error("ERR " + e.message), process.exit(1)));
