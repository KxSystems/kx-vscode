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

import { StructuredTextResults } from "./queryResult";
import { ScratchpadStacktrace } from "./scratchpadResult";

export type GetDataError = string | { buffer: ArrayBuffer };

export type GetDataObjectPayload = {
  error: GetDataError;
  stacktrace?: ScratchpadStacktrace | string[] | string;
  table?: {
    meta: {
      [column: string]: string;
    };
    columns: string[];
    rows: any;
  };
  results?: StructuredTextResults;
  arrayBuffer?: ArrayBuffer;
};

/**
 * Where a request runs: the assembly, and the instance inside it unless the
 * choice is being left to the resource coordinator. The form holds the target
 * string the dropdown wrote instead, and the transport swaps it for this on the
 * way out — `InsightsConnection.scopeValue`.
 */
export type Scope = {
  affinity?: string;
  assembly?: string;
  tier?: string;
  dap?: string;
};

export type getDataBodyPayload = {
  table: string;
  startTS: string;
  endTS: string;
  scope?: string | Scope;
  labels?: { [id: string]: string };
  filter?: (string | number | (string | number)[])[][];
  groupBy?: string[];
  agg?: string[][];
  fill?: string;
  temporality?: string;
  slice?: string[];
  sortCols?: string[];
  limit?: number;
};
