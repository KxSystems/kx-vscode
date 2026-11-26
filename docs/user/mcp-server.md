---
type: Guide
title: MCP Server
description:
  How the kdb extension's MCP server lets AI agents in VS Code run q on the
  connections you allow.
tags: [kdb, vscode, mcp, ai, agents, copilot]
timestamp: 2026-11-20
---

# MCP Server

The extension includes a
[Model Context Protocol](https://modelcontextprotocol.io) server, so AI agents
in VS Code (GitHub Copilot, Codex, Claude Code) can query the q processes you
have connected to and allowed. An agent can run q on those connections, and the
q it runs can change data and files on that process.

## What an agent can use

The server only uses a connection that is both:

1. **allowed**: MCP access is turned on for that connection, and
2. **connected**: you have connected to it in the kdb explorer in this window.

It never opens, reopens or logs in to a connection itself, and both conditions
are checked on every call. Passwords never pass through MCP. Only kdb+/KDB-X
connections are supported; Insights connections aren't yet.

## Tools

| Tool               | What it does                                                          |
| :----------------- | :-------------------------------------------------------------------- |
| `list_connections` | The connections that are allowed and connected.                       |
| `run_q`            | Runs q on a connection and returns console-style text or the q error. |

- Output longer than `kdb.mcp.maxOutputChars` (default 20000) is cut short, and
  the agent is told to narrow the query.
- A query still running after `kdb.mcp.queryTimeoutSeconds` (default 60) is
  reported as timed out. The extension can't cancel it, so it may still be
  running in q, and later queries on that connection wait behind it.

Every call is logged to the **kdb** output channel.

## Query timeout on the q process

`kdb.mcp.queryTimeoutSeconds` (default 60) is the time q gets to run an agent
query. With `\T` set to the same value, q stops the query at that limit and
returns `'stop`. The extension waits 2 seconds longer than the setting, only so
that the error can reach it; that is not extra time for q. If q's `\T` is
shorter, q stops the query first.

The agent is told which of two things happened:

- **q confirmed the stop.** q returned `'stop` at its `\T` limit: "The q process
  stopped the query after its 60-second execution limit." The query is no longer
  running. q also returns `'stop` for an interrupt or from application code, so
  a `'stop` that doesn't arrive at about the `\T` limit is reported as stopped,
  not timed out.
- **q didn't answer.** The extra 2 seconds ran out with no response: "The query
  exceeded its configured 60-second execution budget, and q did not respond
  within the additional 2-second grace period. q did not confirm that execution
  stopped, so the query may still be running." Later queries on that connection
  wait behind it.

The grace period makes the second case rarer but can't rule it out: not every
native function, plugin or blocking system call responds to `\T` promptly, and
without `\T` nothing stops the query.

To have q itself stop agent queries that run too long, set a query timeout on
the process with `\T` (for example `\T 60`, or start q with `-T 60`). The first
time the MCP server serves a connection, the extension reads its `\T` and warns
when it is 0 (no timeout), or longer than `kdb.mcp.queryTimeoutSeconds`.

The extension never changes `\T`. It is process-wide: it stops every client's
long queries, not only the agent's, so setting it is left to whoever runs the
process. A locked-down process that refuses `system` calls is skipped.

### Agent tool timeout

The agent has its own deadline for an MCP tool call. If it gives up first, it
never sees the result or q's error.

> **The agent's MCP tool timeout must be greater than
> `kdb.mcp.queryTimeoutSeconds` + 2 seconds**.

- **Codex**: configs from **Generate MCP config** set `tool_timeout_sec` to the
  setting plus 12 (72 by default), since Codex's own default of 60 is too short.
  Regenerate the config after changing the setting.
- **Other agents** (Claude Code, Copilot): the generated config can't set a
  timeout for them, so set it in the agent. Claude Code reads it from the
  `MCP_TOOL_TIMEOUT` environment variable, in milliseconds, for example
  `MCP_TOOL_TIMEOUT=72000`. For Copilot, check its MCP settings.

## Allowing a connection

Right-click a kdb connection in the kdb explorer and choose **Allow MCP
access**. The first time, a confirmation explains what this means. Allowed
connections show **MCP** in the explorer. Access is saved across restarts, and
can be allowed whether or not the connection is open. Renaming a connection
keeps its access; changing its host or port, or removing it, clears access.

- **Remove MCP access** on the same menu takes effect immediately; the agent's
  next call is refused, and your own connection stays open.
- **KX: Remove MCP access from all connections** turns it off everywhere.
- Deleting a connection, renaming it or changing its host or port removes its
  access.

## Turning it on

- The `kdb.mcp.enabled` setting (on by default) is the master switch. Turning it
  off stops the server, blocks all agent access and hides the MCP commands; the
  connections you allowed stay allowed for when you turn it back on.
- The server listens on `127.0.0.1` only, and only in trusted workspaces. It
  starts when a connection that's allowed for MCP is connected in the window,
  and stops when the last one is disconnected or loses its access, or the window
  closes. Agents show the server as unavailable while it's stopped.
- Every request needs a bearer token, which is kept in VS Code's secret storage
  and shared by all windows. **KX: Regenerate MCP token** replaces it.

### Ports

Each workspace keeps its own port, so an agent config made for a workspace stays
valid across sessions. A second window on a workspace that already runs the
server doesn't take its port over: it leaves the server running and doesn't
start its own.

- The first time a workspace's server starts, it uses `kdb.mcp.port` (default
  `7464`). The port is then saved for the workspace, on this machine only; it
  never appears in `.vscode/settings.json`. That first start also offers **Copy
  MCP config**.
- If the default is held by another workspace's saved port, or by another
  program, a notification says what holds it and offers **Use port N**, **Choose
  port…** or **Don't start**. Suggested ports start 10 above the taken one, to
  stay clear of the ports next to it. The port you pick is saved.
- If another window for the same workspace already serves on the port, this
  window says so once and doesn't start. AI agents in this window may still
  reach the other window's server, and then use its connections and access, not
  this window's. It tries again the next time it connects, so a window that
  dropped without closing (WSL or SSH) recovers once its port is free.
- **KX: Show MCP servers** lists each workspace and its saved port. You can copy
  a config for any of them, or forget a port. Forget the port for another
  workspace; a window can't forget the port it's using.
- Setting `kdb.mcp.port` in the workspace's settings overrides the saved port.
  If that port is taken, the server doesn't start, and you choose another in the
  setting.
- With no folder open, the port lasts for the session only.

Changing a saved port tells you the Codex and Claude Code configs need
generating again.

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

### Choosing the config

Run **KX: Generate MCP config**, pick the agent, then pick where the token comes
from. **Token from environment variable** is recommended:

1. Paste the config into `.mcp.json` (Claude Code) or `~/.codex/config.toml`
   (Codex). It doesn't contain the token, so it doesn't change when the token is
   regenerated.
2. Click **Copy export line** on the notification and add the line to
   `~/.bashrc` (WSL or Linux), or set `KDB_MCP_TOKEN` as a Windows user
   environment variable.
3. Restart the terminal or agent so it sees the variable.

After **KX: Regenerate MCP token**, copy a new export line, replace the old one,
and restart the terminal or agent. The config files stay as they are.
