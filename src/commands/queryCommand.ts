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

import { Uri, workspace } from "vscode";

import {
  getServerForUri,
  getTargetForUri,
  setServerForUri,
  setTargetForUri,
} from "./workspaceCommand";
import { ext } from "../extensionVariables";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import {
  QueryFile,
  createGetData,
  createQsql,
  createSql,
  toValues,
} from "../models/query";
import { UDA } from "../models/uda";
import { MessageKind, notify } from "../utils/notifications";
import { setParamValue } from "../utils/query";

const logger = "queryCommand";

async function exists(uri: Uri) {
  try {
    await workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function replaceExtension(uri: Uri, from: RegExp, to: string) {
  return uri.with({ path: uri.path.replace(from, to) });
}

export function toGetDataQuery(dataSource: DataSourceFiles): UDA {
  const query = createGetData();
  const payload = getLegacyApiBody(dataSource);

  for (const [name, value] of Object.entries(payload)) {
    const structured = typeof value === "object" && value !== null;
    setParamValue(
      query.params,
      name,
      structured ? JSON.stringify(value) : value,
    );
  }

  return query;
}

export function toQsqlQuery(dataSource: DataSourceFiles): UDA {
  const query = createQsql();
  const qsql = dataSource.dataSource.qsql;

  setParamValue(query.params, "target", qsql?.selectedTarget);
  setParamValue(query.params, "query", qsql?.query);
  setParamValue(query.params, "agg", qsql?.agg);

  const labels = qsql?.labels;
  if (labels && Object.keys(labels).length) {
    setParamValue(query.params, "labels", JSON.stringify(labels));
  }

  return query;
}

export function toSqlQuery(dataSource: DataSourceFiles): UDA {
  const query = createSql();
  setParamValue(query.params, "query", dataSource.dataSource.sql?.query);
  return query;
}

function toQuery(dataSource: DataSourceFiles): UDA | undefined {
  switch (dataSource?.dataSource?.selectedType) {
    case DataSourceTypes.QSQL:
      return toQsqlQuery(dataSource);
    case DataSourceTypes.SQL:
      return toSqlQuery(dataSource);
    case DataSourceTypes.UDA:
      return dataSource.dataSource.uda;
    default:
      return toGetDataQuery(dataSource);
  }
}

function getLegacyApiBody(dataSource: DataSourceFiles) {
  const api = <any>dataSource.dataSource.api;
  if (api.payload) {
    return api.payload;
  }

  const optional = api.optional;
  const payload: any = {
    table: api.table,
    startTS: api.startTS,
    endTS: api.endTS,
  };

  if (optional) {
    if (optional.filled) payload.fill = api.fill;
    if (optional.temporal) payload.temporality = api.temporality;
    if (optional.rowLimit && api.rowCountLimit) {
      payload.limit = api.isRowLimitLast
        ? -parseInt(api.rowCountLimit)
        : parseInt(api.rowCountLimit);
    }

    const labels = (optional.labels || []).filter((label: any) => label.active);
    if (labels.length) {
      payload.labels = Object.assign(
        {},
        ...labels.map((label: any) => ({ [label.key]: label.value })),
      );
    }

    const filters = (optional.filters || [])
      .filter((filter: any) => filter.active)
      .map((filter: any) => [
        filter.operator,
        filter.column,
        toValues(filter.values || ""),
      ]);
    if (filters.length) payload.filter = filters;

    const sorts = (optional.sorts || [])
      .filter((sort: any) => sort.active)
      .map((sort: any) => sort.column);
    if (sorts.length) payload.sortCols = sorts;

    const aggs = (optional.aggs || [])
      .filter((agg: any) => agg.active)
      .map((agg: any) => [agg.key, agg.operator, agg.column]);
    if (aggs.length) payload.agg = aggs;

    const groups = (optional.groups || [])
      .filter((group: any) => group.active)
      .map((group: any) => group.column);
    if (groups.length) payload.groupBy = groups;
  }

  return payload;
}

async function write(uri: Uri, content: string, source: Uri) {
  await workspace.fs.writeFile(uri, Buffer.from(content));

  const server = getServerForUri(source);
  if (server) {
    await setServerForUri(uri, server);
  }
  const target = getTargetForUri(source);
  if (target) {
    await setTargetForUri(uri, target);
  }
}

export interface Conversion {
  target: Uri;
  written: boolean;
}

/**
 * Converts one datasource to the format the query editor reads. Every type
 * becomes a `.kxquery`: API and UDA the query they named, QSQL and SQL the
 * builtin the editor holds for them. The original is left on disk.
 *
 * Returns the query file the datasource stands for and whether this call is
 * what wrote it, or undefined when there was nothing to convert.
 */
export async function convertDataSource(
  uri: Uri,
): Promise<Conversion | undefined> {
  let content: any;

  try {
    const document = await workspace.openTextDocument(uri);
    const text = document.getText();
    content = text.trim() ? JSON.parse(text) : {};
  } catch {
    notify(`${uri.path} is not valid JSON.`, MessageKind.ERROR, { logger });
    return undefined;
  }

  const target = replaceExtension(uri, /\.kdb\.json$/, ".kxquery");
  if (await exists(target)) {
    return { target, written: false };
  }

  const file: QueryFile = {
    version: 1,
    query: toQuery(<DataSourceFiles>content),
  };

  await write(target, JSON.stringify(file, null, 2), uri);
  return { target, written: true };
}

export async function convertDataSources() {
  const files = await workspace.findFiles("**/*.kdb.json");
  const converted: Uri[] = [];

  for (const file of files) {
    const conversion = await convertDataSource(file);
    if (conversion?.written) {
      converted.push(conversion.target);
    }
  }

  ext.queryTreeProvider.reload();
  ext.scratchpadTreeProvider.reload();

  notify(
    converted.length
      ? `Converted ${converted.length} file${converted.length === 1 ? "" : "s"}.`
      : "Nothing left to convert.",
    MessageKind.INFO,
    { logger },
  );

  return converted;
}
