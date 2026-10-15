# Manual testing the extension, driven by an agent

An interactive, adaptive way to test the extension like a human would: launch a
**real VS Code window** with the extension loaded, talk to **real, authenticated
q processes**, and drive the UI step by step - observe, decide, act. It is not a
script runner; each command returns what is on screen so the next step can
adapt. Works on Windows, macOS and Linux (Playwright over the Electron app).

If you are an agent asked to "test X" or "test the release like a manual
tester", this file is everything you need.

## Setup (once)

```
cd tools/manual-test && npm ci
cd ../.. && npm run build        # the extension under test is the repo's out/
```

You need a q licence and a q binary (found via `--q`, `QBIN`, `~/.kx/bin/q`,
`QHOME`, or PATH). VS Code is downloaded into `.work/` on first start.

## The loop

```
node qserver.js start --port 5000     # real q; prints user/password. ALWAYS authenticated (-U)
node cli.js start                     # VS Code, fresh profile, fixture workspace; prints a snapshot
node cli.js <command> ...             # act; most commands print a fresh snapshot
node cli.js stop ; node qserver.js stop
```

Never start q with an open port and no `-U`. `qserver.js` enforces this; do not
bypass it. Test against `127.0.0.1` only.

`node cli.js help` lists every command. The snapshot (TABS, QUICKINPUT, DIALOG,
CONTEXT MENU, NOTIFICATIONS, SIDEBAR, TERMINALS, WEBVIEWS, STATUS) is plain text
and cheap; **prefer it to screenshots**. Use `shot` only when text cannot answer
(layout, colours, icons), then read the png once.

### Cheat sheet

| Goal                          | Command                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| Run any extension command     | `palette "KX: New Connection"` (the title from `package.json`)      |
| Pick/enter in quick inputs    | `qi.pick "text"`, `qi.type "text"`, `qi.enter`, `esc`               |
| Click workbench UI            | `click "css selector"` or `click "visible text"` (`--right`)        |
| Notification/dialog button    | `button "Dismiss"`                                                  |
| Webview content (forms, grid) | `wv.list`, `wv.text`, `wv.controls`, `wv.click`, `wv.fill`          |
| Fill a form field by label    | `wv.fill 0 "label:Server Name" value`                               |
| Terminal / REPL output        | `term.read`, `term.send "type 123"`                                 |
| Editors                       | `file.open sample.q`, `editor.read`, `editor.set "text"`            |
| Wait for something            | `wait term "regex"`, `wait webview "regex" --wv 0`, `wait snapshot` |
| Extension log                 | `log 40`                                                            |
| Anything else                 | `eval "return await win.title()"` (Playwright `win`, `app`)        |

Webview indexes (`wv 0`, `1`...) come from `wv.list`; `*` marks the one on
screen. Omitting the index means the visible one.

## Gotchas learned the hard way

- The extension opens its **Welcome tab** on first activation, often right after
  your first command, and it covers other webviews. Webview writes fail with
  "in a background tab" - click the tab (`click ".tab[aria-label*='New Connection']"`).
- Forms can hide fields in collapsed sections (the connection form's "Authentication
  & TLS"): expand first, then fill. `wv.controls` shows each field's current value.
- The connection tree shows `name [host:port]`; connected state is an icon, so
  confirm a connection by running a query and reading the result, not the tree.
- Query results land in the **Terminal** panel (`term.read`) or the **KDB Results**
  view, depending on `setResultsDestination`. Check both.
- `palette` runs a command only on an exact title match, including its prefix
  (`KX: New Connection`, not `New Connection`). Otherwise it runs nothing and
  lists the closest matches: re-run with one of those titles. Commands that
  need an editor or connection (e.g. `KX: Execute Entire File`) are missing from
  the palette until a q file has focus.
- Palette results include other extensions' commands; the isolated profile has
  only this extension, so the `KX:` prefix is a reliable filter.
- Settings live in `.work/ud/User/settings.json` (pass `--settings '{"kdb.x":1}'`
  to `start`). Dialogs and file pickers are set to in-window ones so they are
  scriptable. Native OS dialogs cannot be driven.
- `start` always wipes the profile; `--keep` keeps it. `--workspace dir` uses your
  own folder instead of the fixture copy in `.work/workspace`.
- **The tool drives VS Code internals** (the `fake.html` webview frames, class
  names like `.quick-input-widget` and `.notification-list-item`), and `start`
  downloads `stable` by default, so a VS Code update can break it with no change
  in this repo. If snapshots come back empty or webviews are not found, suspect
  that first: check the version (`eval "return ctx.exe"` - the path names it),
  retry with `start --vscode <older version>`, and tell the user the tool needs
  updating rather than reporting it as an extension bug. Last known good: VS
  Code **1.142.0** (verified 2026-10-14); update this line when you confirm a
  newer one works.
- Commands that print a snapshot wait 700 ms first. For slow UI (connection
  dialogs, activation) pass `--settle 3000`, or use `wait`; `--no-snap` skips the
  snapshot. Only the documented flags are flags: text like `"--- note"` is typed
  as is, and `--` ends flag parsing.
- The daemon's token is in `.work/state.json` (owner-only on macOS/Linux) and
  `eval` runs arbitrary code in the Node process, so treat `.work/` as sensitive
  and never expose the daemon beyond 127.0.0.1.
- Testing a packaged build: unzip the `.vsix` and pass `--ext <folder/extension>`.

## How to test well

1. **Know the expected behaviour first**: `docs/user/`, the command titles and
   settings in `package.json`, `CHANGELOG.md`, and the code in `src/`.
2. **Set up real state**: real q via `qserver.js`, the connection through the UI
   (not by editing settings), real files in the workspace.
3. **Act, read the result, verify it is *correct*** (compare against what q
   returns, e.g. run the same expression in `term.send` on a REPL), not merely
   that something appeared. Try the unhappy paths too: wrong password, q stopped
   mid-session, empty results, huge results, bad input.
4. **When something looks off**, reproduce it once more from a clean `start`,
   then check `log` and the q side before calling it a bug.
5. **Report** per issue: severity, exact steps, observed vs expected, and the
   evidence (snapshot text, log lines). Separately list what you covered and what
   you could not (and why). Do not claim a feature works unless you saw it work.

### "Test the release" outline

Read `CHANGELOG.md` and the diff since the last tag for what changed, then walk the
user-facing surface from `docs/user/reference-card.md`: connections (add/edit/
remove/export, auth, TLS), executing q/Python/SQL from files and selections, query
results (Terminal, Results view, export), query editor / `.kxquery`, notebooks,
scratchpads, REPL, language features (completion, definition, rename, diagnostics),
settings, and first-run experience. Spend most effort on changed areas and on
flows a user hits in the first ten minutes.

## Layout

`cli.js` client; `driver.js` daemon that owns the window; `lib/handlers.js` the
commands (add one here when a pattern repeats); `qserver.js` real q management;
`fixtures/` seed workspace; `.work/` (ignored) runtime state, profile, shots.
