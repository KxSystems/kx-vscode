---
type: RFC
title: "RFC: Removing Datasources, Adding the Query Webview"
description:
  Why .kdb.json datasources and their editor are removed, and the design of the
  .kxquery format and the query editor webview that replace them.
tags: [kdb, vscode, rfc, datasource, kxquery, webview, uda, getdata]
timestamp: 2026-08-17
---

# RFC: Removing Datasources, Adding the Query Webview

- **Status**: Implemented on `ee-webviews`, targeting `dev`
- **Related**: [Query Editor](../user/query-editor.md) (user documentation),
  [Query Execution Call Hierarchy](query-execution-call-hierarchy.md),
  [KXI Datasource Issues](kxi-datasource-issues.md) (what the replacement fixed
  and left)

## Summary

Remove `.kdb.json` datasources and the datasource editor. Replace them with:

- **`.kxquery`** — a file holding one analytic and the values it is run with.
- **The query editor webview** — a custom editor for that file, in which getData
  and a deployed UDA are the same thing rendered by the same code.

QSQL and SQL are two more entries in that editor's query list, so every
datasource converts to a `.kxquery`. Existing files are converted when opened;
nothing is rewritten behind the user's back.

## Background

A `.kdb.json` datasource held four mutually exclusive kinds of query behind four
tabs of one custom editor:

| Tab  | Held                                                                                |
| :--- | :---------------------------------------------------------------------------------- |
| API  | a getData request — table, time range, filters, groups, aggregations, sorts, labels |
| UDA  | a deployed analytic and its parameter values                                        |
| QSQL | a q/qsql query string, and a target                                                 |
| SQL  | a SQL query string                                                                  |

One file format described all four. `selectedType` picked the live one; the
other three branches were written, parsed and validated anyway.

The editor was `src/webview/components/kdbDataSourceView.ts` — 1,916 lines,
1,208 lines of tests — plus a panel, a tree provider and a bespoke
`date-time-nano-picker`.

## Why datasources go

**Two of the four tabs were a worse text editor.** QSQL and SQL were a
`<textarea>` holding a query string. A workbook (`.kdb.q`, `.kdb.sql`) holds the
same query in a real editor: language server, completion, diagnostics, the run
gutter, per-statement and selection execution, diff and blame. The only thing
the datasource form added around them — a connection and a target — workbooks
already have through `kdb.connectionMap` and `kdb.targetMap`. So the tab
machinery around the two of them — most of the component's complexity — is gone,
and a query you are writing belongs in a workbook. What they are _not_ is a
concept the query editor has to be without: they are two more entries in its
query list (see below), which costs two parameter lists and no machinery at all
— and that is what a converted datasource becomes, so nothing about it has to be
reassembled from a text file and a workspace setting.

**The other two tabs were two editors for one concept.** API and UDA both call
an analytic on Insights with named parameters, and they shared no code. The API
tab carried a hand-built model of filters, groups, aggregations and sorts, with
its own widgets and serialisation; the UDA tab had separate machinery driven by
the connection meta. A fix in one never reached the other.

**The format was a union of four shapes.** Reading a datasource means asking
which branch is valid; writing one means keeping three dead branches consistent
enough to round-trip. A file is only ever one of the four.

**Removing the format was never the point — removing the editor was.**
`DataSourceFiles` stays as the internal execution format: a `.kxquery` is
adapted into one on its way to Insights, and it remains what query history and
scratchpad import store. So nothing in the execution path had to change for the
editing surface to be replaced.

## The `.kxquery` file

```ts
export interface QueryFile {
  version: number;
  query?: UDA;
  drafts?: QueryDraft[];
}

export interface QueryDraft {
  name: string;
  params: {
    name: string;
    value?: unknown;
    selectedMultiTypeString?: string;
  }[];
}
```

That is the whole format — JSON on disk, one analytic per file, backed by a
`TextDocument` so undo, dirty state, save and revert are VS Code's rather than
the webview's.

Design points:

- **One query per file.** No `selectedType`, no dead branches; one analytic
  runs.
- **Switching API is not a discard.** The API being left keeps what was entered
  for it in `drafts`, so coming back to it comes back to the values. Only the
  selected API's state lives in `query`; a draft names the parameters that were
  on show and the values in them, laid back over whatever the meta describes at
  the time — so a parameter the deployment has changed or dropped is the meta's
  rather than the file's. This is not the union-of-four again: every entry is
  one API's values rather than a rival shape for the same request, a draft
  holding nothing entered is not kept, and the selected API is never one of
  them.
- **A `version` field from the start**, so the next format change can be a
  conversion rather than a guess about what an untagged file meant.
- **Values are saved with the query.** A `.kxquery` is a re-runnable request,
  not a template — which is what datasources were being used for anyway.
- **The connection is not in the file.** It stays in `kdb.connectionMap`, as for
  workbooks and notebooks, so one mechanism covers every runnable file and a
  file can be shared without carrying someone else's connection name.
- **A new extension rather than `.kdb.json`.** The editor binds by filename
  instead of sniffing content, converted files stay visibly distinct from their
  originals, and the file does not inherit JSON editor behaviour for something
  not meant to be hand-edited.

## The queries every connection answers

Three entries in the **API** dropdown are not read from the meta — qSQL, SQL and
getData, in that order, because what each takes is fixed by the endpoint rather
than by the deployment. All three are described in
[models/query.ts](../../src/models/query.ts) as a `UDA` with parameters, which
is the only shape the view knows:

| Query   | Parameters                                     |
| :------ | :--------------------------------------------- |
| qSQL    | `target` — a tier or DAP process — and `query` |
| SQL     | `query`                                        |
| getData | the fields of the getData request              |

`queryType()` maps the selected query back to a `DataSourceTypes` and
`toDataSourceFile()` fills the branch that type reads: the getData payload, the
`qsql` pair, or the `sql` query. Nothing in the execution path changed for qSQL
and SQL either — `runDataSource` and `importScratchpad` already had those
branches, driven by the same `selectedType`.

Two annotations carry the text queries: `ParamFieldType.Code`, a parameter shown
as a query-sized monospace textarea, and the `targets` `ParamSource`, a
parameter whose dropdown is filled from the DAPs the connection reports
(`parseTargets`), alongside the existing `tables` and `columns`. Both parameters
are marked required, which is what makes them non-removable; neither is marked
`*`, since a string parameter may be left empty.

The `target` is in the file rather than in `kdb.targetMap`, unlike a workbook's:
it is an argument to this request, chosen beside the query it routes, and the
QSQL datasource a `.kxquery` supersedes held it the same way. The _connection_
is still not in the file.

Distinguished parameters are added to a deployed UDA only. getData declares
every one of them already, and none of them mean anything to a text query.

## The query editor webview

`QueryEditorProvider` is a `CustomTextEditorProvider` for `*.kxquery`;
`KdbQueryView` is the Lit element inside it. They exchange one message type
([models/messages.ts](../../src/models/messages.ts)):

| Direction   | Command                                            | Carries                                                                                                  |
| :---------- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| host → view | `Update`                                           | the file, the queries available, the tables and columns, whether meta is loaded, the selected connection |
| view → host | `Change`                                           | the edited file, written back to the document                                                            |
| view → host | `Save`, `Run`, `Populate`, `Refresh`, `Connection` | the action, with the file and connection where relevant                                                  |

### getData and UDAs are one model

The editor renders exactly one thing: a `UDA` — a name, a description, a list of
`UDAParam`, a return type. getData is built as one, `GET_DATA_PARAMS` in
[models/query.ts](../../src/models/query.ts), rather than given a model of its
own:

- Its parameters are **fixed by the endpoint**, not by a deployment, so they are
  written into the extension rather than read from the meta. This also means
  getData can be offered, filled in and saved **before connecting** — the meta
  only supplies the UDA list and the table/column suggestions.
- `parseQueryList` puts getData at the head of the list of UDAs the connection
  reports, so the picker has one list and the view has one render path.

Three additions to `UDAParam` carry what getData needs, and are useful to UDAs
as well:

| Addition  | For                                                                                                                                                                      |
| :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `choices` | fixed-value parameters (`fill`, `temporality`) render as a dropdown, not a free-text field where a typo is a server error                                                |
| `rows`    | list-valued parameters (`filter`, `agg`, `groupBy`, `sortCols`, `labels`, `scope`, `outputTZCols`) are edited as repeating rows and stored as the JSON the request wants |
| `source`  | fields whose values come from the connection: its tables, or the columns of whichever table the query names                                                              |

`UDAParamField` describes one column of a row and absorbs the three
irregularities of the getData request:

- `at` — where the field sits in the **value sent**, when that differs from
  where it sits on screen. An aggregation is `[name, operator, columns]` and its
  two column dropdowns both write to slot 2: fill one for `avg`, both for a
  two-argument function like `wavg`; the slot becomes a list only once both are
  filled.
- `many` — the field's text splits on whitespace or semicolons into a list, so a
  filter value reads `AAPL MSFT`.
- `typed` — a token that parses as a number is sent as one.

`parseRows`/`serializeRows` implement that mapping once for every row parameter,
rather than once per widget as the datasource editor did.

UDAs inherit the table and column dropdowns that used to be an API-tab feature:
`sourceForParam` recognises the parameter names the kdb APIs use (`table`,
`tablename`; `column`, `columns`, `col`, `cols`, `sortCols`, `groupBy`,
`bycols`, `by`) and only where the parameter is a symbol or string — never a
number, flag or timestamp.

### Editing behaviour worth stating

- **Required parameters are shown; the rest are added.** `+ Add parameter` lists
  the optional and distinguished parameters; the trash button beside a parameter
  removes it. A row parameter stays in the list once shown, so choosing it again
  adds another row.
- **Suggestions are offered, never enforced.** A select can only display a value
  it has an option for, so a value the connection does not list — a table from
  another environment, a UDA that is not deployed here, anything at all while
  disconnected — is kept at the head of its own list. Opening a file never
  quietly empties it.
- **Every dropdown is searchable.** There is no native `select` left in any
  webview: every one is a `kdb-select`
  ([components/kdbSelect.ts](../../src/webview/components/kdbSelect.ts)), a
  combobox over an input — type to filter, prefix matches ranked above contained
  ones and the match highlighted, arrows to walk the list, Enter to pick, Escape
  to leave the value as it was. A connection with hundreds of UDAs, tables or
  columns is a list no one can scroll, and the popup a native select opens is
  the browser's own: unthemed, unfilterable, and on macOS not stylable at all.
  The first entry clears the value, the way the blank option did, unless the
  control is `required` — the type of a multitype parameter is always one of its
  types. Options are strings, or `{value, label, group, color}` where the text
  shown differs from the value stored, the list is grouped or an option carries
  a colour: **+ Add parameter** is one control with an _Optional_ and a
  _Distinguished_ group. A `multiple` control holds several values instead of
  one, showing them as badges in the field and ticking them in the list — the
  connection view picks a connection's labels that way, with _+ Create new
  label..._ as an entry the view refuses as a value, opening its modal instead.
- **Rows being edited are held in the view.** A row the user has added but not
  filled in serializes to nothing, so the stored value alone cannot say how many
  rows there are.
- **Edits are debounced into the document** (200 ms) and written with a
  `WorkspaceEdit`, with a re-entrancy guard so the document change the view
  causes does not bounce back as an update. **Save** flushes and delegates to
  `workbench.action.files.save`.
- **Run and Populate Scratchpad** go through `Runner` with cancellation and the
  file's timeout, and offer to connect when the selected connection is not
  connected. Both adapt the file with `toDataSourceFile` and call the existing
  `runDataSource`/`populateScratchpad` — the execution path is untouched.

### Bundling

The view is a separate esbuild entry point (`src/webview/query.ts` →
`out/query.js`) so it carries none of the welcome, chart or results weight.
`codicon.ttf` is copied beside it and its `@font-face` is declared by the page,
because a font face only counts when registered on the document, never inside
the shadow root that asks for it; the toolbar therefore renders glyphs as text
rather than through codicon's `.codicon-*` classes.

## Migration

`DataSourceConverterProvider` is registered as the custom editor for
`*.kdb.json`. Opening one converts it, opens the result and closes itself.
`KX: Convert datasources to queries` does the same across a workspace.

| Datasource    | Becomes                                                                                       |
| :------------ | :-------------------------------------------------------------------------------------------- |
| API (getData) | `.kxquery` running getData, with filters, aggregations, groups, sorts and labels carried over |
| UDA           | `.kxquery` running the same UDA                                                               |
| QSQL          | `.kxquery` running the builtin qSQL query, with its target, aggregation and labels            |
| SQL           | `.kxquery` running the builtin SQL query                                                      |

The original file is left on disk, and each converted file keeps the connection
the original was bound to. The API conversion reconstructs the legacy payload
and folds it through the existing `getApiBody` logic instead of reimplementing
the mapping, so a converted query sends the request the datasource sent.

Converting on open rather than migrating on activation is deliberate: rewriting
files in a workspace nobody asked to have rewritten is not recoverable, and it
would fire on every repository that merely gets opened. Converting on open
happens exactly when the user is looking at the file.

## Surface changes

- View **Datasources** → **Queries** (`kdb-datasource-explorer` →
  `kdb-query-explorer`).
- Commands `kdb.datasource.create`, `kdb.datasource.refreshDataSourceExplorer`,
  `kdb.datasource.import` → `kdb.query.create`, `kdb.query.refresh`,
  `kdb.query.convert`.
- Custom editor `kdb.dataSourceEditor` (`*.kdb.json`) → `kdb.queryEditor`
  (`*.kxquery`), with `kdb.dataSourceConverter` added for `*.kdb.json`.
- Language `kdbdatasource` / `.kdb.json` → `kxquery` / `.kxquery`.

Deleted: `kdbDataSourceView.ts` (1,916), its tests (1,208),
`panels/datasource.ts` (181), `date-time-nano-picker.ts` (161),
`dataSourceTreeProvider.ts` (152), and the panel and provider tests (213).

## Alternatives considered

- **Keep the datasource editor for QSQL and SQL only.** Rejected: the tab
  machinery — most of the cost — would have stayed. Offering them as two entries
  in the query list instead keeps the one editing surface and adds no machinery.
- **Leave QSQL and SQL out of the query editor entirely.** Rejected once the
  editor existed: the question a `.kxquery` answers is what to run on this
  connection, and two of the answers Insights gives were missing from the list —
  with the run, populate, history and telemetry paths already carrying them.
- **Put the qSQL target in `kdb.targetMap`, as a workbook's is.** Rejected: it
  is an argument to the request, and splitting a two-field query across a file
  and a workspace setting is worse than either.
- **Convert QSQL and SQL datasources to workbooks.** What the first cut did, on
  the grounds that a workbook is the better editor for a query in text. Rejected
  once the editor held qSQL and SQL: a datasource is a saved request, and a
  workbook cannot hold one — `agg` and `labels` had nowhere to go and were
  dropped, and the target moved into `kdb.targetMap`, splitting the request
  across a file and a workspace setting. A workbook remains the right home for a
  query the user is writing; it is the wrong shape for one being migrated.
- **Keep `.kdb.json` and replace only the editor.** Rejected: the union-of-four
  shape is what forces dead branches, and a format that outlives its editor
  invites the next editor to support all four again.
- **Migrate every datasource on activation.** Rejected as an unrequested,
  irreversible write to the user's workspace.
- **Give getData its own model and view.** Rejected: that is exactly what the
  API and UDA tabs already were — two editors, one concept, no shared fixes.
- **Read getData's parameters from the connection meta.** Rejected: it makes an
  endpoint-fixed contract look deployment-dependent, and leaves the editor
  useless while disconnected.
- **Model `filter`/`agg` as first-class structured types rather than
  JSON-with-rows.** Rejected as more type machinery than two parameters justify;
  `rows` is data, and the view stays generic.

## Risks and open questions

- getData's structured parameters are not really scalar UDA arguments; `at`,
  `many` and `typed` exist to bridge that. The trade is one representation with
  three annotations against two parallel models with no shared code.
- Conversion is one-way: a converted datasource is a `.kxquery` and does not
  become a datasource again.
- Should `.kxquery` ever hold more than one analytic (a saved sequence), or is
  one-per-file permanent?
- Should `DataSourceFiles` be retired as the execution format once only the
  adapter produces it?
- Should the converter archive or delete the original `.kdb.json` after a
  release or two, rather than leaving it beside the converted file forever?
