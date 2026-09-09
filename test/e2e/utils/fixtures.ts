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

// What the stand-in Insights instance answers the metadata requests with. Kept
// apart from the server itself so the wire handling and the canned data are
// easy to tell apart.

export const USERNAME = "e2e.user";

// The names a query target is built from, as they appear in the meta payload
// below. A tier target is "<assembly> <instance>", a process target adds the
// DAP name — see createTierKey/createProcessKey in workspaceCommand.
export const ASSEMBLY = "e2e-assembly";
export const TIER = "tp";
export const DAP = `${ASSEMBLY}-tp`;

/**
 * The instance configuration, whose version string is what
 * InsightsConnection.getInsightsVersion() reads to decide which endpoints and
 * request bodies to use — so it is what makes a stand-in a 1.10 or a 1.18.
 */
export const config = (version: string) => ({
  description: "Stand-in KDB Insights instance",
  encryptionInFlight: false,
  restricted: false,
  storage: {},
  version: `insights-${version}-e2e`,
});

export const apiConfig = (
  version: string,
  queryEnvironmentsEnabled: boolean,
) => ({
  encryptionDatabase: false,
  encryptionInTransit: false,
  queryEnvironmentsEnabled,
  version,
});

type Param = {
  name: string;
  type: number | number[];
  isReq: boolean;
  description: string;
};

/**
 * One UDA as the meta reports it. parseUDAList reads the description, the
 * parameters and the return off the api entry itself rather than out of
 * `metadata`, so that is where they go.
 */
const registered = (
  api: string,
  description: string,
  params: Param[],
  returns = "Data from insightsMultitypeTable",
) => ({
  api,
  kxname: [ASSEMBLY],
  aggFn: ".sgagg.aggFnDflt",
  custom: true,
  uda: true,
  full: true,
  description,
  params,
  return: { type: [98], description: returns },
  procs: [],
});

const param = (
  name: string,
  type: number | number[],
  isReq: boolean,
  description: string,
): Param => ({ name, type, isReq, description });

const SCOPE = param(
  "scope",
  99,
  false,
  "A dictionary describing what RC and/or DAPs to target.",
);

/**
 * The UDAs the stand-in reports. The first seven are the signatures the
 * insights-uda-e2e-pkg package registers on a real instance — the same names,
 * types and required flags its .kxi.metaParam calls carry — so what the query
 * editor makes of them here is what it makes of them there.
 *
 * The last four have no counterpart in that package, which types every
 * parameter singly, gives every parameter a value and registers a return for
 * every UDA: a multi-typed parameter, a required type the form cannot render, a
 * boolean, and a UDA registered without a .kxi.metaReturn. Each is something a
 * real instance can report and the editor has to survive.
 */
export const UDAS = [
  registered(
    ".insightsUda.tableAPI",
    "Example UDA for using just a table parameter",
    [param("table", -11, true, "Table to query"), SCOPE],
    "Specified table",
  ),
  registered(
    ".insightsUda.noParamAPI",
    "Example UDA that doesn't utilize any parameters",
    [SCOPE],
    "Returns insightsMultitypeTable with data from 1 Jan 2024 through tomorrow",
  ),
  registered(
    ".insightsUda.startEndAPI",
    "Example UDA for using 2 valid start/endTS parameters",
    [
      param("startTS", -12, true, "start timestamp"),
      param("endTS", -12, true, "end timestamp"),
      SCOPE,
    ],
    "Data from insightsMultitypeTable with values between start/endTS",
  ),
  registered(
    ".insightsUda.singleMultiplierAPI",
    "UDA for multiplying a single column",
    [
      param("column", -11, true, "Column to multiply"),
      param("multiplier", -7, true, "Multiplier"),
      SCOPE,
    ],
    "Data from insightsMultitypeTable with multiplied columns",
  ),
  registered(
    ".insightsUda.fullMultiplierAPI",
    "Example UDA for using multiple valid parameters",
    [
      param("table", -11, true, "Table to query"),
      param("column", -11, true, "Column to multiply"),
      param("multiplier", -7, true, "Multiplier"),
      param("startTS", -12, true, "start timestamp"),
      param("endTS", -12, true, "end timestamp"),
      SCOPE,
    ],
    "Table with multiplied columns",
  ),
  registered(
    ".insightsUda.evalAPI",
    "Example UDA for using multiple valid parameters",
    [param("x", 10, true, "String to evaluate"), SCOPE],
    "Table evaluated from string",
  ),
  registered(
    "unqualifiedTableAPI",
    "Example UDA for using just a table parameter",
    [param("table", -11, true, "Table to query"), SCOPE],
    "Specified table",
  ),
  registered(
    ".e2eUda.multiTypeAPI",
    "UDA whose parameter is given as more than one type",
    [param("value", [-11, -7], true, "Value as a symbol or a long"), SCOPE],
    "Rows matching the value",
  ),
  registered(
    ".e2eUda.badFieldAPI",
    "UDA requiring a parameter of a type the editor cannot render",
    [param("fn", 100, true, "Function to apply"), SCOPE],
    "Whatever the function returned",
  ),
  // The UDA from the KXI-65951 description: one parameter registered as every q
  // type. Lambda (100) is not a type the form can render and is dropped, so the
  // dropdown offers the other 22.
  registered(
    ".e2eUda.identityAPI",
    "UDA for the identity function",
    [
      param(
        "x",
        [
          0, -1, -2, -4, -5, -6, -7, -8, -9, -10, 10, -11, -12, -13, -14, -15,
          -16, -17, -18, -19, 98, 99, 100,
        ],
        true,
        "Parameter taking on any Q type",
      ),
      SCOPE,
    ],
    "Returns the parameter defined",
  ),
  registered(
    ".e2eUda.flagAPI",
    "UDA requiring a boolean parameter",
    [param("flag", -1, true, "Whether to do the thing"), SCOPE],
    "Rows, or none",
  ),
  // A UDA whose registration left the return out. metaReturn is optional in q,
  // and `return` is optional in MetaApi, so the meta can carry an api entry
  // without one.
  {
    api: ".e2eUda.noReturnAPI",
    kxname: [ASSEMBLY],
    aggFn: ".sgagg.aggFnDflt",
    custom: true,
    uda: true,
    full: true,
    description: "UDA registered without a metaReturn",
    params: [param("table", -11, true, "Table to query"), SCOPE],
    procs: [],
  },
];

export const meta = {
  header: {
    ac: "0",
    agg: ":127.0.0.1:5070",
    ai: "",
    api: ".kxi.getMeta",
    client: ":127.0.0.1:5050",
    corr: "CorrHash",
    http: "json",
    logCorr: "logCorrHash",
    protocol: "gw",
    rc: "0",
    rcvTS: new Date().toISOString(),
    retryCount: "0",
    to: new Date().toISOString(),
    userID: "e2eID",
    userName: USERNAME,
  },
  payload: {
    rc: [
      {
        api: 3,
        agg: 1,
        assembly: 1,
        schema: 1,
        rc: "e2e-rc",
        labels: [{ kxname: ASSEMBLY }],
        started: new Date().toISOString(),
      },
    ],
    dap: [
      {
        dap: DAP,
        assembly: ASSEMBLY,
        startTS: "2000-01-01T00:00:00.000000000",
        endTS: "2099-01-01T00:00:00.000000000",
        labels: [ASSEMBLY],
        instance: TIER,
      },
    ],
    api: [
      {
        api: ".kxi.getData",
        kxname: [ASSEMBLY],
        aggFn: ".sgagg.aggFnDflt",
        custom: false,
        uda: false,
        full: true,
        procs: [],
      },
      ...UDAS,
    ],
    agg: [
      {
        aggFn: ".sgagg.aggFnDflt",
        custom: false,
        full: true,
        metadata: {
          description: "stand-in aggregator",
          params: [{ description: "stand-in param" }],
          return: { description: "stand-in return" },
          misc: {},
        },
        procs: [],
      },
    ],
    assembly: [
      {
        assembly: ASSEMBLY,
        kxname: ASSEMBLY,
        tbls: ["trade"],
      },
    ],
    schema: [
      {
        table: "trade",
        assembly: ASSEMBLY,
        type: "partitioned",
        columns: [
          { column: "time", typ: 19 },
          { column: "sym", typ: 11 },
          { column: "price", typ: 9 },
          { column: "size", typ: 7 },
        ].map((column) => ({
          ...column,
          anymap: false,
          attrDisk: "",
          attrIDisk: "",
          attrMem: "",
          foreign: "",
          isSerialized: false,
        })),
      },
    ],
  },
};

// What every data, sql, qsql and uda endpoint answers with, so each query path
// has something plausible to render.
export const ROWS = [
  { time: "2026-07-03T09:30:00.000000000", sym: "AAPL", price: 213.5 },
  { time: "2026-07-03T09:30:01.000000000", sym: "MSFT", price: 452.1 },
  { time: "2026-07-03T09:30:02.000000000", sym: "GOOG", price: 178.25 },
];

// The shape a 1.12+ instance returns when asked for structuredText, which is
// what the results view renders from.
export function structuredText(rows: Record<string, unknown>[] = ROWS) {
  const columns =
    rows.length === 0
      ? []
      : Object.keys(rows[0]).map((name) => ({
          name,
          type: typeof rows[0][name] === "number" ? "f" : "s",
          values: rows.map((row) => String(row[name])),
          order: rows.map((_row, index) => index),
        }));

  return { columns, count: rows.length };
}
