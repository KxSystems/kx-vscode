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
import { MessageKind, notify } from "./notifications";
import { getQSQLWrapper } from "./queryUtils";
import { normalizeAssemblyTarget } from "./shared";
import { retrieveUDAtoCreateReqBody } from "./uda";
import { ext } from "../extensionVariables";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import {
  ScratchpadImportAPIReqBody,
  ScratchpadImportQSQLReqBody,
  ScratchpadImportSQLReqBody,
  ScratchpadImportUDAReqBody,
  ScratchpadRequestBody,
  ServicegatewayAPIReqBody,
  ServicegatewayQSQLReqBody,
  ServicegatewaySQLReqBody,
  ServicegatewayUDAReqBody,
} from "../models/requestBody";

const logger = "requestBodyUtils";

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
  isNotebook?: boolean,
): ScratchpadRequestBody {
  let returnFormat = "text";

  if (isNotebook || ext.isResultsTabVisible) {
    returnFormat = "structuredText";
  }

  const language = isPython ? "python" : "q";

  return {
    expression,
    language,
    context: context ?? ".",
    sampleFn: "first",
    sampleSize: 10000,
    returnFormat,
  };
}

// Import scratchpad request Body
export async function selectAndGenerateScratchpadImportReqBody(
  query: string | DataSourceFiles,
  populateType: DataSourceTypes,
  variableName: string,
  connLabel: string,
  target: string,
  isPython?: boolean,
): Promise<
  | ScratchpadImportQSQLReqBody
  | ScratchpadImportSQLReqBody
  | ScratchpadImportAPIReqBody
  | ScratchpadImportUDAReqBody
  | undefined
> {
  if (typeof query === "string") {
    if (query.trim() === "") {
      notify("No query provided to populate scratchpad.", MessageKind.ERROR, {
        logger,
      });
      return;
    }
    if (populateType === DataSourceTypes.QSQL) {
      return generateScratchpadQSQLImportReqBody(
        query,
        target,
        variableName,
        isPython,
      );
    }
    if (populateType === DataSourceTypes.SQL) {
      return generateScratchpadSQLImportReqBody(query, variableName);
    }
    return;
  } else {
    if (populateType === DataSourceTypes.API) {
      return generateScratchpadAPIImportReqBody(query, variableName);
    }
    if (populateType === DataSourceTypes.UDA) {
      return await generateScratchpadUDAImportReqBody(
        query,
        variableName,
        connLabel,
      );
    }
  }
  notify("No data provided to populate scratchpad.", MessageKind.ERROR, {
    logger,
  });
}

export function generateScratchpadQSQLImportReqBody(
  query: string,
  target: string,
  variableName: string,
  isPython?: boolean,
): ScratchpadImportQSQLReqBody {
  const [assembly, tier, dap] = normalizeAssemblyTarget(target).split(/\s+/);
  const body: ScratchpadImportQSQLReqBody = {
    params: {
      query: getQSQLWrapper(query, isPython),
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
  connLabel: string,
): Promise<ScratchpadImportUDAReqBody | undefined> {
  const uda = datasourceParams.dataSource.uda;
  const udaBody = await retrieveUDAtoCreateReqBody(uda, connLabel);
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
export function selectAndGenerateServicegatewayReqBody(
  query: string | DataSourceFiles,
  populateType: DataSourceTypes,
  target: string,
  isPython?: boolean,
) {
  if (typeof query === "string") {
    if (populateType === DataSourceTypes.QSQL) {
      return generateServicegatewayQSQLReqBody(query, target, isPython);
    }
    if (populateType === DataSourceTypes.SQL) {
      return generateServicegatewaySQLReqBody(query);
    }
  } else {
    if (populateType === DataSourceTypes.API) {
      return generateServicegatewayAPIReqBody(query);
    }
    if (populateType === DataSourceTypes.UDA) {
      return generateServiceGatewayUDAReqBody(query);
    }
  }
  notify("No data provided to execute the query.", MessageKind.ERROR, {
    logger,
  });
}

export function generateServicegatewayQSQLReqBody(
  query: string,
  target: string,
  isPython?: boolean,
): ServicegatewayQSQLReqBody {
  const [assembly, tier, dap] = normalizeAssemblyTarget(target).split(/\s+/);

  return {
    query: getQSQLWrapper(query, isPython),
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
): ServicegatewaySQLReqBody {
  return {
    query,
  };
}

function processOptionalParameters(
  body: ServicegatewayAPIReqBody,
  api: any,
  optional: any,
): void {
  if (optional.filled) {
    addIfDefined(body, "fill", api.fill);
  }
  if (optional.temporal) {
    addIfDefined(body, "temporality", api.temporality);
  }
  if (optional.rowLimit && api.rowCountLimit) {
    body.limit = api.isRowLimitLast
      ? -parseInt(api.rowCountLimit)
      : parseInt(api.rowCountLimit);
  }

  const activeLabels = optional.labels.filter((label: any) => label.active);

  if (activeLabels.length > 0) {
    body.labels = Object.assign(
      {},
      ...activeLabels.map((label: any) => ({ [label.key]: label.value })),
    );
  }

  const activeFilters = optional.filters
    .filter((filter: any) => filter.active)
    .map((filter: any) => [filter.operator, filter.column, filter.values]);

  if (activeFilters.length > 0) {
    body.filter = activeFilters;
  }

  const activeSorts = optional.sorts
    .filter((sort: any) => sort.active)
    .map((sort: any) => sort.column);

  if (activeSorts.length > 0) {
    body.sortCols = activeSorts;
  }

  const activeAggs = optional.aggs
    .filter((agg: any) => agg.active)
    .map((agg: any) => [agg.key, agg.operator, agg.column]);

  if (activeAggs.length > 0) {
    body.agg = activeAggs;
  }

  const activeGroups = optional.groups
    .filter((group: any) => group.active)
    .map((group: any) => group.column);

  if (activeGroups.length > 0) {
    body.groupBy = activeGroups;
  }
}

function processSimpleParameters(
  body: ServicegatewayAPIReqBody,
  api: any,
): void {
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
  const optional = api.optional;

  if (optional) {
    processOptionalParameters(body, api, optional);
  } else {
    processSimpleParameters(body, api);
  }

  return body;
}

export async function generateServiceGatewayUDAReqBody(
  datasourceParams: DataSourceFiles,
): Promise<ServicegatewayUDAReqBody | undefined> {
  const uda = datasourceParams.dataSource.uda;
  const selectedConn = datasourceParams.insightsNode;

  if (!selectedConn) {
    notify("No connection selected for UDA import.", MessageKind.INFO, {
      logger,
    });
    return;
  }
  const udaBody = await retrieveUDAtoCreateReqBody(uda, selectedConn);
  const body: ServicegatewayUDAReqBody = {
    ...udaBody.params,
  };

  return body;
}
