---
type: Reference
title: "KXI REPL issues - ee-repl worklist"
description:
  "The KXI issues on board 478 in progress for the extension maintainer, mostly
  children of epic KXI-73457 (REPL Improvements), fixed one at a time on the
  ee-repl branch."
tags: [jira, kxi, repl, vscode-extension]
---

# KXI REPL issues - `ee-repl` worklist

| #   | Key                                                     | Type  | Priority      | Epic | Summary                                                                     | Status          |
| --- | ------------------------------------------------------- | ----- | ------------- | ---- | --------------------------------------------------------------------------- | --------------- |
| 1   | [KXI-70103](https://kxl.atlassian.net/browse/KXI-70103) | Bug   | High          | yes  | Switching to a nested context makes the REPL unresponsive                   | Fixed           |
| 2   | [KXI-73199](https://kxl.atlassian.net/browse/KXI-73199) | Bug   | Medium        |      | CSV export quotes all output                                                | Fixed           |
| 3   | [KXI-70487](https://kxl.atlassian.net/browse/KXI-70487) | Bug   | Low           |      | VS Code Notebooks - Cannot execute queries with Ctrl + D                    | Fixed           |
| 4   | [KXI-72235](https://kxl.atlassian.net/browse/KXI-72235) | Bug   | High          |      | "Suggest a Feature" links isn't working                                     | Fixed           |
| 5   | [KXI-70542](https://kxl.atlassian.net/browse/KXI-70542) | Bug   | Medium        | yes  | Any lines following `\d` won't execute correctly                            | Fixed           |
| 6   | [KXI-73121](https://kxl.atlassian.net/browse/KXI-73121) | Bug   | Medium        | yes  | Pasting comments into the terminal tries to execute them as files           | Fixed           |
| 7   | [KXI-73120](https://kxl.atlassian.net/browse/KXI-73120) | Bug   | Highest       | yes  | Right clicking the terminal silently executes whatever is in the clipboard  | Fixed           |
| 8   | [KXI-73909](https://kxl.atlassian.net/browse/KXI-73909) | Bug   | High          |      | Function definitions are shown as a single line in the terminal output      | Fixed           |
| 9   | [KXI-73281](https://kxl.atlassian.net/browse/KXI-73281) | Bug   | High          | yes  | Only one of the REPL connections appears in the connection dialog           | Fixed           |
| 10  | [KXI-73661](https://kxl.atlassian.net/browse/KXI-73661) | Story | To be defined | yes  | Show Source Expressions for REPL command                                    | Fixed           |
| 11  | [KXI-72126](https://kxl.atlassian.net/browse/KXI-72126) | Bug   | High          | yes  | Errors running the REPL in windows                                          | Fixed           |
| 12  | [KXI-73185](https://kxl.atlassian.net/browse/KXI-73185) | Story | Medium        | yes  | Better use of venvs in the VSCode Extension                                 | Fixed           |
| 13  | [KXI-73991](https://kxl.atlassian.net/browse/KXI-73991) | Bug   | High          | yes  | Python errors not displayed in REPL but prints the contents of evaluatePy.q | Fixed           |
| 14  | [KXI-69244](https://kxl.atlassian.net/browse/KXI-69244) | Story | Low           | yes  | Result isn't shown for assignments, or lines ending in `;` with KX REPL     | Not recommended |

KXI-73121 and KXI-73120 are next to each other because both are the same paste
path.

## Issues

### 1. KXI-70103 - `\d` to a nested context hangs the REPL

As the first input, `\d .foo.i` prints

```text
55966c59-ee0a-40c5-a7f2-67b02d19d2f3@.foo.i@55966c59-ee0a-40c5-a7f2-67b02d19d2f3@.foo.i@
```

and the REPL stops responding until it is restarted. Fixed: the marker the REPL
reads its prompt from only matched `[0-9a-zA-Z_]` after the leading dot, so a
nested namespace never matched and the query never finished. It now allows dots,
and the prompt reads `q.foo.i)`, as in a plain q session.

### 2. KXI-73199 - CSV export quotes everything

Every exported CSV value is quoted, and string columns come out triple quoted.
Seen in 1.18.1 and 1.19.0. Expected: quote only where CSV needs it.

Fixed in `convertToCsv`: the view shows a q string as its literal (`"AUDUSD"`),
and every field was quoted again with its quotes doubled. A cell that is a whole
q string literal is now written as its text, with its escapes decoded, and only
a field holding a comma, a quote or a line break is quoted (RFC 4180).

### 3. KXI-70487 - Ctrl+D in notebooks

Reported on Windows: queries in a notebook do not run with Ctrl+D or Ctrl+Enter.
The acceptance criteria asks for Ctrl+Enter or Ctrl+D to run the query on the
current line and display its results.

Fixed: Ctrl/Cmd+D in a KX notebook cell runs the selection, or the current line
when nothing is selected, through the cell's own execution, so its result
replaces the cell's output. Ctrl+Enter stays VS Code's Run Cell
(`notebook.cell.execute`), the same command the selection runs through; the
Windows report of Ctrl+Enter failing has not been reproduced.

### 4. KXI-72235 - "Suggest a Feature" link

The link pointed to the retired Aha portal. `suggestFeature` in
[extensionVariables.ts](../../src/extensionVariables.ts) now opens
<https://forum.kx.com/c/ideas-feature-requests>.

### 5. KXI-70542 - Lines after `\d` (q connections)

Not the REPL: this is for plain q connections, and still happens (confirmed on
the ticket). Running the second line of

```q
\d
123
```

fails with `{"name":"Error","message":"Error: 123"}`, while `\d .foo` works. The
lines look joined into `\d 123`.

Fixed: not the q side, which runs both lines correctly. To run a selection or a
line, the extension finds the namespace from the `\d` lines above it, and its
pattern allowed any whitespace, newlines included, between `\d` and the name, so
the `123` below a bare `\d` was taken as the namespace. It now only allows
spaces and tabs, in both `getQueryContext` and `getConextForRerunQuery`.

### 6. KXI-73121 - Pasted comments run as files

Pasting `/test.q` followed by a newline runs `system"l ../../../../test.q"`, and
would load the file if it existed. Typed on its own, `/test.q` is a comment and
does nothing. A pasted comment must behave like a typed one.

Fixed with KXI-73120: a pasted line now goes into the input at the cursor, so
`/test.q` waits at the prompt, and Enter runs it as the comment it is.

### 7. KXI-73120 - Right click executes the clipboard

Right clicking a REPL terminal pastes the clipboard. Once "Do not ask me again"
has ever been ticked in VS Code, it runs with no prompt, and a multiline paste
is not echoed: only a new `q)` prompt appears. The reporter overwrote a function
this way while trying to clear the terminal. Reproduce by copying this and right
clicking:

```q
a: 1
   2 3
   4 5
   6 7;
```

Expected, per the report:

1. Right click opens a context menu instead of pasting.
2. A multiline paste does not execute immediately.
3. A multiline paste appears in the console.

Fixed: the REPL turns on bracketed paste, so every paste, from the keyboard or a
right click, arrives marked as one, while text sent with `sendText` (Python
environment activation, dropped files) is handled as before. A pasted line goes
into the input at the cursor. Several lines are shown under the prompt and held
as a block: Enter runs it, Ctrl+C discards it, a further paste adds to it, and
other keys are ignored. It is not added to history. Right click pasting is VS
Code's `terminal.integrated.rightClickBehavior`, which an extension cannot set
for one terminal; with pastes held, a stray right click no longer runs anything.

### 8. KXI-73909 - Lambdas shown on one line (regression)

Customer reported, extension 1.20.1 against Insights 1.18.5 and 1.19.4. A
multiline lambda echoed in the terminal loses its line breaks:

```q
testUda:{[x]
    a:1;
    b:10;
    h:x+a+b;
    h
    }
testUda
```

shows `{[x] a:1; b:10; h:x+a+b; h }`. This was fixed once and has regressed.
Expected: the original line breaks.

Already fixed on `dev`, not yet released. 1.20 began laying every console result
out as a table and joining each cell's lines onto one, so a table cell holding a
nested list stays on its row. A lambda run on Insights with an execution target
comes back as structured text, a single `values` cell, and was flattened with
it: 1.20.1's `convertRows` prints the lambda above as
`{[x] a:1; b:10; h:x+a+b; h }`, the shape in the report. KXI-73276 prints a
single value with its own newlines, and the "should keep the newlines of a
single value" test in `queryUtils.test.ts` covers it, and the Insights e2e test
"prints a lambda result with its own line breaks" runs a targeted query whose
answer is a lambda and reads the console. It ships with the next release.

### 9. KXI-73281 - Only one REPL in the connection dialog

With several REPLs open, the connection picker lists a single REPL entry, which
sends to whichever REPL was last active, and the header does not say which one.
Expected: one entry per open REPL, and the header names the target.

Fixed: the picker keeps `REPL`, which follows the active REPL as before, and
adds `REPL (<name>)` for every open REPL, named as its terminal is, plus the
REPL a file is pinned to when that one is not running. A pinned file runs on its
REPL whichever is active, and a pinned REPL that is not running is started in
its folder. The name is the workspace folder name and the path under it, so the
assignment in `kdb.connectionMap` holds for everyone sharing the settings: where
the only workspace folder goes by another name, as in a clone under a different
directory, the path is taken under that folder. Folders that share a name are
numbered, `src` and `src [2]`. A name with a colon is still a REPL, not a quick
`host:port` connection. The status bar shows `REPL → <name>` for a file
following the active REPL, updated as focus moves, and `REPL (<name>)` for a
pinned one.

### 10. KXI-73661 - Source expressions for the REPL

The ticket is a screenshot of the `kdb.hideSourceExpressions` setting ("When
disabled, the console shows all evaluated expressions, intermediate steps, and
results from your query"). The ask is for the REPL to honour it too, as the
output console does.

Fixed: with the setting off, code the REPL is given to run, from a file, a
selection or a notebook cell, is echoed statement by statement, each after a
prompt of its own and before its output, as a q console transcript reads.
Statements are shown as they are sent, so continuation lines are joined and
backslash commands read as `system` calls. Python is shown as the source was
written rather than as the q wrapper that runs it. Typed input and held pastes
are on screen already and are not echoed. The echo is written to the terminal
only, so a notebook cell's output is unchanged.

### 11. KXI-72126 - The REPL on native Windows

In a Windows (not WSL) workspace, starting the REPL prints
`'""' is not recognized as an internal or external command` and exits with code
1, followed by "KDB installation not found for workspace". The install flow then
links to KDB-X, which needs WSL, and reports that it does. Proposed in the
ticket: start q with something like `bash -c "q"` on non-WSL Windows, or, if the
REPL cannot work there, do not offer it at all, including **KX: Start REPL
Here**. The e2e suite cannot cover this (its stand-in q does not run through
`cmd.exe`).

Fixed, keeping native Windows to classic kdb+. 1.20.0, released after the
report, already finds `q.exe` on the path, through `QHOME` or through the q home
settings, and points Windows at the q home setting rather than at KDB-X, which
has no native Windows build. What was left:

- With no q found, the REPL still spawned `""` through `cmd.exe`, which is the
  error in the report. It now refuses to start: the setup warning is the only
  message, and a restart that finds q gone ends the REPL instead.
- The welcome page offered the KDB-X install on Windows, which only answers with
  the WSL warning. On Windows it now says KDB-X runs in WSL and offers **Set q
  Home Directory** for a kdb+ install instead.

Running KDB-X through `bash -c "q"` from a native Windows window, as the ticket
suggests, was not done:

- KDB-X has no Windows build, so the q that `bash` would start has to be the
  Linux one inside WSL. The `bash` on a Windows path is not always WSL's: Git
  Bash, for one, cannot run a Linux binary at all.
- q inside WSL sees Linux paths. Everything the REPL hands it is a Windows path:
  the working directory, the `\l` of a dropped file, `QHOME`, and the module
  search path it builds for KDB-X. Each would need translating to `/mnt/c/...`,
  and back for anything q reports.
- The install, the license and any Python environment for PyKX would have to
  live inside WSL, while the settings, the Python extension and its
  `activate.bat` environments belong to Windows, so the two would have to be
  kept apart by hand.
- VS Code already has the supported way: opening the folder in WSL runs the
  extension on Linux, where the REPL and the KDB-X install work as they do
  everywhere else. The welcome page now points Windows users there.

### 12. KXI-73185 - Using a venv with the REPL

Even following [Use PyKX within the REPL](../user/use-pykx-within-repl.md),
getting the REPL to use a virtual environment has problems. The ticket gives no
specifics, so this started with reproducing the documented setup and listing
where it fails.

What was wrong:

- **Only one kind of environment worked.** The REPL asked the Python extension's
  legacy API for the active interpreter and activated it only when it was a
  `VirtualEnvironment` whose name matched its folder, by sourcing `activate`
  (`activate.bat` on Windows). conda, pyenv, poetry and global interpreters were
  dropped without a word.
- **Only one environment per workspace folder.** The lookup used the workspace
  folder, so a REPL started in a subfolder with **KX: Start REPL Here** got the
  workspace's environment, not the one selected for that project.
- **PyKX found Python by `PATH`.** `pykx.q` runs `PYKX_EXECUTABLE` when it is
  set, otherwise `python3` then `python` from `PATH`. The interpreter PyKX
  loaded was whatever activation left first on `PATH`, and nothing at all when
  there was no activation.
- **The guide's `.env` step is not needed.** Reproduced with KDB-X on macOS,
  both with a venv on the system Python and a uv venv on a uv managed Python:
  with `PYKX_EXECUTABLE` pointing at the venv, `\l pykx.q` loads with a bare
  `PATH` and no activation, and `.pykx.eval` reports the venv as `sys.prefix`.
  `PYKX_USE_FIND_LIBPYTHON="true"` is only a fallback for a Python whose shared
  library cannot be found, and it makes `\l pykx.q` fail when `find-libpython`
  is not installed.

Fix, on the
[Python Environments](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-python-envs)
API (`@vscode/python-environments`, replacing `@vscode/python-extension`):

- The REPL asks `getEnvironment` for its own folder, so each project gets the
  environment selected for it. The Python extension installs Python Environments
  with it, and the API is available unless `python.useEnvironmentsExtension` is
  set to `false`; without it the REPL starts with no environment. An environment
  reported with an `error` is ignored.
- Activation is the command Python Environments uses for a terminal of the
  REPL's shell (`bash`, `cmd` on Windows), looked up as it does: the shell's
  entry in `execInfo.shellActivation`, then `unknown`, then `activation`
  ([replPython.ts](../../src/utils/replPython.ts)), so each manager's own
  activation is used. Only a venv and a uv venv on macOS were run; other
  managers are untested. The environment's name is shown before the prompt only
  when it was activated.
- `PYKX_EXECUTABLE` is set to the environment's interpreter
  (`execInfo.run.executable`) unless it is already set, from the user's
  environment or the workspace's `.env`, so `\l pykx.q` loads PyKX from the
  selected environment whatever `PATH` holds. It is not set when the path
  contains whitespace: `pykx.q` runs it through `system` unquoted, which fails
  (reproduced with a venv under a folder with a space), and quoting only helps
  under `bash`, since `cmd /c` strips the outer quotes of a line holding more
  than two. Activation then puts the environment's `python` first on `PATH`, as
  before.
- Native Windows (classic kdb+, `cmd.exe`) activates a venv with `activate.bat`,
  the entry Python Environments gives `cmd`, as the old code did. In a WSL
  window both extensions run in WSL and the REPL behaves as on Linux. Neither
  was run here: the e2e stand-in q cannot run through `cmd.exe`, and there is no
  Windows or WSL machine.
- The guide now covers any environment kind, how the REPL picks and uses it, and
  moves the `find-libpython` step to troubleshooting.

Not done: a REPL keeps the environment it started with, and selecting another
one does not restart it or say that it should (`onDidChangeEnvironment` could).
The `python.envFile` setting is not read; the REPL still reads only the
workspace folder's `.env`.

### 13. KXI-73991 - Python in the REPL prints `evaluatePy.q`

Reported against 1.20.1: running Python that fails, e.g. `(123`, from a Python
workbook in the REPL shows no error, only a caret, and scrolling up shows the
source of [evaluatePy.q](../../resources/q/evaluatePy.q).

Fixed in `getPythonWrapper`: `evaluatePy.q` takes one dictionary of arguments,
`{[args] ...}`, and the wrapper called it with four. q failed before any Python
ran and printed the whole wrapper as the error location, so every Python run in
the REPL failed, not only code that errors. The wrapper now passes
`` `returnFormat`code`sample_fn`sample_size!(...) ``, and `(123` prints
`"('unexpected EOF while parsing', ...)"`. The "should call evaluatePy with a
dictionary of arguments" test in `queryUtils.test.ts` covers it.

### 14. KXI-69244 - Results of assignments in the REPL

Stepping through a function body a line at a time, every line but the last ends
in `;` and most are assignments, and the q console prints nothing for either.
The ticket asks the REPL to rewrite each expression so its value is shown, as
`i.normalizeExpn` in the Insights scratchpad's `edi.q` does, behind a per user
setting that defaults to on. A comment on the ticket notes that the REPL mimics
the q console on purpose, as was requested, and that the change would make it
consistent with Analyst and Insights.

Not recommended:

- **The REPL is a q console.** It runs the user's own q process and writes what
  it is given to q's standard input, so a line does what it does in `q` in a
  terminal, which is the reason to use it. In q a trailing `;` is how code says
  "do not print this", and an assignment printing nothing is the language, not a
  gap. Showing both overrides what the user wrote.
- **Printing is not free.** Lines end in `;` because their value is large or not
  worth seeing: `t:select from trade`, `h:hopen ...`, `r:1000000?100f`. Each
  would be formatted by q in the user's process and rendered by the terminal, on
  every line of every file run with the setting at its default.
- **The rewrite is a q parser.** q has to be handed a different statement for
  every form: plain, indexed and compound assignment (`a:1`, `a[i]:x`, `a+:1`,
  `a,:x`), global `::`, several statements on one line (`a:1;b:2`), control
  words, `k)` and `p)` lines, `\` commands already sent as `system`, multiline
  lambdas and tables. `i.normalizeExpn` does this with `-4!` in a process the
  scratchpad owns. The REPL's process is the user's, and the extension loads no
  q into it (it only appends the markers it reads the prompt from), so the
  rewrite would either be defined in the user's session or be reimplemented in
  TypeScript, where every mistake changes what the user's code does.
- **Errors would show the rewrite.** q reports an error against the code it ran.
  [evaluateQ.q](../../resources/q/evaluateQ.q) shows the cost: it wraps each
  statement for the output console, then cuts its own prefix and suffix back out
  of the stack trace. In the REPL q prints the error itself, so the rewritten
  code would reach the terminal unless the REPL parsed and edited q's error
  output.
- **Typed and run code would disagree.** Typed input goes straight to q. A
  rewrite of only the code run from a file, a selection or a cell would make the
  same line print in one and not the other, the inconsistency KXI-73121 removed
  (a paste behaves as typing does). Rewriting typed input too would stop the
  REPL being a q console at all. With source expressions shown (KXI-73661) each
  statement is echoed as sent, so the echo would either show the rewritten form
  or no longer be what ran.
- **A default of on changes every existing user.** After an update, files that
  run quietly in the REPL would print every assignment, and the setting doubles
  the paths every REPL test has to cover.

Stepping through a function already works without it: run the expression without
its `;`, or run the name after the assignment (select `a`, Ctrl+Enter). If the
Analyst and Insights behaviour is wanted, its place is a connection's output
console, which already rewrites each statement in `evaluateQ.q`, not the REPL.
The recommendation is to close the ticket as Won't Do and keep the q console
behaviour.
