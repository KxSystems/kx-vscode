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
import U8 from "./U8";

export default class QUnary extends U8 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.unary, dataView);
  }

  getValue(i: number): number {
    return this.getScalar(i);
  }
}
