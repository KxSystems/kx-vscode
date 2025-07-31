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

import Tools from "./tools";

 
export enum TypeNum {
  list = 0,
  bool = 1,
  guid = 2,
  byte = 4,
  short = 5,
  int = 6,
  long = 7,
  float = 8,
  double = 9,
  char = 10,
  symbol = 11,
  timestamp = 12,
  month = 13,
  date = 14,
  dateTime = 15,
  timespan = 16,
  minute = 17,
  second = 18,
  time = 19,
  table = 98,
  dict = 99,
  unary = 101,
}

export abstract class TypeBase {
  public static readonly typeNames = [
    "list",
    "boolean",
    "guid",
    undefined,
    "byte",
    "short",
    "int",
    "long",
    "real",
    "float",
    "char",
    "symbol",
    "timestamp",
    "month",
    "date",
    "datetime",
    "timespan",
    "minute",
    "second",
    "time",
  ];

  public length: number;
  public readonly qtype: TypeNum;
  protected offset: number;

  constructor(length: number, offset: number, qtype: number) {
    this.length = length;
    this.offset = offset;
    this.qtype = qtype;
  }

  public static createBuffer(size: number) {
    const buffer = {
      data: new Uint8Array(size),
      i: 0,
      wb: (b: number) => {
        buffer.data[buffer.i++] = b;
      },
      wi: (i: number) => {
        for (let j = 0; j < 4; j++) {
           
          buffer.wb(i & 255);
           
          i = i >> 8;
        }
      },
    };

    return buffer;
  }

  public isAligned(): boolean {
    return true;
  }

  public isTemporal(): boolean {
    return 12 >= this.qtype && this.qtype <= 19;
  }

  public toLegacy(i: number): any {
    return this.getValue(i);
  }

  public toViewState(i: number): any {
    return {
      _type: TypeBase.typeNames[Math.abs(this.qtype)],
      value: Tools.convertKDBToViewstateValue(this.toLegacy(i)),
    };
  }

  public abstract getValue(i: number): any;

  public abstract mergeIndexed(arg: TypeBase): any;

  public abstract mergeKeyedPrimary(
    arg: TypeBase,
    maxRows: number,
    insertIndices: Array<number>
  ): number;

  public abstract mergeKeyed(
    arg: TypeBase,
    indices: Array<number>,
    indexOffset: number,
    maxRows: number
  ): any;
}
