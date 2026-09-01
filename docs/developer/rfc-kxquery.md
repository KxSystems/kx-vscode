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
  [KXI Datasource Issues](kxi-datasource-issues.md)

## Summary

`.kdb.json` datasources and the datasource editor are removed. In their place:

- **`.kxquery`** — a file holding one query and the values it is run with.
- **The query editor webview** — a custom editor for that file, in which
  getData, qSQL, SQL and a deployed UDA are the same thing rendered by the same
  code.

Every datasource converts to a `.kxquery`, when the user opens it.

## Why datasources go

A `.kdb.json` held four mutually exclusive queries — API (getData), UDA, QSQL,
SQL — behind four tabs of one 1,916-line editor, with `selectedType` picking the
live one and the other three branches written, parsed and validated anyway.

- **Four editors for one concept.** Every tab sends Insights a named query with
  values filled in. API and UDA are the same request and shared no code, so a
  fix in one never reached the other; QSQL and SQL each got a tab of their own
  for what is a two- and a one-parameter form.
- **The format was a union of four shapes**, of which a file is only ever one.
  Reading one means asking which branch is valid; writing one means keeping
  three dead branches consistent enough to round-trip.

The query editor keeps all four, as entries in one query list over one render
path: qSQL and SQL are two parameter lists and no machinery, so what goes is the
tab apparatus, the four-branch format and the second implementation of the same
request — not a capability. Their query text is still a textarea; a workbook is
the better place for a query being _written_, and remains the recommendation
there, but it cannot hold a saved request, so it is not where a datasource can
go.

Removing the format was never the point — removing the editor was.
`DataSourceFiles` stays as the internal execution format, produced from a
`.kxquery` by `toDataSourceFile` on its way to Insights and still what query
history and scratchpad import store, so nothing in the execution path had to
change for the editing surface to be replaced.

## The `.kxquery` file

```ts
export interface QueryFile {
  version: number;
  query?: UDA;
  drafts?: QueryDraft[];
}

export interface QueryDraft {
  name: string;
  params: { name: string; value?: unknown; selectedMultiTypeString?: string }[];
}
```

JSON on disk, backed by a `TextDocument`, so undo, dirty state, save and revert
are VS Code's rather than the webview's.

- **One query per file**, in `query`. No `selectedType`, no dead branches.
- **Switching query is not a discard.** The query being left keeps its values in
  `drafts`; coming back lays them over a query taken fresh from the meta, so a
  parameter the deployment changed or dropped is the meta's rather than the
  file's. A draft holding nothing entered is not kept.
- **`version` from the start**, so the next format change is a conversion rather
  than a guess.
- **Values are saved with the query.** A `.kxquery` is a re-runnable request,
  which is what datasources were used for anyway.
- **The connection is not in the file.** It stays in `kdb.connectionMap`, as for
  workbooks and notebooks, so a file can be shared without carrying someone
  else's connection name.
- **A new extension**, so the editor binds by filename rather than sniffing
  content, and the file inherits no JSON editor behaviour.

## The queries every connection answers

qSQL, SQL and getData head the **API** dropdown, ahead of the UDAs
`parseQueryList` reads from the meta. All three are described in
[models/query.ts](../../src/models/query.ts) as a `UDA` with parameters — the
only shape the view knows — because what each takes is fixed by the endpoint
rather than by a deployment, which also means they can be filled in and saved
before connecting.

| Query   | Parameters                                                                                                                |
| :------ | :------------------------------------------------------------------------------------------------------------------------ |
| qSQL    | `target` (a tier, a DAP process, or an assembly alone for every tier of it, from Insights 1.13), `query`, `agg`, `labels` |
| SQL     | `query`                                                                                                                   |
| getData | the fields of the getData request                                                                                         |

`queryType()` maps the selection back to a `DataSourceTypes` and
`toDataSourceFile()` fills the branch that type reads, so `runDataSource` and
`importScratchpad` need no new branches. Two annotations carry the text queries:
`ParamFieldType.Code`, a query-sized monospace textarea, and the `targets`
`ParamSource`, a dropdown filled from the DAPs the connection reports.

The qSQL `target` lives in the file rather than in `kdb.targetMap`, unlike a
workbook's: it is an argument to this request, and the QSQL datasource held it
the same way. Distinguished parameters are added to deployed UDAs only — getData
declares them all already, and they mean nothing to a text query.

## The query editor webview

`QueryEditorProvider` is a `CustomTextEditorProvider` for `*.kxquery`;
`KdbQueryView` is the Lit element inside it, a separate esbuild entry point so
it carries none of the welcome, chart or results weight. They exchange one
message type ([models/messages.ts](../../src/models/messages.ts)): `Update`
sends the view the file, the queries, the tables and their columns, the targets,
the connection and whether its meta is loaded; `Change` sends back the edited
file, debounced and applied as a `WorkspaceEdit`; `Save`, `Run`, `Populate`,
`Refresh` and `Connection` send back an action. Run and Populate go through
`Runner` to the existing `runDataSource`/`populateScratchpad`.

### One model for every query

The view renders exactly one thing: a `UDA` — a name, a description, a list of
`UDAParam`, a return type. getData is built as one (`GET_DATA_PARAMS`) rather
than given a model of its own. Four additions to `UDAParam` carry what it needs,
and are useful to UDAs too:

| Addition   | For                                                                                                                                                                      |
| :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `choices`  | fixed-value parameters (`fill`, `temporality`) render as a dropdown, not a field where a typo is a server error                                                          |
| `rows`     | list-valued parameters (`filter`, `agg`, `groupBy`, `sortCols`, `labels`, `scope`, `outputTZCols`) are edited as repeating rows and stored as the JSON the request wants |
| `multiple` | a parameter holding several values at once (getData's `columns`) is one multi-select                                                                                     |
| `source`   | values that come from the connection: its tables, or the columns of the table the query names                                                                            |

`UDAParamField` describes one column of a row, and three annotations on it —
`at`, `many`, `typed` — absorb the places where the value sent does not look
like the fields on screen: a slot two dropdowns write to, text that splits into
a list, a token sent as a number. `parseRows`/`serializeRows` implement that
mapping once for every row parameter, rather than once per widget as the
datasource editor did.

### Editing behaviour worth stating

- **Required parameters are shown; the rest are added** from `+ Add parameter`
  and removed again with the trash button. A row parameter stays in the list, so
  choosing it again adds another row.
- **Suggestions are offered, never enforced.** A value the connection does not
  list — another environment's table, a UDA not deployed here, anything at all
  while disconnected — is kept at the head of its own list, so opening a file
  never quietly empties it. Column lists narrow to the table the query names,
  and are empty until it does.
- **Every dropdown is searchable.** No native `select` is left in any webview:
  each is a `kdb-select`
  ([components/kdbSelect.ts](../../src/webview/components/kdbSelect.ts)), a
  filtering combobox over an input. A connection with hundreds of UDAs is not a
  list anyone can scroll, and a native select's popup is the browser's own —
  unthemed, unfilterable, and on macOS not stylable at all.

## Migration

`DataSourceConverterProvider` is the custom editor for `*.kdb.json`: opening one
converts it, opens the result and closes itself.
`KX: Convert datasources to queries` does the same across a workspace.

| Datasource    | Becomes                                                                                       |
| :------------ | :-------------------------------------------------------------------------------------------- |
| API (getData) | `.kxquery` running getData, with filters, aggregations, groups, sorts and labels carried over |
| UDA           | `.kxquery` running the same UDA                                                               |
| QSQL          | `.kxquery` running the builtin qSQL query, with its target, aggregation and labels            |
| SQL           | `.kxquery` running the builtin SQL query                                                      |

The original is left on disk and the converted file keeps its connection. The
API conversion folds the reconstructed legacy payload through the existing
`getApiBody` logic instead of reimplementing the mapping, so a converted query
sends the request the datasource sent.

Converting on open rather than on activation is deliberate: rewriting a
workspace nobody asked to have rewritten is not recoverable, and it would fire
on every repository that merely gets opened.

## Surface changes

- View **Datasources** → **Queries** (`kdb-datasource-explorer` →
  `kdb-query-explorer`).
- `kdb.datasource.create`, `kdb.datasource.refreshDataSourceExplorer`,
  `kdb.datasource.import` → `kdb.query.create`, `kdb.query.refresh`,
  `kdb.query.convert`.
- Custom editor `kdb.dataSourceEditor` (`*.kdb.json`) → `kdb.queryEditor`
  (`*.kxquery`), plus `kdb.dataSourceConverter` for `*.kdb.json`.
- Language `kdbdatasource` / `.kdb.json` → `kxquery` / `.kxquery`.
- Deleted: `kdbDataSourceView.ts` (1,916), its tests (1,208),
  `panels/datasource.ts` (181), `date-time-nano-picker.ts` (161),
  `dataSourceTreeProvider.ts` (152), and the panel and provider tests (213).

## Alternatives considered

| Alternative                                               | Rejected because                                                                                                                               |
| :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep the datasource editor for QSQL and SQL only          | the tab machinery — most of the cost — would have stayed; two entries in the query list add none                                               |
| Leave qSQL and SQL out of the query editor                | they are two of the answers to what to run on this connection, and run, populate, history and telemetry already carried them                   |
| Convert QSQL and SQL datasources to workbooks             | what the first cut did; a workbook cannot hold a saved request — `agg` and `labels` were dropped and the target split off into `kdb.targetMap` |
| Put the qSQL target in `kdb.targetMap`                    | it is an argument to the request; splitting a two-field query across a file and a setting is worse than either                                 |
| Keep `.kdb.json` and replace only the editor              | the union-of-four shape is what forces dead branches, and it would invite the next editor to support all four again                            |
| Migrate every datasource on activation                    | an unrequested, irreversible write to the user's workspace                                                                                     |
| Give getData its own model and view                       | that is what the API and UDA tabs already were                                                                                                 |
| Read getData's parameters from the meta                   | it makes an endpoint-fixed contract look deployment-dependent, and leaves the editor useless while disconnected                                |
| Model `filter`/`agg` as structured types rather than rows | more type machinery than two parameters justify; `rows` is data, and the view stays generic                                                    |

## Risks and open questions

- getData's structured parameters are not really scalar UDA arguments; `at`,
  `many` and `typed` bridge that. The trade is one representation with three
  annotations against two parallel models with no shared code.
- Conversion is one-way.
- Should `.kxquery` ever hold more than one query (a saved sequence)?
- Should `DataSourceFiles` be retired once only the adapter produces it?
- Should the converter archive the original `.kdb.json` after a release or two,
  rather than leaving it beside the converted file forever?
