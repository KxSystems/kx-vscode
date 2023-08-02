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
import QDict from "./QDict";
import QDouble from "./QDouble";
import QFloat from "./QFloat";
import QGuid from "./QGuid";
import QInt from "./QInt";
import QLong from "./QLong";
import QMinute from "./QMinute";
import QMonth from "./QMonth";
import QSecond from "./QSecond";
import QShort from "./QShort";
import QSymbol from "./QSymbol";
import QTable from "./QTable";
import QTime from "./QTime";
import QTimespan from "./QTimespan";
import QTimestamp from "./QTimestamp";
import QUnary from "./QUnary";
import SparkMD5 from "./SparkMD5";
import * as c from "./c";
import Tools from "./tools";
import { TypeBase } from "./typeBase";
import Vector from "./vector";

export class Parse {
  private static readonly vectorColumnClasses = [
    null,
    QBoolean,
    QGuid,
    null,
    QByte,
    QShort,
    QInt,
    QLong,
    QFloat,
    QDouble,
    QChar,
    null,
    QTimestamp,
    QMonth,
    QDate,
    QDateTime,
    QTimespan,
    QMinute,
    QSecond,
    QTime,
  ];

  public static col(
    qStruct: c.Vector | c.SymList | c.GenericList | c.Dict,
    dataView: DataView
  ): TypeBase | QTable | QDict {
    // parse symbols, mixed and unary
    if (qStruct.qtype === -11) {
      const qa = qStruct as c.Atom;
      return new QSymbol(1, [qa.offset], dataView);
    } else if (qStruct.qtype === 11) {
      // is a symbol
      const sl = qStruct as c.SymList;
      return new QSymbol(sl.offsets.length, sl.offsets, dataView);
    } else if (qStruct.qtype === 0) {
      // is a generic list
      const l = qStruct as c.GenericList;
      return new QList(l.values, l.end, dataView);
    } else if (qStruct.qtype === 101) {
      const qa = qStruct as c.Atom;
      return new QUnary(1, qa.offset, dataView);
    } else if (qStruct.qtype === 98 || qStruct.qtype === 99) {
      const qa = qStruct as c.Dict;
      return Parse.table(qa, dataView);
    }

    const colFn = Parse.vectorColumnClasses[Math.abs(qStruct.qtype)];
    if (colFn) {
      if (qStruct.qtype < 0) {
        const qa = qStruct as c.Atom;
        return new colFn(1, qa.offset, dataView);
      } else {
        const bl = qStruct as c.Vector;
        return new colFn(bl.length, bl.offset, dataView);
      }
    }

    throw new Error("Parse: unknown column type");
  }

  public static dict(dict: c.Dict, dataView: DataView): QDict {
    const keys = Parse.col(
      dict.keys as c.Vector | c.SymList | c.GenericList,
      dataView
    ) as TypeBase;
    const values = Parse.col(
      dict.values as c.Vector | c.SymList | c.GenericList,
      dataView
    );
    return new QDict(keys.length, keys, values as TypeBase, dict.qtype);
  }

  public static flipDict(data: c.Dict, dv: DataView): QTable {
    const keys = Parse.col(data.keys, dv) as TypeBase;
    const values = Parse.col(data.values, dv) as TypeBase;

    return new QTable(
      Tools.times(keys.length, (i) => keys.toLegacy(i)),
      Tools.times(values.length, (i) => Parse.col(values.getValue(i), dv))
    );
  }

  public static reshape(qObj: c.Typed | QTable, buffer: ArrayBuffer): QTable {
    const t = qObj.qtype;
    const dv = new DataView(buffer);

    const cls = (qObj as QTable).class;
    if (
      cls ===
        "com.fd.business.querymanager.subscriptions.StreamingSubscription" ||
      cls === "210" ||
      cls === "207"
    ) {
      return qObj as unknown as QTable;
    }

    const ret = Parse.table(qObj, dv);
    if (ret && ret.qtype === 98) {
      return ret as QTable;
    }

    const table = new QTable();
    const parseCol = (cCol: c.Vector | c.SymList | c.GenericList | c.Dict) =>
      Parse.col(cCol, dv) as Vector | QSymbol;

    if (-20 < t && t < 0) {
      const colName = TypeBase.typeNames[-t] || "unknown";
      table.addParsedColumn(
        colName,
        parseCol(
          t === -11
            ? new c.SymList(true, [(qObj as c.Atom).offset])
            : new c.Vector(-t, true, 1, (qObj as c.Atom).offset)
        )
      );
    } else if (t === 99) {
      const dict = qObj as c.Dict;
      table.addParsedColumn("Property", parseCol(dict.keys));
      table.addParsedColumn("Value", parseCol(dict.values));
    } else if (t === 10) {
      const bl = qObj as c.Vector;
      table.addParsedColumn(
        "string",
        parseCol(
          new c.GenericList(
            true,
            [bl],
            bl.offset + bl.length * (c.getTypeSize(bl.qtype) as number)
          )
        )
      );
    } else if (t === 0) {
      const gl = qObj as c.GenericList;
      gl.values.forEach((li, i) => {
        if (li === null) {
          return;
        }
        const col =
          (li.qtype === 10
            ? "string"
            : TypeBase.typeNames[Math.abs(li.qtype)] || "unknown") + i;

        if (li.qtype < 0) {
          table.addParsedColumn(
            col,
            parseCol(
              li.qtype === -11
                ? new c.SymList(true, [(li as c.Atom).offset])
                : new c.Vector(-li.qtype, true, 1, (li as c.Atom).offset)
            )
          );
        } else {
          table.addParsedColumn(
            col,
            parseCol(
              li.qtype !== 10 && li.qtype <= 19
                ? (li as c.Vector)
                : new c.GenericList(
                    true,
                    [li],
                    li.qtype === 10
                      ? (li as c.Vector).offset +
                        (c.getTypeSize(10) as number) * (li as c.Vector).length
                      : (li as c.Atom).offset
                  )
            )
          );
        }
      });
    } else if (t === 11) {
      const sl = qObj as c.SymList;
      sl.offsets.forEach((offset, i) => {
        table.addParsedColumn(
          (TypeBase.typeNames[sl.qtype] || "unknown") + i,
          parseCol(new c.SymList(true, [offset]))
        );
      });
    } else if (0 <= t && t < 20) {
      const bl = qObj as c.Vector;
      const sz = c.getTypeSize(bl.qtype) as number;
      for (let i = 0; i < bl.length; i++) {
        table.addParsedColumn(
          (TypeBase.typeNames[bl.qtype] || "unknown") + i,
          parseCol(new c.Vector(bl.qtype, true, 1, bl.offset + sz * i))
        );
      }
    } else if (t === 101) {
      return table;
    } else {
      throw new Error("Unsupported Root Object");
    }

    return table;
  }

  public static table(qObj: c.Typed, dv: DataView): QTable | QDict {
    if (qObj.qtype === 98) {
      return Parse.flipDict(qObj as c.Dict, dv);
    } else if (qObj.qtype === 99) {
      const dict = qObj as c.Dict;
      if (dict.values.qtype === 98) {
        if (dict.keys.qtype === 98) {
          const a = Parse.flipDict(dict.keys as c.Dict, dv);
          const b = Parse.flipDict(dict.values as c.Dict, dv);
          return a.merge(b);
        } else if (
          dict.keys.qtype === 11 &&
          (dict.values as c.Dict).keys.qtype === 11
        ) {
          const keys = Parse.col(
            (dict.values as c.Dict).keys as c.SymList,
            dv
          ) as TypeBase;
          const names = ["key"].concat(
            Tools.times(keys.length, (i) => keys.toLegacy(i))
          );
          const cols = Parse.col(
            (dict.values as c.Dict).values as
              | c.Vector
              | c.SymList
              | c.GenericList,
            dv
          ) as QList;
          return new QTable(
            names,
            [dict.keys as c.SymList]
              .concat(Tools.times(cols.length, (i) => cols.getValue(i)))
              .map((x) => Parse.col(x, dv) as Vector)
          );
        }
      } else {
        return Parse.dict(qObj as c.Dict, dv);
      }
    }
  }
}

export class QList extends TypeBase {
  private keyIndex?: { [index: string]: number };
  private values: Array<c.Typed>;
  private end: number;
  private indexOffset = 0;
  private dataView?: DataView;

  constructor(values: Array<c.Typed>, end: number, dataView: DataView) {
    super(values.length, 0, 0);
    this.dataView = dataView;
    this.end = end;
    this.values = values;
  }

  static toIPC(values: Uint8Array[]): Uint8Array {
    const size = values.map((v) => v.length).reduce((a, b) => a + b, 6);
    const buffer = TypeBase.createBuffer(size);

    buffer.wb(0);
    buffer.wb(0);
    buffer.wi(values.length);
    values.forEach((v) => {
      v.forEach((vb) => buffer.wb(vb));
    });

    return buffer.data;
  }

  getFirstOffset(i: number, dataView: DataView): number {
    let qStruct = this.values[i];

    if (qStruct.qtype === 98 || qStruct.qtype === 99) {
      const d = qStruct as c.Dict;
      qStruct =
        d.keys.qtype === 98 || d.keys.qtype === 99
          ? (d.keys as c.Dict).keys
          : d.keys;
    }

    if (qStruct.qtype === 0) {
      const l = qStruct as c.GenericList;
      return new QList(l.values, l.end, dataView).getFirstOffset(0, dataView);
    } else if (qStruct.qtype === 11) {
      const sl = qStruct as c.SymList;
      return sl.offsets[0];
    } else if (qStruct.qtype >= 0 && qStruct.qtype <= 19) {
      const bl = qStruct as c.Vector;
      return bl.offset;
    }

    const qa = qStruct as c.Atom;
    return qa.offset;
  }

  getEndOffset(i: number, dataView: DataView): number {
    let qStruct = this.values[i];

    if (qStruct.qtype === 98 || qStruct.qtype === 99) {
      const d = qStruct as c.Dict;
      qStruct =
        d.values.qtype === 98 || d.values.qtype === 99
          ? (d.values as c.Dict).values
          : d.values;
    }

    if (qStruct.qtype === 0) {
      const l = qStruct as c.GenericList;
      return l.end;
    } else if (qStruct.qtype === 11) {
      const sl = qStruct as c.SymList;
      let end = sl.offsets[sl.offsets.length - 1];
      while (dataView.getUint8(end++) !== 0) {}
      return end;
    } else if (qStruct.qtype === -11) {
      const qsa = qStruct as c.Atom;
      let end = qsa.offset;
      while (dataView.getUint8(end++) !== 0) {}
      return end;
    } else if (qStruct.qtype >= 0 && qStruct.qtype <= 19) {
      const bl = qStruct as c.Vector;
      return bl.offset + (c.getTypeSize(bl.qtype) as number) * bl.length;
    }

    const qa = qStruct as c.Atom;
    return qa.offset + (c.getTypeSize(Math.abs(qa.qtype)) as number);
  }

  getValue(i: number): any {
    if (!this.dataView) {
      return this.values[(i + this.indexOffset) % this.length];
    }

    const qCol = this.values[i];
    if (qCol.qtype === 98 || qCol.qtype === 99) {
      return Parse.table(qCol as c.Dict, this.dataView);
    } else {
      return Parse.col(qCol as c.Vector, this.dataView);
    }
  }

  isolate(i: number): string | number {
    if (!this.dataView) {
      throw new Error("List values already isolated");
    }

    let col;
    const start = this.getFirstOffset(i, this.dataView);
    const end = this.getEndOffset(i, this.dataView);
    const sz = end - start;
    const buffer = new ArrayBuffer(sz);

    const uBuffer = new Uint8Array(buffer, 0, sz);
    uBuffer.set(new Uint8Array(this.dataView.buffer, start, sz));

    this.offsetItem(i, -start, this.dataView);

    if (this.values[i].qtype === 98 || this.values[i].qtype === 99) {
      this.values[i] = Parse.table(
        this.values[i] as c.Dict,
        new DataView(buffer)
      );

      return SparkMD5.hash(uBuffer);
    } else {
      this.values[i] = col = Parse.col(
        this.values[i] as c.Vector,
        new DataView(buffer)
      );

      if (col.qtype === 10) {
        return this.toLegacy(i);
      }

      if (
        col.qtype > -20 &&
        col.qtype < 20 &&
        col.qtype !== 0 &&
        col.qtype !== 11 &&
        col.qtype !== -11
      ) {
        const vCol = col as Vector;
        if (vCol.length === 1) {
          const vec0 = (col as Vector).hash(0);
          return typeof vec0 === "bigint" ? vec0.toString() : (vec0 as number);
        }
      }

      return SparkMD5.hash(uBuffer);
    }
  }

  offsetItem(i: number, offset: number, dataView: DataView): void {
    let qStruct = this.values[i];
    let dValues;

    if (qStruct.qtype === 98 || qStruct.qtype === 99) {
      const d = qStruct as c.Dict;
      qStruct =
        d.keys.qtype === 98 || d.keys.qtype === 99
          ? (d.keys as c.Dict).keys
          : d.keys;
      dValues =
        d.values.qtype === 98 || d.values.qtype === 99
          ? (d.values as c.Dict).values
          : d.values;

      this.offsetQTyped(i, offset, dValues, dataView);
    }

    this.offsetQTyped(i, offset, qStruct, dataView);
  }

  offsetQTyped(
    i: number,
    offset: number,
    qStruct: c.Typed,
    dataView: DataView
  ): void {
    if (qStruct.qtype === 0) {
      const l = qStruct as c.GenericList;
      const cl = new QList(l.values, l.end, dataView);
      for (let j = 0; j < cl.length; j++) {
        cl.offsetItem(j, offset, dataView);
      }
    } else if (qStruct.qtype === 11) {
      const sl = qStruct as c.SymList;
      for (let j = 0; j < sl.offsets.length; j++) {
        sl.offsets[j] += offset;
      }
    } else {
      (qStruct as c.Atom).offset += offset;
    }
  }

  public mergeIndexed(arg: QList): void {
    if (arg.length >= this.length) {
      throw new Error("Invalid Merge Size");
    }

    if (arg.length === 0) {
      return;
    }

    if (!this.dataView || !arg.dataView) {
      throw new Error("Merge missing DataView");
    }

    const argOffsetStart = arg.getFirstOffset(0, this.dataView);
    const argOffsetEnd = arg.end;

    const argSize = argOffsetEnd - argOffsetStart;

    const thisFirstOriginal = this.getFirstOffset(
      arg.values.length,
      this.dataView
    );

    const thisOriginalSize = this.end - thisFirstOriginal;

    const totalSize = argSize + thisOriginalSize;

    const buffer = new ArrayBuffer(totalSize);

    new Uint8Array(buffer, 0, argSize).set(
      new Uint8Array(arg.dataView.buffer, argOffsetStart, argSize)
    );

    new Uint8Array(buffer, argSize, thisOriginalSize).set(
      new Uint8Array(this.dataView.buffer, thisFirstOriginal, thisOriginalSize)
    );

    for (let i = 0; i < arg.length; i++) {
      this.values[i] = arg.values[i];
      this.offsetItem(i, -argOffsetStart, this.dataView);
    }

    const orginalMove = argSize - thisFirstOriginal;
    for (let i = arg.length; i < this.length; i++) {
      this.offsetItem(i, orginalMove, this.dataView);
    }
    this.end += orginalMove;
    this.dataView = new DataView(buffer);
  }

  public mergeKeyedPrimary(
    arg: QList,
    maxRows: number,
    insertIndices: Array<number>
  ): number {
    if (this.keyIndex === undefined) {
      const keyIndex: { [index: string]: number } = {};
      for (let i = 0; i < this.length; i++) {
        const hash = this.isolate(i);
        keyIndex[hash] = i;
      }

      this.keyIndex = keyIndex;

      delete this.dataView;
    }

    for (let i = 0; i < arg.length; i++) {
      const argHash = arg.isolate(i);
      const argValue = arg.values[i];
      const valueIndex = this.keyIndex[argHash];

      if (valueIndex === undefined) {
        if (this.length === maxRows) {
          const targetIndex = this.indexOffset % maxRows;
          this.keyIndex[argHash] = targetIndex;
          this.values[targetIndex] = argValue;
          insertIndices.push(targetIndex);
          this.indexOffset++;
        } else {
          this.keyIndex[argHash] = this.length;
          insertIndices.push(this.length);
          this.values.push(argValue);
          this.length++;
        }
      } else {
        insertIndices.push(valueIndex);
      }
    }

    return this.indexOffset;
  }

  public mergeKeyed(
    arg: QList,
    indices: Array<number>,
    indexOffset: number,
    maxRows: number
  ): void {
    if (this.values === undefined) {
      this.values = new Array(this.length);
      for (let i = 0; i < this.length; i++) {
        const str = this.getValue(i);
        this.values[i] = str;
      }

      delete this.dataView;
    }

    for (let i = 0; i < indices.length; i++) {
      const argValue = arg.getValue(i);
      const targetIndex = indices[i];

      if (targetIndex === this.length) {
        this.values.push(argValue);
        this.length++;
      } else if (targetIndex > this.length) {
        throw new Error("QList target element out of range on merge");
      } else {
        this.values[targetIndex] = argValue;
      }
    }

    this.indexOffset = indexOffset;
  }

  toLegacy(i: number): any {
    const qCol = this.values[i];
    if (!this.dataView) {
      return this.values[i];
    }

    if (qCol.qtype === 10) {
      const bl = qCol as c.Vector;
      const s = [];
      for (i = 0; i < bl.length; i++) {
        s.push(this.dataView.getUint8(bl.offset + i));
      }
      return c.u16u8(s);
    } else if (-20 < qCol.qtype && qCol.qtype < 0) {
      return Parse.col(qCol as c.Vector, this.dataView).toLegacy(0);
    } else if (0 <= qCol.qtype && qCol.qtype < 20) {
      const col = Parse.col(qCol as c.Vector, this.dataView) as Vector;
      return Tools.times(col.length, (j) => col.toLegacy(j));
    } else if (qCol.qtype === 98 || qCol.qtype === 99) {
      return Parse.table(qCol as c.Dict, this.dataView).toLegacy();
    } else if (qCol.qtype === 101) {
      return null;
    }
  }

  public toViewState(i: number) {
    const qCol = this.values[i];
    return this.dataView && (qCol.qtype === 99 || qCol.qtype === 98)
      ? Parse.table(qCol as c.Dict, this.dataView).toViewState()
      : {
          _type:
            qCol.qtype === 10
              ? "string"
              : TypeBase.typeNames[Math.abs(qCol.qtype)],
          value: Tools.convertKDBToViewstateValue(this.toLegacy(i)),
        };
  }
}
