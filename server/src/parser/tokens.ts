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

export const TestBlock = createToken({
  name: "TestBlock",
  pattern:
    /(?<!.)[ \t]*(x?(?:before each|after each|behaviour|baseline|teardown|property|to match|skip if|expect|before|after|setup|replicate|timelimit|tolerance|feature|should|bench))\b(.*)/i,
});

export const Documentation = createToken({
  name: "Documentation",
  pattern:
    /(?:(?<=[ \t])|(?<!.))\/{1,2}[ \t]*(@(?:default-subcategory|default-category|file[oO]verview|subcategory|deprecated|overview|category|doctest|example|private|typedef|returns?|throws|author|param|kind|name|todo|desc|see|end))\b.*/,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /(?:(?<=[ \t])|(?<!.))\/.*/,
});

export const Command = createToken({
  name: "Command",
  pattern: /(?<!.)\\(?:cd|ts|[abBcCdefglopPrsStTuvwWxz12_\\]).*/,
});

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /[ \t]+/,
  line_breaks: true,
});

export const EndOfLine = createToken({
  name: "EndOfLine",
  pattern: /(?:\r?\n)+/,
  line_breaks: true,
});

export const Table = createToken({
  name: "Table",
  pattern: /\(\s*\[\s*\]/,
  line_breaks: true,
});

export const StringEscape = createToken({
  name: "StringEscape",
  pattern: /\\([0-9]{3}|.{1})/,
});

export const Iterator = createToken({
  name: "Iterator",
  pattern: /[\\'/]:/,
});

export const DoubleColon = createToken({
  name: "DoubleColon",
  pattern: /::/,
});

export const Comparator = createToken({
  name: "Comparator",
  pattern: /(?:<=|>=|<>|[>=<~])/,
});

export const Operator = createToken({
  name: "Operator",
  pattern: /[\\.,'|^?!#@$&_%*+-]/,
});

export const Colon = createToken({
  name: "Colon",
  pattern: /:/,
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
