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

import moment from "moment";
import I32 from "./I32";
import QInt from "./QInt";
import { DDateClass } from "./cClasses";
import Constants from "./constants";
import { TypeBase, TypeNum } from "./typeBase";

export default class QDate extends I32 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.date, dataView);
  }

  public static fromMoment(m: moment.Moment): DDateClass | null {
    return m === null ? null : new DDateClass(m.valueOf());
  }

  public static fromScalar(value: number): DDateClass | null {
    return value === null
      ? null
      : new DDateClass(Constants.qEpoch + value * Constants.msDay);
  }

  public static fromString(str: string): DDateClass | null {
    if (!str) {
      return null;
    }
    str = str.replace(/\./g, "-");
    const m = moment.utc(str);
    return QDate.fromMoment(m);
  }

  public static listToIPC(values: DDateClass[]): Uint8Array {
    const size = values.length * 4 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.date);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QDate.writeValue(v, buffer.wb));

    return buffer.data;
  }

  public static toIPC(value: DDateClass): Uint8Array {
    const buffer = TypeBase.createBuffer(5);

    buffer.wb(256 - TypeNum.date);
    QDate.writeValue(value, buffer.wb);
    return buffer.data;
  }

  public static writeValue(value: DDateClass, wb: (b: number) => void): void {
    QInt.writeValue(value === null ? null : QDate.toScalar(value), wb);
  }

  public static toMoment(value: DDateClass): moment.Moment | null {
    return value === null ? null : moment.tz(value.toString(), "UTC");
  }

  public static toScalar(value: DDateClass): number | null {
    return value === null
      ? null
      : (value.i - Constants.qEpoch) / Constants.msDay;
  }

  public static toString(value: DDateClass, format = "YYYY-MM-DD"): string {
    if (value === null) return "";
    const m = QDate.toMoment(value);
    return m === null ? "" : m.format(format);
  }

  public getValue(i: number): number | DDateClass | null {
    return super.deserializeScalarAt(
      i,
      (s) => new DDateClass(Constants.qEpoch + s * Constants.msDay)
    );
  }
}
