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

export interface ScopeObject {
  affinity?: string;
  assembly: string;
  tier?: string;
  dap?: string;
}

//Scratchpad Request Body
export interface ScratchpadRequestBody {
  expression: string;
  language: string;
  context: string;
  sampleFn: string;
  sampleSize: number;
  isTableView?: boolean;
  returnFormat?: string;
}

// Scratchpad Import Request Body
export interface ScratchpadImportQSQLReqBody {
  params: {
    query: string;
    scope: ScopeObject;
  };
  language: string;
  instance: string;
  output?: string;
  returnFormat: string;
  sampleFn: string;
  sampleSize: number;
}

export interface ScratchpadImportSQLReqBody {
  params: {
    query: string;
  };
  language: string;
  output?: string;
  returnFormat: string;
  sampleFn: string;
  sampleSize: number;
}

export interface ScratchpadImportAPIReqBody {
  params: {
    table: string;
    [key: string]: any;
  };
  language: string;
  output?: string;
  returnFormat: string;
  sampleFn: string;
  sampleSize: number;
}

export interface ScratchpadImportUDAReqBody {
  output: string;
  returnFormat: string;
  params: {
    [key: string]: any;
  };
  parameterTypes: { [key: string]: any };
  language: string;
  name: string;
  sampleFn: string;
  sampleSize: number;
}

// Servicegateway Request Body
export interface ServicegatewayUDAReqBody {
  [key: string]: any;
  parameterTypes?: any;
}

export interface ServicegatewayQSQLReqBody {
  labels?: ScopeObject;
  query: string;
  scope: ScopeObject;
}

export interface ServicegatewaySQLReqBody {
  query: string;
  scope: ScopeObject;
}

export interface ServicegatewayAPIReqBody {
  table: string;
  startTS: string;
  endTS: string;
  agg?: string[];
  fill?: string;
  filter?: any[];
  groupBy?: string[];
  inputTZ?: string;
  labels?: ScopeObject;
  limit?: any;
  outputTZ?: string;
  scope?: ScopeObject;
  sortCols?: string[];
  slice?: any[];
  temporality?: string;
  rowCountLimit?: string;
  isRowLimitLast?: boolean;
}
