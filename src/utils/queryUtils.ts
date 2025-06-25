/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import { readFileSync } from "fs";
import { join } from "path";

import { ext } from "../extensionVariables";
import { isBaseVersionGreaterOrEqual, kdbOutputLog } from "./core";
import { normalizeAssemblyTarget } from "./shared";
import { DCDS, deserialize, isCompressed, uncompress } from "../ipc/c";
import { DDateClass, DDateTimeClass, DTimestampClass } from "../ipc/cClasses";
import { Parse } from "../ipc/parse.qlist";
import { TypeBase } from "../ipc/typeBase";
import { ServerType } from "../models/connectionsModels";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { QueryHistory } from "../models/queryHistory";
import { ScratchpadStacktrace } from "../models/scratchpadResult";

export function sanitizeQuery(query: string): string {
  if (query[0] === "`") {
    query = query + " ";
  } else if (query.slice(-1) === ";") {
    query = query.slice(0, -1);
  }
  return query;
}

export function queryWrapper(isPython: boolean): string {
  const filename = isPython ? "evaluatePy.q" : "evaluate.q";

  return readFileSync(
    ext.context.asAbsolutePath(join("resources", filename)),
  ).toString();
}

export function handleWSError(ab: ArrayBuffer): any {
  let errorString;

  try {
    // error for: qe/sql & gateway/data
    const errorHeader = Parse.reshape(deserialize(ab).values[0], ab)
      .toLegacy()
      .rows?.reduce((o: any, k: any) => {
        o[k.Property] = k.Value;
        return o;
      }, {});

    errorString = errorHeader.ai;
  } catch {
    // error for: qe/qsql
    // deserializer didn't recognize the format
    const raw = new Uint8Array(ab);
    if (
      raw.byteLength >= 10 &&
      // header?
      raw.subarray(0, 4).toString() === "1,2,0,0" &&
      // last char is string terminator
      raw[raw.byteLength - 1] === 0 &&
      // error message size, message can be clipped (always less than 256 chars)
      raw[5] * 256 + raw[4] === raw.byteLength
      // TODO: need to check if this is needed
      // &&
      // // 128 - start of string/error ?
      // raw.subarray(6, 9).toString() === "0,0,128"
    ) {
      // eslint-disable-next-line prefer-spread
      const translated = String.fromCharCode
        .apply(
          String,
          raw.subarray(9, raw.byteLength - 1) as unknown as number[],
        )
        .split("\n")
        .slice(-1);
      errorString = translated.join("").trim();

      // TODO: need to check if this is needed
      // errorString = {
      //   // eslint-disable-next-line prefer-spread
      //   ipc: String.fromCharCode.apply(
      //     String,
      //     raw.subarray(9, raw.byteLength - 1) as unknown as number[],
      //   ),
      // };
    } else {
      errorString = "Query error";
    }
  }

  kdbOutputLog(`Error : ${errorString}`, "ERROR", true);

  return { error: errorString };
}

export function handleWSResults(ab: ArrayBuffer, isTableView?: boolean): any {
  if (isTableView === undefined) {
    isTableView = ext.isResultsTabVisible;
  }
  let res: any;
  try {
    if (isCompressed(ab)) {
      ab = uncompress(ab);
    }
    let des = deserialize(ab);
    if (des.qtype === 0 && des.values.length === 2) {
      des = des.values[1];
    }
    res = Parse.reshape(des.dataSet || des, ab).toLegacy();

    if (res.rows.length === 0 && res.columns.length === 0) {
      return "No results found.";
    }
    if (isTableView) {
      return getValueFromArray(res);
    }
    return convertRows(res.rows);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export function handleScratchpadTableRes(results: DCDS | string): any {
  if (typeof results === "string" || results?.rows === undefined) {
    return results;
  }
  let scratchpadResponse = results.rows;
  if (!Array.isArray(scratchpadResponse)) {
    return results;
  }
  if (scratchpadResponse?.length !== 0) {
    scratchpadResponse = addIndexKey(scratchpadResponse);
  }
  const result = [];
  for (const row of scratchpadResponse) {
    const newObj = {};
    for (const key in row) {
      row[key] = checkIfIsQDateTypes(row[key]);
      if (typeof row[key] === "bigint") {
        Object.assign(newObj, { [key]: Number(row[key]) });
      } else if (
        row[key] !== null &&
        typeof row[key] === "number" &&
        (row[key].toString() === "Infinity" ||
          row[key].toString() === "-Infinity")
      ) {
        Object.assign(newObj, { [key]: row[key].toString() });
      } else {
        Object.assign(newObj, { [key]: row[key] });
      }
    }

    result.push(newObj);
  }
  results.rows = result;
  return results;
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

export function getValueFromArray(results: DCDS): any {
  const arr = results.rows;
  if (arr !== undefined) {
    if (arr.length === 1 && typeof arr[0] === "object" && arr[0] !== null) {
      results.rows = [checkIfIsQDateTypes(arr[0])];
    }
  }
  results.meta = generateQTypes(results.meta);
  return results;
}

export function sanitizeQsqlQuery(query: string): string {
  let result = "";
  let inString = false;
  let stringChar = "";
  let i = 0;

  while (i < query.length) {
    const char = query[i];

    if (isStringStart(char, inString)) {
      ({ inString, stringChar, result, i } = handleStringStart(
        char,
        result,
        i,
      ));
    } else if (isStringEnd(char, inString, stringChar)) {
      ({ inString, result, i } = handleStringEnd(char, result, i));
    } else if (inString) {
      ({ result, i } = handleInsideString(char, result, i));
    } else if (isBlockCommentStart(char, query, i)) {
      i = skipBlockComment(query, i);
    } else if (isLineCommentStart(char)) {
      i = skipLineComment(query, i);
    } else {
      result += char;
      i++;
    }
  }

  return normalizeLineBreaks(result.trim());
}

function isStringStart(char: string, inString: boolean): boolean {
  return !inString && (char === '"' || char === "'");
}

function handleStringStart(
  char: string,
  result: string,
  i: number,
): { inString: boolean; stringChar: string; result: string; i: number } {
  return {
    inString: true,
    stringChar: char,
    result: result + char,
    i: i + 1,
  };
}

function isStringEnd(
  char: string,
  inString: boolean,
  stringChar: string,
): boolean {
  return inString && char === stringChar;
}

function handleStringEnd(
  char: string,
  result: string,
  i: number,
): { inString: boolean; result: string; i: number } {
  return {
    inString: false,
    result: result + char,
    i: i + 1,
  };
}

function handleInsideString(
  char: string,
  result: string,
  i: number,
): { result: string; i: number } {
  return {
    result: result + char,
    i: i + 1,
  };
}

function isBlockCommentStart(char: string, query: string, i: number): boolean {
  return char === "/" && query.indexOf("\\", i) > i;
}

function skipBlockComment(query: string, i: number): number {
  const end = query.indexOf("\\", i);
  return end !== -1 ? end + 1 : query.length;
}

function isLineCommentStart(char: string): boolean {
  return char === "/";
}

function skipLineComment(query: string, i: number): number {
  while (i < query.length && query[i] !== "\n" && query[i] !== "\r") {
    i++;
  }
  if (query[i] === "\r" && query[i + 1] === "\n") return i + 2;
  if (query[i] === "\n" || query[i] === "\r") return i + 1;
  return i;
}

function normalizeLineBreaks(input: string): string {
  return input.replace(/([^\s;])(?:\r?\n)+(?=\S)/g, "$1;");
}

export function generateQSqlBody(
  query: string,
  assemblyTarget: string,
  version?: number,
  qeEnabled?: boolean,
) {
  query = sanitizeQsqlQuery(query);

  const [plainAssembly, target] =
    normalizeAssemblyTarget(assemblyTarget).split(/\s+/);

  let assembly = plainAssembly;
  if (qeEnabled) {
    assembly += "-qe";
  }

  if (version && isBaseVersionGreaterOrEqual(version, 1.13)) {
    return {
      query,
      scope: {
        affinity: "soft",
        assembly,
        tier: target,
      },
    };
  }

  return { query, assembly, target };
}

export function generateQTypes(meta: { [key: string]: number }): any {
  const newMeta: { [key: string]: string } = {};
  for (const key in meta) {
    const value = meta[key];
    newMeta[key] = TypeBase.typeNames[value] ?? `Unknown type: ${value}`;
  }
  return newMeta;
}

export function checkIfIsQDateTypes(obj: any): any {
  if (
    obj?.Value instanceof DTimestampClass ||
    obj?.Value instanceof DDateTimeClass ||
    obj?.Value instanceof DDateClass
  ) {
    return obj.Value.toString();
  }
  return obj;
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

export function convertRowsToConsole(rows: string[]): string[] {
  if (rows.length === 0) {
    return [];
  }
  const haveHeader = rows[0].includes("#$#;header;#$#");
  let header;
  if (haveHeader) {
    header = rows[0].split("#$#;header;#$#");
    rows.shift();
  }
  const vector = rows.map((row) => row.split("#$#;#$#"));
  if (header) {
    vector.unshift(header);
  }

  const columnCounters = vector[0].reduce((counters: number[], _, j) => {
    const maxLength = vector.reduce(
      (max, row) => Math.max(max, row[j].length),
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
