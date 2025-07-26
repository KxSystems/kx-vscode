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

import { DDateTimeClass } from "./cClasses";
import Constants from "./constants";
import F64 from "./F64";
import moment from "./moment.custom";
import QDouble from "./QDouble";
import Tools from "./tools";
import { TypeBase, TypeNum } from "./typeBase";

export default class QDateTime extends F64 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.dateTime, dataView);
  }

  static fromMoment(m: moment.Moment): DDateTimeClass | null {
    return m === null ? null : new DDateTimeClass(m.valueOf());
  }

  static fromScalar(scalar: number | null): DDateTimeClass | null {
    return scalar === null || isNaN(scalar)
      ? null
      : new DDateTimeClass(Constants.qEpoch + scalar * Constants.msDay);
  }

  static fromString(str: string): DDateTimeClass | null {
    if (str === null) {
      return null;
    }
    const dateMatch = str.match(/(.*)(D|T)(.*?)Z?$/);
    if (!dateMatch) {
      return null;
    }
    str = dateMatch[1].replace(/\./g, "-") + "T" + dateMatch[3] + "Z";
    const m = moment(str);
    return QDateTime.fromMoment(m);
  }

  static listToIPC(values: DDateTimeClass[]): Uint8Array {
    const size = values.length * 8 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.dateTime);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => QDateTime.writeValue(v, buffer.wb));

    return buffer.data;
  }

  static toIPC(value: DDateTimeClass): Uint8Array {
    const buffer = TypeBase.createBuffer(9);

    buffer.wb(256 - TypeNum.dateTime);
    QDateTime.writeValue(value, buffer.wb);

    return buffer.data;
  }

  static toMoment(value: DDateTimeClass): moment.Moment | null {
    if (value === null) {
      return null;
    }
    const m = moment.tz(value.i, "UTC");
    if (Tools.timezone && m.isValid()) {
      m.tz(Tools.timezone);
    }
    return m;
  }

  static toScalar(value: DDateTimeClass): number | null {
    return value === null
      ? null
      : (value.i - Constants.qEpoch) / Constants.msDay;
  }

  static toString(value: DDateTimeClass, format?: string): string {
    if (value === null) {
      return "";
    }
    const m = QDateTime.toMoment(value);
    return m === null
      ? ""
      : format !== undefined
      ? m.format(format)
      : m.toISOString();
  }

  static writeValue(value: DDateTimeClass, wb: (b: number) => void): void {
    QDouble.writeValue(QDateTime.toScalar(value), wb);
  }

  getValue(i: number): DDateTimeClass | null {
    return QDateTime.fromScalar(this.getScalar(i));
  }
}
