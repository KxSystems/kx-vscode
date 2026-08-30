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
import { QueryFile, createGetData } from "../models/query";
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
        ((values: string) => {
          const tokens = values.split(/[;\s]+/).map((token: string) => {
            const number = parseFloat(token);
            return isNaN(number) ? token : number;
          });
          return tokens.length === 1 ? tokens[0] : tokens;
        })(filter.values),
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

/**
 * Converts one datasource, or one `.kxuda` file, to the format the query
 * editor reads. API and UDA datasources become a `.kxquery`; QSQL and SQL
 * become the workbook that supersedes them. The original is left on disk.
 *
 * Returns the uri of the file it wrote, or undefined when there was nothing to
 * convert or the target was already there.
 */
export async function convertDataSource(uri: Uri): Promise<Uri | undefined> {
  let content: any;

  try {
    const document = await workspace.openTextDocument(uri);
    const text = document.getText();
    content = text.trim() ? JSON.parse(text) : {};
  } catch {
    notify(`${uri.path} is not valid JSON.`, MessageKind.ERROR, { logger });
    return undefined;
  }

  if (uri.path.endsWith(".kxuda")) {
    const target = replaceExtension(uri, /\.kxuda$/, ".kxquery");
    if (await exists(target)) {
      return undefined;
    }
    const file: QueryFile = { version: 1, query: content.query || content.uda };
    await write(target, JSON.stringify(file, null, 2), uri);
    return target;
  }

  const dataSource = <DataSourceFiles>content;
  const type = dataSource?.dataSource?.selectedType;

  if (type === DataSourceTypes.QSQL || type === DataSourceTypes.SQL) {
    const extension = type === DataSourceTypes.QSQL ? ".kdb.q" : ".kdb.sql";
    const target = replaceExtension(uri, /\.kdb\.json$/, extension);
    if (await exists(target)) {
      return undefined;
    }
    const query =
      type === DataSourceTypes.QSQL
        ? dataSource.dataSource.qsql.query
        : dataSource.dataSource.sql.query;
    await write(target, query || "", uri);
    if (type === DataSourceTypes.QSQL) {
      const selectedTarget = dataSource.dataSource.qsql.selectedTarget;
      if (selectedTarget) {
        await setTargetForUri(target, selectedTarget);
      }
    }
    return target;
  }

  const target = replaceExtension(uri, /\.kdb\.json$/, ".kxquery");
  if (await exists(target)) {
    return undefined;
  }

  const file: QueryFile = {
    version: 1,
    query:
      type === DataSourceTypes.UDA
        ? dataSource.dataSource.uda
        : toGetDataQuery(dataSource),
  };

  await write(target, JSON.stringify(file, null, 2), uri);
  return target;
}

export async function convertDataSources() {
  const files = await workspace.findFiles("**/*.{kdb.json,kxuda}");
  const converted: Uri[] = [];

  for (const file of files) {
    const target = await convertDataSource(file);
    if (target) {
      converted.push(target);
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
