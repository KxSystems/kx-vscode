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

import I32 from "./I32";
import { TypeBase, TypeNum } from "./typeBase";

export default class QInt extends I32 {
  static readonly typeNum = 6;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.int, dataView);
  }

  static listToIPC(values: Array<number>): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QInt.typeNum);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QInt.writeValue(v, buffer.wb));

    return buffer.data;
  }

  static toIPC(value: number | null): Uint8Array {
    const buffer = TypeBase.createBuffer(5);
    buffer.wb(256 - QInt.typeNum);
    QInt.writeValue(value, buffer.wb);
    return buffer.data;
  }

  static writeValue(value: number | null, wb: (b: number) => void): void {
    if (value !== null) {
      const ib = new Int32Array(1);
      ib[0] = value;
      new Uint8Array(ib.buffer).forEach((i) => wb(i));
    } else {
      [0, 0, 0, 128].forEach((i) => wb(i));
    }
  }

  getValue(i: number): number | null {
    const val = this.getScalar(i);
    return val === -2147483648
      ? null
      : val === -2147483647
      ? -Infinity
      : val === 2147483647
      ? Infinity
      : val;
  }
}
