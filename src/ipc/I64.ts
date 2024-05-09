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

export default abstract class I64 extends Vector {
  protected static readonly nullValue = BigInt("-9223372036854775808");
  protected static readonly infinityNegative = BigInt("-9223372036854775807");
  protected static readonly infinityPositive = BigInt("9223372036854775807");

  constructor(
    length: number,
    offset: number,
    qtype: number,
    dataView: DataView,
  ) {
    super(length, offset, qtype, dataView, 8);
  }

  calcRange(): bigint[] {
    let xMax = this.getScalar(0);
    let xMin = xMax;
    // @ts-expect-error TS2304
    for (let i = 1; i < this.length; i++) {
      const x = this.getScalar(i);
      // @ts-expect-error TS2304
      if (xMax === I64.nullValue || (x > xMax && x !== I64.nullValue)) {
        xMax = x;
      }
      // @ts-expect-error TS2304
      if (xMin === I64.nullValue || (x < xMin && x !== I64.nullValue)) {
        xMin = x;
      }
    }
    return [xMin, xMax];
  }

  /**
   * Deserializes the scalar value, handles null, +/- infity
   */
  public deserializeScalar<DType>(
    scalar: bigint,
    deserialize: (scalar: bigint) => DType,
  ): DType | number | null {
    if (scalar === I64.nullValue) {
      return null;
    } else if (scalar === I64.infinityNegative) {
      return -Infinity;
    } else if (scalar === I64.infinityPositive) {
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
    deserialize: (scalar: bigint) => DType,
  ): DType | number | null {
    const s = this.getScalar(index);
    return this.deserializeScalar(s, deserialize);
  }

  getScalar(i: number): bigint {
    return this.dataView.getBigInt64(this.getByteLocation(i), true);
  }

  public hash(i: number): bigint {
    return this.dataView.getBigInt64(this.getHashLocation(i), true);
  }
}
