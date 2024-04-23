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
import { RSql, Identifier, Keyword, LSql, Reserved } from "./keywords";
import {
  BinaryLiteral,
  ByteLiteral,
  CharLiteral,
  DateLiteral,
  DateTimeLiteral,
  FileLiteral,
  InfinityLiteral,
  MonthLiteral,
  NumberLiteral,
  SymbolLiteral,
  TimeLiteral,
  TimeStampLiteral,
} from "./literals";
import {
  BlockComment,
  Colon,
  Command,
  Comparator,
  DoubleColon,
  Iterator,
  LastComment,
  LBracket,
  LCurly,
  LineComment,
  LParen,
  Operator,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  WhiteSpace,
} from "./tokens";

export const QTokens = [
  BlockComment,
  LastComment,
  LineComment,
  CharLiteral,
  Command,
  SymbolLiteral,
  DateTimeLiteral,
  TimeStampLiteral,
  DateLiteral,
  MonthLiteral,
  TimeLiteral,
  FileLiteral,
  InfinityLiteral,
  BinaryLiteral,
  ByteLiteral,
  NumberLiteral,
  LSql,
  RSql,
  Keyword,
  Reserved,
  Identifier,
  WhiteSpace,
  Iterator,
  DoubleColon,
  Operator,
  Comparator,
  Colon,
  SemiColon,
  LParen,
  RParen,
  LBracket,
  RBracket,
  LCurly,
  RCurly,
];

export const QLexer = new Lexer(QTokens, { safeMode: true });
