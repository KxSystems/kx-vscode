---
type: Reference
title: "KXI datasource issues — ee-webviews worklist"
description:
  "KXI datasource issues assigned to the extension maintainer, every child of
  epic KXI-73189, and related issues added by hand, each open one classified
  against the code on the ee-webviews branch."
timestamp: 2026-08-29
tags: [jira, kxi, datasources, vscode-extension]
---

# KXI datasource issues — `ee-webviews` worklist

- **Related**:
  [RFC: Removing Datasources, Adding the Query Webview](rfc-kxquery.md) (why the
  editor was replaced), [Query Editor](../user/query-editor.md) (user
  documentation)

Project **KXI**, board **478** (VSCode Extension). Three sources, deduped:
issues **assigned to the extension maintainer** matching
`datasource`/`data source` in any text field; **every child of epic
[KXI-73189](https://kxl.atlassian.net/browse/KXI-73189)** regardless of
assignee; and issues **judged datasource-related by hand** that neither query
catches. 32 issues — 26 open, 6 closed. Retrieved 2026-08-29.

Neither text nor epic search is sufficient on its own:
[KXI-65951](https://kxl.atlassian.net/browse/KXI-65951) is in the epic but says
"UDA parameter type" rather than "datasource", and
[KXI-71824](https://kxl.atlassian.net/browse/KXI-71824) is in neither — it says
"stack traces" and has no epic, yet the defect is in `runDataSource`. Re-pull
all three sources.

Each open issue is classified against the code on the `ee-webviews` branch,
after the commit that replaced the datasource editor with the query editor:
**9** fixed, **4** partially fixed, **1** disputed, **10** not fixed, **2**
obsolete. Verdicts come from reading the source, not from the Jira state — none
of these has been closed in Jira on the strength of a verdict here.

## Fixed (9)

| Key                                                     | Type  | Priority      | Summary                                                                                                               | Evidence                                                                                                                                                                    | Epic                                                    |
| ------------------------------------------------------- | ----- | ------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [KXI-70349](https://kxl.atlassian.net/browse/KXI-70349) | Bug   | High          | v1 GetMeta being used by the VSCode datasource instead of the latest version                                          | Only `api/v3/meta` remains; landed in v1.13.0 (commits da784bec, e1ca8f17), not on this branch.                                                                             | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70493](https://kxl.atlassian.net/browse/KXI-70493) | Story | High          | Datasource - UDA table parameter should be updated to a search-select                                                 | `source: "tables"` routes the UDA table param to the filterable `kdb-select`.                                                                                               | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70501](https://kxl.atlassian.net/browse/KXI-70501) | Task  | High          | Datasource timeout field should be moved to the status bar for consistency with workbooks and notebooks               | `isQuery(uri)` branch in `setTimeoutItem` shows the status-bar timeout item.                                                                                                | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-68887](https://kxl.atlassian.net/browse/KXI-68887) | Task  | Medium        | Unify datasource connection and timeout selection UI                                                                  | Query files use the same two status-bar items as workbooks and notebooks.                                                                                                   | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70471](https://kxl.atlassian.net/browse/KXI-70471) | Bug   | Medium        | Adding a new datasource doesn't generate a unique name which risks dataloss if the existing datasource is overwritten | `addWorkspaceFile` increments `query-N.kxquery`, checking disk and untitled docs; single extension now.                                                                     | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70490](https://kxl.atlassian.net/browse/KXI-70490) | Bug   | Medium        | Datasource - qSQL target dropdown is difficult to read if there are multiple targets and instances                    | `source: "targets"` gives the target dropdown search; not split into two dropdowns.                                                                                         | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-69253](https://kxl.atlassian.net/browse/KXI-69253) | Bug   | To be defined | Datasource requests aren't setting timeouts                                                                           | Provider passes `getTimeoutForUri().value` on Run and Populate; forwarded to all four query types.                                                                          | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70489](https://kxl.atlassian.net/browse/KXI-70489) | Bug   | To be defined | Datasource - start time and end time datepicker issues                                                                | Native `datetime-local` + 9-digit nanos field; the custom picker that would not close was deleted.                                                                          | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-69680](https://kxl.atlassian.net/browse/KXI-69680) | Story | Highest       | VSCode: Support the new qSQL distributed option                                                                       | `parseTargets` offers the assembly on its own from Insights 1.13, `generateQSqlBody` leaves `tier` and `dap` out of its scope, and the target quick-pick offers it as well. | —                                                       |

## Partially fixed (4)

| Key                                                     | Type     | Priority      | Summary                                                                              | Evidence                                                                                                                                                                                                                                                                          | Epic                                                    |
| ------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [KXI-60352](https://kxl.atlassian.net/browse/KXI-60352) | Sub-task | Highest       | update the UDA fields at datasource of Vscode extension                              | The new editor is a consistent field/label/help layout; needs the designer to sign off.                                                                                                                                                                                           | [KXI-60351](https://kxl.atlassian.net/browse/KXI-60351) |
| [KXI-70494](https://kxl.atlassian.net/browse/KXI-70494) | Story    | High          | Datasource - UDA labels parameter should be updated to a key-value pair field        | getData `labels` is key/value rows; the **UDA** `labels` param has no `rows` and still renders raw JSON. Triage: still applies, and cheaper than filed — the `rows` mechanism exists and is proven on getData, so the fix is one entry in `UDA_DISTINGUISHED_PARAMS`.             | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70496](https://kxl.atlassian.net/browse/KXI-70496) | Story    | High          | Datasource - UDA scope parameter should be updated to populated widget               | getData `scope` is key/value rows; UDA `scope` is still raw JSON. Triage: splits in two — the no-more-JSON half is a `rows` addition like labels, but the package/tier/dap widget needs `ParamSource`s the extension does not fetch today. Consider filing the widget separately. | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-65951](https://kxl.atlassian.net/browse/KXI-65951) | Task     | To be defined | VSCode to allow for specifying UDA parameter type when there are multiple registered | Multitype UI is done — `ParamFieldType.MultiType` and `renderMultitype` give a per-parameter type dropdown. The other half is not: UDA calls still go over REST (`udaBase: "servicegateway/"`), with no qIPC path, so the type conversion the ticket asks for is unaddressed.     | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |

## Disputed — needs a decision (1)

| Key                                                     | Type | Priority | Summary                                     | Evidence                                                                                                                                                                                                                                                                                                                                     | Epic                                                    |
| ------------------------------------------------------- | ---- | -------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [KXI-70488](https://kxl.atlassian.net/browse/KXI-70488) | Bug  | Medium   | Datasource row limit allows negative values | Premise does not hold for this editor. Negative `limit` is real API semantics ("a negative value takes them from the end"), the old form hid the sign behind a First/Last radio, and converted datasources arrive with `limit: -100000`. A `min` attribute would delete last-N and invalidate converted files. Needs a decision — see Notes. | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |

## Not fixed (10)

| Key                                                     | Type  | Priority      | Summary                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                   | Epic                                                    |
| ------------------------------------------------------- | ----- | ------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [KXI-34721](https://kxl.atlassian.net/browse/KXI-34721) | Bug   | High          | VSCode: Certain q queries do not work with datasources qsql                          | Triage: still applies, untouched by the rewrite. The RFC states the execution path is deliberately unchanged, so a qSQL result bug survives it intact.                                                                                                                                                                                                                     | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-71824](https://kxl.atlassian.net/browse/KXI-71824) | Story | High          | [vscode] Display stack traces for UDA and qsql queries                               | Both failure branches of `runDataSource` collapse the response to `res.errorMsg ? res.errorMsg : res.error` (dataSourceCommand.ts:185 and :208), discarding `res.stacktrace`. The local path already appends it (localConnection.ts:187), so the fix mirrors an existing pattern.                                                                                          | —                                                       |
| [KXI-65665](https://kxl.atlassian.net/browse/KXI-65665) | Story | Medium        | VSCode: Allow the user to choose the active connection for workbooks and datasources | `setRunScratchpadItemText` shows `(active)` for connectable files but `(none)` for `.kxquery`.                                                                                                                                                                                                                                                                             | —                                                       |
| [KXI-69283](https://kxl.atlassian.net/browse/KXI-69283) | Bug   | Medium        | Vscode suppresses query errors on RC or SG                                           | Error path on RC/SG kill untouched by this branch.                                                                                                                                                                                                                                                                                                                         | [KXI-69362](https://kxl.atlassian.net/browse/KXI-69362) |
| [KXI-69949](https://kxl.atlassian.net/browse/KXI-69949) | Story | Medium        | Add Preview tab to the Data Source page                                              | No preview in the query editor or provider.                                                                                                                                                                                                                                                                                                                                | —                                                       |
| [KXI-70491](https://kxl.atlassian.net/browse/KXI-70491) | Bug   | Medium        | Datasource - API does not have a Select Columns filter                               | Triage: still applies but reframed — this is a getData _parameter_ gap, not a form feature. It becomes one `GET_DATA_PARAMS` entry using the existing `multiple` control and `source: "columns"`. Confirm the endpoint accepts a column projection before building it.                                                                                                     | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-73276](https://kxl.atlassian.net/browse/KXI-73276) | Bug   | Medium        | Some datasource results are displayed incorrectly                                    | Result rendering cannot represent every q type. Reporter proposes `structuredText` only, or a text format via `.Q.s`/`formatQ.q`. Results view, not the editor — unaffected by the rewrite.                                                                                                                                                                                | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-73119](https://kxl.atlassian.net/browse/KXI-73119) | Bug   | To be defined | `1b and `0b are being incorrectly changed to true and false                          | `kdbToAgGridCellType` maps kdb `boolean`/`booleans` onto ag-grid's `boolean` cellDataType (resultsRenderer.ts:168), which renders `true`/`false` rather than `1b`/`0b`. A general list takes one column type, which is how an enlisted symbol ends up rendered as a boolean too — worth tracing the column-typing path for mixed lists. Same defect as KXI-73276.          | —                                                       |
| [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) | Epic  | To be defined | Datasource improvements                                                              | Epic — closes with its children. 15 in this list: 8 fixed, 1 disputed, 4 still applying, 2 obsolete.                                                                                                                                                                                                                                                                       | —                                                       |
| [KXI-73220](https://kxl.atlassian.net/browse/KXI-73220) | Bug   | To be defined | Show error messages returned by qsql queries                                         | Populate Scratchpad swallows a qsql error as `{"status":200}`. Same root as KXI-69283 (errors suppressed on RC/SG) — worth working the two together.                                                                                                                                                                                                                       | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |

## Obsolete — close, do not fix (2)

| Key                                                     | Type  | Priority | Summary                                                             | Evidence                                                                                                                                                                                                                                                                                                          | Epic                                                    |
| ------------------------------------------------------- | ----- | -------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [KXI-70499](https://kxl.atlassian.net/browse/KXI-70499) | Task  | Medium   | Datasource save button is confusing                                 | Triage: the described confusion is gone. Refresh and Save are separate buttons, and the editor is `TextDocument`-backed so dirty state, undo and save are VS Code's — the RFC makes Save a deliberate delegation to `workbench.action.files.save`. "Can we remove it?" is now a small preference call, not a bug. | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |
| [KXI-70500](https://kxl.atlassian.net/browse/KXI-70500) | Story | Medium   | Datasource should have a clear button to reset the form in each tab | Triage: premise removed. There are no tabs and no permanently-present optional fields to reset — optional parameters do not exist until added via `+ Add parameter`, and each has its own trash button. Re-file if a "clear all rows" on a filled getData is still wanted.                                        | [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) |

## Already closed in Jira (6)

| Key                                                     | Type  | Priority      | Status   | Summary                                                                                                  | Updated    |
| ------------------------------------------------------- | ----- | ------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| [KXI-64009](https://kxl.atlassian.net/browse/KXI-64009) | Story | High          | Rejected | Workbook enhancements - allow q and python files to be open multiple times targeting different endpoints | 2026-05-22 |
| [KXI-62193](https://kxl.atlassian.net/browse/KXI-62193) | Task  | To be defined | Done     | R - RFC for Q notebooks                                                                                  | 2025-10-23 |
| [KXI-65355](https://kxl.atlassian.net/browse/KXI-65355) | Story | To be defined | Rejected | Workbooks and Notebooks are executing IE queries as DATASOURCE                                           | 2025-10-23 |
| [KXI-46528](https://kxl.atlassian.net/browse/KXI-46528) | Task  | To be defined | Done     | Regression: Import old style data sources into .kx folder                                                | 2025-10-23 |
| [KXI-38369](https://kxl.atlassian.net/browse/KXI-38369) | Task  | High          | Done     | Create UI Mockup for multiple scratchpads & datasources                                                  | 2025-10-23 |
| [KXI-44186](https://kxl.atlassian.net/browse/KXI-44186) | Task  | To be defined | Done     | Right Click Functionality for Multi-scratchpads/workbooks                                                | 2025-10-23 |

## Notes

- [KXI-70349](https://kxl.atlassian.net/browse/KXI-70349) is listed as fixed,
  but it was fixed in **v1.13.0** — seven releases back — not by the current
  work. If a customer hit the getMeta error after 1.13, the API version was not
  the cause and the issue needs a fresh diagnosis.
- Epic [KXI-73189](https://kxl.atlassian.net/browse/KXI-73189) has **18**
  children, all listed here, triaged 2026-08-29 against
  [the RFC](rfc-kxquery.md): **8** fixed, **3** partially fixed, **1** disputed,
  **4** not fixed, **2** obsolete. Two are unassigned (KXI-73220, KXI-73276) and
  one more is assigned but was missed by text search (KXI-65951). The epic
  itself closes with its children.
- The triage rule: the RFC replaced the _editing surface_ and deliberately left
  the _execution path_ untouched. So form-shaped complaints about tabs,
  always-present fields and the save/refresh switch died with the old editor,
  while API-level and result-level bugs survive it unchanged.
- [KXI-70488](https://kxl.atlassian.net/browse/KXI-70488) needs a call before
  any code is written. The reporter wanted negatives blocked, but that was
  written against the old form, which exposed a First/Last radio over a positive
  count and encoded the sign downstream in `getLegacyApiBody`. The new editor
  dropped that radio, so the sign _is_ the control. Two ways out: **(A) reject
  it** — signed `limit` matches the API and the help text explains it; or **(B)
  restore an explicit First/Last control** over a positive count, after which
  blocking negatives is correct and matches the Insights UI the reporter cites.
  B needs `limit` to become a composite field rather than `Number`.
- Unrelated find: the API transport used to hardcode `body.params` to
  `table`/`startTS`/`endTS`, silently discarding filter, groupBy, agg, sortCols,
  limit, labels and scope. This branch sends the full payload. Any "my getData
  filter is ignored" report traces to that.
- Neighbouring epic [KXI-73198](https://kxl.atlassian.net/browse/KXI-73198)
  "VSCode - KDB Results Improvements" holds 8 unassigned/triage issues about the
  results view (truncation warnings, sorting and filtering, stack traces, column
  widths). None are datasource issues so none are listed here, but KXI-73276 and
  KXI-73119 above overlap them — if result rendering gets worked, that epic is
  the place to look first.
