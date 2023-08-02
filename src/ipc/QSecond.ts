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

import I32 from "./I32";
import QInt from "./QInt";
import { DSecondClass } from "./cClasses";
import Constants from "./constants";
import moment from "./moment.custom";
import { TypeBase, TypeNum } from "./typeBase";

export default class QSecond extends I32 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.second, dataView);
  }

  public static fromMoment(m: moment.Duration): DSecondClass | null {
    return m === null ? null : new DSecondClass(m.asSeconds());
  }

  public static fromScalar(value: number): DSecondClass | null {
    return value === null ? null : new DSecondClass(value);
  }

  public static fromString(str: string): DSecondClass | null {
    str = str.replace("1970-01-01T", "").replace("Z", "");
    const timeParts = str.match(Constants.timePartsRx);
    const m = moment.duration(timeParts && timeParts[1] ? timeParts[1] : str);
    return QSecond.fromMoment(m);
  }

  public static listToIPC(values: DSecondClass[]): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.second);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QSecond.writeValue(v, buffer.wb));

    return buffer.data;
  }

  public static toIPC(value: DSecondClass): Uint8Array {
    const buffer = TypeBase.createBuffer(5);

    buffer.wb(256 - TypeNum.second);
    QSecond.writeValue(value, buffer.wb);

    return buffer.data;
  }

  public static toMoment(value: DSecondClass): moment.Duration | null {
    return value === null ? null : moment.duration(value.i * 1000);
  }

  public static toScalar(value: DSecondClass): number | null {
    return value === null ? null : value.i;
  }

  public static toString(
    value: DSecondClass,
    format = "HH:mm:ss.SSS",
    options = { trim: false }
  ): string {
    if (value === null) return "";
    const m = QSecond.toMoment(value);
    return m === null ? "" : m.format(format, options);
  }

  private static writeValue(
    value: DSecondClass,
    wb: (b: number) => void
  ): void {
    QInt.writeValue(QSecond.toScalar(value), wb);
  }

  public getValue(i: number): DSecondClass | number | null {
    return super.deserializeScalarAt(i, (s) => new DSecondClass(s));
  }
}
