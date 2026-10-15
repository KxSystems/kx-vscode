// Long-lived daemon: owns one real VS Code window (via Playwright) and answers
// commands from cli.js over 127.0.0.1 HTTP with a per-run token.
const http = require("http");
const crypto = require("crypto");
const { _electron: electron } = require("playwright-core");
const { downloadAndUnzipVSCode } = require("@vscode/test-electron");
const {
  fs,
  path,
  REPO,
  TOOL,
  p,
  ensure,
  sleep,
  parseArgs,
} = require("./lib/common");
const { makeHandlers } = require("./lib/handlers");

const SETTINGS = {
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "security.workspace.trust.enabled": false,
  "window.dialogStyle": "custom", // keep dialogs in the DOM
  "files.simpleDialog.enable": true, // file pickers in the DOM
  "terminal.integrated.gpuAcceleration": "off", // DOM renderer: text readable
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "chat.disableAIFeatures": true,
  "editor.minimap.enabled": false,
};

async function main() {
  const a = parseArgs(process.argv.slice(3));
  const ext = path.resolve(a.ext || REPO);
  if (!fs.existsSync(path.join(ext, "package.json")))
    throw new Error(`no extension at ${ext}`);
  const main = JSON.parse(
    fs.readFileSync(path.join(ext, "package.json"), "utf8"),
  ).main;
  if (main && !fs.existsSync(path.join(ext, main)))
    throw new Error(`${main} missing in ${ext}: run "npm run build" first`);

  const exe = await downloadAndUnzipVSCode({
    cachePath: ensure(p(".vscode-test")),
    version: a.vscode || "stable",
  });

  const ud = p("ud");
  if (!a.keep) fs.rmSync(ud, { recursive: true, force: true });
  ensure(path.join(ud, "User"));
  fs.writeFileSync(
    path.join(ud, "User", "settings.json"),
    JSON.stringify({ ...SETTINGS, ...(a.settings ? JSON.parse(a.settings) : {}) }, null, 2),
  );

  let ws = a.workspace && path.resolve(a.workspace);
  if (!ws) {
    ws = p("workspace");
    fs.rmSync(ws, { recursive: true, force: true });
    fs.cpSync(path.join(TOOL, "fixtures"), ws, { recursive: true });
  }

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  if (process.env.MT_LD_LIBRARY_PATH)
    env.LD_LIBRARY_PATH = process.env.MT_LD_LIBRARY_PATH;

  const app = await electron.launch({
    executablePath: exe,
    env,
    args: [
      ws,
      "--extensionDevelopmentPath=" + ext,
      "--disable-extensions-except=" + ext,
      "--user-data-dir=" + ud,
      "--extensions-dir=" + ensure(p("extensions")),
      "--no-sandbox",
      "--disable-gpu",
      "--disable-workspace-trust",
      "--skip-release-notes",
    ],
  });
  const win = await app.firstWindow();
  await win.waitForSelector(".monaco-workbench", { timeout: 90000 });
  // First-run onboarding modal (two steps); harmless if absent.
  await win
    .getByText("Continue without Signing In")
    .click({ timeout: 8000 })
    .catch(() => {});
  await win
    .getByText("Get Started", { exact: true })
    .click({ timeout: 3000 })
    .catch(() => {});
  // Let extensions finish activating so first-run UI (e.g. the extension's
  // Welcome tab) has appeared before the first command.
  await win
    .waitForFunction(() => !/Activating Extensions/.test(document.querySelector(".statusbar")?.innerText || ""), null, { timeout: 30000 })
    .catch(() => {});
  await sleep(3000);

  const token = crypto.randomBytes(16).toString("hex");
  const ctx = { app, win, ws, ext, ud, exe, shotsDir: ensure(p("shots")) };
  const handlers = makeHandlers(ctx);
  let quitting = false;
  const quit = async () => {
    if (quitting) return;
    quitting = true;
    await app.close().catch(() => {});
    fs.rmSync(p("state.json"), { force: true });
    process.exit(0);
  };
  app.on("close", quit);

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const send = (code, obj) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.headers["x-token"] !== token) return send(403, { error: "bad token" });
      try {
        const { cmd, args } = JSON.parse(body);
        if (cmd === "stop") {
          send(200, { result: "stopping" });
          return quit();
        }
        const h = handlers[cmd];
        if (!h) return send(400, { error: `unknown command ${cmd}` });
        send(200, { result: await h(args || {}) });
      } catch (e) {
        send(200, { error: String((e && e.message) || e).split("\n").slice(0, 6).join("\n") });
      }
    });
  });
  server.listen(0, "127.0.0.1", () => {
    // Holds the RPC token, and `eval` runs arbitrary code: owner-only (POSIX).
    fs.writeFileSync(
      p("state.json"),
      JSON.stringify({
        port: server.address().port,
        token,
        pid: process.pid,
        workspace: ws,
        extension: ext,
        vscode: exe,
      }),
      { mode: 0o600 },
    );
  });
}

main().catch((e) => {
  fs.writeFileSync(p("start-error.txt"), String((e && e.stack) || e));
  console.error(e);
  process.exit(1);
});

