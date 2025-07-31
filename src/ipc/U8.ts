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

export default abstract class U8 extends Vector {
  protected static readonly min = 0;
  protected static readonly max = 255;

  constructor(
    length: number,
    offset: number,
    qtype: number,
    dataView: DataView
  ) {
    super(length, offset, qtype, dataView, 1);
  }

  calcRange(): number[] {
    let xMax = U8.min;
    let xMin = U8.max;

    for (let i = 0; i < this.length; i += 1) {
      const x = this.getScalar(i);
      if (x > xMax) {
        xMax = x;
      }
      if (x < xMin) {
        xMin = x;
      }
    }

    return [xMin, xMax];
  }

  getScalar(i: number): number {
    return this.dataView.getUint8(this.getByteLocation(i));
  }

  hash(i: number): number {
    return this.dataView.getUint8(this.getHashLocation(i));
  }
}
