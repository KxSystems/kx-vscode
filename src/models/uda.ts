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

export enum ParamFieldType {
  Text = "text",
  Number = "number",
  Boolean = "boolean",
  Timestamp = "timestamp",
  Invalid = "invalid",
  MultiType = "multitype",
  JSON = "json",
  Code = "code",
}

export enum InvalidParamFieldErrors {
  BadField = "badField",
  NoMetadata = "noMetadata",
}

export type ParamSource = "tables" | "columns" | "targets";

export interface UDAParamField {
  name: string;
  choices?: string[];
  at?: number;
  many?: boolean;
  typed?: boolean;
  source?: ParamSource;
}

export interface UDAParam {
  name: string;
  description: string;
  default?: any;
  isReq: boolean;
  type: number[] | number;
  typeStrings?: string[];
  fieldType?: ParamFieldType;
  multiFieldTypes?: { [key: string]: ParamFieldType }[];
  selectedMultiTypeString?: string;
  value?: any;
  isVisible?: boolean;
  isDistinguised?: boolean;
  choices?: string[];
  rows?: UDAParamField[];
  source?: ParamSource;
}

export interface UDAReturn {
  type?: string[];
  description?: string;
}

export interface UDA {
  name: string;
  description: string;
  params: UDAParam[];
  return?: UDAReturn;
  incompatibleError?: string;
}

export interface UDARequestBody {
  language: string;
  name: string;
  output?: string;
  parameterTypes: Record<string, unknown>;
  params: Record<string, unknown>;
  returnFormat: string;
  sampleFn: string;
  sampleSize: number;
}

export const UDA_DISTINGUISHED_PARAMS: UDAParam[] = [
  {
    name: "table",
    description: "Table to target.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    isVisible: false,
    fieldType: ParamFieldType.Text,
    isDistinguised: true,
    source: "tables",
  },
  {
    name: "labels",
    description: "A dictionary describing DAP labels to target,",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    isVisible: false,
    fieldType: ParamFieldType.JSON,
    isDistinguised: true,
  },
  {
    name: "scope",
    description: "A dictionary describing what RC and/or DAPs to target.",
    isReq: false,
    type: [99],
    typeStrings: ["Dictionary"],
    fieldType: ParamFieldType.JSON,
    isDistinguised: true,
  },
  {
    name: "startTS",
    description: "Inclusive start time of the request.",
    isReq: false,
    type: [-12],
    typeStrings: ["Timestamp"],
    isVisible: false,
    fieldType: ParamFieldType.Timestamp,
    isDistinguised: true,
  },
  {
    name: "endTS",
    description: "Exclusive end time of the request.",
    isReq: false,
    type: [-12],
    typeStrings: ["Timestamp"],
    isVisible: false,
    fieldType: ParamFieldType.Timestamp,
    isDistinguised: true,
  },
  {
    name: "inputTZ",
    description: "Timezone of startTS and endTS (default: UTC).",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    isVisible: false,
    fieldType: ParamFieldType.Text,
    isDistinguised: true,
  },
  {
    name: "outputTZ",
    description:
      "Timezone of the final result (.kxi.getData only). No effect on routing.",
    isReq: false,
    type: [-11],
    typeStrings: ["Symbol"],
    isVisible: false,
    fieldType: ParamFieldType.Text,
    isDistinguised: true,
  },
];

const TABLE_PARAMS = /^(table|tablename)$/;
const COLUMN_PARAMS = /^(column|columns|col|cols|sortcols|groupby|bycols|by)$/;

export function sourceForParam(
  name: string,
  fieldType?: ParamFieldType,
): ParamSource | undefined {
  if (fieldType !== ParamFieldType.Text) {
    return undefined;
  }
  const key = name.toLowerCase();
  if (TABLE_PARAMS.test(key)) {
    return "tables";
  }
  return COLUMN_PARAMS.test(key) ? "columns" : undefined;
}

export const allowedEmptyRequiredTypes = [10, -11];

export const allowedEmptyRequiredTypesStrings = ["Symbol", "String"];
