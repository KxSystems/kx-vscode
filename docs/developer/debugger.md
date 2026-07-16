---
type: Developer Note
title: The q Debugger
description:
  How the q debug adapter works — the shared process transport, the parser's
  role, the q internal/.dbg API (used and deliberately unused), the execution
  and stepping model, and known limitations.
tags: [kdb, vscode, debugger, q, dap]
timestamp: 2026-07-16
---

# The q Debugger

The extension ships a source-level debugger for q programs, implemented as a VS
Code **Debug Adapter (DAP)**. It does not fork its own q — it drives the **same
live q process that backs the program's REPL**, so breakpoints, stepping, locals
and watches all act on the real session the user is working in.

There is no bytecode-level breakpoint API in q that maps source lines to stops,
and the interactive debugger exposes only a handful of single-character control
commands over the prompt. The adapter therefore composes three things:

1. a **transport** that speaks to q's interactive debugger over stdin/stdout;
2. a **parser** (the language server's) that recovers lambda and statement
   structure from source text; and
3. a small set of **`.dbg.*` q helpers** injected into the debuggee that wrap
   q's `.Q` breakpoint primitives.

## Where the code lives

| File                                                                 | Role                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [src/classes/qDebugSession.ts](../../src/classes/qDebugSession.ts)   | The DAP session: launch, breakpoints, stepping, scopes, locals, watch.      |
| [src/classes/qDebugDriver.ts](../../src/classes/qDebugDriver.ts)     | The transport: spawns/drives q, one-command-at-a-time prompt state machine. |
| [src/classes/replConnection.ts](../../src/classes/replConnection.ts) | Owns the shared q process; the debugger borrows its `QDebugDriver`.         |
| [resources/q/debug.q](../../resources/q/debug.q)                     | The `.dbg.*` helpers, loaded into the debuggee at startup.                  |
| [src/utils/qBacktrace.ts](../../src/utils/qBacktrace.ts)             | Parses `.Q.bt[]` / `>`-step output into frames and the current position.    |
| [src/utils/qLocals.ts](../../src/utils/qLocals.ts)                   | Maps a source line to the enclosing lambda `(name, nested-path)`.           |
| [src/utils/qStatements.ts](../../src/utils/qStatements.ts)           | Splits a program into top-level statements for one-at-a-time loading.       |

## The shared process and the transport

The debugger and the REPL share one `QDebugDriver`, which owns a plain piped
child process (no PTY, no native module). Two environment flags shape q's
behaviour over the pipe:

- **`KX_TTY=1`** makes q act as if attached to a tty, so it prints its prompt
  (`q)`, `q.ns)`, and one extra `)` per nested debugger suspension — `q))`,
  `q)))`) and its interactive debugger engages on an error or a trap.
- **`KX_LINE=0`** turns off q's readline echo, so the stream is clean line
  output and a command's response is exactly what q printed.

### One stream, one command at a time

Two properties of the transport are load-bearing and were the subject of real
bugs; both are enforced in [qDebugDriver.ts](../../src/classes/qDebugDriver.ts):

- **`2>&1` — merge stderr into stdout.** q writes a command's _result_ to stdout
  but its _prompt_ (and the debugger's `>` / backtrace traffic) to stderr. As
  two separate OS pipes their `data` events can arrive out of order, so the
  prompt could be seen before the output it terminates — the prompt matcher
  would then resolve a command with empty output and the real output would leak
  into the next command (e.g. a second `.Q.bt[]` in a row read as empty).
  Redirecting stderr into stdout gives one byte-ordered stream and removes the
  race.
- **Serialized writes (`pump`).** The next command is written only _after_ the
  previous command's prompt has been consumed (`pump` → `drain` → `pump`). This
  prevents two commands' outputs from coalescing in the buffer, which — with the
  end-anchored prompt regex — would let one command's matcher greedily swallow
  the next command's output and strand its promise unresolved (a hang). This
  matters because the REPL and the debugger issue commands into the same driver
  concurrently (e.g. a terminal-resize `\c` racing a debugger step).

The debug session adds a _second_, higher layer of serialization (`serialized`):
a DAP request is a multi-command sequence (navigate frame → evaluate → pop
back), and two such sequences must not interleave on the one shared prompt or
they would evaluate in the wrong frame. `settle` is the same lock but swallows
the "process exited" rejection that a mid-request shutdown produces (the DAP
framework leaves a rejected request-handler promise unhandled).

### Control commands

All debugger control is text written to q's stdin and awaited to the next
prompt:

| Command     | Purpose                                                                    | Driver method            |
| ----------- | -------------------------------------------------------------------------- | ------------------------ |
| `>`         | single-step one bytecode; echoes the new frame + line + `^` caret          | `stepPosition`           |
| `:`         | continue / resume from a breakpoint (runs to the next trap or program end) | `continueFromBreakpoint` |
| `` ` ``     | move the current frame up (towards the entry)                              | `up`                     |
| `.`         | move the current frame down (towards the innermost)                        | `down`                   |
| `\`         | abort one debugger level; looped to unwind to the top prompt               | `abortToTop` / `reset`   |
| `.Q.bt[]`   | dump the backtrace                                                         | `frames` / `position`    |
| `\l <file>` | load a (line-padded) statement file                                        | `load`                   |
| `\c r c`    | console size — kept in step with the terminal (REPL, not the debugger)     | —                        |

`interrupt()` sends `SIGINT` to the child (REPL Ctrl+C); it does not go through
the prompt queue.

## The parser's role

q offers no way to ask "which lambda / statement is this source line in", yet
almost every adapter decision needs exactly that. The **language-server
Chevrotain parser** ([server/src/parser](../../server/src/parser)) is reused
(via [qLocals.ts](../../src/utils/qLocals.ts) and
[qStatements.ts](../../src/utils/qStatements.ts)) to recover that structure from
source text — statically, before or between executions:

- **`splitTopLevelStatements`** — splits the program into top-level statements
  so they can be loaded one at a time (see the execution model below).
- **`lambdaPathAt(text, line)`** — the key primitive: it returns the lambda
  enclosing a line as an **outermost function name plus a source-order descent
  path** of nested-lambda indices (`[]` = the named function itself, `[0]` = its
  first nested `{…}` constant, …). This is what lets the adapter arm a
  breakpoint on the _right_ lambda, name the _right_ frame's locals, and resolve
  a step-in target — all without a global name for nested lambdas.
- **`lambdaStatementSeparators` / `statementId`** — the `;` boundaries of a
  lambda, used by step-over to tell two statements on the same source line apart
  and to detect a loop back-edge.
- **`statementStart`** — snaps q's `^` caret (which lands at an inconsistent
  sub-token offset) to the start of the statement it points into, so VS Code
  marks the statement, not just the line.

**Why static parsing rather than asking q?** q's value/bytecode representation
does not carry a reliable bytecode→source-line map, and its `^` caret is coarse.
Parsing the source is the only way to go from a _line_ (what DAP speaks) to a
_lambda identity_ (what the trap primitives need).

**A limit of the line-based view:** a nested lambda's _definition_ lines belong
to that lambda in the source, but when the _parent_ executes the definition (the
assignment) control is still in the parent's frame. So a source line alone is
ambiguous for "which frame am I in". Stepping therefore relies on q's **frame
index** for depth decisions (below), and uses the parser only for same-frame
statement boundaries.

## The `.dbg.*` helpers and the `.Q` API

The adapter deliberately works through the **high-level `.Q` breakpoint layer
plus text control commands** — never q's raw frame-pointer primitives. The
[debug.q](../../resources/q/debug.q) helpers are injected into the debuggee
before the user program.

### Breakpoints — entry traps on lambdas

Traps are always set at a lambda's **entry (bytecode index 0)** — always a valid
stop. The adapter then single-steps from entry to the requested source line
(`advanceToBreakpoint`), using q's own reported line, so placement is correct
even inside `if`/`while`/`do`/`$` constructs where a static offset map would not
be. Crucially, **`>` single-stepping does not descend into nested lambda
calls**, so a breakpoint inside a nested lambda needs its _own_ entry trap on
that lambda, not the outer function's.

- **`.dbg.nested[nm;path]`** — resolves the (possibly deeply nested) lambda from
  the outermost function name `nm` and a source-order descent `path`. A nested
  lambda has no global name but is stored as a `type 100h` constant of its
  parent's `value`; trapping the returned value patches the parent's embedded
  instance _in place_ (q shares the constant by reference).
- **`.dbg.bs[nm;path]`** → `.Q.bs[…;0]` — arm the entry trap. The static
  line→`(name,path)` mapping comes from `lambdaPathAt`.
- **`.dbg.bu[nm;path]`** → `.Q.bu[…;0]` — recover the original bytecode when a
  breakpoint is removed or the session ends. Used **instead of `.Q.bd`** (see
  _Deliberately avoided_). Leaving `0xff` traps in the REPL's functions would
  corrupt them.
- **`.dbg.childidx[nm;f]`** — the source-order index of the nested lambda of
  `nm` whose value is `f`, or null. Used by **step-in** to resolve a _local_
  lambda call (`f: {…}; f[]`) to a `(nm;path)`: the adapter passes the local's
  live value (evaluated in the suspended frame) and gets back the child index to
  arm. Only direct children are matched; a deeper local falls back to step-over.

### Stack / position — `.Q.bt[]`

`.Q.bt[]` is parsed two ways by [qBacktrace.ts](../../src/utils/qBacktrace.ts):
`frames()` builds the full call stack; `position()` extracts the current
`file:line`, the `^` caret column, and — importantly — the **frame index**
(`QPosition.index`), the call-stack depth used to detect crossing a call
boundary while stepping. The `>` step echoes the same frame shape, so a step
reads its new position without a separate `.Q.bt[]` round-trip.

### Locals — `.dbg.locals`, `.dbg.vals`

- **`.dbg.locals[nm;path]`** — the param + local _names_ of the frame's lambda,
  read from its `value` (params at index 1, locals at index 2) and emitted as
  JSON. It resolves the lambda via `.dbg.nested`, so a frame inside a nested
  lambda lists _its_ names, not the outer function's. The JSON is **written to
  stdout with `neg[1]`** rather than returned, because a returned string would
  be display-formatted and elided at the console width (`\c` truncates displayed
  values, not handle writes). The trailing `;` makes the lambda return `::` so
  nothing prints after the JSON.
- **`.dbg.vals[d]`** — renders a frame-locals dict (built as a bare expression
  in the suspended frame, so the values are the live frame locals) as JSON the
  same way. Any value larger than `.dbg.cap` (16 KB) serialized bytes (`-22!`)
  is replaced by a `type/count` summary, so a huge table or vector is never
  serialized in full. On failure the adapter falls back to querying each name
  individually.

Names come from the parser-derived `(name, path)` of the frame (`frameLambda`);
values come from evaluating in the frame after `navigateTo` moves q's current
frame with `` ` ``/`.`. Locals are read from q at runtime, not dereferenced from
raw frame pointers.

## Execution model

`launchRequest` borrows the REPL's driver, `reset`s the debugger to a clean top
level, then runs the program:

1. **Load one statement at a time.** `runStatements` iterates the top-level
   statements. Each is written to a **line-padded temp file** (blank lines up to
   its original start line) and loaded with `\l`, so multi-line definitions
   parse correctly _and_ the debugger reports the original file's line numbers.
   The temp path is mapped back to the program path in stack traces
   (`mapToProgram`).
   - A **`\d` namespace directive** is the exception: it is run **directly** on
     the session, not via a temp file, because `\l` saves and restores the
     namespace around each load — so a `\d .utils` loaded that way would not
     persist and a following `run:{…}` would wrongly define a root `run`. Run
     directly, `\d` sticks and later statements load into that namespace.
2. **Arm breakpoints at each statement boundary** (`syncBreakpoints`), a
   top-level point where trap recovery is safe. Each requested breakpoint line
   is resolved to a `(name, path)` via `lambdaPathAt` and armed with `.dbg.bs`;
   traps whose breakpoints were removed are recovered with `.dbg.bu`. Arming is
   gated on the enclosing function having been defined.
3. **On a suspension** (`handleSuspension`): an entry trap fired, so
   `advanceToBreakpoint` single-steps until q reports a requested breakpoint
   line, then emits the DAP _stopped_ event (`reportStopped`, which captures the
   frames and the statement marker). A `'`-signalled error stops as an
   exception.

### Namespaces

The parser reports the **bare** assigned name (`run`), but under `\d .utils` the
real global is `.utils.run`. So every name the adapter hands to `.dbg.*` (which
resolve globals absolutely) is first passed through `qualify`, which prefixes it
with the `\d` namespace active at that source line (`namespaceAt`, a scan of
`\d` directives above the line). This applies to breakpoint arming, locals, and
step-in target resolution; a name already absolute (leading `.`) is left as-is.
q's backtrace prints fully-qualified frame names, so those need no qualifying.

## Stepping

All stepping is single-step (`>`) with a **frame-index** decision — the depth q
prints for the current frame, which rises on descent into a callee and falls on
return. This is more reliable than a source line, which is ambiguous around
nested-lambda definitions.

- **Step over (`stepStatement`, Next / F10)** — step within the current frame
  until the source line changes or a later same-line `;`-statement is reached (a
  loop back-edge is stepped over silently). `>` runs calls to completion without
  descending, so step-over never leaves the frame.
- **Step in (`stepInto`, F11)** — q has no native step-into, so it is
  synthesized: the functions the current statement could call (the bare
  identifiers on the line) are given temporary entry traps (`armStepInTraps` →
  `resolveLocalStepInTarget` for a nested local via `.dbg.childidx`, else
  `resolveGlobalStepInTarget`), then the statement is single-stepped. When the
  frame index rises, execution paused inside a callee. If no call is taken it
  degrades to step-over. Indirect calls (a function value applied without a bare
  name) are not trapped and fall back to step-over.
- **Step out (`stepOut`, Shift+F11)** — single-step until the frame index falls
  below where it started (the current lambda returned to its caller); stepping
  out of the outermost function returns to the top level and the loader resumes.
  Plain `continue` cannot do this — `:` runs to the next breakpoint or the
  program's end, overshooting the caller.
- **Continue (`resume`)** — resumes from a breakpoint with `:`, or, when the
  current function still holds a further requested breakpoint line, single-steps
  to it (`:` would skip in-function breakpoints past the first). An exception is
  unwound with `\` and execution carries on.

### Deferred step-in trap recovery

A step-in trap must be removed once done, but **recovering a trap on a function
still on the call stack corrupts its bytecode (q may exit)**. So step-in traps
(`stepInTraps`) are recovered lazily — at the first stop where the function is
no longer on the stack (`recoverStepInTraps`, keyed by whether the outer name is
in the current backtrace), before running a statement freely, and on session end
(`release`). They never overlap a real breakpoint's trap.

## Known limitations

- **Stopping the session while paused inside a nested lambda can terminate the
  shared q process.** `\`-aborting out of a lambda reached via an entry trap
  exits q — a general q behaviour that also affects nested breakpoints.
  Proceeding with Step/Continue (which use `>`/`:`) is always safe; only _Stop_
  mid-nested-lambda hits it. `reset`/`release` use `abortToTop`.
- **One-liner local lambdas** (`h:{ x+1 }` entirely on one line) can't be
  distinguished from the enclosing statement by line, so step-in labels them as
  step-over (it still stops on that line). Multi-line lambdas are unambiguous.
- **Recursion** — frame-index detection treats a same-named recursive frame as
  the same lambda for step-in/out identity.
- **Long functions** — step-out single-steps to the return, so a function with a
  very large loop is slow (bounded by a step ceiling).
- **Command timeout** — a driver command waits ~15 s for a prompt; a longer q
  computation times out at the transport layer.

## Deliberately avoided

- **`.Q.bd`** — its `.Q.BP` bookkeeping signals `'length` on current KDB-X
  builds, so `.Q.bu` is used to remove breakpoints instead
  ([debug.q](../../resources/q/debug.q)).

## Unused entirely

The debugger never touches the raw frame-pointer layer or the low-level
interactive-debugger entrypoints:

- L-namespace frame primitives: `Ll`, `Lp`, `Lx`, `Lu`, `Ls`
- `.Q.prr`, `.Q.srr`, `.Q.dbg`, `.Q.err`, `.Q.bc`
- `.Q.pl`, `.Q.btx`, `.Q.dr`, `.Q.dw`
- the `'s` (throw) control command
- `.z.ex`, `.z.ey`

## Not the DAP debugger: the scratchpad / query error path

A separate, non-DAP path reports query errors with a captured stack trace and is
unrelated to the debug adapter above:

- **`.Q.trp`** — protected eval with a stack-trace-capturing error handler
  ([evaluateQ.q](../../resources/q/evaluateQ.q)).
- **`.Q.sbt`** — formats the captured backtrace for display.
