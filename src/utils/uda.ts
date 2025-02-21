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

export function getUDAParamType(
  type: ParamFieldType | ParamFieldType[],
): string | string[] {
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

  let foundType: ParamFieldType | undefined;
  for (const fieldType of typePriority) {
    if (typeSet.has(fieldType)) {
      if (foundType) {
        return ParamFieldType.MultiType;
      }
      foundType = fieldType;
    }
  }

  return foundType ?? ParamFieldType.Invalid;
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
    const typeStrings = convertTypesToString(validTypes);

    let multiFieldTypes: { [key: string]: ParamFieldType }[] | undefined;
    if (fieldType === ParamFieldType.MultiType) {
      multiFieldTypes = validTypes.map((type, index) => ({
        [typeStrings[index]]: getUDAFieldType(type),
      }));
    } else {
      multiFieldTypes = undefined;
    }

    if (fieldType === ParamFieldType.Invalid && param.isReq) {
      hasInvalidRequiredParam = true;
    }

    parsedParams.push({
      ...param,
      type: validTypes,
      fieldType,
      typeStrings,
      multiFieldTypes,
      isVisible: param.isReq,
    });
  });

  return hasInvalidRequiredParam ? ParamFieldType.Invalid : parsedParams;
}

export function convertTypesToString(returnType: number[]): string[] {
  if (!Array.isArray(returnType)) {
    returnType = [returnType];
  }
  return returnType.map(
    (type) => ext.constants.dataTypes.get(type.toString()) ?? type.toString(),
  );
}

export function getIncompatibleError(
  metadata: any,
  parsedParams: any,
): InvalidParamFieldErrors | undefined {
  if (!metadata) {
    return InvalidParamFieldErrors.NoMetadata;
  }
  if (parsedParams === ParamFieldType.Invalid) {
    return InvalidParamFieldErrors.BadField;
  }
  return undefined;
}

export function createUDAReturn(metadata: any): UDAReturn {
  return {
    type: convertTypesToString(metadata?.return.type || []),
    description: metadata?.return.description || "",
  };
}

export function createUDAObject(
  uda: any,
  parsedParams: any,
  incompatibleError: any,
): UDA {
  return {
    name: uda.api,
    description: uda.metadata?.description || "",
    params: Array.isArray(parsedParams) ? parsedParams : [],
    return: createUDAReturn(uda.metadata),
    incompatibleError,
  };
}

export function parseUDAList(getMeta: MetaObjectPayload): UDA[] {
  const UDAs: UDA[] = [];
  if (getMeta.api !== undefined) {
    const getMetaUDAs = getMeta.api.filter((api) => api.custom === true);
    if (getMetaUDAs.length !== 0) {
      for (const uda of getMetaUDAs) {
        const parsedParams = parseUDAParams(uda.metadata?.params);
        const incompatibleError = getIncompatibleError(
          uda.metadata,
          parsedParams,
        );
        UDAs.push(createUDAObject(uda, parsedParams, incompatibleError));
      }
    }
  }
  return UDAs;
}

export function retrieveDataTypeByString(type: string): number {
  return ext.constants.reverseDataTypes.get(type) ?? 0;
}
