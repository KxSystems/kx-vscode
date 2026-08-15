# CLAUDE.md

## Overview

The **kdb VS Code extension** (`KX.kdb`) — an IDE for the q language and the kdb
product suite (KDB-X, kdb Insights Enterprise, kdb+ Personal Edition): edit
q/Python/SQL, connect to multiple kdb processes, run queries, view results.

## Build & Development Commands

Install with `npm ci`, not `npm install` — [package.json](package.json) pins
every dependency to an absolute version and the lockfile is authoritative.
`update-deps` bumps patch levels only.

```bash
npm ci                 # Install locked dependencies
npm run build          # Bundle all targets with esbuild (sourcemaps) → out/
npm run watch          # Same, in watch mode (use during development)
npm run lint           # eslint --fix (enforces license headers + import order)
npm run format         # prettier --write "**/*.ts"
npm run package        # vsce package → .vsix
```

F5 launches the Extension Development Host (needs a prior `build` or `watch`).

### Tests

**Mocha**, with **Sinon** for stubs and **proxyquire**/**mock-fs** for module
and filesystem mocking. Tests compile first (`pretest`/`tsc` → `out-test/`) and
run inside a real VS Code instance via `@vscode/test-electron`; `test/suite/`
mirrors the `src/` layout.

```bash
npm run test                      # Full integration suite (test/suite/**)
npm run test:file <path>          # Single test file (TEST_FILE env)
npm run test:folder <path>        # A folder of tests (TEST_FOLDER env)
npm run test:e2e                  # End to end suite (test/e2e/**), TEST_FILE env narrows it
npm run coverage                  # Same suite under c8 coverage
npm run q-test                    # q-language unit tests — runs in the qpbuild docker image (no local q needed)
```

Every suite that launches VS Code (all but `q-test`) needs
`ELECTRON_RUN_AS_NODE` **unset** — some terminals export it, and Electron then
starts as plain node and fails in a way that hides the cause:
`bad option: --no-sandbox` (exit 9), or
`Cannot find module .../test/e2e/workspace` for `test:e2e`. Prefix the command
with `env -u ELECTRON_RUN_AS_NODE`.

`test:e2e` opens its own VS Code window on `test/e2e/workspace` and drives the
extension through its real commands with nothing stubbed — real workspace
settings, real language server. Stand-ins replace everything outside the
extension and record what they are sent: `fakeq/bin/q` for the REPL (reached
through `kdb.qHomeDirectoryWorkspace`, writing a `.transcript.log` per REPL),
`test/e2e/qserver.ts`, an in-process kdb+ IPC server for connections, and
`test/e2e/insightsServer.ts`, an Insights instance over HTTPS with a
self-signed certificate (`test/e2e/certs/`, generated on the first run) whose
reported version selects the endpoint group under test — with the browser the
OAuth code flow opens replaced in `test/e2e/insights.ts`. macOS and Linux only
— on Windows the REPL spawns q through `cmd.exe`, which cannot run the
stand-in. See
[docs/developer/development.md](docs/developer/development.md).

`q-test` wraps [qcumber.sh](qcumber.sh), which runs the tests in the `qpbuild`
image (pykx set up by `test/q/preTest.sh`). The image lives in a private GitLab
registry: the script pulls with whatever credentials docker already has (in CI,
a `docker/login-action` step), and only on failure authenticates from
`GITLAB_TOKEN` (a PAT with `read_registry`) or an interactive prompt and retries
once. It also needs a kdb+ license as `KDB_K4LICENSE_B64` (a CI secret); if that
is unset, `qcumber.sh` encodes a `k4.lic` found at `$QLIC/`, `$QHOME/`, then
`~/.kx/` — so an existing `$QLIC`/`$QHOME` needs no setup. A `kc.lic` will not
work.

## Architecture

Four separately-bundled entry points (see [esbuild.mjs](esbuild.mjs)), all
outputting to `out/`:

1. **Extension host** — [src/extension.ts](src/extension.ts) (CJS, Node). The
   activation entry point.
2. **Language server** — [server/src/server.ts](server/src/server.ts) (CJS,
   Node). A separate process spoken to via LSP.
3. **Webviews** — [src/webview/main.ts](src/webview/main.ts) (ESM, browser).
   Lit + Shoelace components.
4. **Webview CSS** — from `src/webview/styles/`.

### Extension host (`src/`)

- **[extension.ts](src/extension.ts)** — `activate()` wires up tree providers,
  webview providers, custom editors, the notebook controller, the LSP client and
  all commands. Commands are declared as `CommandRegistration[]` arrays grouped
  by domain (`registerConnectionsCommands`, `registerScratchpadCommands`, …) and
  registered in bulk; the _implementations_ live in `src/commands/`.
- **[extensionVariables.ts](src/extensionVariables.ts)** — the `ext` namespace,
  a global singleton holding shared state (active connections, tree providers,
  telemetry, secret storage, output channel). Referenced pervasively; treat it
  as the extension's service locator.
- **`src/classes/`** — connection implementations: `LocalConnection` (q/kdb+
  over IPC via `node-q`), `InsightsConnection` (kdb Insights Enterprise over
  REST/WebSocket), `ReplConnection`.
- **`src/services/`** — VS Code providers: tree data, webview/custom-editor,
  notebook, completion/quickfix.
- **`src/commands/`**, **`src/models/`**, **`src/utils/`**,
  **`src/validators/`** — command handlers, data models, helpers (config,
  telemetry, secret storage, execution console) and input validators.

### Language server (`server/src/`)

q language features over LSP. Parsing uses **Chevrotain** in
`server/src/parser/` (lexer, tokens, parser, semantic checks); `qlint` rules
live in `server/src/linter/`. The client connects in `extension.ts`
(`documentSelector` = language `q`, including q cells in `kx-notebook`).

### q runtime scripts (`resources/q/`)

`.q` scripts (`vscode.q`, `evaluateQ.q`, `evaluatePy.q`, `secure.q`, …) are
injected into connected q processes to define the API the extension calls.
[build-api.js](build-api.js) assembles `out/vscode.q` from `vscode.q`, inlining
the others via `//{{path/to/file.q}}` placeholders. See
[secure-processes.md](secure-processes.md) for the `.vscode` namespace security
model used by locked-down processes.

### File types & features

Custom file types the extension owns: `.kdb.json` (Datasource editor), `.plot`
(Chart viewer), `.kxnb` (KX Notebook), `.kdb.q`/`.kdb.py`/`.kdb.sql`
(Workbooks/scratchpads). Each workbook/datasource is mapped to a connection and
execution target via the `kdb.connectionMap`/`kdb.targetMap` workspace settings.

### Documentation (`docs/`)

In-tree docs in the
[Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/):
markdown with YAML frontmatter (`type` required; `title`, `description`, `tags`,
`timestamp` optional), an `index.md` per folder, relative cross-links (not
`github.com/.../wiki/` URLs — these pages superseded the wiki). Split into
[docs/user/](docs/user/) and [docs/developer/](docs/developer/), screenshots
under `docs/images/`. End-user product documentation is hosted separately at
`https://code.kx.com/vscode/`.

New pages need OKF frontmatter and a link from the enclosing `index.md`. Keep
[docs/user/reference-card.md](docs/user/reference-card.md) — the canonical
reference card — in sync when commands, keybindings, settings or telemetry
events change.

## Conventions

- **License header**: every `.ts` file must start with the Apache 2.0 header
  block, with the current year (ESLint `license-header/header`) — copy it from
  any existing source file.
- **Imports**: ESLint enforces `import/order` — builtin/external first, then
  internal, alphabetized, newline between groups. Run `npm run lint` before
  committing.
- **Formatting**: Prettier (`printWidth: 80`, `bracketSameLine: true`).
- **Dependencies**: pin every package to an absolute version (no `^`/`~`) and
  commit the updated `package-lock.json`.
- **Branching**: PRs target `dev` (the default branch), not `main`.
- **Commit messages**: a single line, no body and no `Co-Authored-By` trailer.
  Lead with the affected area, then a comma-separated summary, e.g.
  `REPL: add word nav/delete keys, route orphan files to active REPL, dedupe query normalization`.
- **Squashing**: interactive rebase isn't available here — soft-reset instead,
  e.g. `git reset --soft HEAD~4 && git commit -m "REPL: …"`.
- Versions containing `rc` (e.g. `1.19.0-rc`) disable telemetry automatically.
