---
type: Developer Note
title: Query Execution Call Hierarchy
description: File types the extension executes, their available actions, and the top-level entry point each action runs on.
tags: [kdb, vscode, execution, query]
timestamp: 2026-07-10
---

## Files of Interest

### .q

#### Actions

- Execute Entire File
- Execute Current Selection
- Execute Current Block
- Populate Scratchpad

Runs on [workspaceCommand.runActiveEditor()](top-level-error-handling.md#workspacecommandrunactiveeditor)

### .py

#### Actions

- Execute Entire File
- Execute Current Selection

Runs on [workspaceCommand.runActiveEditor()](top-level-error-handling.md#workspacecommandrunactiveeditor)

### .sql

#### Actions

- Execute Entire File
- Populate Scratchpad

Runs on [workspaceCommand.runActiveEditor()](top-level-error-handling.md#workspacecommandrunactiveeditor)

### .kxnb

#### Actions

- Run code block(s)

Runs on [notebookController.execute()](top-level-error-handling.md#notebookcontrollerexecute)

### .kdb.json

#### Actions

- Run
- Populate Scratchpad
- Refresh Meta

Runs on [dataSourceEditorProvider.webview.onDidReceiveMessage()](top-level-error-handling.md#datasourceeditorproviderwebviewondidreceivemessage)

### .kdb.q

Same as [.q](#q)

### .kdb.py

Same as [.py](#py)

### .quke

No actions.

## Connections Explorer

- serverCommand.refreshGetMeta()
- serverCommand.resetScratchpad()
