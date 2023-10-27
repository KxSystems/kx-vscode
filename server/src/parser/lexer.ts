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

import { Lexer } from "chevrotain";
import {
  BinaryLiteral,
  ByteLiteral,
  CharLiteral,
  DateLiteral,
  DateTimeLiteral,
  FloatLiteral,
  IntegerLiteral,
  MiliTimeLiteral,
  MinuteLiteral,
  MonthLiteral,
  NanoTimeLiteral,
  SecondLiteral,
  TimeStampLiteral,
} from "./literals";
import {
  BinaryColon,
  BlockComment,
  Colon,
  Dot,
  EndOfLine,
  Identifier,
  Infix,
  Keyword,
  LBracket,
  LCurly,
  LParen,
  LineComment,
  Quote,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  Underscore,
  WhiteSpace,
} from "./tokens";

export const QTokens = [
  BlockComment,
  LineComment,
  CharLiteral,
  WhiteSpace,
  EndOfLine,
  Quote,
  SemiColon,
  LParen,
  RParen,
  LBracket,
  RBracket,
  LCurly,
  RCurly,
  Dot,
  Underscore,
  TimeStampLiteral,
  DateTimeLiteral,
  MiliTimeLiteral,
  NanoTimeLiteral,
  DateLiteral,
  MonthLiteral,
  SecondLiteral,
  MinuteLiteral,
  FloatLiteral,
  BinaryLiteral,
  ByteLiteral,
  IntegerLiteral,
  Infix,
  BinaryColon,
  Colon,
  Keyword,
  Identifier,
];

export const QLexer = new Lexer(QTokens);
