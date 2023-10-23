/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import { readFileSync } from "fs";
import { join } from "path";
import { ext } from "../extensionVariables";
import { deserialize, isCompressed, uncompress } from "../ipc/c";
import { Parse } from "../ipc/parse.qlist";
import { ServerType } from "../models/server";

export function sanitizeQuery(query: string): string {
  if (query[0] === "`") {
    query = query + " ";
  } else if (query.slice(-1) === ";") {
    query = query.slice(0, -1);
  }
  return query;
}

export function queryWrapper(): string {
  return readFileSync(
    ext.context.asAbsolutePath(join("resources", "evaluate.q"))
  ).toString();
}

export function handleWSResults(ab: ArrayBuffer): any {
  let res: any;
  try {
    if (isCompressed(ab)) {
      ab = uncompress(ab);
    }
    let des = deserialize(ab);
    if (des.qtype === 0 && des.values.length === 2) {
      des = des.values[1];
    }
    res = Parse.reshape(des, ab).toLegacy();
    if (res.rows.length === 0) {
      return "No results found.";
    }
    return convertRows(res.rows);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export function convertRows(rows: any[]): any[] {
  if (rows.length === 0) {
    return [];
  }
  const keys = Object.keys(rows[0]);
  const result = [keys.join(",")];
  for (const row of rows) {
    const values = keys.map((key) => row[key]);
    result.push(values.join(","));
  }
  return result;
}

export function convertRowsToConsole(rows: string[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const vector = [];
  for (let i = 0; i < rows.length; i++) {
    vector.push(rows[i].split(","));
  }

  const columnCounters = [];
  for (let j = 0; j < vector[0].length; j++) {
    let maxLength = 0;
    for (let i = 0; i < vector.length; i++) {
      maxLength = Math.max(maxLength, vector[i][j].length);
    }
    columnCounters.push(maxLength + 2);
  }

  for (let i = 0; i < vector.length; i++) {
    const row = vector[i];
    for (let j = 0; j < row.length; j++) {
      const value = row[j];
      const counter = columnCounters[j];
      const diff = counter - value.length;
      if (diff > 0) {
        row[j] = value + " ".repeat(diff);
      }
    }
  }

  const result = [];
  for (let i = 0; i < vector.length; i++) {
    result.push(vector[i].join(""));
  }

  const totalCount = columnCounters.reduce((sum, count) => sum + count, 0);
  const totalCounter = "-".repeat(totalCount);
  result.splice(1, 0, totalCounter);

  return result;
}

export function getConnectionType(type: ServerType): string {
  switch (type) {
    case ServerType.KDB:
      return "kdb";
    case ServerType.INSIGHTS:
      return "insights";
    default:
      return "undefined";
  }
}
