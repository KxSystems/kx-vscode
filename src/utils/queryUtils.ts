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
import { ScratchpadStacktrace } from "../models/scratchpadResult";

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

export function convertRows(rows: any[]): any {
  if (rows.length === 0) {
    return [];
  }
  const keys = Object.keys(rows[0]);
  const isObj = typeof rows[0] === "object";
  const isPropVal = isObj ? checkIfIsPropVal(keys) : false;
  const result = isPropVal ? [] : [keys.join("#$#;header;#$#")];
  for (const row of rows) {
    const values = keys.map((key) => {
      if (Array.isArray(row[key])) {
        return row[key].join(" ");
      }
      return row[key];
    });
    result.push(values.join("#$#;#$#"));
  }
  return convertRowsToConsole(result).join("\n") + "\n\n";
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

export function convertRowsToConsole(rows: string[]): string[] {
  if (rows.length === 0) {
    return [];
  }
  const haveHeader = rows[0].includes("#$#;header;#$#");
  let header;
  if (haveHeader) {
    header = rows[0].split("#$#;header;#$#").map(flatten);
    rows.shift();
  }
  const vector = rows.map((row) => row.split("#$#;#$#").map(flatten));
  if (header) {
    vector.unshift(header);
  }

  const columnCounters = vector[0].reduce((counters: number[], _, j) => {
    const maxLength = vector.reduce(
      (max, row) => Math.max(max, (row[j] || "").length),
      0,
    );
    counters.push(maxLength + 2);
    return counters;
  }, []);

  vector.forEach((row) => {
    row.forEach((value, j) => {
      const counter = columnCounters[j];
      const diff = counter - value.length;
      if (diff > 0) {
        if (!haveHeader && j !== columnCounters.length - 1) {
          row[j] = value + "|" + " ".repeat(diff > 1 ? diff - 1 : diff);
        } else {
          row[j] = value + " ".repeat(diff);
        }
      }
    });
  });

  const result = vector.map((row) => row.join(""));

  const totalCount = columnCounters.reduce((sum, count) => sum + count, 0);
  const totalCounter = "-".repeat(totalCount);
  if (haveHeader) {
    result.splice(1, 0, totalCounter);
  }

  return result;
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

export function resultToBase64(result: any): string | undefined {
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
