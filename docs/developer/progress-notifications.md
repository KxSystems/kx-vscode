---
type: Developer Note
title: Progress Notifications
description: All progress notifications must be obtained via the Runner.create() static function.
tags: [kdb, vscode, notifications, progress]
timestamp: 2026-07-10
---

# Progress Notifications

All progress notifications should be obtained by calling [Runner.create()](https://github.com/KxSystems/kx-vscode/blob/84fb68a9007dce6c07790d92cf6a8f23f4528f62/src/utils/notifications.ts#L77) static function.
