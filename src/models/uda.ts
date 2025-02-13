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

export enum ParamFieldType {
  Text = "text",
  Number = "number",
  Boolean = "boolean",
  Timestamp = "timestamp",
  Invalid = "invalid",
  MultiType = "multitype",
  JSON = "json",
}

export enum InvalidParamFieldErrors {
  BadField = "badField",
  NoMetadata = "noMetadata",
}

export interface UDAParam {
  name: string;
  description: string;
  default?: any;
  isReq: boolean;
  type: number[] | number;
  fieldType?: ParamFieldType;
  value?: any;
  isVisible?: boolean;
}

export interface UDAReturn {
  type?: number[];
  description?: string;
}

export interface UDA {
  name: string;
  description: string;
  params: UDAParam[];
  return?: UDAReturn;
  incompatibleError?: string;
}
