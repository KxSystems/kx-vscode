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

import { DMinuteClass } from "./cClasses";
import Constants from "./constants";
import I32 from "./I32";
import moment from "./moment.custom";
import QInt from "./QInt";
import { TypeBase, TypeNum } from "./typeBase";

export default class QMinute extends I32 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.minute, dataView);
  }

  public static fromMoment(m: moment.Duration): DMinuteClass | null {
    return QMinute.fromScalar(m.asMinutes());
  }

  public static fromScalar(s: number): DMinuteClass | null {
    return s === null ? null : new DMinuteClass(s);
  }

  public static fromString(str: string): DMinuteClass | null {
    str = str.replace("1970-01-01T", "").replace("Z", "");
    const timeParts = str.match(Constants.timePartsRx);
    const m = moment.duration(timeParts && timeParts[1] ? timeParts[1] : str);
    return QMinute.fromMoment(m);
  }

  public static listToIPC(values: Array<DMinuteClass>): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.minute);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QMinute.writeValue(v, buffer.wb));

    return buffer.data;
  }

  public static toMoment(value: DMinuteClass): moment.Duration | null {
    return value === null ? null : moment.duration(value.i * 60 * 1000);
  }

  public static toScalar(value: DMinuteClass): number | null {
    return value === null ? null : value.i;
  }

  public static toString(
    value: DMinuteClass,
    format = "HH:mm:ss.SSS",
    options = { trim: false }
  ): string {
    if (value === null) return "";
    const m = QMinute.toMoment(value);
    return m === null ? "" : m.format(format, options);
  }

  public static toIPC(value: DMinuteClass): Uint8Array {
    const buffer = TypeBase.createBuffer(5);

    buffer.wb(256 - TypeNum.minute);
    QMinute.writeValue(value, buffer.wb);

    return buffer.data;
  }

  private static writeValue(
    value: DMinuteClass,
    wb: (b: number) => void
  ): void {
    QInt.writeValue(QMinute.toScalar(value), wb);
  }

  public getValue(i: number): DMinuteClass | number | null {
    return super.deserializeScalarAt(i, (s) => new DMinuteClass(s));
  }
}
