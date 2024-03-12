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

export const BlockComment = createToken({
  name: "BlockComment",
  pattern: /(?<!.)\/(?!.)[\s\S]*?(?<!.)\\(?!.)/,
  line_breaks: true,
  group: Lexer.SKIPPED,
});

export const LastComment = createToken({
  name: "LastComment",
  pattern: /(?<!.)\\[ \t]*(?!.)[\s\S]*/,
  line_breaks: true,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /(?:(?<=[ \t])|(?<!.))\/.*/,
  line_breaks: false,
  group: Lexer.SKIPPED,
});

export const Command = createToken({
  name: "Command",
  pattern:
    /\\(?:cd|ts|[abBcCdefglopPrsStTuvwWxz12_\\])[\s\S]*?(?:(?<!;[ \t]*)\r?\n(?![ \t])|;)/,
});

export const SemiColon = createToken({
  name: "SemiColon",
  pattern: /(?:(?<!;[ \t]*)\r?\n(?![ \t])|;)/,
  line_breaks: true,
});

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /[ \t]+/,
  group: Lexer.SKIPPED,
});

export const Iterator = createToken({
  name: "Iterator",
  pattern: /[\\'/]:/,
});

export const Operator = createToken({
  name: "Operator",
  pattern: /[_.,'^<=>?!#@$&~|%*+-]/,
});

export const Colon = createToken({
  name: "Colon",
  pattern: /:/,
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
