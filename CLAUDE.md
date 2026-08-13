# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Overview

This is the **kdb VS Code extension** (`KX.kdb`) — an IDE for the q programming
language and the kdb product suite (KDB-X, kdb Insights Enterprise, kdb+
Personal Edition). It lets users edit q/Python/SQL, connect to multiple kdb
processes, run queries, and view results.

## Build & Development Commands

Dependencies are pinned in `package-lock.json` — install with `npm ci` (respects
the lockfile exactly) rather than `npm install`. Every dependency in
[package.json](package.json) is an **absolute version** (e.g.
`"eslint": "9.39.4"`) — no `^`/`~` semver ranges. `update-deps` bumps only
patch-level versions.

```bash
npm ci                 # Install locked dependencies
npm run build          # Bundle all targets with esbuild (sourcemaps) → out/
npm run watch          # Same, in watch mode (use during development)
npm run lint           # eslint --fix (enforces license headers + import order)
npm run format         # prettier --write "**/*.ts"
npm run package        # vsce package → .vsix
```

Press F5 in VS Code to launch the Extension Development Host (requires a prior
`npm run build` or `npm run watch`).

### Tests

The primary test suite runs inside a real VS Code instance via
`@vscode/test-electron`. Tests must be compiled first (`pretest`/`tsc` →
`out-test/`), then run:

```bash
npm run test                      # Full integration suite (test/suite/**)
npm run test:file <path>          # Single test file (TEST_FILE env)
npm run test:folder <path>        # A folder of tests (TEST_FOLDER env)
npm run coverage                  # Same suite under c8 coverage
npm run ui-test                   # End-to-end UI tests via vscode-extension-tester (test/ui/**)
npm run q-test                    # q-language unit tests — runs in the qpbuild docker image (no local q needed)
```

`q-test` wraps [qcumber.sh](qcumber.sh), which runs the tests inside the
`qpbuild` image and sets up pykx via `test/q/preTest.sh`. The image lives in a
private GitLab registry — if it isn't already local, the script pulls it,
relying on whatever credentials docker already has (this is how CI authenticates
— a `docker/login-action` step runs before `qcumber.sh`). Only if that pull
fails does it authenticate itself — from `GITLAB_TOKEN` (a GitLab PAT with the
`read_registry` scope) or an interactive prompt — and retry once. It also needs
a kdb+ license passed to the container as `KDB_K4LICENSE_B64` (this is how CI
passes it, from a secret). If that env var is unset, `qcumber.sh` base64-encodes
a `k4.lic` file, looked up as `$QLIC/k4.lic`, `$QHOME/k4.lic`, then
`~/.kx/k4.lic` — so if you already have `$QLIC`/`$QHOME` set there's nothing to
configure. (A `kc.lic` will not work; the tests need a `k4.lic`.)

Test framework is **Mocha** with **Sinon** for stubs and
**proxyquire**/**mock-fs** for module and filesystem mocking. Tests mirror the
`src/` layout under `test/suite/`.

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

- **[extension.ts](src/extension.ts)** — `activate()` wires up everything: tree
  providers, webview providers, custom editors, notebook controller, the LSP
  client, and all commands. Commands are declared as `CommandRegistration[]`
  arrays grouped by domain (`registerConnectionsCommands`,
  `registerScratchpadCommands`, etc.) and registered in bulk. Command
  _implementations_ live in `src/commands/`.
- **[extensionVariables.ts](src/extensionVariables.ts)** — the `ext` namespace,
  a global singleton holding shared state (active connections, tree providers,
  telemetry, secret storage, output channel). Referenced pervasively; treat it
  as the extension's service locator.
- **`src/classes/`** — connection implementations: `LocalConnection` (q/kdb+
  process over IPC via `node-q`), `InsightsConnection` (kdb Insights Enterprise
  over REST/WebSocket), `ReplConnection`.
- **`src/services/`** — VS Code providers: tree data providers
  (`kdbTreeProvider`, `workspaceTreeProvider`), webview/custom-editor providers
  (`dataSourceEditorProvider`, `chartEditorProvider`, `resultsPanelProvider`),
  notebook providers, completion/quickfix providers.
- **`src/commands/`** — command handler logic (server, workspace, datasource,
  client/LSP, buildtools, setup).
- **`src/models/`**, **`src/utils/`**, **`src/validators/`** — data models,
  helpers (config, telemetry, secret storage, execution console), and input
  validators.

### Language server (`server/src/`)

An LSP server providing q language features. Parsing is done with **Chevrotain**
in `server/src/parser/` (lexer, tokens, parser, semantic checks). Linting rules
for `qlint` live in `server/src/linter/`. The client connects to it in
`extension.ts` (`documentSelector` = language `q`, including q cells in
`kx-notebook`).

### q runtime scripts (`resources/q/`)

`.q` scripts (`vscode.q`, `evaluateQ.q`, `evaluatePy.q`, `secure.q`, etc.) are
injected into connected q processes to define the API the extension calls.
[build-api.js](build-api.js) assembles `out/vscode.q` from `vscode.q`, inlining
other scripts via `//{{path/to/file.q}}` placeholders. See
[secure-processes.md](secure-processes.md) for the `.vscode` namespace security
model used by locked-down processes.

### File types & features

Custom file types the extension owns: `.kdb.json` (Datasource editor), `.plot`
(Chart viewer), `.kxnb` (KX Notebook), `.kdb.q`/`.kdb.py`/`.kdb.sql`
(Workbooks/scratchpads). Each workbook/datasource is mapped to a connection and
execution target via the `kdb.connectionMap`/`kdb.targetMap` workspace settings.

### Documentation (`docs/`)

In-tree docs, ported from the (now-superseded) GitHub wiki and structured in the
[Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/):
plain markdown files with YAML frontmatter (`type` required; `title`,
`description`, `tags`, `timestamp` optional), an `index.md` per folder for
navigation, and relative markdown cross-links. Split into
[docs/user/](docs/user/) (reference card, q home directory, PyKX-in-REPL, sample
notebooks) and [docs/developer/](docs/developer/) (setup, notifications,
execution flow, telemetry), with screenshots under `docs/images/`. The
end-user product documentation is hosted separately at
`https://code.kx.com/vscode/`.

- [docs/user/reference-card.md](docs/user/reference-card.md) is the canonical
  reference card (command palette, keybindings, settings, execution matrix,
  telemetry events) — it replaced the former root `ref_card.md`. Keep it in sync
  when commands, keybindings, settings, or telemetry events change.
- When adding a page, give it OKF frontmatter and link it from the enclosing
  `index.md`. Use relative links between pages, not `github.com/.../wiki/` URLs.

## Conventions

- **License header**: every `.ts` file must start with the Apache 2.0 header
  block (ESLint `license-header/header` enforces it, with the current year). New
  files will fail lint without it — copy the header from any existing source
  file.
- **Imports**: ESLint enforces `import/order` — builtin/external first, then
  internal, alphabetized, with newlines between groups. Run `npm run lint`
  before committing.
- **Formatting**: Prettier (`printWidth: 80`, `bracketSameLine: true`).
- **Dependencies**: pin every package to an absolute version (no `^`/`~` ranges)
  and commit the updated `package-lock.json`.
- **Branching**: PRs target `dev` (the default branch), not `main`.
- **Commit messages**: a single line, no body/newlines and no `Co-Authored-By`
  trailer. Lead with the affected area, then a comma-separated summary of what
  changed, e.g.
  `REPL: add word nav/delete keys, route orphan files to active REPL, dedupe query normalization`.
- **Squashing**: interactive rebase isn't available here — squash with a soft
  reset instead, then re-commit in the style above, e.g.
  `git reset --soft HEAD~4 && git commit -m "REPL: add word nav/delete keys, route orphan files to active REPL, dedupe query normalization"`.
- Versions containing `rc` (e.g. `1.19.0-rc`) disable telemetry automatically.
