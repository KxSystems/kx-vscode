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

import Vector from "./vector";

export default abstract class F64 extends Vector {
  constructor(
    length: number,
    offset: number,
    qtype: number,
    dataView: DataView
  ) {
    super(length, offset, qtype, dataView, 8);
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
    return this.dataView.getFloat64(this.getByteLocation(i), true);
  }

  hash(i: number): number {
    return this.dataView.getFloat64(this.getHashLocation(i), true);
  }

  toSplitTypedArray(): Float32Array {
    this.align();
    return new Float32Array(this.dataView.buffer, this.offset, this.length * 2);
  }
}
