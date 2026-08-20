---
type: Developer Guide
title: Development
description: Setting up, building, testing, debugging and releasing the kdb VS Code extension.
tags: [kdb, vscode, development, testing, debugging, release]
timestamp: 2026-07-10
---

## Setup

```sh
git clone https://github.com/KxSystems/kx-vscode.git
npm install
```

## Recommended Extensions

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [lit-plugin](https://marketplace.visualstudio.com/items?itemName=runem.lit-plugin)
- [Debug Configuration Launcher](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-launcher)
- [SonarQube](https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarlint-vscode)

## Scripts

Run these with `npm run scriptName`

| Script        | Description                                 |
| :------------ | :------------------------------------------ |
| `update-deps` | Update dependencies to latest patch version |
| `format`      | Format all `ts` files                       |
| `lint`        | Lint all `ts` files                         |
| `package`     | Produce `vsix`                              |
| `test`        | Perform [Unit Tests](https://github.com/KxSystems/kx-vscode/tree/dev/test/suite)|
| `test:e2e`    | Perform [End to End Tests](https://github.com/KxSystems/kx-vscode/tree/dev/test/e2e)|
| `coverage`    | Produce coverage reports|
| `q-test`      | Perform [q Tests](https://github.com/KxSystems/kx-vscode/tree/dev/test/q/tests)|

## Configuring SonarQube

Once you've installed the [SonarQube Extension](https://marketplace.visualstudio.com/items?itemName=SonarSource.sonarlint-vscode), add the KX SonarQube server `https://sonarqube.dl.kx.com`, and it will lint as you type, so you don't need to wait for the github pipeline to discover issues.

Ctrl + Shift + P -> "SonarQube: Analyze Current File with SonarQube" will give you a a detailed summary of any issues in a file.

SonarQube results can be viewed at https://sonarqube.dl.kx.com/dashboard?branch=dev&id=kxvscode

## Debugging

Pressing F5 with a file in the extension open will launch a VSCode instance running the extension built from source, with the debugger open in the original VSCode instance.

Extension [Unit Tests](https://github.com/KxSystems/kx-vscode/tree/dev/test/suite) can be debugged by selecting `Extension Tests` target from run and debug tab.

Testing will stop at any breakpoint set in test or source file.

![Run and debug tab](../images/dev-run-and-debug-tab.png)

Single test file can also be debugged by clicking run button from the editor toolbar:

![Debug single test file](../images/dev-debug-single-test-file.png)

## End to end Testing

`npm run test:e2e` opens a second VS Code window on
[test/e2e/workspace](https://github.com/KxSystems/kx-vscode/tree/dev/test/e2e/workspace)
and drives the extension the way a user does: real commands, real workspace
settings, the real language server. Nothing is stubbed.

The test files sit directly in [test/e2e](https://github.com/KxSystems/kx-vscode/tree/dev/test/e2e);
everything they are built out of — the stand-ins, the fixtures, the helpers that
drive VS Code — lives in
[test/e2e/utils](https://github.com/KxSystems/kx-vscode/tree/dev/test/e2e/utils).

Stand-ins take the place of everything outside the extension, and each records
what it is sent, which is what the tests assert on:

- `fakeq/bin/q`, spawned by the REPL because the workspace points
  `kdb.qHomeDirectoryWorkspace` at it. It answers the REPL handshake and writes
  a `.transcript.log` next to the directory each REPL runs in.
- `qserver.ts`, a kdb+ IPC server the connection tests run in process. It uses
  the same codec as `node-q`, and the suite adds and removes its connection
  itself, so no connection has to be prepared beforehand.
- `insightsServer.ts`, a KDB Insights instance, over HTTPS with a self-signed
  certificate generated into `test/e2e/certs/` on the first run — Insights
  connections must be `https://`, and a certificate no CA vouches for is what
  the connection's "insecure" flag exists for. It answers the OAuth code flow,
  the configuration, meta, scratchpad and service gateway endpoints, and the
  scratchpad log websocket. Which endpoints the extension picks depends on the
  version the instance reports, so `version` and `queryEnvironments` are
  settings on it and a test can stand up an older instance by changing them.
- the browser the OAuth code flow opens, replaced in `insights.ts` by a
  function that walks the authorization redirect back to the extension's own
  local server. It is the only stand-in that replaces a VS Code API rather than
  a process, and it exists because there is no one in a test window to open the
  URL — the code flow, the token request and the certificate handling all still
  run for real.

Both suites can be debugged with the `E2E Tests` and `E2E Test Selected File`
targets in the run and debug tab.

These tests are macOS and Linux only for now: the REPL spawns q through
`cmd.exe` on Windows, which cannot run the extensionless stand-in.

## q Testing

To run the tests non-interactively, you can just run `npm run q-test` and they will be run in the q-build container.

To run the tests interactively, you need to
1. Install Python version 3.12 installed, as the tests rely on an old version of pykx that doesn't support the latest Python
```
~/kx-vscode $ brew install python@3.12
~/kx-vscode $ python3.12 -m venv venv
~/kx-vscode $ source venv/bin/activate
```

2. Install pykx by running the following. If you aren't running the right Python version, PyKX 2.5 won't be available. More detailed instructions are available [here](https://code.kx.com/pykx/pykx-under-q/intro.html)
```
~/kx-vscode $ zsh ./test/q/preTest.sh
```

3. kdb+ installed, with the `q` executable in the system path
4. [AxLibraries](https://code.kx.com/developer/getting-started/) should be installed, according to its readme.

To debug the tests, create a file with a username and password to secure the q process, then start a q process using that authentication.
```
$ echo "myusername:mypassword" >> users.txt
$ q -u users.txt -p 1234
KDB-X 5.0 2026.01.22 Copyright (C) 1993-2026 Kx Systems
l64/ 16()core 15644MB myusername hostname 127.0.1.1 EXPIRE 2027.01.13 email@example.com

q)\l qcumber.q
q)\l test/q/main.q
```

You can now connect to the process on port 1234 and step through the tests

## Python and matplotlib

Start a virtual environment

```sh
python3 -m venv ~/kx-vscode/venv
source venv/bin/activate
```

Then install matplotlib
```sh
pip install --upgrade matplotlib
```

and PyKX, following the steps here
https://code.kx.com/pykx/getting-started/installing.html#1-install-kdb-x-python

## Restart Extension Host

`ctrl`/`⌘`+`r` will restart extension host.

## Dependencies

List outdated dependencies:

```sh
npm exec ncu
```

## Releasing a new version

Let the doc writer, or the #docs channel if they're unavailable, know that a release is about to go out so they can publish the docs concurrently.

Check out the branch to release, update the version number in package.json, then run
```
git tag v1.2.3
git push origin v1.2.3
```
Then, in the [Actions](https://github.com/KxSystems/kx-vscode/actions) tab, open the pipeline that was just created, and give manual approval once the action reaches that point. It can take 10 minutes for the version number to be updated in the extension marketplace, even after it updates the timestamp to reflect the new release.

Announce the release in #kx-product-releases, using the template
```
:rocket: VSCode Extension x.y.z has been released

https://github.com/KxSystems/kx-vscode/releases/tag/vX.Y.Z
https://marketplace.visualstudio.com/items?itemName=KX.kdb


vX.Y.Z
Release date: [Today's Date]

[The change log, which can be found by clicking the release [here](https://github.com/KxSystems/kx-vscode/tags)]
```
