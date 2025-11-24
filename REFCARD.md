## Command Palette

| Command                | Command                   | Command                             |
| :--------------------- | :------------------------ | :---------------------------------- |
| KX: Welcome to KDB-X   | KX: New Connection        | KX: Focus on Connections view       |
| KX: Install KDB-X      | KX: New Notebook          | KX: Focus on Datasources view       |
| KX: Start REPL         | KX: New Workbook (q)      | KX: Focus on Workbooks view         |
| KX: Import connections | KX: New Workbook (Python) | KX: Focus on Query History view     |
| KX: Export connections | KX: New Datasource        | KX: Focus on Help and Feedback view |

## Keybindings

| Command                       | When           | Shortcut                 | MacOS                 |
| :---------------------------- | :------------- | :----------------------- | :-------------------- |
| KX: Execute Current Selection | `q` `py` `sql` | `ctrl`+`d`               | `⌘`+`d`               |
| KX: Execute Current Block     | `q`            | `ctrl`+`shift`+`e`       | `⌘`+`shift`+`e`       |
| KX: Execute Entire File       | `q` `py` `sql` | `ctrl`+`shift`+`d`       | `⌘`+`shift`+`d`       |
| KX: Populate Scratchpad       | `q` `py` `sql` | `ctrl`+`shift`+`alt`+`p` | `⌘`+`shift`+`alt`+`p` |
| KX: Reset Scratchpad          | `q` `py` `sql` | `ctrl`+`shift`+`delete`  | `⌘`+`shift`+`delete`  |
| KX: Choose Execution Target   | `q` `py` `sql` | `ctrl`+`alt`+`t`         | `⌘`+`alt`+`t`         |
| KX: Toggle Parameter Cache    | `q`            | `ctrl`+`shift`+`y`       | `⌘`+`shift`+`y`       |

### REPL

| Shortcut    | Action                 | Shortcut       | Action                            |
| :---------- | :--------------------- | :------------- | :-------------------------------- |
| `RETURN`    | Execute command line   | `END`          | Move cursor to end                |
| `BACKSPACE` | Delete left of cursor  | `shift`+`←`    | Move cursor left                  |
| `DEL`       | Delete right of cursor | `shift`+`→`    | Move cursor right                 |
| `←`         | Move cursor left       | `shift`+`↑`    | Move cursor up                    |
| `→`         | Move cursor right      | `shift`+`↓`    | Move cursor down                  |
| `↑`         | History                | `ctrl`/`⌘`+`v` | Paste code                        |
| `↓`         | History                | `ctrl`+`c`     | Stop execution (Reset on Windows) |
| `HOME`      | Move cursor to start   | `ctrl`+`d`     | Reset                             |

## Settings

| Setting                                                                                   | Scope    | Type      | Default       |
| :---------------------------------------------------------------------------------------- | :------- | :-------- | :------------ |
| [kdb.qHomeDirectory](https://github.com/KxSystems/kx-vscode/wiki/qHomeDirectory)          | machine  | `string`  | `""`          |
| kdb.servers                                                                               | machine  | `object`  | `{}`          |
| kdb.insightsEnterpriseConnections                                                         | machine  | `object`  | `{}`          |
| kdb.connectionLabels                                                                      | machine  | `array`   | `[]`          |
| kdb.labelsConnectionMap                                                                   | machine  | `array`   | `[]`          |
| kdb.hideSurvey                                                                            | machine  | `boolean` | `false`       |
| kdb.hideSourceExpressions                                                                 | machine  | `boolean` | `true`        |
| kdb.hideSubscribeRegistrationNotification                                                 | machine  | `boolean` | `false`       |
| kdb.neverShowQInstallAgain                                                                | machine  | `boolean` | `false`       |
| kdb.autoFocusOutputOnEntry                                                                | machine  | `boolean` | `true`        |
| [kdb.qHomeDirectoryWorkspace](https://github.com/KxSystems/kx-vscode/wiki/qHomeDirectory) | resource | `string`  | `""`          |
| kdb.connectionMap                                                                         | resource | `object`  | `{}`          |
| kdb.targetMap                                                                             | resource | `object`  | `{}`          |
| kdb.linting                                                                               | resource | `boolean` | `false`       |
| kdb.refactoring                                                                           | resource | `string`  | `"Workspace"` |

## Execution

| Type       | REPL | My q | IE SP | IE q/SQL | IE API | IE UDA | IE Populate SP |
| :--------- | :--: | :--: | :---: | :------: | :----: | :----: | :------------: |
| File `q`   |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `py`  |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `sql` |  ✓   |      |       |    ✓     |        |        |       ✓        |
| Cell `q`   |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Cell `py`  |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Cell `sql` |  ✓   |      |       |    ✓     |        |        |       ✓        |
| Datasource |      |      |       |    ✓     |   ✓    |   ✓    |       ✓        |

`REPL` and `My q` requires [PyKX](https://github.com/KxSystems/kx-vscode/wiki/Use-PyKX-Within-REPL) for Python support.
