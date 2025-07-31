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
import QTable from "./QTable";
import Tools from "./tools";
import { TypeBase, TypeNum } from "./typeBase";

export default class QDict {
  public length: number;
  public qtype: number;
  protected keys: TypeBase;
  protected values: TypeBase;

  constructor(
    length: number,
    keys: TypeBase,
    values: TypeBase,
    qtype?: number
  ) {
    this.length = length;
    this.keys = keys;
    this.values = values;
    this.qtype = qtype || TypeNum.dict;
  }

  public static toIPC(keys: Array<string>, valueData: Uint8Array): Uint8Array {
    const size =
      keys.map((k) => k.length + 1).reduce((a, b) => a + b) +
      7 +
      valueData.length;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(99);
    buffer.wb(11);
    buffer.wb(0);
    buffer.wi(keys.length);
    keys.forEach((k) => QSymbol.writeValue(k, buffer.wb));
    valueData.forEach((d) => buffer.wb(d));
    return buffer.data;
  }

  public getKey(i: number): any {
    return this.keys.getValue(i);
  }

  public getValue(i: number): any {
    return this.values.getValue(i);
  }

  public toObject(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < this.length; i++) {
      obj[this.getKey(i)] = this.getValue(i);
    }
    return obj;
  }

  public toLegacy(): DCDS {
    const t = new QTable();
    if (this.qtype === 99) {
      t.addParsedColumn("Property", this.keys);
      t.addParsedColumn("Value", this.values);
    } else {
      Tools.times(this.keys.length, (i) => {
        t.addParsedColumn(this.keys.toLegacy(i), this.values.getValue(i));
      });
    }
    return t.toLegacy();
  }

  public toViewState() {
    const ret: Record<string, unknown> = {};
    for (let i = 0; i < this.length; i++) {
      ret[this.getKey(i)] = this.values.toViewState(i);
    }

    return {
      _type: "dict",
      value: ret,
    };
  }
}

QDict.prototype.qtype = 99;
