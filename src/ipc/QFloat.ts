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

import { TypeBase, TypeNum } from "./typeBase";
import Vector from "./vector";

export default class QFloat extends Vector {
  static readonly typeNum = TypeNum.float;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.float, dataView, 4);
  }

  static listToIPC(values: Array<number>): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QFloat.typeNum);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QFloat.writeValue(v, buffer.wb));

    return buffer.data;
  }

  static toIPC(value: number): Uint8Array {
    const buffer = TypeBase.createBuffer(5);
    buffer.wb(256 - QFloat.typeNum);
    QFloat.writeValue(value, buffer.wb);
    return buffer.data;
  }

  static writeValue(value: number, wb: (b: number) => void): void {
    if (value !== null) {
      const fb = new Float32Array(1);
      fb[0] = value;
      new Uint8Array(fb.buffer).forEach((f) => wb(f));
    } else {
      [0, 0, 192, 255].forEach((l) => wb(l));
    }
  }

  calcRange(): number[] {
    let xMax = Number.NEGATIVE_INFINITY;
    let xMin = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.length; i += 1) {
      const x = this.getScalar(i);
      if (isNaN(xMax) || (x > xMax && !isNaN(x))) {
        xMax = x;
      }
      if (isNaN(xMin) || (x < xMin && !isNaN(x))) {
        xMin = x;
      }
    }

    return [xMin, xMax];
  }

  getScalar(i: number): number {
    return this.dataView.getFloat32(this.getByteLocation(i), true);
  }

  getValue(i: number): number | null {
    const val = this.getScalar(i);
    return isNaN(val) ? null : val;
  }

  hash(i: number): number {
    return this.dataView.getFloat32(this.getHashLocation(i), true);
  }
}
