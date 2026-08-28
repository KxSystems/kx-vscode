---
type: Developer Note
title: What the End to End Suite Covers
description: A short map of what npm run test:e2e asserts, and what it cannot reach.
tags: [kdb, vscode, testing, e2e]
timestamp: 2026-08-21
---

# What the End to End Suite Covers

`npm run test:e2e` drives the extension in a real VS Code window against
stand-in processes. See [Development](development.md) for how it is wired up.
This page is the map of what it actually asserts.

## Covered

- **Running code** — q, SQL and Python, from a file, a workbook, a `.quke` file
  and a notebook, on the REPL, a kdb+ connection and an Insights connection.
  Whole file, selection, current line, and the block under the cursor.
- **Where code runs** — the file's assigned connection, the last focused KX
  terminal, and the REPL by default. Files outside the workspace included.
- **The REPL** — typing at the prompt, recall, Ctrl+C, Ctrl+D, Ctrl+L, dropping
  a file on it, and several REPLs across folders.
- **Connecting** — the kdb+ handshake with and without credentials, the
  Insights OAuth code flow over a self-signed certificate, and being offered a
  connection when the file's one is not connected.
- **Insights by version** — which endpoints and request bodies each instance
  from 1.10 to 1.18 gets, with query environments on and off.
- **The scratchpad** — the log websocket, resetting it, and the execution
  timeout each request carries.
- **Results** — the grid, paging, structured text, the console, and the CSV
  export.
- **The q language** — definition, references, call hierarchy, folding,
  completion, selection expand and the parameter cache, against the real
  language server.
- **Panels** — the welcome page and the new connection form, driven as real
  components.

## Not covered

- **Anything a tree view draws.** VS Code exposes no API for another
  extension's tree items, so connection categories, query history entries and
  their icons and colours are asserted in `test/suite` instead. What a tree
  item's command *does* is still covered here.
- **Datasources and UDAs** — neither the editor nor the queries they send.
- **Importing and exporting connections.** The workspace turns the system file
  dialog into a quick pick, which a test can accept — but only the `defaultUri`
  it was opened on, since keystrokes do not reach it. These two commands pass
  no `defaultUri`, so there is nothing to accept.
- **The output channel**, which cannot be read back.
- **Windows**, where the REPL spawns q through `cmd.exe` and cannot run the
  stand-in.
