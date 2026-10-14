#!/usr/bin/env node
// Client for the manual-test driver. See README.md for the command list.
const { spawn } = require("child_process");
const { fs, path, p, ensure, readJson, sleep, isAlive } = require("./lib/common");

const USAGE = `usage: node cli.js <command> [args]
  start [--ext dir] [--workspace dir] [--vscode ver] [--keep] [--settings '{json}']
  stop | status
  snapshot                         compact state of the whole window
  palette "<text>" [pick-number]   run a command-palette item
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
Any command accepts --json '{...}' to pass raw arguments.`;

const argsFor = (cmd, r, o) => {
  const n = (v) => (v === undefined ? undefined : /^\d+$/.test(v) ? Number(v) : v);
  switch (cmd) {
    case "palette": return { text: r[0], pick: r[1] && Number(r[1]) };
    case "key": return { keys: r };
    case "type": case "qi.type": case "qi.pick": case "editor.type": case "editor.set": return { text: r[0] };
    case "click": return { sel: r[0], button: o.right ? "right" : undefined, dbl: !!o.dbl };
    case "button": return { text: r[0] };
    case "wv.text": return r.length > 1 ? { wv: n(r[0]), sel: r[1] } : /^\d+$/.test(r[0] || "") ? { wv: n(r[0]) } : { sel: r[0] };
    case "wv.controls": return { wv: n(r[0]) };
    case "wv.click": return { wv: n(r[0]), sel: r[1] };
    case "wv.fill": case "wv.select": return { wv: n(r[0]), sel: r[1], value: r[2] };
    case "wv.check": return { wv: n(r[0]), sel: r[1], checked: r[2] !== "false" };
    case "wv.eval": return { wv: n(r[0]), js: r[1] };
    case "term.read": return { lines: r[0] && Number(r[0]) };
    case "term.send": return { text: r[0], enter: !o["no-enter"] };
    case "file.open": return { name: r[0] };
    case "wait": return { kind: r[0], match: r[1], timeout: o.timeout && Number(o.timeout), wv: n(o.wv) };
    case "shot": return { name: r[0], sel: o.sel };
    case "log": return { lines: r[0] && Number(r[0]) };
    case "eval": return { js: o.file ? fs.readFileSync(o.file, "utf8") : r[0] };
    default: return {};
  }
};

async function rpc(cmd, args) {
  const st = readJson(p("state.json"));
  if (!st || !isAlive(st.pid)) throw new Error("driver not running: run `node cli.js start` first");
  const res = await fetch(`http://127.0.0.1:${st.port}/`, {
    method: "POST",
    headers: { "x-token": st.token },
    body: JSON.stringify({ cmd, args }),
    signal: AbortSignal.timeout(120000),
  });
  return res.json();
}

async function start(argv) {
  const st = readJson(p("state.json"));
  if (st && isAlive(st.pid)) return `already running (pid ${st.pid}); run stop first`;
  fs.rmSync(p("start-error.txt"), { force: true });
  ensure(p("."));
  const log = fs.openSync(p("driver.log"), "w");
  const child = spawn(process.execPath, [path.join(__dirname, "driver.js"), "serve", ...argv], {
    detached: true, stdio: ["ignore", log, log], windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const s = readJson(p("state.json"));
    if (s && isAlive(s.pid)) return `started. workspace=${s.workspace} extension=${s.extension}\n` + (await rpc("snapshot", {})).result;
    if (!isAlive(child.pid)) break;
  }
  const err = fs.existsSync(p("start-error.txt")) ? fs.readFileSync(p("start-error.txt"), "utf8") : fs.readFileSync(p("driver.log"), "utf8");
  throw new Error("driver failed to start:\n" + err.slice(0, 1500));
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help") return console.log(USAGE);
  const raw = [], o = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--") && !(cmd === "start" && false)) {
      const k = a.slice(2), nx = rest[i + 1];
      if (nx === undefined || nx.startsWith("--")) o[k] = true; else (o[k] = nx), i++;
    } else raw.push(a);
  }
  if (cmd === "start") {
    const pass = [];
    for (const [k, v] of Object.entries(o)) pass.push("--" + k, ...(v === true ? [] : [v]));
    return console.log(await start(pass));
  }
  if (cmd === "status") {
    const st = readJson(p("state.json"));
    return console.log(st && isAlive(st.pid) ? `running pid=${st.pid} workspace=${st.workspace} extension=${st.extension}` : "not running");
  }
  const args = o.json ? JSON.parse(o.json) : argsFor(cmd, raw, o);
  const r = await rpc(cmd, args);
  if (r.error) { console.error("ERR " + r.error); process.exit(1); }
  console.log(r.result);
})().catch((e) => (console.error("ERR " + e.message), process.exit(1)));
