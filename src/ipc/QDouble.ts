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

import F64 from "./F64";
import { TypeBase, TypeNum } from "./typeBase";

export default class QDouble extends F64 {
  static typeNum = 9;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.double, dataView);
  }

  static listToIPC(values: Array<number>): Uint8Array {
    const size = values.length * 8 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QDouble.typeNum);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QDouble.writeValue(v, buffer.wb));

    return buffer.data;
  }

  static toIPC(value: number): Uint8Array {
    const buffer = TypeBase.createBuffer(9);
    buffer.wb(256 - QDouble.typeNum);
    QDouble.writeValue(value, buffer.wb);
    return buffer.data;
  }

  static writeValue(value: number | null, wb: (b: number) => void): void {
    if (value !== null) {
      const fb = new Float64Array(1);
      fb[0] = value;
      new Uint8Array(fb.buffer).forEach((f) => wb(f));
    } else {
      [0, 0, 0, 0, 0, 0, 248, 255].forEach((l) => wb(l));
    }
  }

  getValue(i: number): number | null {
    const val = this.getScalar(i);
    return val === null || isNaN(val) ? null : val;
  }
}
