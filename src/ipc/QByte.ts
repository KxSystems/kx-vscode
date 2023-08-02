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

import U8 from "./U8";
import { TypeBase, TypeNum } from "./typeBase";

export default class QByte extends U8 {
  static readonly typeNum = 4;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.byte, dataView);
  }

  static listToIPC(values: Array<number>): Uint8Array {
    const size = values.length + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QByte.typeNum);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => buffer.wb(v));

    return buffer.data;
  }

  static toIPC(value: number): Uint8Array {
    const buffer = TypeBase.createBuffer(2);
    buffer.wb(256 - QByte.typeNum);
    buffer.wb(value || 0);
    return buffer.data;
  }

  getValue(i: number): number {
    return this.getScalar(i);
  }
}
