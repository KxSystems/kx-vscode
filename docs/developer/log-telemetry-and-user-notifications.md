---
type: Developer Note
title: Log, Telemetry and User Notifications
description: All log, telemetry and user notifications must go through the notifications.notify() function.
tags: [kdb, vscode, notifications, telemetry, logging]
timestamp: 2026-07-10
---

# Log, Telemetry and User Notifications

All log, telemetry and user notifications should be done through [notifications.notify()](https://github.com/KxSystems/kx-vscode/blob/84fb68a9007dce6c07790d92cf6a8f23f4528f62/src/utils/notifications.ts#L93) function.
