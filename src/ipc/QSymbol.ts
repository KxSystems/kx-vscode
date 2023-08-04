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

import { u16u8 } from "./c";
import { TypeBase, TypeNum } from "./typeBase";

export default class QSymbol extends TypeBase {
  private offsets?: Array<number>;

  // keyed data
  private keyIndex?: { [index: string]: number };
  private values?: Array<string>;
  private indexOffset = 0;
  private dataView?: DataView;

  constructor(length: number, offsets: Array<number>, dataView: DataView) {
    super(length, length ? offsets[0] : 0, TypeNum.symbol);
    this.dataView = dataView;
    this.offsets = offsets;
  }

  static listToIPC(values: Array<string>): Uint8Array {
    const size = values.map((v) => v.length + 1).reduce((a, b) => a + b, 6);
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(11);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QSymbol.writeValue(v, buffer.wb));

    return buffer.data;
  }

  static toIPC(value: string | null): Uint8Array {
    const size = value ? value.length + 2 : 2;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(256 - 11);
    if (value !== null && value !== undefined) {
      QSymbol.writeValue(value, buffer.wb);
    }

    return buffer.data;
  }

  static writeValue(value: string, wb: (b: number) => void): void {
    if (value !== null && value !== undefined) {
      for (const c of "" + value) wb(c.charCodeAt(0));
    }

    wb(0);
  }

  getValue(i: number): string {
    if (this.values) {
      return this.values[(i + this.indexOffset) % this.length];
    } else if (this.offsets && this.dataView) {
      let c;
      let pos = this.offsets[(i + this.indexOffset) % this.length];
      const s = [];
      while ((c = this.dataView.getUint8(pos++)) !== 0) {
        s.push(c);
      }
      return u16u8(s);
    } else throw new Error("QSymbol, no vaules or offsets");
  }

  hash(i: number): string {
    return this.getValue(i);
  }

  public mergeIndexed(arg: QSymbol): void {
    if (arg.length >= this.length) {
      throw new Error("Invalid Merge Size");
    }

    if (arg.offset === null) {
      return;
    }

    if (!arg.offsets || !arg.dataView) {
      throw new Error("Merge invalid arg");
    }

    if (!this.offsets || !this.dataView) {
      throw new Error("Merge invalid this");
    }

    let argOffsetEnd = arg.offsets[arg.offsets.length - 1];
    while (arg.dataView.getUint8(argOffsetEnd++) !== 0) {}

    const argSize = argOffsetEnd - arg.offset;

    const thisFirstOriginal = this.offsets[arg.length];

    let thisOffsetEnd = this.offsets[this.offsets.length - 1];
    while (this.dataView.getUint8(thisOffsetEnd++) !== 0) {}

    const thisOriginalSize = thisOffsetEnd - thisFirstOriginal;

    const totalSize = argSize + thisOriginalSize;

    const buffer = new ArrayBuffer(totalSize);

    new Uint8Array(buffer, 0, argSize).set(
      new Uint8Array(arg.dataView.buffer, arg.offset, argSize)
    );

    new Uint8Array(buffer, argSize, thisOriginalSize).set(
      new Uint8Array(this.dataView.buffer, thisFirstOriginal, thisOriginalSize)
    );

    for (let i = 0; i < arg.length; i++) {
      this.offsets[i] = arg.offsets[i] - arg.offset;
    }

    const orginalMove = argSize - thisFirstOriginal;
    for (let i = arg.length; i < this.length; i++) {
      this.offsets[i] = this.offsets[i] + orginalMove;
    }

    this.offset = 0;

    this.dataView = new DataView(buffer);
  }

  public mergeKeyedPrimary(
    arg: QSymbol,
    maxRows: number,
    insertIndices: Array<number>
  ): number {
    if (this.keyIndex === undefined || this.values === undefined) {
      this.keyIndex = {};
      this.values = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        const value = this.getValue(i);
        this.keyIndex[value] = i;
        this.values[i] = value;
      }

      delete this.offsets;
      delete this.dataView;
    }

    for (let i = 0; i < arg.length; i++) {
      const argValue = arg.getValue(i);
      const valueIndex = this.keyIndex[argValue];

      if (valueIndex === undefined) {
        if (this.length === maxRows) {
          const targetIndex = this.indexOffset % maxRows;
          this.keyIndex[argValue] = targetIndex;
          this.values[targetIndex] = argValue;
          insertIndices.push(targetIndex);
          this.indexOffset++;
        } else {
          this.keyIndex[argValue] = this.length;
          insertIndices.push(this.length);
          this.values.push(argValue);
          this.length++;
        }
      } else {
        insertIndices.push(valueIndex);
      }
    }

    return this.indexOffset;
  }

  public mergeKeyed(
    arg: QSymbol,
    indices: Array<number>,
    indexOffset: number,
    maxRows: number
  ): void {
    if (this.values === undefined) {
      const values = [];
      for (let i = 0; i < this.length; i++) {
        const str = this.getValue(i);
        values.push(str);
      }

      this.values = values;

      delete this.offsets;
      delete this.dataView;
    }

    for (let i = 0; i < indices.length; i++) {
      const argValue = arg.getValue(i);
      const targetIndex = indices[i];

      if (targetIndex === this.length) {
        this.values.push(argValue);
        this.length++;
      } else if (targetIndex > this.length) {
        debugger;
      } else {
        this.values[targetIndex] = argValue;
      }
    }

    this.indexOffset = indexOffset;
  }
}
