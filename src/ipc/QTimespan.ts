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

import { DTimespanClass } from "./cClasses";
import Constants from "./constants";
import I64 from "./I64";
import moment from "./moment.custom";
import QLong from "./QLong";
import { TypeBase, TypeNum } from "./typeBase";

export default class QTimespan extends I64 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.timespan, dataView);
  }

  public static fromScalar(value: number): DTimespanClass | null {
    return value === null ? null : new DTimespanClass(value);
  }

  public static fromMoment(m: moment.Duration): DTimespanClass | null {
    return m === null ? null : new DTimespanClass(m.valueOfNano());
  }

  public static fromString(str: string): DTimespanClass | null {
    let m: moment.Duration;
    str = str.replace("1970-01-01T", "").replace("Z", "");
    const timeParts = str.match(Constants.timePartsRx);
    if (timeParts && timeParts[1]) {
      if (str.indexOf("D") !== -1) {
        const dayHourArr = str.substring(0, str.indexOf(":")).split("D");
        const hours = Number(dayHourArr[1]) + Number(dayHourArr[0]) * 24;
        if (hours) {
          timeParts[1] = hours + timeParts[1].substring(2);
        }
      }

      m = moment.duration(timeParts[1]);
      const nano = Number(timeParts[2] || 0);
      if (nano && !isNaN(nano)) {
        m.nanoseconds(nano);
      }
    } else {
      m = moment.duration(str);
    }

    return QTimespan.fromMoment(m);
  }

  public static listToIPC(values: Array<DTimespanClass>): Uint8Array {
    const size = values.length * 8 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.timespan);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QTimespan.writeValue(v, buffer.wb));

    return buffer.data;
  }

  public static toIPC(value: DTimespanClass): Uint8Array {
    const buffer = TypeBase.createBuffer(9);

    buffer.wb(256 - TypeNum.timespan);
    QTimespan.writeValue(value, buffer.wb);

    return buffer.data;
  }

  public static toMoment(value: DTimespanClass): moment.Duration | null {
    if (value === null) {
      return null;
    }
    const m = moment.duration(
      (value.i > 0 ? Math.floor : Math.ceil)(value.i / 1000000)
    );
    m.nanoseconds(value.i % 1000000);
    return m;
  }

  public static toScalar(value: DTimespanClass): number | null {
    return value === null ? null : value.i;
  }

  public static toString(
    value: DTimespanClass,
    format?: string,
    options?: any
  ): string {
    if (value === null) return "";
    const m = QTimespan.toMoment(value);
    if (m === null) return "";
    const str = m.format(format || "HH:mm:ss.SSS", options || { trim: false });
    return format ? str : (str + m.nanoseconds()).padEnd(6, "0");
  }

  public static writeValue(
    value: DTimespanClass,
    wb: (b: number) => void
  ): void {
    const s = QTimespan.toScalar(value);
    QLong.writeValue(BigInt(s !== null ? s.toFixed(0) : 0), wb);
  }

  public getValue(i: number): DTimespanClass | number | null {
    return super.deserializeScalarAt(
      i,
      (s) => new DTimespanClass(Number(s.toString()))
    );
  }
}
