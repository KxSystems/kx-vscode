---
type: Developer Note
title: Top Level Error Handling and User Notification Functions
description: The functions where user-visible query-execution notifications belong; everything below them should use DEBUG level.
tags: [kdb, vscode, notifications, error-handling, execution]
timestamp: 2026-07-10
---

# Top Level Error Handling and User Notification Functions

User visible notifications regarding query executions should be handled on the following functions. Call hierarchy below those functions should only use DEBUG level notifications.

## workspaceCommand.runActiveEditor()

- serverCommand.runQuery() (1)
  - serverCommand.executeQuery() (4)
  - dataSourceCommand.runDataSource() (4)
  - dataSourceCommand.populateScratchpad() (3)

## notebookController.execute()

- serverCommand.executeQuery()
- dataSourceCommand.runDataSource()
- dataSourceCommand.populateScratchpad()

## dataSourceEditorProvider.webview.onDidReceiveMessage()

- connectionManagerService.instance.refreshGetMeta()
- dataSourceCommand.runDataSource()
- dataSourceCommand.populateScratchpad()

## serverCommand.rerunQuery()

- serverCommand.executeQuery()
- dataSourceCommand.runDataSource()
