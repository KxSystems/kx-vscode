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

import { DCDS } from "./c";
import QSymbol from "./QSymbol";
import { TypeBase } from "./typeBase";
import Vector from "./vector";

export default class QTable implements DCDS {
  public qtype!: number;
  public class = "203";
  public columns: string[] = [];
  public meta: { [index: string]: number } = {};
  public cols: { [index: string]: TypeBase } = {};

  constructor(names?: Array<string>, columns?: Array<Vector | QSymbol>) {
    if (names && columns) {
      this.columns = names;
      names.forEach((c, i) => {
        this.meta[c] = columns[i].qtype;
        this.cols[c] = columns[i];
      });
    }
  }

  static toLegacy(
    meta: { [index: string]: number },
    columns: Array<string>,
    cols: { [index: string]: TypeBase }
  ): DCDS {
    const count: number = columns.length > 0 ? cols[columns[0]].length : 0;
    const rows = new Array(count);

    for (let i = 0; i < count; i++) {
      const obj: { [index: string]: unknown } = {};
      columns.forEach((c) => (obj[c] = cols[c].toLegacy(i)));
      rows[i] = obj;
    }

    return {
      class: "203",
      columns: columns.slice(0),
      meta: Object.assign({}, meta),
      rows,
    };
  }

  public addParsedColumn(name: string, col: TypeBase): void {
    this.columns.push(name);
    this.meta[name] = col.qtype;
    this.cols[name] = col;
  }

  public merge(table: QTable): QTable {
    this.columns = this.columns.concat(table.columns);
    table.columns.forEach((c) => {
      this.meta[c] = table.meta[c];
      this.cols[c] = table.cols[c];
    });

    return this;
  }

  public toLegacy(): DCDS {
    return QTable.toLegacy(this.meta, this.columns, this.cols);
  }

  public toViewState(): { _type: "table"; value: DCDS } {
    return {
      _type: "table",
      value: this.toLegacy(),
    };
  }
}

QTable.prototype.qtype = 98;
