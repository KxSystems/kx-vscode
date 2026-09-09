---
type: Index
title: Developer Notes
description:
  Architecture and contributor notes for the kdb VS Code extension — setup,
  notifications, execution flow, telemetry.
tags: [kdb, vscode, developer]
timestamp: 2026-07-10
---

# Developer Notes

Architecture and contributor notes for the kdb VS Code extension. See also the
[user notes](../user/index.md).

> The end-user product documentation is hosted separately at
> <https://code.kx.com/vscode/>.

- [Development](development.md) — setup, recommended extensions, scripts,
  debugging, releasing.
- [What the End to End Suite Covers](end-to-end-coverage.md) — the map of what
  `test:e2e` asserts, and what it cannot reach.
- [Log, Telemetry and User Notifications](log-telemetry-and-user-notifications.md)
  — the single notification entry point.
- [Progress Notifications](progress-notifications.md) — creating progress
  notifications.
- [Query Execution Call Hierarchy](query-execution-call-hierarchy.md) — file
  types, actions and their entry points.
- [Top Level Error Handling and User Notification Functions](top-level-error-handling.md)
  — where user-visible query notifications belong.
- [Telemetry (Pre 1.17.0)](telemetry-pre-1.17.0.md) — the legacy telemetry event
  list.
- [RFC: Removing Datasources, Adding the Query Webview](rfc-kxquery.md) — why
  datasources are removed, and the design of `.kxquery` and its editor.
- [KXI Datasource Issues — `ee-webviews` Worklist](kxi-datasource-issues.md) —
  the tracked datasource issues, each classified against the branch code.
