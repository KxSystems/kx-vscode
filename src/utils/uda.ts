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

import { InsightsConnection } from "../classes/insightsConnection";
import { ext } from "../extensionVariables";
import { MetaObjectPayload } from "../models/meta";
import { PREVIEW, isPreview, parseValue } from "../models/query";
import {
  InvalidParamFieldErrors,
  ParamFieldType,
  SCOPE,
  UDA,
  UDAParam,
  UDARequestBody,
  UDAReturn,
  sourceForParam,
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
      source: sourceForParam(param.name, fieldType),
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

const MINUTE_PRECISION = /^(?:\d{4}-\d{2}-\d{2}T)?\d{2}:\d{2}$/;

//TODO: Should remove this after add nanoseconds support in uda
export function fixTimeAtUDARequestBody(
  udaReqBody: UDARequestBody,
): UDARequestBody {
  const parameterTypes = udaReqBody.parameterTypes as {
    [key: string]: number;
  };
  const params = udaReqBody.params as { [key: string]: any };

  for (const key in parameterTypes) {
    if (parameterTypes[key] === -12) {
      const value = params[key];
      if (typeof value === "string" && MINUTE_PRECISION.test(value)) {
        params[key] = `${value}:00.000000000`;
      }
    }
  }

  return udaReqBody;
}

export function getIncompatibleError(
  parsedParams: any,
): InvalidParamFieldErrors | undefined {
  if (parsedParams === ParamFieldType.Invalid) {
    return InvalidParamFieldErrors.BadField;
  }
  return undefined;
}

export function createUDAReturn(uda: any): UDAReturn {
  return {
    type: convertTypesToString(uda?.return?.type || []),
    description: uda?.return?.description || "",
  };
}

export function createUDAObject(
  uda: any,
  parsedParams: any,
  incompatibleError: any,
): UDA {
  return {
    name: uda.api,
    description: uda?.description || "",
    params: Array.isArray(parsedParams) ? parsedParams : [],
    return: createUDAReturn(uda),
    incompatibleError,
  };
}

/**
 * The preview API, when the connection has one. `.kxi.preview` is registered as
 * a system API rather than a UDA, so it is picked out by name where
 * `parseUDAList` goes by the flag, and a deployment without it offers no
 * preview at all. The meta describes it in full — table, startTS, endTS and
 * limit — so the form comes from the connection rather than from a copy of the
 * signature kept here.
 */
export function parsePreviewApi(getMeta: MetaObjectPayload): UDA | undefined {
  const preview = getMeta.api?.find((api) => api.api === PREVIEW);
  if (!preview) {
    return undefined;
  }
  const parsedParams = parseUDAParams(preview.params);
  return createUDAObject(
    preview,
    parsedParams,
    getIncompatibleError(parsedParams),
  );
}

export function parseUDAList(getMeta: MetaObjectPayload): UDA[] {
  const UDAs: UDA[] = [];
  if (getMeta.api !== undefined) {
    const getMetaUDAs = getMeta.api.filter((api) => api.uda === true);
    if (getMetaUDAs.length !== 0) {
      for (const uda of getMetaUDAs) {
        const parsedParams = parseUDAParams(uda.params);
        const incompatibleError = getIncompatibleError(parsedParams);
        UDAs.push(createUDAObject(uda, parsedParams, incompatibleError));
      }
    }
  }
  return UDAs;
}

export function retrieveDataTypeByString(type: string): number {
  return ext.constants.reverseDataTypes.get(type) ?? 0;
}

export async function validateUDA(
  uda: UDA | undefined,
  selectedConn: InsightsConnection,
): Promise<{ error: string } | null> {
  if (!uda) {
    return { error: "UDA not found" };
  }

  if (uda.name === "") {
    return { error: "UDA name not found" };
  }

  const isAvailable = await selectedConn.isUDAAvailable(uda.name);
  if (!isAvailable) {
    return { error: `UDA ${uda.name} is not available in this connection` };
  }

  return null;
}

export function processUDAParams(uda: UDA): {
  params: { [key: string]: any };
  parameterTypes: { [key: string]: number };
  error?: { error: string };
} {
  const params: { [key: string]: any } = {};
  const parameterTypes: { [key: string]: number } = {};

  if (uda.incompatibleError) {
    return {
      params: {},
      parameterTypes: {},
      error: {
        error: `The UDA you have selected cannot be queried because it has required fields with types that are not supported.`,
      },
    };
  }

  if (uda.params && uda.params.length > 0) {
    for (const param of uda.params) {
      const validationError = validateParam(param, uda.name);
      if (validationError) {
        return validationError;
      }

      if (param.isVisible) {
        const type = resolveParamType(param);
        const value = jsonValue(param, type);
        if (value instanceof Error) {
          return {
            params: {},
            parameterTypes: {},
            error: { error: value.message },
          };
        }
        params[param.name] = value;
        parameterTypes[param.name] = type;
      }
    }
  }

  return { params, parameterTypes };
}

/**
 * The value a parameter is sent as. A JSON-typed one — a dictionary or a list —
 * is edited as JSON text and held as that text, but has to reach the gateway as
 * the value the text describes: sent as a string it is refused outright, with
 * `Argument 'scope' is not a dictionary` or `Invalid labels. Not a dictionary`.
 * Text that does not parse is returned as the Error to report, rather than left
 * for the gateway to answer 400 to. `scope` is the exception: it holds a target
 * string rather than JSON, and `retrieveUDAtoCreateReqBody` resolves it against
 * the connection meta once there is a connection to resolve it against.
 */
function jsonValue(param: UDAParam, type: number): unknown {
  const value = param.value ?? "";
  if (
    param.name === SCOPE ||
    !ext.jsonTypes.has(type) ||
    typeof value !== "string" ||
    !value.trim()
  ) {
    return value;
  }
  const parsed = parseValue(value);
  return parsed === undefined
    ? new Error(
        `The ${param.name} parameter is not valid JSON. Give it a value like ["a","b"] or {"key":"value"}.`,
      )
    : parsed;
}

function validateParam(
  param: UDAParam,
  udaName: string,
): {
  params: Record<string, never>;
  parameterTypes: Record<string, never>;
  error: { error: string };
} | null {
  if (isInvalidRequiredParam(param)) {
    return {
      params: {},
      parameterTypes: {},
      error: {
        error: `The UDA: ${udaName} requires the parameter: ${param.name}.`,
      },
    };
  }
  return null;
}

/**
 * The type a parameter is being given as: for a parameter registered with more
 * than one, the one picked on the form rather than the first declared.
 * Undefined where there is nothing to go on — a multi-typed parameter with no
 * pick yet, an empty type list, or a type the map does not name.
 */
function selectedParamType(param: UDAParam): number | undefined {
  if (!Array.isArray(param.type)) {
    return typeof param.type === "number" ? param.type : undefined;
  }
  if (param.type.length > 1) {
    if (!param.selectedMultiTypeString) {
      return undefined;
    }
    const named = param.selectedMultiTypeString.replace("_", " ");
    return ext.constants.reverseDataTypes.get(named);
  }
  return param.type[0];
}

/**
 * Whether a parameter has been left blank. A parameter given `false` or `0` has
 * been answered, so neither counts as blank.
 */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * The parameters whose chosen type the service gateway will not honour. A REST
 * request carries no type of its own: the gateway casts each parameter using
 * the UDA's registered metadata, and "if multiple types are specified,
 * auto-casting uses the first type in the list" — so a multi-typed parameter
 * given anything but its first type is cast to something else. The scratchpad
 * takes parameterTypes and does honour the choice, so this is about Run Query
 * alone.
 */
export function recastParams(uda: UDA): string[] {
  return (uda.params || [])
    .filter((param) => {
      if (!param.isVisible || !Array.isArray(param.type)) {
        return false;
      }
      const selected = selectedParamType(param);
      return (
        param.type.length > 1 &&
        selected !== undefined &&
        selected !== param.type[0]
      );
    })
    .map((param) => param.name);
}

export function resolveParamType(param: UDAParam): number {
  const selected = selectedParamType(param);
  if (selected !== undefined) {
    return selected;
  }
  // Reached by a multi-typed parameter whose pick is missing or unrecognised;
  // a single type has already come back from selectedParamType.
  if (Array.isArray(param.type) && param.type.length > 0) {
    return param.type[0];
  }
  throw new Error(
    `Invalid type for parameter: ${param.name}. Expected number or array of numbers.`,
  );
}

export function isInvalidRequiredParam(param: UDAParam): boolean {
  if (param.name === "table" && param.isReq) {
    return isBlank(param.value);
  }

  const typeToValidate = selectedParamType(param);

  const isAllowedEmptyType =
    typeof typeToValidate === "number" &&
    ext.constants.allowedEmptyRequiredTypes.includes(typeToValidate);

  return !isAllowedEmptyType && param.isReq && isBlank(param.value);
}

export function createUDARequestBody(
  name: string,
  params: { [key: string]: any },
  parameterTypes: { [key: string]: any },
  returnFormat: string,
): UDARequestBody {
  return {
    language: "q",
    name,
    parameterTypes,
    params,
    returnFormat,
    sampleFn: "first",
    sampleSize: 10000,
  };
}

export async function retrieveUDAtoCreateReqBody(
  uda: UDA | undefined,
  insightsConn: InsightsConnection,
): Promise<UDARequestBody | any> {
  if (!uda) {
    return { error: "UDA is undefined" };
  }

  const returnFormat = ext.isResultsTabVisible ? "structuredText" : "text";

  const validationError = await validateUDA(uda, insightsConn);
  if (validationError) {
    return validationError;
  }

  const { params, parameterTypes, error } = processUDAParams(uda);
  if (error) {
    return error;
  }

  // A parameter shown and left blank is not an answer, and preview has a
  // documented default behind each of the three optional ones: the whole
  // available range, and a thousand rows. Dropping the empty box asks for that
  // default rather than handing the gateway a blank to cast.
  if (isPreview(uda)) {
    for (const param of uda.params) {
      if (!param.isReq && isBlank(params[param.name])) {
        delete params[param.name];
        delete parameterTypes[param.name];
      }
    }
  }

  // The form holds a target string; the request wants the dictionary it stands
  // for, and only the connection can say what the gateway calls those names.
  if (SCOPE in params) {
    const scope = insightsConn.scopeValue(params[SCOPE]);
    if (scope === undefined) {
      delete params[SCOPE];
      delete parameterTypes[SCOPE];
    } else {
      params[SCOPE] = scope;
    }
  }

  const udaReqBody: UDARequestBody = createUDARequestBody(
    uda.name,
    params,
    parameterTypes,
    returnFormat,
  );

  return udaReqBody;
}
