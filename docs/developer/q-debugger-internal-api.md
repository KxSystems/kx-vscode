---
type: Developer Note
title: q Debugger Internal API Usage
description: Which q internal/debug API entrypoints the debug adapter uses, what for, and which documented symbols are deliberately avoided or unused.
tags: [kdb, vscode, debugger, q, dap]
timestamp: 2026-07-15
---

# q Debugger Internal API Usage

The q debugger is a VS Code Debug Adapter (DAP) implementation that drives a
connected q process. Rather than reaching for q's raw frame-pointer primitives,
it works entirely through the **high-level `.Q` layer plus text control commands
written to the process's stdin**.

## Where the code lives

- [src/classes/qDebugSession.ts](../../src/classes/qDebugSession.ts) — the DAP
  session logic (breakpoints, stepping, scopes).
- [src/classes/qDebugDriver.ts](../../src/classes/qDebugDriver.ts) — the
  low-level driver that writes control commands to q's stdin and parses the
  prompt.
- [src/utils/qBacktrace.ts](../../src/utils/qBacktrace.ts) — parser for
  `.Q.bt[]` output.
- [resources/q/debug.q](../../resources/q/debug.q) — the `.dbg.locals` helper
  injected into the debuggee.

## APIs the debugger uses

### Breakpoints (`.Q` user API)

- **`.Q.bs[f;0]`** — arms a trap at each target function's *entry* (bytecode
  index 0). The adapter then single-steps from entry to reach the requested
  source line.
  [qDebugSession.ts:719](../../src/classes/qDebugSession.ts#L719)
- **`.Q.bu[f;i]`** — recovers the original bytecode when a breakpoint is removed
  or the session tears down. Used *instead of* `.Q.bd`.
  [qDebugSession.ts:387](../../src/classes/qDebugSession.ts#L387),
  [qDebugSession.ts:729](../../src/classes/qDebugSession.ts#L729)

### Stack / position (`.Q` api)

- **`.Q.bt[]`** — called two ways: `frames()` parses it into the full stack, and
  `position()` parses it for the current file/line/caret.
  [qDebugDriver.ts:238](../../src/classes/qDebugDriver.ts#L238),
  [qDebugDriver.ts:244](../../src/classes/qDebugDriver.ts#L244); parsers in
  [qBacktrace.ts](../../src/utils/qBacktrace.ts).

### Control commands (written to q's stdin)

| Command | Purpose | Reference |
| --- | --- | --- |
| `` ` `` | frame up | [qDebugDriver.ts:228](../../src/classes/qDebugDriver.ts#L228) |
| `.` | frame down | [qDebugDriver.ts:233](../../src/classes/qDebugDriver.ts#L233) |
| `>` | single-step (also advances entry → breakpoint line) | [qDebugDriver.ts:222](../../src/classes/qDebugDriver.ts#L222) |
| `:` | continue / resume from breakpoint | [qDebugDriver.ts:253](../../src/classes/qDebugDriver.ts#L253) |
| `\` | abort — unwind nested debugger levels back to the top prompt (`abortToTop`, `popTo`) | [qDebugDriver.ts:263](../../src/classes/qDebugDriver.ts#L263), [qDebugDriver.ts:331](../../src/classes/qDebugDriver.ts#L331) |

### Locals (custom helper)

- **`.dbg.locals`** — reads `value f` (param/local name indices) and emits JSON
  via `.j.j`, written to stdout with `neg[1]` so the payload is never elided at
  the console width (`\c` truncates displayed values, not handle writes).
  Injected into the debuggee before the user program and used to name locals in
  the Scopes view, rather than dereferencing frames with `Lp`.
  [debug.q:16](../../resources/q/debug.q#L16),
  [qDebugSession.ts:755](../../src/classes/qDebugSession.ts#L755)
- **`.dbg.vals`** — renders a frame-locals dict as JSON the same way, replacing
  any value larger than `.dbg.cap` serialized bytes (`-22!`) with a type/count
  summary so a huge table or vector is never serialized in full.
  [debug.q](../../resources/q/debug.q)

### Scratchpad / query path (not the DAP debugger)

A separate, non-DAP path reports query errors with a captured stack trace:

- **`.Q.trp`** — protected eval with a stack-trace-capturing error handler.
  [evaluateQ.q:108](../../resources/q/evaluateQ.q#L108)
- **`.Q.sbt`** — formats the captured backtrace for display.
  [evaluateQ.q:121](../../resources/q/evaluateQ.q#L121)

## Deliberately avoided

- **`.Q.bd`** — its `.Q.BP` bookkeeping signals `'length` on current KDB-X
  builds, so `.Q.bu` is used to remove breakpoints instead. See the comment at
  [qDebugSession.ts:382](../../src/classes/qDebugSession.ts#L382).

## Unused entirely

The debugger never touches the raw frame-pointer layer or the interactive
debugger entrypoints:

- L-namespace: `Ll`, `Lp`, `Lx`, `Lu`, `Ls`
- `.Q.prr`, `.Q.srr`, `.Q.dbg`, `.Q.err`
- `.Q.bc`
- `.Q.pl`, `.Q.btx`, `.Q.dr`, `.Q.dw`
- the `'s` (throw) control command
- `.z.ex`, `.z.ey`
