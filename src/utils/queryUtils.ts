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

  // Transforma a array de strings em um vetor de strings
  const vector = rows.map((row) => row.split(","));

  // Conta o maior número de caracteres em cada coluna
  const columnCounters = vector[0].map((_, j) => {
    const maxLength = Math.max(...vector.map((row) => row[j].length));
    return maxLength + 2;
  });

  vector.forEach((row) => {
    row.forEach((value: string, j: number) => {
      const counter = columnCounters[j];
      const diff = counter - value.length;
      if (diff > 0) {
        row[j] = value + " ".repeat(diff);
      }
    });
  });

  // Junta cada linha do vetor em uma string
  const result = vector.map((row) => row.join(""));

  // Cria uma string com o contador geral
  const totalCount = columnCounters.reduce((sum, count) => sum + count, 0);
  const totalCounter = "-".repeat(totalCount);

  // Adiciona a string do contador geral como o segundo item da array
  result.splice(1, 0, totalCounter);

  return result;
}
