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

import { TypeNum } from "./typeBase";
import Vector from "./vector";

export default class QGuid extends Vector {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.guid, dataView, 16);
  }

  calcRange(): bigint[] {
    throw new Error("Not implemented");
  }

  hash(i: number): number {
    // return this.dataView.getFloat64(this.offset + i);
    throw new Error("GUID hash not implemented " + i);
  }

  getScalar(i: number): bigint {
    // TODO: should be 128-bit not 64
    return this.dataView.getBigInt64(this.getByteLocation(i), true);
  }

  getValue(index: number): string | null {
    const UUID_NULL = "00000000-0000-0000-0000-000000000000";
    const start = this.getByteLocation(index);
    const end = start + this.size;
    const x = "0123456789abcdef";
    let s = "";
    for (let i = start; i < end; i++) {
      const c = this.dataView.getUint8(i);
      const d = i - start;
      s += d === 4 || d === 6 || d === 8 || d === 10 ? "-" : "";

       
      s += x[c >> 4];

       
      s += x[c & 15];
    }
    if (s === UUID_NULL) {
      return null;
    }

    return s;
  }
}
