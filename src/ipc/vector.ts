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

import Tools from "./tools";
import { TypeBase } from "./typeBase";

export default abstract class Vector extends TypeBase {
  public readonly size;
  protected bufferLength;
  protected indexOffset = 0;
  protected dataView: DataView;

  private index?: number[];
  private rangeCache: Array<number | bigint> | null = null;

  protected constructor(
    length: number,
    offset: number,
    qtype: number,
    dataView: DataView,
    size: number,
  ) {
    super(length, offset, qtype);
    this.dataView = dataView;
    this.size = size;
    this.bufferLength = length;
  }

  public getRange(): Array<number | bigint> {
    return !this.index || this.index.length === 0
      ? this.rangeCache || (this.rangeCache = this.calcRange())
      : [
          this.hash(this.index[0]),
          this.hash(this.index[this.index.length - 1]),
        ];
  }

  public mergeIndexed(arg: Vector): void {
    if (arg.length >= this.length) {
      throw new Error("Invalid Merge size");
    }

    this.resetRangeCache();
    new Uint8Array(
      this.dataView.buffer,
      this.offset,
      arg.length * this.size,
    ).set(
      new Uint8Array(arg.dataView.buffer, arg.offset, arg.length * this.size),
    );
  }

  public hasIndex(): boolean {
    return !!this.index;
  }

  public getIndexFromSortedIndex(i: number): number {
    if (this.index === undefined) throw new Error("No Vector Index");
    return (this.length + this.index[i] - this.indexOffset) % this.length;
  }

  public getScalarFromSortedIndex(i: number): number | bigint {
    if (this.index === undefined) throw new Error("No Vector Index");
    i = (this.indexOffset + i) % this.length;
    return this.getScalar(this.index[i]);
  }

  public findIndex(value: number | bigint): number {
    if (this.size !== 8 || [9, 15].indexOf(this.qtype) !== -1) {
      const compareFn = (x: number, y: number): number =>
        x - (this.hash(y) as number);
      // @ts-expect-error
      return Tools.binarySearch2(Number(value), this.index, compareFn);
    } else {
      const compareFn = (x: bigint, y: number): number =>
        Number(x - (this.hash(y) as bigint));
      // @ts-expect-error
      return Tools.binarySearch2(BigInt(value), this.index, compareFn);
    }
  }

  public mergeKeyedPrimary(
    arg: Vector,
    maxRows: number,
    insertIndices: Array<number>,
  ): number {
    this.resetRangeCache();
    this.index = this.index ? this.index : this.generateIndex();

    for (let i = 0; i < arg.length; i++) {
      let indexIndex = this.findIndex(arg.hash(i));
      if (indexIndex < 0) {
        let targetIndex;
        if (this.length === maxRows) {
          targetIndex = this.indexOffset % maxRows;
          const targetIndexIndex = this.findIndex(this.hash(targetIndex));
          this.index.splice(targetIndexIndex, 1);
          if (-indexIndex - 1 > targetIndexIndex) {
            indexIndex++;
          }
          this.index.splice(-indexIndex - 1, 0, targetIndex);
          this.indexOffset = (this.indexOffset + 1) % maxRows;
        } else {
          targetIndex = this.length;
          if (targetIndex >= this.bufferLength) {
            this.reallocate(maxRows);
          }
          this.index.splice(-indexIndex - 1, 0, targetIndex);
          this.length++;
        }
        new Uint8Array(
          this.dataView.buffer,
          this.offset + targetIndex * this.size,
          this.size,
        ).set(
          new Uint8Array(
            arg.dataView.buffer,
            arg.offset + i * this.size,
            this.size,
          ),
        );
        insertIndices.push(targetIndex);
      } else {
        const valueIndex = this.index[indexIndex];
        insertIndices.push(valueIndex);
      }
    }
    return this.indexOffset;
  }

  public mergeKeyed(
    arg: Vector,
    indices: Array<number>,
    indexOffset: number,
    maxRows: number,
  ): void {
    this.resetRangeCache();
    for (let i = 0; i < indices.length; i++) {
      const targetIndex = indices[i];

      if (targetIndex === this.length) {
        if (targetIndex >= this.bufferLength) {
          this.reallocate(maxRows);
        }

        this.length++;
      }

      new Uint8Array(
        this.dataView.buffer,
        this.offset + targetIndex * this.size,
        this.size,
      ).set(
        new Uint8Array(
          arg.dataView.buffer,
          arg.offset + i * this.size,
          this.size,
        ),
      );
    }

    this.indexOffset = indexOffset;
  }

  public reallocate(extLength?: number): void {
    this.bufferLength = extLength || this.bufferLength;
    const buffer = new ArrayBuffer(this.bufferLength * this.size);
    new Uint8Array(buffer, 0, this.length * this.size).set(
      new Uint8Array(
        this.dataView.buffer,
        this.offset,
        this.length * this.size,
      ),
    );

    this.dataView = new DataView(buffer);
    this.offset = 0;
  }

  public toTypedArray():
    | Uint8Array
    | Int16Array
    | Int32Array
    | Float32Array
    | Float64Array
    | BigInt64Array {
    this.align();

    let TA;
    if (this.size === 1) {
      TA = Uint8Array;
    } else if (this.size === 2) {
      TA = Int16Array;
    } else if (this.size === 4) {
      TA = this.qtype === 8 ? Float32Array : Int32Array;
    } else if (this.size === 8) {
      TA = [9, 15].indexOf(this.qtype) !== -1 ? Float64Array : BigInt64Array;
    } else {
      throw new Error("Unknown TypedArray");
    }

    if (this.indexOffset === 0) {
      return new TA(this.dataView.buffer, this.offset, this.length);
    }

    const typedArray = new TA(this.length);

    typedArray.set(
      // @ts-ignore
      new TA(
        this.dataView.buffer,
        this.indexOffset * this.size,
        this.length - this.indexOffset,
      ),
    );

    typedArray.set(
      // @ts-ignore
      new TA(this.dataView.buffer, 0, this.indexOffset),
      this.length - this.indexOffset,
    );

    return typedArray;
  }

  protected align(): void {
    if (this.offset % this.size !== 0) {
      this.reallocate();
    }
  }

  protected getByteLocation(i: number): number {
    return this.offset + ((i + this.indexOffset) % this.length) * this.size;
  }

  protected getHashLocation(i: number): number {
    return this.offset + i * this.size;
  }

  private generateIndex(): number[] {
    const index = new Array(this.length);
    for (let i = 0; i < this.length; i++) {
      index[i] = i;
    }
    if (this.size !== 8 || [9, 15].indexOf(this.qtype) !== -1) {
      index.sort((a, b) => (this.hash(a) as number) - (this.hash(b) as number));
    } else {
      index.sort((a, b) =>
        Number((this.hash(a) as bigint) - (this.hash(b) as bigint)),
      );
    }

    return index;
  }

  private resetRangeCache(): void {
    this.rangeCache = null;
  }

  public abstract calcRange(): Array<number | bigint>;

  public abstract getScalar(i: number): number | bigint;

  public abstract hash(i: number): number | bigint;
}
