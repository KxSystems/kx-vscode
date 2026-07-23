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

// Static fixture data returned by the mock Insights server. Kept separate
// from server.ts so the wire/plumbing code and the canned data are easy to
// tell apart and edit independently.

export const mockUsername = "mock.user";

// Matched by InsightsConnection.getInsightsVersion()'s /-\d+(\.\d+){2}(-|$)/
// regex to resolve to insightsVersion = 1.14.
export const configResponse = {
  description: "Mock KDB Insights instance",
  encryptionInFlight: false,
  restricted: false,
  storage: {},
  version: "insights-1.14.0-mock",
};

export const apiConfigResponse = {
  encryptionDatabase: false,
  encryptionInTransit: false,
  queryEnvironmentsEnabled: false,
  version: "1.14.0",
};

export const metaResponse = {
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
    userID: "mockID",
    userName: mockUsername,
  },
  payload: {
    rc: [
      {
        api: 3,
        agg: 1,
        assembly: 1,
        schema: 1,
        rc: "mock-rc",
        labels: [{ kxname: "mock-assembly" }],
        started: new Date().toISOString(),
      },
    ],
    dap: [
      {
        dap: "mock-assembly-tp",
        assembly: "mock-assembly",
        startTS: "2000-01-01T00:00:00.000000000",
        endTS: "2099-01-01T00:00:00.000000000",
        labels: ["mock-assembly"],
        instance: "tp",
      },
    ],
    api: [
      {
        api: ".kxi.getData",
        kxname: ["mock-assembly"],
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
          description: "mock aggregator",
          params: [{ description: "mock param" }],
          return: { description: "mock return" },
          misc: {},
        },
        procs: [],
      },
    ],
    assembly: [
      {
        assembly: "mock-assembly",
        kxname: "mock-assembly",
        tbls: ["trade"],
      },
    ],
    schema: [
      {
        table: "trade",
        assembly: "mock-assembly",
        type: "partitioned",
        columns: [
          {
            column: "time",
            typ: 19,
            anymap: false,
            attrDisk: "",
            attrIDisk: "",
            attrMem: "",
            foreign: "",
            isSerialized: false,
          },
          {
            column: "sym",
            typ: 11,
            anymap: false,
            attrDisk: "",
            attrIDisk: "",
            attrMem: "",
            foreign: "",
            isSerialized: false,
          },
          {
            column: "price",
            typ: 9,
            anymap: false,
            attrDisk: "",
            attrIDisk: "",
            attrMem: "",
            foreign: "",
            isSerialized: false,
          },
          {
            column: "size",
            typ: 7,
            anymap: false,
            attrDisk: "",
            attrIDisk: "",
            attrMem: "",
            foreign: "",
            isSerialized: false,
          },
        ],
      },
    ],
  },
};

// A few sample rows shared by every data/sql/qsql/uda endpoint so all query
// paths in the extension have something plausible to render.
export const sampleRows = [
  { time: "2026-07-03T09:30:00.000000000", sym: "AAPL", price: 213.5, size: 100 },
  { time: "2026-07-03T09:30:01.000000000", sym: "MSFT", price: 452.1, size: 250 },
  { time: "2026-07-03T09:30:02.000000000", sym: "GOOG", price: 178.25, size: 75 },
];

export function structuredTextFromRows(rows: Record<string, unknown>[]) {
  const columns =
    rows.length === 0
      ? []
      : Object.keys(rows[0]).map((name) => ({
          name,
          type: typeof rows[0][name] === "number" ? "f" : "s",
          values: rows.map((row) => String(row[name])),
          order: rows.map((_row, i) => i),
        }));

  return { columns, count: rows.length };
}
