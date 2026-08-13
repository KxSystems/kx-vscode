---
type: Guide
title: Environment Files
description: How the extension reads a workspace .env file to set environment variables for the KX REPL, including syntax, variable expansion and precedence.
tags: [kdb, vscode, configuration, env, repl, qhome]
timestamp: 2026-08-13
---

## Overview

A `.env` [file](https://code.visualstudio.com/docs/python/environments#_environment-variables) in the root of a workspace folder lets you set environment variables that apply only to that workspace, without changing your operating system environment.

The extension reads it when it starts a **KX REPL**: the variables are merged into the environment of the `q` process it launches. This is the recommended place for workspace specific values such as `QHOME`, `QLIC` or `PYKX_USE_FIND_LIBPYTHON`.

The file is read every time a REPL starts, so after editing it, restart the REPL for the changes to take effect.

## Location

The file must be named `.env` and live in the root of the workspace folder:

```
my-workspace/
├── .env
├── .vscode/
│   └── settings.json
└── main.q
```

In a [multi-root workspace](https://code.visualstudio.com/docs/editing/workspaces/multi-root-workspaces) each folder has its own `.env`, and the one belonging to the folder the REPL was started for is used. If a file does not belong to any workspace folder, no `.env` is applied.

Note that the Python extension reads the same file by default (`python.envFile`), so variables placed here are also picked up when a virtual environment is activated for the REPL.

## Syntax

One `KEY=VALUE` assignment per line:

```
QHOME=/opt/kdb
QLIC=/opt/kdb/lic
PYKX_USE_FIND_LIBPYTHON="true"

# Lines starting with a hash are comments
```

- Blank lines and lines whose first non-whitespace character is `#` are ignored.
- Whitespace around the key and the value is trimmed.
- Quotes (`"` and `'`) are removed from the value, so `PYKX_USE_FIND_LIBPYTHON="true"` and `PYKX_USE_FIND_LIBPYTHON=true` are equivalent.
- There is no `export` prefix support, no multi-line values, and a value cannot contain `=` — everything from the second `=` onwards is discarded.

## Variable Expansion

Values may reference other variables in either POSIX or Windows form:

```
QHOME=/opt/kdb
QLIC=${QHOME}/lic
QPATH=$QHOME/mod
HOSTNAME=%COMPUTERNAME%
```

`$NAME`, `${NAME}` and `%NAME%` are all expanded. A reference is resolved against the variables defined earlier in the same `.env` file first, then against the environment the extension itself is running in. A reference that cannot be resolved is left in the value unchanged.

## Precedence

Values in `.env` override the variables inherited from the operating system for the launched `q` process.

`QHOME` is the exception, because the extension also has settings for it. When locating the `q` executable the order is:

1. `kdb.qHomeDirectoryWorkspace` (set in `.vscode/settings.json`)
2. `QHOME` from `.env`, or from the operating system if `.env` does not set it
3. `kdb.qHomeDirectory`
4. The default `KDB-X` install location `$HOME/.kx`, then the system path

See [q Home Directory](q-home-directory.md) for details.

`QPATH` is also adjusted for `KDB-X`: the module directory of the folder the REPL runs in is prepended to whatever `QPATH` resolves to, so modules local to the workspace are found first.

## Scope

`.env` applies to the REPL only, since that is the process the extension launches itself. It has no effect on q processes you connect to as **My kdb Servers** or on **kdb Insights Enterprise** connections — those run outside of VS Code and take their environment from wherever they were started.
