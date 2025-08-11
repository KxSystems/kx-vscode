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

import { convertTimeToTimestamp } from "./dataSource";
import { normalizeAssemblyTarget } from "./shared";
import { retrieveUDAtoCreateReqBody } from "./uda";
import { InsightsConnection } from "../classes/insightsConnection";
import { ext } from "../extensionVariables";
import { DataSourceFiles } from "../models/dataSource";
import {
  ScratchpadImportQSQLReqBody,
  ScratchpadImportSQLReqBody,
  ScratchpadImportAPIReqBody,
  ScratchpadImportUDAReqBody,
  ScratchpadRequestBody,
  ServicegatewayQSQLReqBody,
  ServicegatewaySQLReqBody,
  ServicegatewayAPIReqBody,
  ServicegatewayUDAReqBody,
} from "../models/requestBody";

function addIfDefined(target: any, key: string, value: any): void {
  if (
    value !== undefined &&
    value !== "" &&
    (Array.isArray(value) ? value.length > 0 : true)
  ) {
    target[key] = value;
  }
}

// <-- Scrachpad section -->
// Execute Scratchpad request body
export function generateScratchpadQueryReqBody(
  expression: string,
  context?: string,
  isPython?: boolean,
): ScratchpadRequestBody {
  const returnFormat = ext.isResultsTabVisible ? "structuredText" : "text";
  const language = isPython ? "python" : "q";
  return {
    expression,
    language,
    context: context || ".",
    sampleFn: "first",
    sampleSize: 10000,
    returnFormat,
  };
}

// Import scratchpad request Body
export function generateScratchpadQSQLImportReqBody(
  query: string,
  target: string,
  variableName: string,
): ScratchpadImportQSQLReqBody {
  const [assembly, tier, dap] = normalizeAssemblyTarget(target).split(/\s+/);
  const body: ScratchpadImportQSQLReqBody = {
    params: {
      query,
      scope: {
        affinity: "soft",
        assembly,
        tier,
        dap,
      },
    },
    language: "q",
    output: variableName,
    returnFormat: "text",
    sampleFn: "first",
    sampleSize: 10000,
    instance: tier,
  };

  return body;
}

export function generateScratchpadSQLImportReqBody(
  query: string,
  variableName: string,
): ScratchpadImportSQLReqBody {
  const body: ScratchpadImportSQLReqBody = {
    params: {
      query,
    },
    language: "sql",
    output: variableName,
    returnFormat: "text",
    sampleFn: "first",
    sampleSize: 10000,
  };
  return body;
}

export function generateScratchpadAPIImportReqBody(
  datasourceParams: DataSourceFiles,
  variableName: string,
): ScratchpadImportAPIReqBody {
  const table = datasourceParams.dataSource.api.table;
  const startTS = convertTimeToTimestamp(
    datasourceParams.dataSource.api.startTS,
  );
  const endTS = convertTimeToTimestamp(datasourceParams.dataSource.api.endTS);
  const body: ScratchpadImportAPIReqBody = {
    params: {
      table,
      startTS,
      endTS,
    },
    language: "q",
    output: variableName,
    returnFormat: "text",
    sampleFn: "first",
    sampleSize: 10000,
  };

  const api = datasourceParams.dataSource.api;
  addIfDefined(body.params, "fill", api.fill);
  addIfDefined(body.params, "temporality", api.temporality);
  addIfDefined(body.params, "filter", api.filter);
  addIfDefined(body.params, "groupBy", api.groupBy);
  addIfDefined(body.params, "agg", api.agg);
  addIfDefined(body.params, "sortCols", api.sortCols);
  addIfDefined(body.params, "slice", api.slice);
  addIfDefined(body.params, "labels", api.labels);

  if (api.rowCountLimit && api.rowCountLimit !== "") {
    body.params.limit = api.isRowLimitLast
      ? -parseInt(api.rowCountLimit)
      : parseInt(api.rowCountLimit);
  }

  return body;
}

export async function generateScratchpadUDAImportReqBody(
  datasourceParams: DataSourceFiles,
  variableName: string,
  insightsConn: InsightsConnection,
): Promise<ScratchpadImportUDAReqBody> {
  const uda = datasourceParams.dataSource.uda;
  const udaBody = await retrieveUDAtoCreateReqBody(uda, insightsConn);
  const body: ScratchpadImportUDAReqBody = {
    output: variableName,
    returnFormat: "text",
    params: udaBody.params,
    parameterTypes: udaBody.parameterTypes,
    language: udaBody.language,
    name: udaBody.name,
    sampleFn: udaBody.sampleFn,
    sampleSize: udaBody.sampleSize,
  };

  return body;
}

// <-- Servicegateway section -->
export function generateServicegatewayQSQLReqBody(
  query: string,
  target: string,
): ServicegatewayQSQLReqBody {
  const [assembly, tier, dap] = normalizeAssemblyTarget(target).split(/\s+/);
  return {
    labels: {
      affinity: "soft",
      assembly,
      tier,
      dap,
    },
    query,
    scope: {
      affinity: "soft",
      assembly,
      tier,
      dap,
    },
  };
}

export function generateServicegatewaySQLReqBody(
  query: string,
  target: string,
): ServicegatewaySQLReqBody {
  const [assembly, tier, dap] = normalizeAssemblyTarget(target).split(/\s+/);
  return {
    query,
    scope: {
      affinity: "soft",
      assembly,
      tier,
      dap,
    },
  };
}

export function generateServicegatewayAPIReqBody(
  datasourceParams: DataSourceFiles,
): ServicegatewayAPIReqBody {
  const table = datasourceParams.dataSource.api.table;
  const startTS = convertTimeToTimestamp(
    datasourceParams.dataSource.api.startTS,
  );
  const endTS = convertTimeToTimestamp(datasourceParams.dataSource.api.endTS);
  const body: ServicegatewayAPIReqBody = {
    table,
    startTS,
    endTS,
  };

  const api = datasourceParams.dataSource.api;
  addIfDefined(body, "fill", api.fill);
  addIfDefined(body, "temporality", api.temporality);
  addIfDefined(body, "filter", api.filter);
  addIfDefined(body, "groupBy", api.groupBy);
  addIfDefined(body, "agg", api.agg);
  addIfDefined(body, "sortCols", api.sortCols);
  addIfDefined(body, "slice", api.slice);
  addIfDefined(body, "labels", api.labels);
  if (api.rowCountLimit && api.rowCountLimit !== "") {
    body.limit = api.isRowLimitLast
      ? -parseInt(api.rowCountLimit)
      : parseInt(api.rowCountLimit);
  }

  return body;
}

export async function generateServiceGatewayUDAReqBody(
  datasourceParams: DataSourceFiles,
  insightsConn: InsightsConnection,
): Promise<ServicegatewayUDAReqBody> {
  const uda = datasourceParams.dataSource.uda;
  const udaBody = await retrieveUDAtoCreateReqBody(uda, insightsConn);
  const body: ServicegatewayUDAReqBody = {
    ...udaBody.params,
  };

  return body;
}
