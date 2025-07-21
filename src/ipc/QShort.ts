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

export default class QShort extends Vector {
  static readonly typeNum = 5;
  static readonly shortNull = -32768;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.short, dataView, 2);
  }

  static listToIPC(values: Array<number>): Uint8Array {
    const size = values.length * 2 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QShort.typeNum); // type
    buffer.wb(0); // attributes
    buffer.wi(values.length); // vector size
    values.forEach((v) => QShort.writeValue(v, buffer.wb)); // values

    return buffer.data;
  }

  static toIPC(value: number): Uint8Array {
    const buffer = TypeBase.createBuffer(3);
    buffer.wb(256 - QShort.typeNum); // type
    QShort.writeValue(value, buffer.wb); // value
    return buffer.data;
  }

  static writeValue(value: number, wb: (b: number) => void): void {
    if (value !== null) {
      const ib = new Int16Array(1);
      ib[0] = value;
      new Uint8Array(ib.buffer).forEach((i) => wb(i));
    } else {
      wb(0);
      wb(128);
    }
  }

  public getValue(i: number): number | null {
    const val = this.getScalar(i);
    return val === -32768
      ? null
      : val === -32767
      ? -Infinity
      : val === 32767
      ? Infinity
      : val;
  }

  public calcRange(): number[] {
    let xMax = Number.NEGATIVE_INFINITY;
    let xMin = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.length; i += 1) {
      const x = this.getScalar(i);
      if (xMax === QShort.shortNull || (x > xMax && x !== QShort.shortNull)) {
        xMax = x;
      }
      if (xMin === QShort.shortNull || (x < xMin && x !== QShort.shortNull)) {
        xMin = x;
      }
    }

    return [xMin, xMax];
  }

  public getScalar(i: number): number {
    return this.dataView.getInt16(this.getByteLocation(i), true);
  }

  public hash(i: number): number {
    return this.dataView.getInt16(this.getHashLocation(i));
  }
}
