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

import QBoolean from "./QBoolean";
import QByte from "./QByte";
import QChar from "./QChar";
import QDate from "./QDate";
import QDateTime from "./QDateTime";
import QDouble from "./QDouble";
import QFloat from "./QFloat";
import QInt from "./QInt";
import QLong from "./QLong";
import QMinute from "./QMinute";
import QMonth from "./QMonth";
import QSecond from "./QSecond";
import QShort from "./QShort";
import QString from "./QString";
import QSymbol from "./QSymbol";
import QTime from "./QTime";
import QTimespan from "./QTimespan";
import QTimestamp from "./QTimestamp";
import { QList } from "./parse.qlist";
import { TypeBase } from "./typeBase";

export class Util {
  private static typeDict: { [index: string]: any } = {
    "10": QString,
    "0": QList,
    "-1": QBoolean,
    "-2": QSymbol,
    "-4": QByte,
    "-5": QShort,
    "-6": QInt,
    "-7": QLong,
    "-8": QFloat,
    "-9": QDouble,
    "-10": QChar,
    "-11": QSymbol,
    "-12": QTimestamp,
    "-13": QMonth,
    "-14": QDate,
    "-15": QDateTime,
    "-16": QTimespan,
    "-17": QMinute,
    "-18": QSecond,
    "-19": QTime,
  };

  static getType(typeNum: number | string): any {
    return Util.typeDict[typeNum];
  }

  static mergeTypedArraysUnsafe(a: any, b: any) {
    const c = new a.constructor(a.length + b.length);
    c.set(a);
    c.set(b, a.length);

    return c;
  }

  static fromHexString(hexString: string): Uint8Array {
    // https://github.com/ng-packagr/ng-packagr/issues/696#issuecomment-387114613
    const ret = new Uint8Array(
      ((hexString || "").match(/.{1,2}/g) || []).map((byte) =>
        parseInt(byte, 16)
      )
    );
    return ret;
  }

  static toHexString(bytes: Array<number>) {
    let result = "";
    for (const b of bytes) {
      const str = b.toString(16);
      result += str.length === 1 ? "0" + str : str;
    }

    return result;
  }

  static pack(bytes: Array<number>) {
    const chars = [];
    for (let i = 0, n = bytes.length; i < n; ) {
      // eslint-disable-next-line no-bitwise
      chars.push(((bytes[i++] & 0xff) << 8) | (bytes[i++] & 0xff));
    }
    return String.fromCharCode.apply(null, chars);
  }

  static base64(bytes: Array<number>): string {
    return btoa(String.fromCharCode.apply(null, bytes));
  }

  static toMessage(arr: ArrayLike<number>) {
    const header = TypeBase.createBuffer(8);
    header.wi(1);
    header.wi(arr.length + 8);
    return Util.mergeTypedArraysUnsafe(header.data, arr);
  }
}
