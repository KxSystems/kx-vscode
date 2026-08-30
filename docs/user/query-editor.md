---
type: Reference
title: Query Editor
description: Editing and running getData, qSQL, SQL and User Defined Analytics in a .kxquery file.
tags: [kdb, vscode, query, uda, getdata, qsql, sql, insights]
timestamp: 2026-08-16
---

# Query Editor

A `.kxquery` file holds one query and the values it is run with — one of the
three every kdb Insights Enterprise connection answers (**qSQL**, **SQL** and
**getData**), or a User Defined Analytic (UDA) deployed on the connection.

It opens in the query editor, a custom editor with a toolbar carrying
**Connection**, **Run**, **Populate Scratchpad**, **Refresh** and **Save**.

**Connection** opens the same picker as the rest of the extension, narrowed to
Insights connections — a query runs nowhere else, so the REPL, local q processes
and quick connection strings are not offered. The status bar carries the same
connection and timeout items it does for notebooks and workbooks: click the
connection to rebind the file, the timeout to change how long its queries may
run.

Create one with **KX: New Query**, or with the **+** button on the Queries view.

## Choosing what to run

The **API** dropdown lists qSQL, SQL, getData and the UDAs deployed on the
selected connection. The first three are always offered, even before you
connect; the UDAs come from the connection's meta, and **Refresh** reloads them.
Type in the dropdown to filter it — a connection with hundreds of UDAs is a list
no one wants to scroll.

The required parameters are shown straight away — for getData that is `table`,
`startTS` and `endTS`. Everything else is added from the **+ Add parameter**
list and removed again with the trash button beside it.

A parameter that holds a list — `filter`, `agg`, `groupBy`, `sortCols`,
`labels`, `scope`, `outputTZCols` — keeps its place in that list once shown:
choosing it again adds another row. Each row has its own trash button, and
removing the last row removes the parameter.

Changing the API is not a discard. What you entered for the one you leave is
kept with the file, so switching to another API and back brings the form back as
you left it — the parameters you had added, and the values in them. Only the API
you have selected is run; the rest are along for the ride.

## qSQL and SQL

qSQL and SQL are text queries rather than analytics called with named
arguments, so each has a single `query` parameter — a box the size of a
query — and qSQL a `target` dropdown above it, listing the tiers the
connection reports and the DAP processes inside them as `assembly instance` and
`assembly instance dap`. Above those sits `assembly distributed` — the assembly
on its own, which leaves the instance out of the request so the resource
coordinator fans the query out over every tier. It is offered on Insights 1.13
and later, the versions whose qSQL scope accepts a missing instance. A target
the connection does not list is kept and shown, so a file written against
another connection opens unchanged. Neither field can be removed.

qSQL takes two optional parameters from the **+ Add parameter** list. `agg` is a
unary function run on the aggregator over the results the processes return,
defaulting to `raze` — a named function (`distinct`), a composition of them
(`'[distinct;raze]`) or a lambda. `labels` targets DAPs by label instead of by
tier. The gateway handles both rather than the data access processes, so the
meta does not describe them. SQL has no further parameters to add.

Both run on the selected connection exactly as the QSQL and SQL datasources did.
A workbook (`.kdb.q`, `.kdb.sql`) is still the better home for a query you are
writing — it has the language server, diagnostics, per-statement execution and
the run gutter — so reach for a `.kxquery` when what you want is a saved,
re-runnable request beside the getData and UDA queries it belongs with.

## Parameters

Each parameter is edited as its type asks:

| Parameter | Editor |
| :-------- | :----- |
| `table`, and any column field | a dropdown of what the connection reports |
| Text, number | a single field |
| Boolean | a checkbox |
| Timestamp | a date and time, and the nanoseconds, stored as `YYYY-MM-DDTHH:mm:ss.nnnnnnnnn` |
| `fill`, `temporality` | a dropdown of the values the request accepts |
| `filter`, `agg`, `groupBy`, `sortCols`, `labels`, `scope`, `outputTZCols` | rows you add and remove |

A row parameter reads as one line per entry — a filter is a column, an operator
and a value; an aggregation is a name, an operator and a column; `labels` and
`scope` are a key and a value. Filter values are split on spaces or semicolons,
and anything that parses as a number is sent as one, so `AAPL MSFT` becomes a
list of two symbols and `100` a number. An aggregation row has two column
dropdowns: fill the first for a function of one column, both for a function of
two such as `wavg`.

Anything that names a table or a column is chosen from a dropdown filled from
the connection's meta: `table` lists the tables it reports, and the column
fields of `filter`, `agg`, `groupBy`, `sortCols` and `outputTZCols` list the
columns of whichever table the query names — every column it knows of until you
pick one. A UDA gets the same lists: its distinguished `table` parameter, any parameter
it declares called `table`, and its symbol parameters named for columns
(`column`, `columns`, `col`, `cols`, `sortCols`, `groupBy`, `by`). A value
the meta does not mention is kept and shown, so opening a file written against
another connection never empties it.

`table` is the only getData parameter that must be filled in. The time range is
optional — leaving `startTS` and `endTS` empty queries the table unbounded, so
it is worth setting them on anything large. A parameter marked `*` is required;
symbol and string parameters may be left empty.

## Running

**Run** executes the query on the selected connection and writes the result to
the current results destination; **Populate Scratchpad** loads the result into a
scratchpad variable instead. Both honour the timeout shown in the status bar,
and both offer to connect when the selected connection is not connected.

Editing a field writes the file as you type; **Save** commits it to disk.

## Datasources

`.kdb.json` datasources are superseded by this editor and by workbooks:

| Datasource | Becomes |
| :--------- | :------ |
| API (getData) | a `.kxquery` running getData, with the filters, aggregations, groups, sorts and labels carried over |
| UDA | a `.kxquery` running the same UDA |
| QSQL | a `.kdb.q` workbook holding the query, with its execution target |
| SQL | a `.kdb.sql` workbook holding the query |

A QSQL or SQL datasource still converts to a workbook rather than to a
`.kxquery`: it is a query in text, and a workbook is a better editor for text.
The qSQL and SQL entries in the **API** dropdown are there for a query you
want to keep as a `.kxquery` beside the rest.

Opening a `.kdb.json` converts it and opens what came out; the original file is
left on disk. **KX: Convert datasources to queries** does the same across the
whole workspace. Files from the earlier `.kxuda` format are converted the same
way. Each converted file keeps the connection the original was bound to.
