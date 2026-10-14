#!/usr/bin/env node
// Start/stop real q processes for manual testing. A listening port ALWAYS gets
// a -U users file: this tool refuses to start an unauthenticated q.
//
//   node qserver.js start [--port 5000] [--user tester] [--password pw] [--q <path>]
//   node qserver.js stop [--port 5000]      (no --port: stop all)
//   node qserver.js list
const { spawn, execFileSync } = require("child_process");
const net = require("net");
const {
  fs,
  os,
  path,
  p,
  ensure,
  readJson,
  sleep,
  isAlive,
  parseArgs,
} = require("./lib/common");

const dir = () => ensure(p("q"));
const stateFile = (port) => path.join(dir(), `q-${port}.json`);

function findQ(explicit) {
  const cands = [explicit, process.env.QBIN];
  const exe = process.platform === "win32" ? "q.exe" : "q";
  const home = os.homedir();
  cands.push(path.join(home, ".kx", "bin", exe));
  if (process.env.QHOME) {
    const sub = { win32: "w64", darwin: "m64", linux: "l64" }[process.platform];
    cands.push(path.join(process.env.QHOME, sub, exe));
  }
  try {
    const w = execFileSync(
      process.platform === "win32" ? "where" : "which",
      ["q"],
      { encoding: "utf8" },
    )
      .split(/\r?\n/)[0]
      .trim();
    if (w) cands.push(w);
  } catch {}
  for (const c of cands) if (c && fs.existsSync(c)) return c;
  throw new Error("q not found: pass --q <path> or set QBIN");
}

function probe(port) {
  return new Promise((res) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => (s.destroy(), res(true)));
    s.once("error", () => res(false));
  });
}

async function start(a) {
  const port = Number(a.port || 5000);
  if (readJson(stateFile(port)) && isAlive(readJson(stateFile(port)).keeper))
    throw new Error(`a q is already managed on port ${port}; stop it first`);
  if (await probe(port)) throw new Error(`port ${port} is already in use`);
  const user = a.user || "tester";
  const password =
    a.password || "pw" + Math.random().toString(36).slice(2, 10);
  const users = path.join(dir(), `users-${port}.txt`);
  fs.writeFileSync(users, `${user}:${password}\n`);
  const q = findQ(a.q);
  const keeper = spawn(
    process.execPath,
    [__filename, "_keeper", String(port), q, users],
    { detached: true, stdio: "ignore", cwd: dir(), windowsHide: true },
  );
  keeper.unref();
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (await probe(port)) {
      const st = readJson(stateFile(port));
      return { port, user, password, q, pid: st && st.pid, host: "127.0.0.1" };
    }
  }
  throw new Error("q did not start listening within 10s (licence problem?)");
}

// Long-lived parent that owns q's stdin, so q does not exit on EOF.
function keeper(port, q, users) {
  const child = spawn(q, ["-p", port, "-U", users], {
    stdio: ["pipe", "ignore", "ignore"],
    cwd: dir(),
    windowsHide: true,
  });
  fs.writeFileSync(
    stateFile(port),
    JSON.stringify({ port, keeper: process.pid, pid: child.pid, users }),
  );
  child.on("exit", () => {
    fs.rmSync(stateFile(port), { force: true });
    process.exit(0);
  });
  process.on("SIGTERM", () => child.kill());
  setInterval(() => {}, 1 << 30);
}

function stop(a) {
  const files = fs.readdirSync(dir()).filter((f) => /^q-\d+\.json$/.test(f));
  const out = [];
  for (const f of files) {
    const st = readJson(path.join(dir(), f));
    if (!st || (a.port && Number(a.port) !== st.port)) continue;
    for (const pid of [st.pid, st.keeper])
      try {
        process.kill(pid);
      } catch {}
    fs.rmSync(path.join(dir(), f), { force: true });
    fs.rmSync(st.users, { force: true });
    out.push(st.port);
  }
  return { stopped: out };
}

function list() {
  return fs
    .readdirSync(dir())
    .filter((f) => /^q-\d+\.json$/.test(f))
    .map((f) => readJson(path.join(dir(), f)))
    .filter((s) => s && isAlive(s.pid))
    .map((s) => ({ port: s.port, pid: s.pid }));
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  if (cmd === "_keeper") keeper(rest[0], rest[1], rest[2]);
  else
    Promise.resolve(
      cmd === "start" ? start(a) : cmd === "stop" ? stop(a) : list(),
    )
      .then((r) => console.log(JSON.stringify(r)))
      .catch((e) => (console.error("ERR " + e.message), process.exit(1)));
}
