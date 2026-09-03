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

import { isBaseVersionGreaterOrEqual } from "./core";
import { convertTimeToTimestamp } from "./dataSource";
import { cleanAssemblyName, cleanDapName } from "./shared";
import { parseUDAList } from "./uda";
import { getDataBodyPayload } from "../models/data";
import {
  DataSourceFiles,
  DataSourceTypes,
  createDefaultDataSourceFile,
} from "../models/dataSource";
import { MetaObjectPayload } from "../models/meta";
import {
  DISTRIBUTED_SINCE,
  GET_DATA,
  QueryFile,
  createGetData,
  createQsql,
  createSql,
  isGetData,
  isQsql,
  isSql,
} from "../models/query";
import { UDA, UDAParam } from "../models/uda";

export function parseQueryList(meta: MetaObjectPayload): UDA[] {
  return [createQsql(), createSql(), createGetData(), ...parseUDAList(meta)];
}

/**
 * The execution targets the connection reports, named as a qSQL request wants
 * them: the assembly on its own for the distributed target, a tier for each of
 * its instances, and each DAP process inside those. Distributed scopes only
 * came in with Insights 1.13, so a connection older than that is offered the
 * tiers alone.
 */
export function parseTargets(
  meta: MetaObjectPayload,
  version?: string,
): string[] {
  const targets = new Set<string>();
  const distributed =
    !!version && isBaseVersionGreaterOrEqual(version, DISTRIBUTED_SINCE);

  for (const dap of meta.dap || []) {
    const assembly = cleanAssemblyName(dap.assembly);
    if (distributed) {
      targets.add(assembly);
    }
    const tier = `${assembly} ${dap.instance}`;
    targets.add(tier);
    if (dap.dap) {
      targets.add(`${tier} ${cleanDapName(dap.dap)}`);
    }
  }

  return [...targets].sort();
}

/**
 * The tables the connection reports, each with its columns — what the table
 * and column fields suggest. A table defined by more than one assembly is the
 * union of what they declare.
 */
export function parseTables(meta: MetaObjectPayload) {
  const tables: { [table: string]: string[] } = {};

  for (const schema of meta.schema || []) {
    const columns = tables[schema.table] || [];
    for (const { column } of schema.columns || []) {
      if (!columns.includes(column)) {
        columns.push(column);
      }
    }
    tables[schema.table] = columns;
  }

  return tables;
}

const TIMESTAMPS = ["startTS", "endTS"];
const NANOSECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}$/;
// scope is absent on purpose: it holds the target string the dropdown wrote,
// which the transport resolves against the connection meta rather than the
// form parsing it here.
const STRUCTURED = [
  "filter",
  "groupBy",
  "agg",
  "sortCols",
  "labels",
  "outputTZCols",
];

const AGG_CONFLICT =
  "Give either columns or agg, not both: getData carries column selection and aggregation in the same parameter.";

function parseStructured(name: string, value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(
      `The ${name} parameter is not valid JSON. Give it a value like ["a","b"].`,
    );
  }
}

export function buildGetDataPayload(query: UDA): Partial<getDataBodyPayload> {
  const payload = <Partial<getDataBodyPayload>>{};

  for (const param of query.params || []) {
    if (!param.isVisible) {
      continue;
    }
    const value = param.value ?? param.default;
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const name = param.name as keyof getDataBodyPayload;

    if (TIMESTAMPS.includes(param.name)) {
      const time = String(value);
      payload[name] = (
        NANOSECONDS.test(time) ? time : convertTimeToTimestamp(time)
      ) as never;
    } else if (param.name === "columns") {
      // Column selection and aggregation are the same wire parameter, and it
      // takes one shape or the other, so both being filled in is ambiguous
      // rather than additive. Say so instead of picking one.
      if ("agg" in payload) {
        throw new Error(AGG_CONFLICT);
      }
      payload.agg = parseStructured("columns", String(value)) as never;
    } else if (STRUCTURED.includes(param.name)) {
      if (param.name === "agg" && "agg" in payload) {
        throw new Error(AGG_CONFLICT);
      }
      payload[name] = parseStructured(param.name, String(value)) as never;
    } else if (param.name === "limit") {
      payload.limit = Number(value);
    } else {
      payload[name] = String(value) as never;
    }
  }

  return payload;
}

/** The datasource type a query file runs as — what the execution path, the
 * query history and the telemetry are keyed by. */
export function queryType(file: QueryFile): DataSourceTypes {
  const query = file.query;
  if (isGetData(query)) {
    return DataSourceTypes.API;
  }
  if (isQsql(query)) {
    return DataSourceTypes.QSQL;
  }
  if (isSql(query)) {
    return DataSourceTypes.SQL;
  }
  return DataSourceTypes.UDA;
}

function paramValue(query: UDA | undefined, name: string) {
  const param = query?.params?.find((item) => item.name === name);
  const value = param?.value ?? param?.default;
  return value === undefined || value === null ? "" : String(value);
}

function addedParamValue(query: UDA | undefined, name: string) {
  const param = query?.params?.find((item) => item.name === name);
  if (!param?.isVisible) {
    return undefined;
  }
  const value = param.value ?? param.default;
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

export function toDataSourceFile(file: QueryFile): DataSourceFiles {
  const dataSourceFile = createDefaultDataSourceFile();
  const query = file.query;
  const type = queryType(file);

  dataSourceFile.dataSource.selectedType = type;

  switch (type) {
    case DataSourceTypes.API:
      dataSourceFile.dataSource.api.selectedApi = GET_DATA;
      dataSourceFile.dataSource.api.payload = buildGetDataPayload(query!);
      break;
    case DataSourceTypes.QSQL: {
      const agg = addedParamValue(query, "agg");
      const labels = addedParamValue(query, "labels");
      dataSourceFile.dataSource.qsql = {
        query: paramValue(query, "query"),
        selectedTarget: paramValue(query, "target"),
        ...(agg === undefined ? {} : { agg }),
        ...(labels === undefined
          ? {}
          : { labels: parseStructured("labels", labels) }),
      };
      break;
    }
    case DataSourceTypes.SQL:
      dataSourceFile.dataSource.sql = { query: paramValue(query, "query") };
      break;
    default:
      dataSourceFile.dataSource.uda = query;
      break;
  }

  return dataSourceFile;
}

export function setParamValue(
  params: UDAParam[],
  name: string,
  value: unknown,
) {
  const param = params.find((item) => item.name === name);
  if (param && value !== undefined && value !== null && value !== "") {
    param.value = value;
    param.isVisible = true;
  }
}
