## Command Palette

| Command                | Command                   | Command                             |
| :--------------------- | :------------------------ | :---------------------------------- |
| KX: Welcome to KDB-X   | KX: New Connection        | KX: Focus on Connections view       |
| KX: Install KDB-X      | KX: New Notebook          | KX: Focus on Datasources view       |
| KX: Start REPL         | KX: New Workbook (q)      | KX: Focus on Workbooks view         |
| KX: Import Connections | KX: New Workbook (Python) | KX: Focus on Query History view     |
| KX: Export Connections | KX: New Workbook (SQL)    | KX: Focus on Help and Feedback view |
|                        | KX: New Datasource        |                                     |

## Keybindings

| Command                       | When                  | Shortcut                     |
| :---------------------------- | :-------------------- | :--------------------------- |
| KX: Execute Entire File       | `q` `py` `sql`        | `ctrl`/`⌘` +`shift`+`d`      |
| KX: Execute Current Selection | `q` `py` `sql`        | `ctrl`/`⌘`+`d`               |
| KX: Execute Current Block     | `q`                   | `ctrl`/`⌘`+`shift`+`e`       |
| KX: Populate Scratchpad       | `q` `py` `sql`        | `ctrl`/`⌘`+`shift`+`alt`+`p` |
| KX: Reset Scratchpad          | `q` `py` `sql` `kxnb` | `ctrl`/`⌘`+`shift`+`delete`  |
| KX: Choose Connection         | `q` `py` `sql` `kxnb` |                              |
| KX: Choose Execution Target   | `q` `py` `sql`        | `ctrl`/`⌘`+`alt`+`t`         |
| KX: Toggle Parameter Cache    | `q`                   | `ctrl`/`⌘`+`shift`+`y`       |

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

| Type                | REPL | My q | IE SP | IE q/SQL | IE API | IE UDA | IE Populate SP |
| :------------------ | :--: | :--: | :---: | :------: | :----: | :----: | :------------: |
| File `q`            |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `py`           |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `sql`          |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Workbook `q`        |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Workbook `py`       |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Workbook `sql`      |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Notebook Cell `q`   |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Notebook Cell `py`  |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Notebook Cell `sql` |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Datasource          |      |      |       |    ✓     |   ✓    |   ✓    |       ✓        |

`REPL` and `My q` requires [PyKX](https://github.com/KxSystems/kx-vscode/wiki/Use-PyKX-Within-REPL) for Python support.

## Telemetry

| Telemetry                         | Measurements | Source                                   |
| :-------------------------------- | :----------: | :--------------------------------------- |
| Extension.Activated               |              | src/extension.ts                         |
| Extension.CustomAuth.Activated    |              | src/extension.ts                         |
| ¦                                 |              |                                          |
| Welcome.Displayed                 |              | src/commands/setupCommand.ts             |
| Install.kdbx                      |              | src/commands/setupCommand.ts             |
| Install.kdbx.workspace            |              | src/commands/setupCommand.ts             |
| Install.kdbx.win32.fail           |              | src/commands/setupCommand.ts             |
| Repl.Start                        |              | src/commands/workspaceCommand.ts         |
| ¦                                 |              |                                          |
| Connection.Create.kdb             |              | src/commands/serverCommand.ts            |
| Connection.Edit.kdb               |              | src/commands/serverCommand.ts            |
| Connection.Delete.kdb             |              | src/services/connectionManagerService.ts |
| Connection.Create.ie              |              | src/commands/serverCommand.ts            |
| Connection.Edit.ie                |              | src/commands/serverCommand.ts            |
| Connection.Delete.ie              |              | src/services/connectionManagerService.ts |
| Connection.Export.All             |              | src/extension.ts                         |
| Connection.Export.Single          |              | src/extension.ts                         |
| Connection.Import                 |              | src/extension.ts                         |
| Connection.Reset.ie.sp            |              | src/classes/insightsConnection.ts        |
| Connection.Label.Create           |      ✓       | src/utils/connLabel.ts                   |
| Connection.Label.Delete           |      ✓       | src/utils/connLabel.ts                   |
| ¦                                 |              |                                          |
| Run.Workbook.repl.q               |              | src/utils/queryUtils.ts                  |
| Run.Workbook.repl.py              |              | src/utils/queryUtils.ts                  |
| Run.Workbook.repl.sql             |              | src/utils/queryUtils.ts                  |
| Run.File.repl.q                   |              | src/utils/queryUtils.ts                  |
| Run.File.repl.py                  |              | src/utils/queryUtils.ts                  |
| Run.File.repl.sql                 |              | src/utils/queryUtils.ts                  |
| Run.Cell.repl.q                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.repl.py                  |              | src/utils/queryUtils.ts                  |
| Run.Cell.repl.sql                 |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.kdb.q                |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.py               |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.sql              |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.q                    |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.py                   |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.sql                  |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.q                    |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.py                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.sql                  |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.ie.q                 |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.py                |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.sql               |              | src/utils/queryUtils.ts                  |
| Run.File.ie.q                     |              | src/utils/queryUtils.ts                  |
| Run.File.ie.py                    |              | src/utils/queryUtils.ts                  |
| Run.File.ie.sql                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.q                     |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.py                    |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.sql                   |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.ie.dap.q             |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.dap.py            |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.q                 |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.py                |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.dap.q                 |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.dap.py                |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.kdb.quick.q          |              |                                          |
| Run.Workbook.kdb.quick.py         |              |                                          |
| Run.Workbook.kdb.quick.sql        |              |                                          |
| Run.File.kdb.quick.q              |              |                                          |
| Run.File.kdb.quick.py             |              |                                          |
| Run.File.kdb.quick.sql            |              |                                          |
| Run.Cell.kdb.quick.q              |              |                                          |
| Run.Cell.kdb.quick.py             |              |                                          |
| Run.Cell.kdb.quick.sql            |              |                                          |
| ¦                                 |              |                                          |
| Run.Datasource.api                |              | src/utils/queryUtils.ts                  |
| Run.Datasource.qsql               |              | src/utils/queryUtils.ts                  |
| Run.Datasource.sql                |              | src/utils/queryUtils.ts                  |
| Run.Datasource.uda                |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Populate.Datasource.api           |              | src/utils/queryUtils.ts                  |
| Populate.Datasource.qsql          |              | src/utils/queryUtils.ts                  |
| Populate.Datasource.sql           |              | src/utils/queryUtils.ts                  |
| Populate.Datasource.uda           |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Populate.Workbook.q               |              | src/utils/queryUtils.ts                  |
| Populate.Workbook.py              |              | src/utils/queryUtils.ts                  |
| Populate.Workbook.sql             |              | src/utils/queryUtils.ts                  |
| Populate.File.q                   |              | src/utils/queryUtils.ts                  |
| Populate.File.py                  |              | src/utils/queryUtils.ts                  |
| Populate.File.sql                 |              | src/utils/queryUtils.ts                  |
| Populate.Cell.q                   |              | src/utils/queryUtils.ts                  |
| Populate.Cell.py                  |              | src/utils/queryUtils.ts                  |
| Populate.Cell.sql                 |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Results.Table.Displayed           |              | src/services/resultsPanelProvider.ts     |
| Results.Export.csv                |              | src/services/resultsPanelProvider.ts     |
| Results.Graphics.Displayed.kdb.q  |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.kdb.py |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.q   |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.py  |              | src/commands/serverCommand.ts            |
| ¦                                 |              |                                          |
| Language.References               |              | server/src/qLangServer.ts                |
| Language.Definition               |              | server/src/qLangServer.ts                |
| Language.Completion               |              | server/src/qLangServer.ts                |
| Language.RenameRequest            |              | server/src/qLangServer.ts                |
| Language.ParameterCache           |              | server/src/qLangServer.ts                |
| Language.CallHierarchy            |              | server/src/qLangServer.ts                |
| ¦                                 |              |                                          |
| Debugger.Run                      |              |                                          |
| Debugger.Resume                   |              |                                          |
| Debugger.StepOver                 |              |                                          |
| Debugger.SetBreakPoint            |              |                                          |
| ¦                                 |              |                                          |
| Help.Open.Documentation           |              | src/extension.ts                         |
| Help.Open.ReportBug               |              | src/extension.ts                         |
| Help.Open.SuggestFeature          |              | src/extension.ts                         |
| Help.Open.Survey                  |              | src/extension.ts                         |
| Help.Hide.Survey                  |              | src/utils/feedbackSurveyUtils.ts         |
