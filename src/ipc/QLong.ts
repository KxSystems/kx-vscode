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

import I64 from "./I64";
import { TypeBase, TypeNum } from "./typeBase";

export default class QLong extends I64 {
  static readonly typeNum = 7;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.long, dataView);
  }

  static listToIPC(values: Array<bigint>): Uint8Array {
    const size = values.length * 8 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QLong.typeNum);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QLong.writeValue(v, buffer.wb));

    return buffer.data;
  }

  static toIPC(value: bigint): Uint8Array {
    const buffer = TypeBase.createBuffer(9);
    buffer.wb(256 - QLong.typeNum);
    QLong.writeValue(value, buffer.wb);
    return buffer.data;
  }

  static writeValue(value: bigint | null, wb: (b: number) => void): void {
    if (value !== null) {
      const v = new BigInt64Array([value]);
      new Uint8Array(v.buffer).forEach((l) => wb(l));
    } else {
      [0, 0, 0, 0, 0, 0, 0, 128].forEach((l) => wb(l));
    }
  }

  getValue(i: number): bigint | null | number {
    return super.deserializeScalarAt(i, (s) => s);
  }
}
