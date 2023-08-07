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

import Vector from "./vector";

export default abstract class I32 extends Vector {
  protected static readonly nullValue = -2147483648;
  protected static readonly infinityNegative = -2147483647;
  protected static readonly infinityPositive = 2147483647;

  constructor(
    length: number,
    offset: number,
    qtype: number,
    dataView: DataView
  ) {
    super(length, offset, qtype, dataView, 4);
  }

  public calcRange(): number[] {
    let xMax = Number.NEGATIVE_INFINITY;
    let xMin = Number.POSITIVE_INFINITY;

    for (let i = 0; i < this.length; i += 1) {
      const x = this.getScalar(i);
      if (xMax === I32.nullValue || (x > xMax && x !== I32.nullValue)) {
        xMax = x;
      }
      if (xMin === I32.nullValue || (x < xMin && x !== I32.nullValue)) {
        xMin = x;
      }
    }

    return [xMin, xMax];
  }

  /**
   * Deserializes the scalar value, handles null, +/- infity
   */
  public deserializeScalar<DType>(
    scalar: number,
    deserialize: (scalar: number) => DType
  ): DType | number | null {
    if (scalar === I32.nullValue) {
      return null;
    } else if (scalar === I32.infinityNegative) {
      return -Infinity;
    } else if (scalar === I32.infinityPositive) {
      return Infinity;
    } else {
      return deserialize(scalar);
    }
  }

  /**
   * Deserializes the scalar value at index, handles null, +/- infity
   */
  public deserializeScalarAt<DType>(
    index: number,
    deserialize: (scalar: number) => DType
  ): DType | number | null {
    const s = this.getScalar(index);
    return this.deserializeScalar(s, deserialize);
  }

  public getScalar(i: number): number {
    return this.dataView.getInt32(this.getByteLocation(i), true);
  }

  public hash(i: number): number {
    return this.dataView.getInt32(this.getHashLocation(i));
  }
}
