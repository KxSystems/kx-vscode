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
import { DMonthClass } from "./cClasses";
import moment from "./moment.custom";
import { TypeBase, TypeNum } from "./typeBase";

export default class QMonth extends I32 {
  static readonly typeNum = 13;

  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.month, dataView);
  }

  public static fromMoment(m: moment.Moment): DMonthClass | null {
    return m === null
      ? null
      : new DMonthClass(Math.round(m.diff(moment([2000]), "months", true)));
  }

  public static fromScalar(value: number): DMonthClass | null {
    return value === null ? null : new DMonthClass(value);
  }

  public static fromString(str: string): DMonthClass | null {
    if (str === null) {
      return null;
    }
    str = str.replace(/\./g, "-").replace(/m$/, "");
    const m = moment.utc(str);
    return QMonth.fromMoment(m);
  }

  public static listToIPC(values: Array<DMonthClass>): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QMonth.typeNum);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QMonth.writeValue(v, buffer.wb));

    return buffer.data;
  }

  public static toIPC(value: DMonthClass): Uint8Array {
    const buffer = TypeBase.createBuffer(5);

    buffer.wb(256 - QMonth.typeNum);
    QMonth.writeValue(value, buffer.wb);

    return buffer.data;
  }

  public static toMoment(value: DMonthClass): moment.Moment | null {
    if (value === null) return null;
    const m = moment.tz("2000-01-01", "UTC");
    m.add(value.i, "month");
    return m;
  }

  public static toScalar(value: DMonthClass): number | null {
    return value === null ? null : value.i;
  }

  public static toString(value: DMonthClass, format = "YYYY-MM"): string {
    if (value === null) return "";
    const m = QMonth.toMoment(value);
    return m === null ? "" : m.format(format);
  }

  public static writeValue(value: DMonthClass, wb: (b: number) => void): void {
    QInt.writeValue(QMonth.toScalar(value), wb);
  }

  getValue(i: number): number | DMonthClass | null {
    const s = super.getScalar(i);
    return s === I32.nullValue ? null : new DMonthClass(s);
  }
}
