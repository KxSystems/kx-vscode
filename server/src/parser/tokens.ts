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

import { Lexer, createToken } from "chevrotain";
import {
  DateTimeLiteral,
  MiliTimeLiteral,
  MinuteLiteral,
  NanoTimeLiteral,
  SecondLiteral,
  TimeStampLiteral,
} from "./literals";

export const BlockComment = createToken({
  name: "BlockComment",
  pattern: /(?<=(\r?\n|[ \t]*))\/(?:[ \t]*\r?\n)[^\\]*\\?/,
  line_breaks: true,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /(?:(?<=\r?\n|[ \t])|(?<!.))\/.*/,
  line_breaks: true,
  longer_alt: BlockComment,
  group: Lexer.SKIPPED,
});

export const EndOfLine = createToken({
  name: "EndOfLine",
  pattern: /\r?\n/,
  line_breaks: true,
});

export const Identifier = createToken({
  name: "Identifier",
  pattern: /(?:\.[A-Za-z][A-Za-z_0-9.]*(?<!\.)|[A-Za-z][A-Za-z_0-9]*)/,
  line_breaks: false,
});

export const DoubleColon = createToken({
  name: "DoubleColon",
  pattern: /::/,
});

export const DynamicLoad = createToken({
  name: "DynamicLoad",
  pattern: /[\\'/012]:/,
});

export const Command = createToken({
  name: "Command",
  pattern: /\\(?:cd|ts|[abBcCdefglopPrsStTuvwWxz12_\\])/,
  longer_alt: DynamicLoad,
});

export const Colon = createToken({
  name: "Colon",
  pattern: /:/,
  longer_alt: [
    DynamicLoad,
    DoubleColon,
    MiliTimeLiteral,
    NanoTimeLiteral,
    DateTimeLiteral,
    TimeStampLiteral,
    SecondLiteral,
    MinuteLiteral,
  ],
});

export const Operator = createToken({
  name: "Operator",
  pattern: /[_.,'^<=>?!#@$&~|%*+-]/,
});

export const SemiColon = createToken({
  name: "SemiColon",
  pattern: /;/,
});

export const LParen = createToken({
  name: "LParen",
  pattern: /\(/,
});

export const RParen = createToken({
  name: "RParen",
  pattern: /\)/,
});

export const LBracket = createToken({
  name: "LBracket",
  pattern: /\[/,
});

export const RBracket = createToken({
  name: "RBracket",
  pattern: /]/,
});

export const LCurly = createToken({
  name: "LCurly",
  pattern: /{/,
});

export const RCurly = createToken({
  name: "RCurly",
  pattern: /}/,
});
