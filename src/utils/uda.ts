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

import { ext } from "../extensionVariables";
import { MetaObjectPayload } from "../models/meta";
import {
  InvalidParamFieldErrors,
  ParamFieldType,
  UDA,
  UDAParam,
  UDAReturn,
} from "../models/uda";

export function filterUDAParamsValidTypes(type: number | number[]): number[] {
  const validTypes = new Set([
    ...ext.booleanTypes,
    ...ext.numberTypes,
    ...ext.textTypes,
    ...ext.timestampTypes,
    ...ext.jsonTypes,
  ]);

  const typesArray = Array.isArray(type) ? type : [type];

  return typesArray.filter(validTypes.has, validTypes);
}

export function getUDAParamType(type: ParamFieldType): string | string[] {
  if (Array.isArray(type)) {
    return type.map(
      (t) => ext.constants.dataTypes.get(t.toString()) ?? t.toString(),
    );
  }
  return ext.constants.dataTypes.get(type.toString()) ?? type.toString();
}

export function getUDAFieldType(type: number | number[]): ParamFieldType {
  if (!Array.isArray(type)) {
    return parseUDAParamTypes(type);
  }

  const typeSet = new Set(type.map(parseUDAParamTypes));

  if (typeSet.size === 1) {
    return typeSet.values().next().value ?? ParamFieldType.Invalid;
  }

  const typePriority = [
    ParamFieldType.Text,
    ParamFieldType.Number,
    ParamFieldType.Boolean,
    ParamFieldType.Timestamp,
    ParamFieldType.JSON,
  ];

  for (const fieldType of typePriority) {
    if (typeSet.has(fieldType)) {
      return fieldType;
    }
  }

  return typeSet.size > 1 ? ParamFieldType.MultiType : ParamFieldType.Invalid;
}

export function parseUDAParamTypes(type: number): ParamFieldType {
  const typeMap = new Map<number, ParamFieldType>([
    ...Array.from(ext.booleanTypes).map(
      (t) => [t, ParamFieldType.Boolean] as [number, ParamFieldType],
    ),
    ...Array.from(ext.numberTypes).map(
      (t) => [t, ParamFieldType.Number] as [number, ParamFieldType],
    ),
    ...Array.from(ext.textTypes).map(
      (t) => [t, ParamFieldType.Text] as [number, ParamFieldType],
    ),
    ...Array.from(ext.timestampTypes).map(
      (t) => [t, ParamFieldType.Timestamp] as [number, ParamFieldType],
    ),
    ...Array.from(ext.jsonTypes).map(
      (t) => [t, ParamFieldType.JSON] as [number, ParamFieldType],
    ),
  ]);

  return typeMap.get(type) ?? ParamFieldType.Invalid;
}

export function parseUDAParams(
  params: UDAParam[] | undefined,
): UDAParam[] | ParamFieldType.Invalid {
  if (!params) {
    return [];
  }

  const parsedParams: UDAParam[] = [];
  let hasInvalidRequiredParam = false;

  params.forEach((param) => {
    const validTypes = filterUDAParamsValidTypes(param.type);
    const fieldType = validTypes.length
      ? getUDAFieldType(validTypes)
      : ParamFieldType.Invalid;

    if (fieldType === ParamFieldType.Invalid && param.isReq) {
      hasInvalidRequiredParam = true;
    }

    parsedParams.push({
      ...param,
      type: validTypes,
      fieldType,
    });
  });

  return hasInvalidRequiredParam ? ParamFieldType.Invalid : parsedParams;
}

export function parseReturnTypes(returnType: number[]): string[] {
  if (!Array.isArray(returnType)) {
    returnType = [returnType];
  }
  return returnType.map(
    (type) => ext.constants.dataTypes.get(type.toString()) ?? type.toString(),
  );
}

export function parseUDAList(getMeta: MetaObjectPayload): UDA[] {
  const UDAs: UDA[] = [];
  if (getMeta.api !== undefined) {
    const getMetaUDAs = getMeta.api.filter((api) => api.custom === true);
    if (getMetaUDAs.length !== 0) {
      for (const uda of getMetaUDAs) {
        const parsedParams = parseUDAParams(uda.metadata?.params);
        let incompatibleError = undefined;
        if (!uda.metadata) {
          incompatibleError = InvalidParamFieldErrors.NoMetadata;
        }
        if (parsedParams === ParamFieldType.Invalid) {
          incompatibleError = InvalidParamFieldErrors.BadField;
        }
        const returnData: UDAReturn = {
          type: parseReturnTypes(uda.metadata?.return.type || []),
          description: uda.metadata?.return.description || "",
        };
        UDAs.push({
          name: uda.api,
          description: uda.metadata?.description || "",
          params: Array.isArray(parsedParams) ? parsedParams : [],
          return: returnData,
          incompatibleError,
        });
      }
    }
  }

  return UDAs;
}
