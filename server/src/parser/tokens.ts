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
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /(?:(?<=\r?\n|[ \t])|(?<!.))\/.*/,
  longer_alt: BlockComment,
  group: Lexer.SKIPPED,
});

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /(?:\r?\n)*[ \t]+/,
  group: Lexer.SKIPPED,
});

export const EndOfLine = createToken({
  name: "EndOfLine",
  pattern: /\r?\n/,
});

export const SemiColon = createToken({
  name: "SemiColon",
  pattern: /;/,
});

export const Quote = createToken({
  name: "Quote",
  pattern: /"/,
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

export const Identifier = createToken({
  name: "Identifier",
  pattern: /(?:\.[A-Za-z][A-Za-z_0-9.]*(?<!\.)|[A-Za-z][A-Za-z_0-9]*)/,
});

export const Dot = createToken({
  name: "Dot",
  pattern: /\./,
  longer_alt: Identifier,
});

export const Underscore = createToken({
  name: "Underscore",
  pattern: /_/,
  longer_alt: Identifier,
});

export const Infix = createToken({
  name: "Infix",
  pattern: /[,%*+-]/,
});

// TODO
export const BinaryColon = createToken({
  name: "BinaryColon",
  pattern: /['/\\:012]:/,
});

export const Colon = createToken({
  name: "Colon",
  pattern: /:/,
  longer_alt: [
    BinaryColon,
    MiliTimeLiteral,
    NanoTimeLiteral,
    DateTimeLiteral,
    TimeStampLiteral,
    SecondLiteral,
    MinuteLiteral,
  ],
});

export const Keyword = createToken({
  name: "Keyword",
  pattern:
    /(?:do|exit|if|while|getenv|gtime|ltime|setenv|eval|parse|reval|show|system|value|dsave|get|hclose|hcount|hdel|hopen|hsym|load|read0|read1|rload|rsave|save|set|each|over|peach|prior|scan|aj|aj0|ajf|ajf0|asof|ej|ij|ijf|lj|ljf|pj|uj|ujf|wj|wj1|count|cross|cut|enlist|except|fills|first|flip|group|in|inter|last|mcount|next|prev|raze|reverse|rotate|sublist|sv|til|union|vs|where|xprev|all|and|any|not|or|abs|acos|asin|atan|avg|avgs|ceiling|cor|cos|cov|deltas|dev|div|ema|exp|floor|inv|log|lsq|mavg|max|maxs|mdev|med|min|mins|mmax|mmin|mmu|mod|msum|neg|prd|prds|rand|ratios|reciprocal|scov|sdev|signum|sin|sqrt|sum|sums|svar|tan|var|wavg|within|wsum|xexp|xlog|attr|null|tables|type|view|views|delete|exec|fby|from|select|update|asc|bin|binr|desc|differ|distinct|iasc|idesc|rank|xbar|xrank|cols|csv|fkeys|insert|key|keys|meta|ungroup|upsert|xasc|xcol|xcols|xdesc|xgroup|xkey|like|lower|ltrim|md5|rtrim|ss|ssr|string|trim|upper)/,
  longer_alt: Identifier,
});
