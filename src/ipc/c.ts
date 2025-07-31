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

import { Op } from "./Op";

export interface DCDS {
  class: string;
  columns: Array<string>;
  meta: { [index: string]: number };
  rows?: Record<string, unknown>[];
  cols?: { [index: string]: Typed };
  clientId?: string;
  subId?: string;
  runID?: string;
}

export interface Typed {
  qtype: number;
}

export class Atom implements Typed {
  "offset": number;
  "qtype": number;

  constructor(offset: number, qtype: number) {
    this.offset = offset;
    this.qtype = qtype;
  }
}

export class Vector extends Atom {
  "length": number;
  "isSorted": boolean;
  constructor(
    qtype: number,
    isSorted: boolean,
    length: number,
    offset: number
  ) {
    super(offset, qtype);
    this.isSorted = isSorted;
    this.length = length;
  }
}

export class GenericList implements Typed {
  "qtype" = 0;
  "values": Array<Typed>;
  "end": number;
  "isSorted": boolean;
  constructor(isSorted: boolean, values: Array<Typed>, end: number) {
    this.isSorted = isSorted;
    this.values = values;
    this.end = end;
  }
}

export class SymList implements Typed {
  "qtype" = 11;
  "offsets": Array<number>;
  "isSorted": boolean;
  constructor(isSorted: boolean, offsets: Array<number>) {
    this.isSorted = isSorted;
    this.offsets = offsets;
  }
}

export class Dict implements Typed {
  "qtype": number;
  "keys": Vector | SymList | GenericList | Dict;
  "values": Vector | SymList | GenericList | Dict;
  "isSorted": boolean;
  constructor(
    qtype: number,
    isSorted: boolean,
    keys: Vector | SymList | GenericList | Dict,
    values: Vector | SymList | GenericList | Dict
  ) {
    this.keys = keys;
    this.values = values;
    this.qtype = qtype;
    this.isSorted = isSorted;
  }
}

export const getTypeSize = (qType: number): number | undefined => {
  switch (qType) {
    case 1:
    case 4:
    case 10:
      return 1;
    case 5:
      return 2;
    case 6:
    case 8:
    case 13:
    case 14:
    case 17:
    case 18:
    case 19:
      return 4;
    case 7:
    case 9:
    case 12:
    case 15:
    case 16:
      return 8;
    case 2:
      return 16;
    default:
      return undefined;
  }
};

export const u8u16 = (u16: string): Array<number> => {
  const u8 = [];
  for (let i = 0; i < u16.length; i++) {
    let c = u16.charCodeAt(i);
    if (c < 0x80) u8.push(c);
    else if (c < 0x800) u8.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0xd800 || c >= 0xe000)
      u8.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else {
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
};

export const u16u8 = (u8: ArrayLike<number>): string => {
  let u16 = "";
  let c;
  let c1;
  let c2;
  for (let i = 0; i < u8.length; i++) {
    switch ((c = u8[i]) >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        u16 += String.fromCharCode(c);
        break;
      case 12:
      case 13:
        c1 = u8[++i];
        u16 += String.fromCharCode(((c & 0x1f) << 6) | (c1 & 0x3f));
        break;
      case 14:
        c1 = u8[++i];
        c2 = u8[++i];
        u16 += String.fromCharCode(
          ((c & 0x0f) << 12) | ((c1 & 0x3f) << 6) | ((c2 & 0x3f) << 0)
        );
        break;
    }
  }

  return u16;
};

export const uncompress = (ab: ArrayBuffer): ArrayBuffer => {
  const b = new Uint8Array(ab);
  if (b.length < 12 + 1) {
    return b;
  }
  const i32u8 = (u8: ArrayBuffer) => new Uint32Array(u8)[0];

  let n = 0,
    r = 0,
    f = 0,
    s = 8,
    p = s,
    i = 0,
    d = 12;
  const usize = i32u8(b.buffer.slice(8, 12));
  const dst = new Uint8Array(usize);
  const aa = new Int32Array(256);
  for (; s < dst.length; ) {
    if (i == 0) {
      f = 0xff & b[d++];
      i = 1;
    }
    if ((f & i) != 0) {
      r = aa[0xff & b[d++]];
      dst[s++] = dst[r++];
      dst[s++] = dst[r++];
      n = 0xff & b[d++];
      for (let m = 0; m < n; m++) {
        dst[s + m] = dst[r + m];
      }
    } else {
      dst[s++] = b[d++];
    }
    for (; p < s - 1; ) {
      aa[(0xff & dst[p]) ^ (0xff & dst[p + 1])] = p++;
    }
    if ((f & i) != 0) {
      s += n;
      p = s;
    }
    i *= 2;
    if (i == 256) {
      i = 0;
    }
  }
  return dst.buffer;
};

export const isCompressed = (x: ArrayBuffer) => new Uint8Array(x)[2] === 1;

export const deserialize = (
  x: ArrayBuffer,
  offset?: number,
  isLite?: boolean
): any => {
  let pos: number = offset === undefined ? 8 : offset;
  const dataView = new DataView(x);

  const rInt8 = () => dataView.getInt8(pos++);
  const rUInt8 = () => dataView.getUint8(pos++);
  const rInt32 = (): number => {
    const ret = dataView.getInt32(pos, true);
    pos += 4;
    return ret;
  };

  const rSymbol = () => {
    let c;
    const s = [];
    while ((c = dataView.getUint8(pos++)) !== 0) s.push(c);
    return u16u8(s);
  };

  const parseAtom = (t: number): Atom => {
    const column = new Atom(pos, t);
    const sz = getTypeSize(-t);
    if (sz) {
      pos += sz;
    } else if (t === -11) {
      while (rUInt8() !== 0);
    } else {
      throw new Error("Unsupported type");
    }

    return column;
  };

  const parseList = (t: number): Vector | GenericList | SymList => {
    const isSorted = rUInt8() === 1;
    const n = rInt32();
    const sz = getTypeSize(t);

    if (sz) {
      const column = new Vector(t, isSorted, n, pos);
      pos += n * sz;
      return column;
    } else if (t === 11) {
      const offsets = new Array(n);
      for (let i = 0; i < n; i++) {
        offsets[i] = pos;
        while (rUInt8() !== 0);
      }
      return new SymList(isSorted, offsets);
    } else if (t === 0) {
      const values = new Array(n);
      for (let i = 0; i < n; i++) {
        values[i] = r();
      }
      return new GenericList(isSorted, values, pos);
    }

    throw new Error("Unsupported type");
  };

  const parseTable = (): Dict => {
    const isSorted = rUInt8() === 1;
    const checkT = rInt8();
    if (checkT !== 99) {
      console.error("c.js Assertion type=99 failed.");
    }

    return new Dict(98, isSorted, parseList(rInt8()), parseList(rInt8()));
  };

  const parseDict = (): Dict => {
    const flip = 98 === dataView.getUint8(pos);

    if (!flip) {
      const keys = parseList(rInt8());
      const t = rUInt8();
      const vals = t === 98 ? parseTable() : parseList(t);
      return new Dict(99, false, keys, vals);
    } else {
      const isSorted = rUInt8() === 1;
      const a = parseTable();
      pos++;
      const b = parseTable();

      return new Dict(99, isSorted, a, b);
    }
  };

  const r = (): Typed => {
    const t: number = rInt8();

    if (-20 < t && t < 0) {
      return parseAtom(t);
    }

    if (t > 99) {
      const ret = new Atom(pos, t);
      if (t === 100) {
        rSymbol();
        return r();
      }
      if (t < 104)
        return rInt8() === 0 && t === 101 ? new Atom(pos - 1, t) : ret;
      if (t > 105) r();
      else for (let i = 0, n = rInt32() || 0; i < n; i++) r();

      return ret;
    }

    if (99 === t) {
      return parseDict();
    }

    if (98 === t) {
      return parseTable();
    }

    return parseList(t);
  };

  if (isLite) {
    if (rInt8() === 0) {
      const msgLength = rInt32();
      if (rInt8() === 0 && rInt8() === -6) {
        const requestId = rInt32();
        const qtype = rInt8();
        const mtype = rUInt8();
        const tmp = r();
        return [requestId, mtype, tmp];
      }
    }

    return [0, Op.error, "Message parse error"];
  } else return r();
};
