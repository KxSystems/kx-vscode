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
import { DTimeClass } from "./cClasses";
import Constants from "./constants";
import moment from "./moment.custom";
import { TypeBase, TypeNum } from "./typeBase";

export default class QTime extends I32 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.time, dataView);
  }

  public static fromMoment(m: moment.Duration): DTimeClass | null {
    return m === null ? null : new DTimeClass(m.asMilliseconds());
  }

  public static fromScalar(value: number): DTimeClass | null {
    return value === null ? null : new DTimeClass(value);
  }

  public static fromString(str: string): DTimeClass | null {
    str = str.replace("1970-01-01T", "").replace("Z", "");
    const timeParts = str.match(Constants.timePartsRx);
    const m = moment.duration(timeParts && timeParts[1] ? timeParts[1] : str);
    return QTime.fromMoment(m);
  }

  public static listToIPC(values: DTimeClass[]): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.time);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QTime.writeValue(v, buffer.wb));

    return buffer.data;
  }

  public static toIPC(value: DTimeClass): Uint8Array {
    const buffer = TypeBase.createBuffer(5);

    buffer.wb(256 - TypeNum.time);
    QTime.writeValue(value, buffer.wb);

    return buffer.data;
  }

  public static toMoment(value: DTimeClass): moment.Duration | null {
    return value === null ? null : moment.duration(value.i);
  }

  public static toScalar(value: DTimeClass): number | null {
    return value === null ? null : value.i;
  }

  public static toString(
    value: DTimeClass,
    format = "HH:mm:ss.SSS",
    options = { trim: false }
  ): string {
    if (value !== null) {
      const m = QTime.toMoment(value);
      return m === null ? "" : m.format(format, options);
    }

    return "";
  }

  public static writeValue(value: DTimeClass, wb: (b: number) => void): void {
    QInt.writeValue(QTime.toScalar(value), wb);
  }

  getValue(i: number): DTimeClass | number | null {
    return super.deserializeScalarAt(i, (s) => new DTimeClass(s));
  }
}
