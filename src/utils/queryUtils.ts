/*
 * Copyright (c) 1998-2026 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

import * as realFs from "fs";
import { join } from "path";

import { ext } from "../extensionVariables";
import { MessageKind, notify, Runner } from "./notifications";
import { ServerType } from "../models/connectionsModels";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { QueryHistory } from "../models/queryHistory";
import { queryConstants, StructuredTextResults } from "../models/queryResult";
import {
  ScratchpadResult,
  ScratchpadStacktrace,
} from "../models/scratchpadResult";

const logger = "queryUtils";

const QUERY_LIMIT = 250_000;

export function sanitizeQuery(query: string): string {
  if (query[0] === "`") {
    query = query + " ";
  } else if (query.slice(-1) === ";") {
    query = query.slice(0, -1);
  }
  return query;
}

export function queryWrapper(
  isPython: boolean,
  useAPI: boolean,
  filesystem = realFs,
  context = ext.context,
): string {
  if (useAPI) {
    return isPython ? ".vscode.runPyQuery" : ".vscode.runQQuery";
  }

  if (isPython) {
    return filesystem
      .readFileSync(
        context.asAbsolutePath(join("resources", "q", "evaluatePy.q")),
      )
      .toString();
  }

  const evaluateQ = filesystem
    .readFileSync(context.asAbsolutePath(join("resources", "q", "evaluateQ.q")))
    .toString();

  const formatQ = filesystem
    .readFileSync(context.asAbsolutePath(join("resources", "q", "formatQ.q")))
    .toString();

  // NOTE - There needs to be a space before the semicolon, since these files end in newlines
  return `{[args]
    evaluateQ: ${evaluateQ} ;
    formatQ: ${formatQ} ;
    formatQ[args; evaluateQ args]
    }`;
}

export function addIndexKey(input: any) {
  let arr: any[];

  if (Array.isArray(input)) {
    arr = input;
  } else {
    arr = [input];
  }

  if (arr.length === 0) {
    return arr;
  }

  if (!Object.prototype.hasOwnProperty.call(arr[0], "Index")) {
    arr = arr.map((obj, index) => {
      const newObj = { Index: index + 1 };

      if (typeof obj === "string") {
        (<any>newObj)["Value"] = obj;
      } else {
        for (const prop in obj) {
          (<any>newObj)[prop] = obj[prop];
        }
      }

      return newObj;
    });
  }

  return arr;
}

function queryLimitCheck(query: string): string {
  if (query.length > QUERY_LIMIT) {
    throw new Error(`Query length limit (${QUERY_LIMIT}) reached.`);
  }
  return query;
}

// Comment/system-command handling shared by normalizeQuery and normalizeQSQLQuery.
// The two diverge after this point because q and QSQL need different statement
// separators: q reads one statement per line, QSQL is sent as a single `;`
// joined expression (see the tail of each function below).
function stripCommentsAndSystemCommands(query: string): string {
  return (
    query
      // Remove block comments (closed by a solitary \ or running to end of input)
      .replace(/^\/[\t ]*$[^]*?(?:^\\[\t ]*$|(?![^]))/gm, "")
      // Remove terminate comments
      .replace(/^\\[\t ]*(?:\r\n|[\r\n])[^]*/gm, "")
      // Remove single line comments
      .replace(/^\/.+/gm, "")
      // Rewrite \ prefixed commands, e.g. `\ts:1000 myFunc[]`, to system calls,
      // e.g. `system"ts:1000 myFunc[]"`. This is necessary because \ prefixed
      // commands must start in the first column and can't be combined with
      // other expressions, so they can't survive being joined onto one line.
      // The command text is re-quoted as-is, so its own backslashes must be
      // escaped before its quotes (in that order) so a literal `\` (e.g. in
      // `\someCommand "\t"`) survives rather than being consumed by the outer
      // string's escape processing.
      .replace(/^\\(.+)$/gm, (matched, command) =>
        command === "\\"
          ? 'system"\\\\"'
          : `system"${command.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
      )
  );
}

export function normalizeQuery(query: string): string {
  return (
    stripCommentsAndSystemCommands(queryLimitCheck(query))
      // Remove line comments
      .replace(
        /(?:("([^"\\]*(?:\\.[^"\\]*)*)")|([ \t]+\/.*))/gm,
        (matched, isString) => (isString ? matched : ""),
      )
      // Replace new lines in strings
      .replace(/"(?:[^"\\]*(?:\\.[^"\\]*)*)"/gs, (matched) =>
        matched.replace(/(?:\r\n|[\r\n])/gs, "\\n"),
      )
      // Remove none end of statement new lines
      .replace(/(?:\r\n|[\r\n])+(?=[\t ])/gs, "")
      // Comments and blank lines removed above can leave runs of consecutive
      // newlines; collapse each run to a single CRLF so the q process still
      // sees one statement per line.
      .replace(/(?:\r\n|[\r\n])+/g, "\r\n")
  );
}

export function normalizeQSQLQuery(query: string): string {
  return (
    stripCommentsAndSystemCommands(queryLimitCheck(query))
      // Trim white space
      .trim()
      // Replace end of statements
      .replace(/(?<!;[\t ]*)(\r\n|[\r\n])+(?![\t\r\n ])/gs, ";$1")
  );
}

export function normalizePyQuery(query: string): string {
  return (
    queryLimitCheck(query)
      // Replace double quotes
      .replace(/"/gs, '\\"')
  );
}

/**
 * Generate request headers including timeout
 * @param {Number} timeout - request timeout (ms)
 * @param {('struct-text'|'json')} type - type of response to accept
 */
export function getHeaders(
  timeout?: number,
  type: "json" | "struct-text" = "json",
) {
  const headers: Record<string, boolean | string> = {
    "Content-Type": "application/json",
  };

  if (type === "struct-text") {
    headers["Accept"] = "application/struct-text";
  } else if (type === "json") {
    headers["Accept"] = "application/json";
    headers["json"] = true;
  } else {
    throw "Unsupported type";
  }

  if (timeout) {
    headers["timeout"] = String(timeout);
  }

  return headers;
}

export function getPythonWrapper(
  query: string,
  returnFormat: "serialized" | "text" | "structuredText",
): string {
  const wrapper = queryWrapper(true, false);
  const args = {
    returnFormat,
    code: normalizePyQuery(query),
    sample_fn: "first",
    sample_size: 10000,
  };
  return `{[returnFormat;code;sample_fn;sample_size] res:${wrapper}[returnFormat;code;sample_fn;sample_size];$[res\`error;res\`errorMsg;res\`data]}["${args.returnFormat}";"${args.code}";"${args.sample_fn}";${args.sample_size}]`;
}

export function getQSQLWrapper(
  query: string,
  returnFormat: "serialized" | "text" | "structuredText",
  isPython?: boolean,
): string {
  return isPython
    ? getPythonWrapper(query, returnFormat)
    : normalizeQSQLQuery(query);
}

export function getSQLWrapper(query: string): string {
  return `s)${query.replace(/(?:\r\n|\n)/g, " ")}`;
}

// The encoding `convertRowsToConsole` accepts from a caller that has nothing
// but strings: a row's cells joined with CELL, and a header row marked by a
// leading HEADER. The header used to be told apart by the delimiter between
// its own cells, which a one-column table never has, so it lost its rule and
// read as a list (KXI-73276).
const HEADER = "#$#;header;#$#";
const CELL = "#$#;#$#";

// What the console lays a table out from: the cells, the header row where the
// result has one, and how many of the leading columns are keys — a
// dictionary's key, or a keyed table's key columns, which q separates from the
// values with a pipe.
interface ConsoleTable {
  cells: string[][];
  header?: string[];
  keys: number;
}

export function convertRows(
  rows: any[],
  width = 0,
  results?: StructuredTextResults,
): any {
  const table = results ? structuredTable(rows, results) : objectTable(rows);
  const lines = table ? layout(table, width) : [];
  return lines.length === 0 ? [] : lines.join("\n") + "\n\n";
}

function cell(value: any): string {
  return Array.isArray(value) ? value.join(" ") : String(value ?? "");
}

// Rows on their own carry no more than their column names, so a dictionary is
// only recognizable where it arrived as a property/value pair.
function objectTable(rows: any[]): ConsoleTable | undefined {
  if (rows.length === 0) {
    return undefined;
  }
  const names = Object.keys(rows[0]);
  const isPropVal =
    typeof rows[0] === "object" ? checkIfIsPropVal(names) : false;
  return {
    cells: rows.map((row) => names.map((name) => cell(row[name]))),
    header: isPropVal ? undefined : names,
    keys: isPropVal ? 1 : 0,
  };
}

// A structured text result knows what the rows extracted from it cannot say:
// which columns are keys, whether the result is a table at all, and the schema
// of one that came back empty.
function structuredTable(
  rows: any[],
  results: StructuredTextResults,
): ConsoleTable | undefined {
  const columns = Array.isArray(results.columns)
    ? results.columns
    : [results.columns];
  if (columns.length === 0) {
    return undefined;
  }
  const names = columns.map((column) => column.name);
  // Nothing in the payload says whether a result was a table: a list is the
  // one column `values` that formatQ.q gives an unnamed result, and a
  // dictionary the key/values pair, both of which q prints without column
  // names. An empty result has nothing but its header, so that carries the
  // types too — the schema is the whole answer there.
  const isList =
    !Array.isArray(results.columns) ||
    (columns.length === 1 && names[0] === "values" && !columns[0].isKey);
  const isDictionary =
    columns.length === 2 && !!columns[0].isKey && names.join() === "key,values";
  return {
    cells: rows.map((row) => names.map((name) => cell(row[name]))),
    header:
      rows.length === 0
        ? columns.map((column) => `${column.name} [${column.type}]`)
        : isList || isDictionary
          ? undefined
          : names,
    keys: columns.filter((column) => column.isKey).length,
  };
}

// Marks a line the console could not show in full, as a q console marks one.
const CUT = "..";

// Cuts a line to the given width, as a q console cuts one to its `\c`. A width
// of 0 means no limit — the shared output channel scrolls horizontally, where
// a terminal only wraps, and a wrapped table is no longer a table.
function fit(line: string, width: number): string {
  if (!width || line.length <= width) {
    return line;
  }
  return line.slice(0, Math.max(0, width - CUT.length)) + CUT;
}

// A cell that arrives with newlines in it — a nested list, rendered down the
// page by whatever produced it — would otherwise carry the rest of its row
// with it and leave every column after it hanging. A console table keeps one
// row to one line.
function flatten(value: string) {
  const parts = String(value ?? "").split("\n");
  const last = parts.length - 1;
  return parts
    .map((part, index) => {
      const head = index === 0 ? part.trimEnd() : part.trimStart();
      return index === last ? head : head.trimEnd();
    })
    .filter((part, index) => index === 0 || part)
    .join(" ")
    .trimEnd();
}

// The rule under a header carries the key separator through it, the way a
// keyed table prints in q: `a b| c` over `---| -`.
function rule(length: number, widths: number[], keys: number): string {
  const line = "-".repeat(length);
  const pipe = widths.slice(0, keys).reduce((sum, width) => sum + width, 0) - 2;
  return keys > 0 && length > pipe + 1
    ? line.slice(0, pipe) + "| " + line.slice(pipe + 2)
    : line;
}

function layout(table: ConsoleTable, width: number): string[] {
  const rows = table.header ? [table.header, ...table.cells] : table.cells;
  if (rows.length === 0) {
    return [];
  }
  // A result that is a single value — a lambda, a string, an atom — is not a
  // table, and keeps the newlines it came with instead of being squared off
  // into one cell (KXI-73276).
  if (!table.header && rows.length === 1 && rows[0].length === 1) {
    return rows[0][0].split("\n").map((line) => fit(line, width));
  }
  const cells = rows.map((row) => row.map(flatten));
  const count = cells.reduce((max, row) => Math.max(max, row.length), 0);
  const widths = Array.from(
    { length: count },
    (_unused, index) =>
      cells.reduce((max, row) => Math.max(max, (row[index] || "").length), 0) +
      2,
  );
  // The pipe separates a key block from what follows it; a dictionary with
  // nothing to its right, or a line of plain console output, has no key block.
  const keys = table.keys > 0 && table.keys < count ? table.keys : 0;
  const lines = cells.map((row) =>
    fit(
      row
        .map((value, index) =>
          index === keys - 1
            ? value.padEnd(widths[index] - 2) + "| "
            : value.padEnd(widths[index]),
        )
        .join(""),
      width,
    ),
  );
  if (table.header) {
    lines.splice(1, 0, rule(lines[0].length, widths, keys));
  }
  return lines;
}

export function convertRowsToConsole(rows: string[], width = 0): string[] {
  if (rows.length === 0) {
    return [];
  }
  const haveHeader = rows[0].startsWith(HEADER);
  const header = haveHeader
    ? rows[0].slice(HEADER.length).split(CELL)
    : undefined;
  const cells = (haveHeader ? rows.slice(1) : rows).map((row) =>
    row.split(CELL),
  );
  // Rows that arrive without a header of their own are a dictionary's
  // key/value pairs, which q prints with a pipe between them.
  return layout({ cells, header, keys: haveHeader ? 0 : 1 }, width);
}

export function checkIfIsPropVal(columns: string[]): boolean {
  return (
    columns.length === 2 &&
    columns.includes("Property") &&
    columns.includes("Value")
  );
}

export function getConnectionType(type: ServerType): string {
  switch (type) {
    case ServerType.KDB:
      return "kdb";
    case ServerType.INSIGHTS:
      return "insights";
    default:
      return "undefined";
  }
}

export function checkIfIsDatasource(
  dataSourceType: string | undefined,
): boolean {
  if (dataSourceType === undefined) {
    return false;
  }
  const validTypes = ["API", "QSQL", "SQL", "UDA"];
  return validTypes.includes(dataSourceType);
}

export function selectDSType(
  dataSourceType: string,
): DataSourceTypes | undefined {
  const typeMapping: { [key: string]: DataSourceTypes } = {
    API: DataSourceTypes.API,
    QSQL: DataSourceTypes.QSQL,
    SQL: DataSourceTypes.SQL,
  };
  return typeMapping[dataSourceType] || undefined;
}

export function addQueryHistory(
  query: string | DataSourceFiles,
  executorName: string,
  connectionName: string,
  connectionType: ServerType,
  success: boolean,
  isPython?: boolean,
  isWorkbook?: boolean,
  isDatasource?: boolean,
  datasourceType?: DataSourceTypes,
  duration?: string,
  isFromConnTree?: boolean,
) {
  const newQueryHistory: QueryHistory = {
    query: query,
    executorName,
    time: new Date().toLocaleString(),
    success,
    connectionName,
    connectionType,
    language: isPython ? "python" : "q",
    isWorkbook,
    isDatasource,
    datasourceType,
    duration,
    isFromConnTree,
  };

  ext.kdbQueryHistoryList.unshift(newQueryHistory);

  ext.queryHistoryProvider.refresh();
}

function isScratchpadStacktrace(
  value: unknown[],
): value is ScratchpadStacktrace {
  return value.every(
    (frame: any) => frame && Array.isArray(frame.text) && "name" in frame,
  );
}

export function appendStacktrace(
  message: string,
  stacktrace?: ScratchpadStacktrace | string[] | string,
): string {
  if (!stacktrace || (Array.isArray(stacktrace) && stacktrace.length === 0)) {
    return message;
  }
  if (!Array.isArray(stacktrace)) {
    return `${message}\n${stacktrace}`;
  }
  return (
    message +
    "\n" +
    (isScratchpadStacktrace(stacktrace)
      ? formatScratchpadStacktrace(stacktrace)
      : stacktrace.map((line) => `${line}`).join("\n"))
  );
}

const UDA_UNKNOWN_API = "Querying database using (UDA) raised - Unknown API:";

export function formatScratchpadError(result: ScratchpadResult): string {
  let message =
    result.errorMsg ||
    (typeof result.error === "string" ? result.error : "Unknown error");

  if (message.includes(UDA_UNKNOWN_API)) {
    message +=
      ". A table, label, or scope parameter may be missing or incorrect.";
  }

  return appendStacktrace(
    `${queryConstants.error} ${message}`,
    result.stacktrace,
  );
}

export function formatScratchpadStacktrace(stacktrace: ScratchpadStacktrace) {
  return stacktrace
    .map((frame, i) => {
      let lines = frame.text[0].split("\n");
      let preline = "";
      // We need to account for the possibility that the error
      // occurs in a piece of code containing newlines, so we split
      // up the text into lines and inject the caret into the correct
      // location.
      preline = lines.pop() as string;
      const caretline = Array(preline.length).fill(" ").join("") + "^";
      const postlines = (preline + frame.text[1]).split("\n");
      postlines.splice(1, 0, caretline);
      lines = lines.concat(postlines);

      // main line of trace
      let str = "[" + (stacktrace.length - 1 - i) + "] " + frame.name;

      // add indicator for nested anonymous functions
      if (frame.isNested) {
        str += " @ ";
      }

      // add gutter to align other lines with the first one
      const gutter = " ".repeat(str.length);
      str += lines.map((l, i) => (i > 0 ? gutter + l : l)).join("\n");

      return str;
    })
    .join("\n");
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_BASE64 = "iVBORw0KGg";

/**
 * Tells whether a result is a PNG the process encoded with .Q.btoa, which the
 * Insights display API does for any image, whatever return format was asked
 * for.
 * @param result The result, or the data field of one
 * @returns Whether it is a base64 encoded PNG
 */
export function isEncodedPng(result: any): result is string {
  return typeof result === "string" && result.startsWith(PNG_BASE64);
}

export function resultToBase64(result: any): string | undefined {
  const encoded = isEncodedPng(result)
    ? result
    : isEncodedPng(result?.data)
      ? result.data
      : undefined;

  if (encoded) {
    return `data:image/png;base64,${encoded}`;
  }

  const bytes =
    (Array.isArray(result?.data?.rows) && result?.data?.rows[0].Value) ||
    (Array.isArray(result?.columns) && result.columns[0]?.values) ||
    result?.columns?.values ||
    result;
  if (Array.isArray(bytes) && bytes.length > 66) {
    for (let i = 0; i < PNG.length; i++) {
      if (parseInt(`${bytes[i]}`) !== PNG[i]) {
        return undefined;
      }
    }
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return undefined;
}

export function needsScratchpad<T>(connLabel: string, target: Promise<T>) {
  if (!ext.scratchpadStarted.has(connLabel)) {
    const runner = Runner.create(() =>
      target.then(() => ext.scratchpadStarted.add(connLabel)),
    );
    runner.title = `Starting scratchpad on ${connLabel}.`;
    runner.execute();
  }
  return target;
}

export function resetScratchpadStarted(connLabel: string) {
  ext.scratchpadStarted.delete(connLabel);
}

export const enum RunFlag {
  Run = 0b0000000001,
  Workbook = 0b0000000010,
  Notebook = 0b0000000100,
  Repl = 0b0000001000,
  Insights = 0b0000010000,
  Quick = 0b0000100000,
  Dap = 0b0001000000,
  Python = 0b0010000000,
  Sql = 0b0100000000,
  Quke = 0b1000000000,
}

export function notifyExecution(flags: number, dsType?: string) {
  const telemetry =
    (flags & RunFlag.Run ? "Run" : "Populate") +
    (dsType
      ? ".Datasource." + dsType.toLowerCase()
      : (flags & RunFlag.Workbook
          ? ".Workbook"
          : flags & RunFlag.Notebook
            ? ".Cell"
            : ".File") +
        (flags & RunFlag.Repl
          ? ".repl"
          : flags & RunFlag.Insights
            ? ".ie"
            : ".kdb") +
        (flags & RunFlag.Quick ? ".quick" : "") +
        (flags & RunFlag.Dap ? ".dap" : "") +
        (flags & RunFlag.Python
          ? ".py"
          : flags & RunFlag.Sql
            ? ".sql"
            : flags & RunFlag.Quke
              ? ".quke"
              : ".q"));

  notify(`Query ${telemetry} executed.`, MessageKind.DEBUG, {
    logger,
    telemetry,
  });

  return telemetry;
}
