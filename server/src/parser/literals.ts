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

import { createToken } from "chevrotain";

export const CharLiteral = createToken({
  name: "CharLiteral",
  pattern: /"(?:\\.|(?:(?!\r?\n\S)[^"]))*"/,
});

export const FloatLiteral = createToken({
  name: "FloatLiteral",
  pattern: /-?(?:\d+\.\d+|\.\d+|\d+\.)(?:e[+-]?\d?\d)?e?/,
});

export const IntegerLiteral = createToken({
  name: "IntegerLiteral",
  pattern: /-?\d+[jhi]?/,
});

export const BinaryLiteral = createToken({
  name: "BinaryLiteral",
  pattern: /[01]+b/,
});

export const ByteLiteral = createToken({
  name: "ByteLiteral",
  pattern: /0x(?:[0-9a-fA-F]{2})+/,
});

export const DateLiteral = createToken({
  name: "DateLiteral",
  pattern: /\d{4}\.\d{2}\.\d{2}/,
});

export const MiliTimeLiteral = createToken({
  name: "MiliTimeLiteral",
  pattern: /\d{2}:\d{2}:\d{2}\.\d{3}/,
});

export const NanoTimeLiteral = createToken({
  name: "NanoTimeLiteral",
  pattern: /(?:0D)?\d{2}:\d{2}:\d{2}\.\d{9}/,
});

export const DateTimeLiteral = createToken({
  name: "DateTimeLiteral",
  pattern: /\d{4}\.\d{2}\.\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}/,
});

export const TimeStampLiteral = createToken({
  name: "TimeStampLiteral",
  pattern: /\d{4}\.\d{2}\.\d{2}D\d{2}:\d{2}:\d{2}\.\d{9}/,
});

export const MonthLiteral = createToken({
  name: "MonthLiteral",
  pattern: /\d{4}\.\d{2}m/,
  longer_alt: DateLiteral,
});

export const SecondLiteral = createToken({
  name: "SecondLiteral",
  pattern: /\d{2}:\d{2}:\d{2}/,
});

export const MinuteLiteral = createToken({
  name: "MinuteLiteral",
  pattern: /\d{2}:\d{2}/,
  longer_alt: SecondLiteral,
});