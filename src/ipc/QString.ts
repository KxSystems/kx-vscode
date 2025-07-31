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

import { QList } from "./parse.qlist";
import { TypeBase } from "./typeBase";

 

export default class QString {
  static typeNum = 10;

  static u8u16(u16: string): Array<number> {
    const u8 = [];
    for (let i = 0; i < u16.length; i++) {
      let c = u16.charCodeAt(i);
      if (c < 0x80) {
        u8.push(c);
      } else if (c < 0x800) {
        u8.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        u8.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        c = 0x10000 + (((c & 0x3ff) << 10) | (u16.charCodeAt(++i) & 0x3ff));
        u8.push(
          0xf0 | (c >> 18),
          0x80 | ((c >> 12) & 0x3f),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f)
        );
      }
    }
    return u8;
  }

  static listToIPC(values: Array<string>): Uint8Array {
    // https://github.com/ng-packagr/ng-packagr/issues/696#issuecomment-387114613
    const ret = QList.toIPC(values.map((v) => QString.toIPC(v)));
    return ret;
  }

  static toIPC(value: string): Uint8Array {
    const valEn = value ? QString.u8u16(value) : [];
    const size = valEn.length + 6;
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(QString.typeNum); // type
    buffer.wb(0); // attributes
    buffer.wi(valEn.length); // vector size
    valEn.forEach((v) => buffer.wb(v)); // values

    return buffer.data;
  }
}
