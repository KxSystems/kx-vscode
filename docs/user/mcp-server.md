---
type: Guide
title: MCP Server
description:
  How the kdb extension's MCP server lets AI agents in VS Code run read-only q
  on the connections you allow.
tags: [kdb, vscode, mcp, ai, agents, copilot]
timestamp: 2026-11-20
---

# MCP Server

The extension includes a
[Model Context Protocol](https://modelcontextprotocol.io) server, so AI agents
in VS Code (GitHub Copilot, Codex, Claude Code) can query the q processes you
have connected to and allowed. In this version access is **read only**: an agent
can query data but can't change it.

## What an agent can use

The server only uses a connection that is both:

1. **allowed**: MCP access is turned on for that connection, and
2. **connected**: you have connected to it in the kdb explorer in this window.

It never opens, reopens or logs in to a connection itself, and both conditions
are checked on every call. Passwords never pass through MCP. Only kdb+/KDB-X
connections are supported; Insights connections aren't yet.

## Read-only access

Every MCP call is evaluated with q's `reval`. The agent's code can't:

- assign, insert into, update or redefine globals;
- write files;
- read files outside the q process's working directory;
- run system commands, `exit`, or `hopen` a file.

This needs kdb+ 4.0 (2020.03.17) or later, or KDB-X. On a process locked down
with the `.vscode` API (see [secure-processes.md](../../secure-processes.md)),
its `vscode.q` must be version 1.1.0 or later. If a process can't enforce read
only, MCP calls to it are refused; they never run with write access instead.
Python (`p)`) code is refused.

Because of this, you load the data yourself, at q startup or from a workbook.
Start q in the folder that holds any files the agent should read. A segmented
database with partitions outside the working directory fails with `'access`.

`reval` guards against accidents. It isn't a sandbox for hostile code. In
particular it doesn't restrict:

- embedded Python (embedPy or PyKX), which can do anything the q process can;
- what another process does with a message sent to it over an open handle.

The extension refuses code that uses `p)`, `.p.`, `.pykx.` or `hopen`, but that
check is a safety net, not a complete filter. Only allow MCP access on processes
where an agent making a mistake would be acceptable.

## Tools

| Tool               | What it does                                                                      |
| :----------------- | :-------------------------------------------------------------------------------- |
| `list_connections` | The connections that are allowed and connected, with their access mode (`read`).  |
| `run_q`            | Runs q on a connection, read only, and returns console-style text or the q error. |

Every call is logged to the **kdb** output channel.

## Allowing a connection

Right-click a kdb connection in the kdb explorer and choose **Allow MCP access
(read only)**. The first time, a confirmation explains what this means. Allowed
connections show **MCP** in the explorer. Access is saved across restarts, and
can be allowed whether or not the connection is open.

- **Remove MCP access** on the same menu takes effect immediately; the agent's
  next call is refused, and your own connection stays open.
- **KX: Remove MCP access from all connections** turns it off everywhere.
- Deleting a connection, renaming it or changing its host or port removes its
  access.

## Turning it on

- The `kdb.mcp.enabled` setting (on by default) is the master switch. Turning it
  off stops the server and refuses all MCP access, keeping each connection's
  choice.
- The server listens on `127.0.0.1` only, and only in trusted workspaces. It
  starts when a connection that's allowed for MCP is connected in the window,
  and stops when the last one is disconnected or loses its access, or the window
  closes. Agents show the server as unavailable while it's stopped.
- Every request needs a bearer token, which is kept in VS Code's secret storage
  and shared by all windows. **KX: Regenerate MCP token** replaces it.

### Ports

Each workspace keeps its own port, so an agent config made for a workspace stays
valid across sessions, and windows open at the same time don't clash.

- The first time a workspace's server starts, it uses `kdb.mcp.port` (default
  `7464`), or the next free port if another workspace already has that one. The
  port is then saved for the workspace, on this machine only; it never appears
  in `.vscode/settings.json`.
- If the saved port is taken, a notification says what holds it (another
  window's kdb MCP server, named by its workspace, or another program) and
  offers **Use port N**, **Choose port…** or **Don't start**. The port you pick
  is saved.
- Setting `kdb.mcp.port` in the workspace's settings overrides the saved port.
  If that port is taken, the server doesn't start, and you choose another in the
  setting.
- With no folder open, the port lasts for the session only.

### Copilot

Copilot needs no setup: the extension registers the server with VS Code, which
gives Copilot the address and token. VS Code asks you to trust the server the
first time it's used.

### Claude Code

Claude Code reads its own config, so it needs the server's address and token.
Run **KX: Generate MCP config** and pick one:

- **Claude Code: command**: a `claude mcp add` command to run in a terminal.
- **Claude Code: .mcp.json entry**: to paste into `.mcp.json` in the project
  folder.

Both contain the token, so keep them out of source control. Each workspace has
its own entry (`kdb-<workspace>`). After **KX: Regenerate MCP token**, generate
the config again.
