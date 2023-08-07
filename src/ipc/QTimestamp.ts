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

import I64 from "./I64";
import QLong from "./QLong";
import { DTimestampClass } from "./cClasses";
import Constants from "./constants";
import moment from "./moment.custom";
import Tools from "./tools";
import { TypeBase, TypeNum } from "./typeBase";

export default class QTimestamp extends I64 {
  constructor(length: number, offset: number, dataView: DataView) {
    super(length, offset, TypeNum.timestamp, dataView);
  }

  public static fromMoment(m: moment.Moment): DTimestampClass | null {
    return m === null
      ? null
      : new DTimestampClass(
          m.valueOf(),
          m.milliseconds() * 1000000 + m.nanoseconds()
        );
  }

  public static fromScalar(value: bigint): DTimestampClass | null {
    if (value === I64.nullValue) {
      return null;
    }

    // todo - need the precision of jsbn
    const jsNanos2 = BigInt(value.toString()) + Constants.bnEpoch;

    // convert to nano
    const jsNanosStr = jsNanos2.toString();
    return new DTimestampClass(
      Number(jsNanosStr.substring(0, jsNanosStr.length - 6)),
      Number(jsNanosStr.substring(jsNanosStr.length - 9))
    );
  }

  public static fromString(str: string): DTimestampClass | null {
    if (str === null) {
      return null;
    }
    const dateMatch = str.match(/(.*)(D|T)(.*?)Z?$/);
    if (!dateMatch) {
      return null;
    }
    str = dateMatch[1].replace(/\./g, "-") + "T" + dateMatch[3] + "Z";
    const m = moment(str);
    m.nanoseconds(Tools.extractNanos(str));
    return QTimestamp.fromMoment(m);
  }

  public static listToIPC(values: Array<DTimestampClass>): Uint8Array {
    const size = values.length * 8 + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(TypeNum.timestamp); // type
    buffer.wb(0); // attributes
    buffer.wi(values.length); // vector size
    values.forEach((v) => QTimestamp.writeValue(v, buffer.wb)); // values

    return buffer.data;
  }

  public static toIPC(value: DTimestampClass): Uint8Array {
    const buffer = TypeBase.createBuffer(9);

    buffer.wb(256 - TypeNum.timestamp); // type
    QTimestamp.writeValue(value, buffer.wb); // value

    return buffer.data;
  }

  public static toMoment(value: DTimestampClass): moment.Moment | null {
    if (value === null) {
      return null;
    }
    const m = moment.tz(value.i, "UTC");
    m.nanoseconds(value.n % 1000000);
    if (Tools.timezone && m.isValid()) {
      m.tz(Tools.timezone);
    }
    return m;
  }

  public static toScalar(value: DTimestampClass): bigint | null {
    return value === null ? null : BigInt(QTimestamp.toScalarString(value));
  }

  public static toString(value: DTimestampClass, format?: string): string {
    if (value === null) return "";
    const m = QTimestamp.toMoment(value);
    if (m === null) return "";
    const str = m.format(format || "YYYY-MM-DDTHH:mm:ss.SSS");
    return format
      ? str
      : (str.substr(0, 23) + m.nanoseconds()).padEnd(6, "0") + "Z";
  }

  private static writeValue(
    value: DTimestampClass,
    wb: (b: number) => void
  ): void {
    const s = QTimestamp.toScalar(value);
    QLong.writeValue(s, wb);
  }

  private static toScalarString(value: DTimestampClass): string {
    const nanos = value.n.toFixed(0).padStart(9, "0");
    const ms = value.i.toFixed(0);

    // need 64-bit+ precision
    let bignum = BigInt(ms + nanos.substring(3));
    bignum = bignum - Constants.bnEpoch;
    return bignum.toString();
  }

  // note: need more than 64-bit precision here so use big nums for calcs.
  getValue(i: number): DTimestampClass | number | null {
    return super.deserializeScalarAt(i, (s) => {
      // need 64-bit+ precision of jsbn
      const jsNanos2 = s + Constants.bnEpoch;

      // convert to nano
      const jsNanosStr = jsNanos2.toString();
      return new DTimestampClass(
        Number(jsNanosStr.substring(0, jsNanosStr.length - 6)),
        Number(jsNanosStr.substring(jsNanosStr.length - 9))
      );
    });
  }
}
