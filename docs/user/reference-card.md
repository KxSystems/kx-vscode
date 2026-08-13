---
type: Reference
title: Reference Card
description: Command palette entries, keybindings, settings, execution matrix and telemetry events for the kdb VS Code extension.
tags: [kdb, vscode, reference, keybindings, settings, telemetry]
timestamp: 2026-07-10
---

## Command Palette

| Command                | Command                   | Command                             |
| :--------------------- | :------------------------ | :---------------------------------- |
| KX: Welcome to KDB-X   | KX: New Connection        | KX: Focus on Connections view       |
| KX: Install KDB-X      | KX: New Notebook          | KX: Focus on Datasources view       |
| KX: Start REPL         | KX: New Workbook (q)      | KX: Focus on Workbooks view         |
| KX: Import Connections | KX: New Workbook (Python) | KX: Focus on Query History view     |
| KX: Export Connections | KX: New Workbook (SQL)    | KX: Focus on Help and Feedback view |
|                        | KX: New Datasource        | KX: Focus on KDB Results view       |

## Keybindings

| Command                       | When                  | Windows / Linux          | macOS            |
| :---------------------------- | :-------------------- | :----------------------- | :--------------- |
| KX: Execute Entire File       | `q` `py` `sql`        | `ctrl`+`shift`+`d`       | `⌘`+`⇧`+`d`      |
| KX: Execute Current Selection | `q` `py` `sql`        | `ctrl`+`d`               | `⌘`+`d`          |
| KX: Execute Current Block     | `q`                   | `ctrl`+`shift`+`e`       | `⌘`+`⇧`+`e`      |
| KX: Populate Scratchpad       | `q` `py` `sql`        | `ctrl`+`shift`+`alt`+`p` | `⌘`+`⇧`+`⌥`+`p`  |
| KX: Reset Scratchpad          | `q` `py` `sql` `kxnb` | `ctrl`+`shift`+`delete`  | `⌘`+`⇧`+`fn`+`⌫` |
| KX: Choose Connection         | `q` `py` `sql` `kxnb` |                          |                  |
| KX: Choose Execution Target   | `q` `py` `sql`        | `ctrl`+`alt`+`t`         | `⌘`+`⌥`+`t`      |
| KX: Toggle Parameter Cache    | `q`                   | `ctrl`+`shift`+`y`       | `⌘`+`⇧`+`y`      |

### REPL

| Action                              | Windows / Linux   | macOS                  |
| :---------------------------------- | :---------------- | :--------------------- |
| Execute command line                | `RETURN`          | `RETURN`               |
| Delete left of cursor               | `BACKSPACE`       | `⌫`                    |
| Delete right of cursor              | `DEL`             | `fn`+`⌫`               |
| Move cursor left                    | `←` / `shift`+`←` | `←` / `⇧`+`←`          |
| Move cursor right                   | `→` / `shift`+`→` | `→` / `⇧`+`→`          |
| Recall previous history entry       | `↑`               | `↑`                    |
| Recall next history entry           | `↓`               | `↓`                    |
| Move cursor to start of line        | `HOME`            | `HOME` / `⌘`+`←`       |
| Move cursor to end of line          | `END`             | `END` / `⌘`+`→`        |
| Move cursor up (multi-line input)   | `shift`+`↑`       | `⇧`+`↑`                |
| Move cursor down (multi-line input) | `shift`+`↓`       | `⇧`+`↓`                |
| Jump to previous word               | `ctrl`+`←`        | `⌥`+`←`                |
| Jump to next word                   | `ctrl`+`→`        | `⌥`+`→`                |
| Delete previous word                | `ctrl`+`⌫`        | `⌥`+`⌫`                |
| Delete next word                    | `ctrl`+`delete`   | `⌥`+`d` (`fn`+`⌥`+`⌫`) |
| Paste code                          | `ctrl`+`v`        | `⌘`+`v`                |
| Stop execution (Reset on Windows)   | `ctrl`+`c`        | `⌃`+`c`                |
| Reset                               | `ctrl`+`d`        | `⌃`+`d`                |
| Clear the REPL                      | `ctrl`+`l`        | `⌃`+`l`                |

## Settings

| Setting                                             | Scope    | Type      | Default       |
| :-------------------------------------------------- | :------- | :-------- | :------------ |
| [kdb.qHomeDirectory](q-home-directory.md)           | machine  | `string`  | `""`          |
| kdb.servers                                         | machine  | `object`  | `{}`          |
| kdb.insightsEnterpriseConnections                   | machine  | `object`  | `{}`          |
| kdb.connectionLabels                                | machine  | `array`   | `[]`          |
| kdb.labelsConnectionMap                             | machine  | `array`   | `[]`          |
| kdb.hideSurvey                                      | machine  | `boolean` | `false`       |
| kdb.hideSourceExpressions                           | machine  | `boolean` | `true`        |
| kdb.hideSubscribeRegistrationNotification           | machine  | `boolean` | `false`       |
| kdb.neverShowQInstallAgain                          | machine  | `boolean` | `false`       |
| kdb.autoFocusOutputOnEntry                          | machine  | `boolean` | `true`        |
| [kdb.qHomeDirectoryWorkspace](q-home-directory.md)  | resource | `string`  | `""`          |
| kdb.connectionMap                                   | resource | `object`  | `{}`          |
| kdb.targetMap                                       | resource | `object`  | `{}`          |
| kdb.timeoutMap                                       | resource | `object`  | `{}`          |
| kdb.defaultTimeout                                  | resource | `number`  | `30`          |
| kdb.linting                                         | resource | `boolean` | `false`       |
| kdb.refactoring                                     | resource | `string`  | `"Workspace"` |

`kdb.connectionMap`, `kdb.targetMap` and `kdb.timeoutMap` are keyed by
workspace relative path, so they only cover files inside the workspace. Files
opened from outside the workspace can still be assigned a connection, an
execution target and a timeout, but those assignments are kept in memory and
are lost when VS Code restarts.

## Execution

| Type                | REPL | My q | IE SP | IE q/SQL | IE API | IE UDA | IE Populate SP |
| :------------------ | :--: | :--: | :---: | :------: | :----: | :----: | :------------: |
| File `q`            |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `quke`         |  ✓   |  ✓   |   ✓   |    ✓     |        |        |                |
| File `py`           |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| File `sql`          |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Workbook `q`        |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Workbook `py`       |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Workbook `sql`      |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Notebook Cell `q`   |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Notebook Cell `py`  |  ✓   |  ✓   |   ✓   |    ✓     |        |        |       ✓        |
| Notebook Cell `sql` |  ✓   |  ✓   |       |    ✓     |        |        |       ✓        |
| Datasource          |      |      |       |    ✓     |   ✓    |   ✓    |       ✓        |

`REPL` and `My q` requires [PyKX](use-pykx-within-repl.md) for Python support.

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
| Repl.StartFolder                  |              | src/commands/workspaceCommand.ts         |
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
| Connection.Cancel.ie.sp           |              | src/classes/insightsConnection.ts        |
| Connection.Reset.ie.sp            |              | src/classes/insightsConnection.ts        |
| Connection.Label.Create           |      ✓       | src/utils/connLabel.ts                   |
| Connection.Label.Delete           |      ✓       | src/utils/connLabel.ts                   |
| ¦                                 |              |                                          |
| Run.Workbook.repl.q               |              | src/utils/queryUtils.ts                  |
| Run.Workbook.repl.py              |              | src/utils/queryUtils.ts                  |
| Run.Workbook.repl.sql             |              | src/utils/queryUtils.ts                  |
| Run.File.repl.q                   |              | src/utils/queryUtils.ts                  |
| Run.File.repl.quke                |              | src/utils/queryUtils.ts                  |
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
| Run.File.kdb.quke                 |              | src/utils/queryUtils.ts                  |
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
| Run.File.ie.quke                  |              | src/utils/queryUtils.ts                  |
| Run.File.ie.py                    |              | src/utils/queryUtils.ts                  |
| Run.File.ie.sql                   |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.q                     |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.py                    |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.sql                   |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.ie.dap.q             |              | src/utils/queryUtils.ts                  |
| Run.Workbook.ie.dap.py            |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.q                 |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.quke              |              | src/utils/queryUtils.ts                  |
| Run.File.ie.dap.py                |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.dap.q                 |              | src/utils/queryUtils.ts                  |
| Run.Cell.ie.dap.py                |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Run.Workbook.kdb.quick.q          |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.quick.py         |              | src/utils/queryUtils.ts                  |
| Run.Workbook.kdb.quick.sql        |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.q              |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.quke           |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.py             |              | src/utils/queryUtils.ts                  |
| Run.File.kdb.quick.sql            |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.quick.q              |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.quick.py             |              | src/utils/queryUtils.ts                  |
| Run.Cell.kdb.quick.sql            |              | src/utils/queryUtils.ts                  |
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
| Populate.Workbook.ie.q            |              | src/utils/queryUtils.ts                  |
| Populate.Workbook.ie.py           |              | src/utils/queryUtils.ts                  |
| Populate.Workbook.ie.sql          |              | src/utils/queryUtils.ts                  |
| Populate.File.ie.q                |              | src/utils/queryUtils.ts                  |
| Populate.File.ie.py               |              | src/utils/queryUtils.ts                  |
| Populate.File.ie.sql              |              | src/utils/queryUtils.ts                  |
| Populate.Cell.ie.q                |              | src/utils/queryUtils.ts                  |
| Populate.Cell.ie.py               |              | src/utils/queryUtils.ts                  |
| Populate.Cell.ie.sql              |              | src/utils/queryUtils.ts                  |
| ¦                                 |              |                                          |
| Results.Table.Displayed           |              | src/services/resultsPanelProvider.ts     |
| Results.Export.csv                |              | src/services/resultsPanelProvider.ts     |
| Results.Graphics.Displayed.kdb.q  |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.kdb.py |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.q   |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.py  |              | src/commands/serverCommand.ts            |
| Results.Graphics.Displayed.ie.stdout |           | src/classes/scratchpadLogger.ts          |
| ¦                                 |              |                                          |
| Language.References               |              | server/src/qLangServer.ts                |
| Language.Definition               |              | server/src/qLangServer.ts                |
| Language.Completion               |              | server/src/qLangServer.ts                |
| Language.RenameRequest            |              | server/src/qLangServer.ts                |
| Language.ParameterCache           |              | server/src/qLangServer.ts                |
| Language.CallHierarchy            |              | server/src/qLangServer.ts                |
| ¦                                 |              |                                          |
| Help.Open.Documentation           |              | src/extension.ts                         |
| Help.Open.ReportBug               |              | src/extension.ts                         |
| Help.Open.SuggestFeature          |              | src/extension.ts                         |
| Help.Open.Survey                  |              | src/extension.ts                         |
| Help.Hide.Survey                  |              | src/utils/feedbackSurveyUtils.ts         |
