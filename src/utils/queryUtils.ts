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

import { readFileSync } from "fs";
import { join } from "path";
import { ext } from "../extensionVariables";

export function sanitizeQuery(query: string): string {
  if (query[0] === "`") {
    query = query + " ";
  } else if (query.slice(-1) === ";") {
    query = query.slice(0, -1);
  }
  return query;
}

export function queryWrapper(): string {
  return readFileSync(
    ext.context.asAbsolutePath(join("resources", "evaluate.q"))
  ).toString();
}

// export function isCompressed(x: ArrayBuffer): boolean {
//   return new Uint8Array(x)[2] === 1;
// }

// export function uncompress(ab: ArrayBuffer): ArrayBuffer {
//   const b = new Uint8Array(ab); // copy array not sure why?
//   if (b.length < 12 + 1) {
//     return b;
//   }
//   const i32u8 = (u8: ArrayBuffer) => new Uint32Array(u8)[0];

//   let n = 0,
//     r = 0,
//     f = 0,
//     s = 8,
//     p = s,
//     i = 0,
//     d = 12;
//   const usize = i32u8(b.buffer.slice(8, 12));
//   const dst = new Uint8Array(usize);
//   const aa = new Int32Array(256);
//   for (; s < dst.length; ) {
//     if (i == 0) {
//       f = 0xff & b[d++];
//       i = 1;
//     }
//     if ((f & i) != 0) {
//       r = aa[0xff & b[d++]];
//       dst[s++] = dst[r++];
//       dst[s++] = dst[r++];
//       n = 0xff & b[d++];
//       for (let m = 0; m < n; m++) {
//         dst[s + m] = dst[r + m];
//       }
//     } else {
//       dst[s++] = b[d++];
//     }
//     for (; p < s - 1; ) {
//       aa[(0xff & dst[p]) ^ (0xff & dst[p + 1])] = p++;
//     }
//     if ((f & i) != 0) {
//       s += n;
//       p = s;
//     }
//     i *= 2;
//     if (i == 256) {
//       i = 0;
//     }
//   }
//   return dst.buffer;
// }
