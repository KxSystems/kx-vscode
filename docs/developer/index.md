---
type: Index
title: Developer Notes
description: Architecture and contributor notes for the kdb VS Code extension — setup, notifications, execution flow, telemetry.
tags: [kdb, vscode, developer]
timestamp: 2026-07-10
---

# Developer Notes

Architecture and contributor notes for the kdb VS Code extension. See also the
[user notes](../user/index.md).

> The end-user product documentation is hosted separately at
> <https://gitlab.com/kxdev/documentation/vscode-docs/>.

- [Development](development.md) — setup, recommended extensions, scripts, debugging, releasing.
- [Log, Telemetry and User Notifications](log-telemetry-and-user-notifications.md) — the single notification entry point.
- [Progress Notifications](progress-notifications.md) — creating progress notifications.
- [Query Execution Call Hierarchy](query-execution-call-hierarchy.md) — file types, actions and their entry points.
- [Top Level Error Handling and User Notification Functions](top-level-error-handling.md) — where user-visible query notifications belong.
- [Telemetry (Pre 1.17.0)](telemetry-pre-1.17.0.md) — the legacy telemetry event list.
