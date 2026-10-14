const fs = require("fs");
const os = require("os");
const path = require("path");

const TOOL = path.resolve(__dirname, "..");
const REPO = path.resolve(TOOL, "..", "..");
const WORK = process.env.MT_WORK || path.join(TOOL, ".work");

const p = (...a) => path.join(WORK, ...a);
const ensure = (d) => (fs.mkdirSync(d, { recursive: true }), d);
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAlive(pid) {
  try {
    // Despite the name, this doesn't kill the process, just "sends" a null signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Minimal `--flag value` / `--flag` parser; positional args go in `_`. */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith("--")) out[k] = true;
      else (out[k] = nxt), i++;
    } else out._.push(a);
  }
  return out;
}

module.exports = {
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
