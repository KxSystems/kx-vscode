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

import { MetaResult } from "./metaResult";

export type QueryResult = {
  result: string;
  errored: boolean;
  error: string;
  keys: string[];
  meta: MetaResult[];

  data: any;
  backtrace: {
    name: string;
    text: string;
    index: number;
  }[];

  errorMsg?: string;
  stacktrace?: string;
};

export enum QueryResultType {
  Text,
  JSON,
  Bytes,
  Error,
}

export const queryConstants = {
  error: "Error:",
};

export interface StructuredTextColumns {
  name: string;
  type: string;
  values: string[] | string;
  order:
    | number[] /* ascending indexes if the column is sorted */
    | string /* error message if sorting is not possible */;
  isKey?: boolean /* a key column of a dictionary or a keyed table */;
  attributes?: string /* the q attribute the column carries: s, u, p or g */;
}

export interface StructuredTextResults {
  columns: StructuredTextColumns[] | StructuredTextColumns;
  /* note: values array length may differ */
  count: number;
}
