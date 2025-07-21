/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import { TokenType } from "chevrotain";
import { writeFileSync } from "fs";
import { resolve } from "path";

import { Control, Identifier, Keyword, Reserved } from "./keywords";
import {
  BinaryLiteral,
  ByteLiteral,
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
  CommentEnd,
  ExitCommentBegin,
  CommentBegin,
  StringEnd,
  StringBegin,
  TestBegin,
} from "./ranges";
import {
  Colon,
  Command,
  Comparator,
  DoubleColon,
  Iterator,
  LineComment,
  Operator,
  Documentation,
  SemiColon,
  StringEscape,
  TestBlock,
  TestLambdaBlock,
  Cond,
  CutDrop,
} from "./tokens";

const includes = [
  {
    include: "#ranges",
  },
  {
    include: "#literals",
  },
  {
    include: "#keywords",
  },
  {
    include: "#tokens",
  },
];

const quke = {
  patterns: [
    {
      begin: _(TestBegin),
      captures: {
        1: {
          name: "support.function.q",
        },
        2: {
          name: "string.quoted.q",
        },
      },
      patterns: [
        ...[TestBlock, TestLambdaBlock].map((block) => ({
          match: _(block),
          captures: {
            1: {
              name: "support.function.q",
            },
            2: {
              name: "string.quoted.q",
            },
          },
        })),
        ...includes,
      ],
    },
  ],
};

const repository = {
  quke,
  ranges: {
    patterns: [
      {
        name: "comment.block.q",
        begin: _(CommentBegin),
        end: _(CommentEnd),
      },
      {
        name: "comment.exit.q",
        begin: _(ExitCommentBegin),
      },
      {
        name: "comment.line.q",
        match: _(Documentation),
        captures: {
          1: {
            name: "keyword.other.qdoc",
          },
        },
      },
      {
        name: "comment.line.q",
        match: _(LineComment),
      },
      {
        name: "string.quoted.q",
        begin: _(StringBegin),
        end: _(StringEnd),
        patterns: [
          {
            name: "constant.character.escape.q",
            match: _(StringEscape),
          },
        ],
      },
    ],
  },
  literals: {
    patterns: [
      {
        name: "support.type.symbol.q",
        match: _(SymbolLiteral),
      },
      {
        name: "constant.numeric.datetime.q",
        match: _(DateTimeLiteral),
      },
      {
        name: "constant.numeric.timestamp.q",
        match: _(TimeStampLiteral),
      },
      {
        name: "constant.numeric.date.q",
        match: _(DateLiteral),
      },
      {
        name: "constant.numeric.month.q",
        match: _(MonthLiteral),
      },
      {
        name: "constant.numeric.time.q",
        match: _(TimeLiteral),
      },
      {
        name: "constant.language.infinity.q",
        match: _(InfinityLiteral),
      },
      {
        name: "constant.numeric.binary.q",
        match: _(BinaryLiteral),
      },
      {
        name: "constant.numeric.byte.q",
        match: _(ByteLiteral),
      },
      {
        name: "constant.numeric.number.q",
        match: _(NumberLiteral),
      },
    ],
  },
  keywords: {
    patterns: [
      {
        name: "keyword.control.q",
        match: `${_(Control)}\\b`,
      },
      {
        name: "keyword.other.reserved.q",
        match: `${_(Reserved)}\\b`,
      },
      {
        name: "keyword.other.q",
        match: `${_(Keyword)}\\b`,
      },
      {
        name: "variable.other.q",
        match: `${_(Identifier)}\\b`,
      },
    ],
  },
  tokens: {
    patterns: [
      {
        name: "constant.character.q",
        match: _(Command),
      },
      {
        name: "keyword.other.iterator.q",
        match: _(Iterator),
      },
      {
        name: "keyword.operator.arithmetic.q",
        match: _(Comparator),
      },
      {
        name: "punctuation.assignment.q",
        match: _(DoubleColon),
      },
      {
        name: "keyword.operator.arithmetic.q",
        match: _(CutDrop),
      },
      {
        name: "keyword.operator.arithmetic.q",
        match: _(Operator),
      },
      {
        name: "keyword.operator.arithmetic.q",
        match: _(Cond),
      },
      {
        name: "punctuation.assignment.q",
        match: _(Colon),
      },
      {
        name: "punctuation.terminator.statement.q",
        match: _(SemiColon),
      },
    ],
  },
};

const language = {
  description:
    "TextMate grammar for q, quke and qdoc. This file is auto generated DO NOT EDIT",
  name: "q",
  scopeName: "source.q",
  patterns: [
    {
      include: "#quke",
    },
    ...includes,
  ],
  repository,
};

function _(token: TokenType | RegExp) {
  const pattern = "PATTERN" in token ? `${token.PATTERN}` : `${token}`;
  const index = pattern.lastIndexOf("/");
  const options = pattern.slice(index + 1);
  const result = pattern.slice(1, index);
  return options ? `(?${options})${result}` : result;
}

export function generateTextMateGrammar() {
  const grammar = JSON.stringify(language, null, 2);
  writeFileSync(
    resolve(__dirname, "../".repeat(4), "syntaxes", "q.tmLanguage.json"),
    grammar,
  );
  return grammar;
}
