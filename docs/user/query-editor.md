---
type: Reference
title: Query Editor
description:
  Editing and running getData, qSQL, SQL and User Defined Analytics in a
  .kxquery file.
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
`labels`, `outputTZCols` — keeps its place in that list once shown: choosing it
again adds another row. Each row has its own trash button, and removing the last
row removes the parameter.

Changing the API is not a discard. What you entered for the one you leave is
kept with the file, so switching to another API and back brings the form back as
you left it — the parameters you had added, and the values in them. Only the API
you have selected is run; the rest are along for the ride.

## qSQL and SQL

qSQL and SQL are text queries rather than analytics called with named arguments,
so each has a single `query` parameter — a box the size of a query — and qSQL a
`target` dropdown above it, listing the tiers the connection reports and the DAP
processes inside them as `assembly instance` and `assembly instance dap`. Above
those sits `assembly distributed` — the assembly on its own, which leaves the
instance out of the request so the resource coordinator fans the query out over
every tier. It is offered on Insights 1.13 and later, the versions whose qSQL
scope accepts a missing instance. A target the connection does not list is kept
and shown, so a file written against another connection opens unchanged. Neither
field can be removed.

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

## Scope

`scope` says where a request runs, and it is asked the way qSQL asks it: the
same dropdown, listing the tiers the connection reports and the DAP processes
inside them, with the assembly on its own above them. Add it from **+ Add
parameter** and pick a target — getData, a UDA and qSQL all answer the question
once, in the same words. What the request carries is the assembly, tier and DAP
the target stands for, resolved against the connection when the query runs, so a
file written against one connection still names the right processes on another.

Leave it off and the choice is the resource coordinator's, which is what you
want unless you have a reason to pin a query to one process. A file written
before the dropdown, holding a scope as JSON text, is sent as the dictionary it
already describes.

## Parameters

Each parameter is edited as its type asks:

| Parameter                                                        | Editor                                                                          |
| :--------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `table`, and any column field                                    | a dropdown of what the connection reports                                       |
| Text, number                                                     | a single field                                                                  |
| Boolean                                                          | a checkbox                                                                      |
| Timestamp                                                        | a date and time, and the nanoseconds, stored as `YYYY-MM-DDTHH:mm:ss.nnnnnnnnn` |
| `fill`, `temporality`                                            | a dropdown of the values the request accepts                                    |
| `scope`                                                          | the same target dropdown qSQL uses                                              |
| `filter`, `agg`, `groupBy`, `sortCols`, `labels`, `outputTZCols` | rows you add and remove                                                         |

A row parameter reads as one line per entry — a filter is a column, an operator
and a value; an aggregation is a name, an operator and a column; a label is a
key and a value. Filter values are split on spaces or semicolons, and anything
that parses as a number is sent as one, so `AAPL MSFT` becomes a list of two
symbols and `100` a number. An aggregation row has two column dropdowns: fill
the first for a function of one column, both for a function of two such as
`wavg`.

Anything that names a table or a column is chosen from a dropdown filled from
the connection's meta: `table` lists the tables it reports, and the column
fields of `filter`, `agg`, `groupBy`, `sortCols` and `outputTZCols` list the
columns of the table the query names. A column belongs to a table, so until one
is picked these dropdowns are empty and say `Select a table first...`. A UDA
gets the same lists: its distinguished `table` parameter, any parameter it
declares called `table` or `tableName`, and its symbol parameters named for
columns (`column`, `columns`, `col`, `cols`, `sortCols`, `groupBy`, `by`) — so a
UDA that names no table of its own offers columns once its `table` parameter is
added and set. A value the meta does not mention is kept and shown, so opening a
file written against another connection never empties it.

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

`.kdb.json` datasources are superseded by this editor:

| Datasource    | Becomes                                                                                             |
| :------------ | :-------------------------------------------------------------------------------------------------- |
| API (getData) | a `.kxquery` running getData, with the filters, aggregations, groups, sorts and labels carried over |
| UDA           | a `.kxquery` running the same UDA                                                                   |
| QSQL          | a `.kxquery` running qSQL, with the execution target, the aggregation and the labels carried over   |
| SQL           | a `.kxquery` running SQL, with the query carried over                                               |

A converted QSQL query keeps the target the datasource named even when the
connection you open it against does not offer it, so nothing is lost by
converting against the wrong connection — pick the right target from the
dropdown when you get there. To edit one of these queries as text instead, copy
it into a workbook (`.kdb.q`, `.kdb.sql`), which gives you the language server,
the run gutter and per-statement execution.

Opening a `.kdb.json` converts it and opens what came out; the original file is
left on disk. **KX: Convert datasources to queries** does the same across the
whole workspace. Each converted file keeps the connection the original was bound
to.
