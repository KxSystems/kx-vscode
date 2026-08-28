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
