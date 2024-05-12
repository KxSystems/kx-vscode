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
import { RSql, Identifier, Keyword, LSql, Reserved, System } from "./keywords";
import {
  BinaryLiteral,
  ByteLiteral,
  CharLiteral,
  DateLiteral,
  DateTimeLiteral,
  InfinityLiteral,
  MonthLiteral,
  NumberLiteral,
  SymbolLiteral,
  TimeLiteral,
  TimeStampLiteral,
} from "./literals";
import {
  Colon,
  Command,
  Comparator,
  DoubleColon,
  EndOfLine,
  Iterator,
  LBracket,
  LCurly,
  LParen,
  LineComment,
  Operator,
  Documentation,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  WhiteSpace,
  StringEscape,
} from "./tokens";
import {
  After,
  AfterEach,
  Baseline,
  Before,
  BeforeEach,
  Behaviour,
  Bench,
  Expect,
  Feature,
  Property,
  Replicate,
  Setup,
  Should,
  SkipIf,
  Teardown,
  TimeLimit,
  ToMatch,
  Tolerance,
} from "./quke";
import {
  CommentEnd,
  ExitCommentBegin,
  CommentBegin,
  StringEnd,
  StringBegin,
  QukeBegin,
} from "./ranges";

const Language = [
  Command,
  EndOfLine,
  WhiteSpace,
  SymbolLiteral,
  DateTimeLiteral,
  TimeStampLiteral,
  DateLiteral,
  MonthLiteral,
  TimeLiteral,
  InfinityLiteral,
  BinaryLiteral,
  ByteLiteral,
  NumberLiteral,
  System,
  LSql,
  RSql,
  Keyword,
  Reserved,
  Identifier,
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

const Quke = [
  AfterEach,
  After,
  Baseline,
  BeforeEach,
  Before,
  Behaviour,
  Bench,
  Expect,
  Feature,
  Property,
  Replicate,
  Setup,
  Should,
  SkipIf,
  Teardown,
  TimeLimit,
  Tolerance,
  ToMatch,
];

export const QLexer = new Lexer(
  {
    defaultMode: "q_mode",
    modes: {
      q_mode: [
        CommentBegin,
        ExitCommentBegin,
        Documentation,
        LineComment,
        StringBegin,
        QukeBegin,
        ...Language,
      ],
      quke_mode: [
        CommentBegin,
        ExitCommentBegin,
        Documentation,
        LineComment,
        StringBegin,
        ...Quke,
        ...Language,
      ],
      string_mode: [
        StringEscape,
        StringEnd,
        EndOfLine,
        WhiteSpace,
        CharLiteral,
      ],
      comment_mode: [CommentEnd, EndOfLine, WhiteSpace, CharLiteral],
      exit_comment_mode: [EndOfLine, WhiteSpace, CharLiteral],
    },
  },
  { safeMode: true },
);
