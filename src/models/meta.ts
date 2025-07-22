/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

export enum MetaInfoType {
  META = "meta",
  SCHEMA = "schema",
  API = "api",
  AGG = "agg",
  DAP = "dap",
  RC = "rc",
}

export type MetaRC = {
  rc: string;
  labels: {
    [id: string]: string;
  }[];
  started: string;
  api: number;
  agg: number;
  assembly: number;
  schema: number;
};

export type MetaAgg = {
  aggFn: string;
  custom: boolean;
  full: boolean;
  metadata: any;
  procs: string[];
};

export type MetaApi = {
  api: string;
  kxname: string[];
  aggFn: string;
  custom: boolean;
  full: boolean;
  metadata?: MetaApiMetadata; // metadata pode ser undefined
  procs: any[];
};

export type MetaApiMetadata = {
  description: string;
  params: {
    name: string;
    type: number | number[];
    isReq: boolean;
    description: string;
    default?: string | number;
  }[];
  return: {
    type: number[];
    description: string;
  };
  aggReturn: {
    type: number;
    description: string;
  };
  misc: {
    [key: string]: any;
  };
};

export type MetaAssembly = {
  assembly: string;
  tbls: string[];
  instances?: MetaDap[];
  [additionalProp: string]: string | string[] | MetaDap[] | undefined;
};

export type MetaSchema = {
  table: string;
  assembly: string;
  type: string;
  columns: MetaColumns[];
};

export type MetaColumns = {
  anymap: boolean;
  attrDisk: string;
  attrIDisk: string;
  attrMem: string;
  column: string;
  foreign: string;
  isSerialized: boolean;
  typ: number;
};

export type MetaDap = {
  dap: string;
  assembly: string;
  startTS: string;
  endTS: string;
  labels: string[];
  instance: string;
};

export type MetaObjectPayload = {
  rc: MetaRC[];
  api: MetaApi[];
  agg: MetaAgg[];
  assembly: MetaAssembly[];
  schema: MetaSchema[];
  dap: MetaDap[];
};

export type MetaObject = {
  header: {
    [id: string]: number | string;
  };
  payload: MetaObjectPayload;
};
