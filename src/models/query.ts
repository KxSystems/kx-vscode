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

import { aggOperators, filterOperators } from "./dataSource";
import { ParamFieldType, UDA, UDAParam } from "./uda";

export interface QueryFile {
  version: number;
  query?: UDA;
  drafts?: QueryDraft[];
}

/**
 * The values entered for one API, held over the parameters the connection
 * describes rather than beside them: a parameter the draft names is shown, and
 * one it does not was not asked for.
 */
export interface QueryDraft {
  name: string;
  params: QueryDraftParam[];
}

export interface QueryDraftParam {
  name: string;
  value?: unknown;
  selectedMultiTypeString?: string;
}

export function createDefaultQueryFile(): QueryFile {
  return { version: 1 };
}

function isEntered(value: unknown) {
  return value !== undefined && value !== "";
}

/**
 * What is worth keeping about the API being left: the parameters on show, and
 * the values in them. Nothing entered is nothing to keep — the form is rebuilt
 * from the meta either way.
 */
export function toDraft(query: UDA | undefined): QueryDraft | undefined {
  if (!query) {
    return undefined;
  }

  const params = query.params
    .filter((param) => param.isVisible || isEntered(param.value))
    .map((param) => {
      const draft: QueryDraftParam = { name: param.name };
      if (isEntered(param.value)) {
        draft.value = param.value;
      }
      if (param.selectedMultiTypeString) {
        draft.selectedMultiTypeString = param.selectedMultiTypeString;
      }
      return draft;
    });

  return params.some((param) => "value" in param)
    ? { name: query.name, params }
    : undefined;
}

/**
 * A draft over a query taken fresh from the meta, so a parameter the deployment
 * has changed or dropped is the meta's rather than the file's. A required
 * parameter keeps the visibility the meta gives it; every other one is shown
 * only if the draft names it.
 */
export function applyDraft(query: UDA, draft: QueryDraft) {
  for (const param of query.params) {
    const entered = draft.params.find((item) => item.name === param.name);
    if (entered) {
      param.isVisible = true;
      param.value = entered.value;
      param.selectedMultiTypeString = entered.selectedMultiTypeString;
    } else if (!param.isReq) {
      param.isVisible = false;
    }
  }
  return query;
}

export const GET_DATA = ".kxi.getData";
export const QSQL = "qSQL";
export const SQL = "SQL";

export function isGetData(query: UDA | undefined) {
  return query?.name === GET_DATA;
}

export function isQsql(query: UDA | undefined) {
  return query?.name === QSQL;
}

export function isSql(query: UDA | undefined) {
  return query?.name === SQL;
}

/** One of the queries every connection answers, rather than a deployed UDA. */
export function isBuiltin(query: UDA | undefined) {
  return isGetData(query) || isQsql(query) || isSql(query);
}

export const GET_DATA_PARAMS: UDAParam[] = [
  {
    name: "table",
    description: "Table to query.",
    isReq: true,
    type: [-11],
    typeStrings: ["Symbol"],
    fieldType: ParamFieldType.Text,
    isVisible: true,
    source: "tables",
  },
  {
    name: "startTS",
    description:
      "Inclusive start time of the request, applied to the partition column.",
    isReq: false,
    type: [-12],
    typeStrings: ["Timestamp"],
    fieldType: ParamFieldType.Timestamp,
    isVisible: true,
  },
  {
    name: "endTS",
    description:
      "Exclusive end time of the request, applied to the partition column.",
    isReq: false,
    type: [-12],
    typeStrings: ["Timestamp"],
    fieldType: ParamFieldType.Timestamp,
    isVisible: true,
  },
  {
    name: "filter",
    description: "Filters to apply. Values are split on spaces or semicolons.",
    isReq: false,
    type: [99],
    typeStrings: ["List"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [
      { name: "column", at: 1, source: "columns" },
      { name: "operator", choices: filterOperators, at: 0 },
      { name: "values", at: 2, many: true, typed: true },
    ],
  },
  {
    name: "groupBy",
    description: "Columns to group by.",
    isReq: false,
    type: [11],
    typeStrings: ["Symbol vector"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [{ name: "column", source: "columns" }],
  },
  {
    name: "agg",
    description:
      "Aggregations to apply. A function of two columns takes both, separated by a space.",
    isReq: false,
    type: [99],
    typeStrings: ["List"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [
      { name: "name", at: 0 },
      { name: "operator", choices: aggOperators, at: 1 },
      { name: "column", at: 2, source: "columns" },
      { name: "column", at: 2, source: "columns" },
    ],
  },
  {
    name: "sortCols",
    description: "Columns to sort by.",
    isReq: false,
    type: [11],
    typeStrings: ["Symbol vector"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [{ name: "column", source: "columns" }],
  },
  {
    name: "labels",
    description: "DAP labels to target.",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [{ name: "key" }, { name: "value" }],
  },
  {
    name: "fill",
    description: "How to fill gaps in the data.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    fieldType: ParamFieldType.Text,
    isVisible: false,
    choices: ["zero", "forward"],
  },
  {
    name: "temporality",
    description: "Temporality of the request.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    fieldType: ParamFieldType.Text,
    isVisible: false,
    choices: ["snapshot", "slice"],
  },
  {
    name: "inputTZ",
    description: "Timezone of startTS and endTS (default: UTC).",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    fieldType: ParamFieldType.Text,
    isVisible: false,
  },
  {
    name: "outputTZ",
    description: "Timezone applied to the timestamp columns of the result.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    fieldType: ParamFieldType.Text,
    isVisible: false,
  },
  {
    name: "outputTZCols",
    description: "Columns to apply outputTZ to, rather than all of them.",
    isReq: false,
    type: [11],
    typeStrings: ["Symbol vector"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [{ name: "column", source: "columns" }],
  },
  {
    name: "scope",
    description: "A dictionary describing what RC and/or DAPs to target.",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [{ name: "key" }, { name: "value" }],
  },
  {
    name: "limit",
    description:
      "Maximum number of rows to return. A negative value takes them from the end.",
    isReq: false,
    type: [-7],
    typeStrings: ["Long"],
    fieldType: ParamFieldType.Number,
    isVisible: false,
  },
];

export function createGetData(): UDA {
  return {
    name: GET_DATA,
    description: "Query a table over a time range.",
    params: GET_DATA_PARAMS.map((param) => ({
      ...param,
      rows: param.rows?.map((field) => ({ ...field })),
    })),
    return: { type: ["Table"], description: "The rows matching the request." },
  };
}

export const QSQL_PARAMS: UDAParam[] = [
  {
    name: "target",
    description: "Tier or DAP process to run the query on.",
    isReq: true,
    type: [-11],
    typeStrings: ["Symbol"],
    fieldType: ParamFieldType.Text,
    isVisible: true,
    source: "targets",
  },
  {
    name: "query",
    description: "The qSQL query to run.",
    isReq: true,
    type: [10],
    typeStrings: ["String"],
    fieldType: ParamFieldType.Code,
    isVisible: true,
  },
  {
    name: "agg",
    description:
      "A unary function run on the aggregator over the results the processes return (default: raze). A named function, a composition of them, or a lambda.",
    isReq: false,
    type: [10],
    typeStrings: ["String"],
    fieldType: ParamFieldType.Code,
    isVisible: false,
  },
  {
    name: "labels",
    description: "DAP labels to target.",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    fieldType: ParamFieldType.JSON,
    isVisible: false,
    rows: [{ name: "key" }, { name: "value" }],
  },
];

export const SQL_PARAMS: UDAParam[] = [
  {
    name: "query",
    description: "The SQL query to run.",
    isReq: true,
    type: [10],
    typeStrings: ["String"],
    fieldType: ParamFieldType.Code,
    isVisible: true,
  },
];

export function createQsql(): UDA {
  return {
    name: QSQL,
    description: "Run a qSQL query on a tier or a DAP process.",
    params: QSQL_PARAMS.map((param) => ({ ...param })),
    return: { type: ["Table"], description: "The rows the query returns." },
  };
}

export function createSql(): UDA {
  return {
    name: SQL,
    description: "Run a SQL query on the database.",
    params: SQL_PARAMS.map((param) => ({ ...param })),
    return: { type: ["Table"], description: "The rows the query returns." },
  };
}

function isDictionary(param: UDAParam) {
  return param.name === "labels" || param.name === "scope";
}

function parseValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function toValues(text: string, typed = true) {
  const tokens = text
    .split(/[;\s]+/)
    .filter((token) => token !== "")
    .map((token) => {
      if (!typed) {
        return token;
      }
      const number = parseFloat(token);
      return isNaN(number) || String(number) !== token ? token : number;
    });
  return tokens.length === 1 ? tokens[0] : tokens;
}

function fromValues(value: unknown) {
  return Array.isArray(value) ? value.join(" ") : String(value ?? "");
}

/** The stored value of a row parameter, as the rows the editor shows. */
export function parseRows(param: UDAParam): string[][] {
  const fields = param.rows;
  if (!fields) {
    return [];
  }

  const parsed = parseValue(param.value);
  if (!parsed) {
    return [];
  }

  if (isDictionary(param)) {
    return Object.entries(parsed).map(([key, value]) => [
      key,
      String(value ?? ""),
    ]);
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((row) => {
    if (fields.length === 1) {
      return [String(row ?? "")];
    }
    const values = Array.isArray(row) ? row : [];
    const taken = new Map<number, number>();

    return fields.map((field, index) => {
      const at = field.at ?? index;
      const value = values[at];
      if (field.many) {
        return fromValues(value);
      }
      const shared = fields.filter(
        (other, position) => (other.at ?? position) === at,
      ).length;
      if (shared > 1) {
        const position = taken.get(at) || 0;
        taken.set(at, position + 1);
        const list = Array.isArray(value) ? value : [value];
        return String(list[position] ?? "");
      }
      return String(value ?? "");
    });
  });
}

/** The rows the editor shows, as the value the request wants. */
export function serializeRows(param: UDAParam, rows: string[][]) {
  const fields = param.rows;
  if (!fields) {
    return "";
  }

  const filled = rows.filter((row) =>
    row.some((value, index) => value !== "" && !fields[index]?.choices),
  );
  if (filled.length === 0) {
    return "";
  }

  if (isDictionary(param)) {
    return JSON.stringify(
      Object.fromEntries(filled.map(([key, value]) => [key, value])),
    );
  }

  if (fields.length === 1) {
    return JSON.stringify(filled.map((row) => row[0]));
  }

  return JSON.stringify(
    filled.map((row) => {
      const values: unknown[] = [];
      const shared = new Map<number, string[]>();

      fields.forEach((field, index) => {
        const at = field.at ?? index;
        if (field.many) {
          values[at] = toValues(row[index] || "", field.typed);
          return;
        }
        const slot = shared.get(at) || [];
        if (row[index]) {
          slot.push(row[index]);
        }
        shared.set(at, slot);
      });

      for (const [at, slot] of shared) {
        values[at] = slot.length > 1 ? slot : slot[0] || "";
      }

      return values;
    }),
  );
}

export function createRow(param: UDAParam) {
  return (param.rows || []).map((field) => field.choices?.[0] || "");
}
