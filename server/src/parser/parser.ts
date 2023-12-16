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

import { CstParser } from "chevrotain";
import { QLexer, QTokens } from "./lexer";
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
  Colon,
  Command,
  Iterator,
  LBracket,
  LCurly,
  LParen,
  Operator,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
} from "./tokens";
import { RSql, Identifier, Keyword, LSql } from "./keywords";

class Parser extends CstParser {
  constructor() {
    super(QTokens, { maxLookahead: 3 });
    this.performSelfAnalysis();
  }

  public script = this.RULE("script", () => {
    this.MANY(() => this.SUBRULE(this.expression));
  });

  private expression = this.RULE("expression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.iterator) },
      { ALT: () => this.SUBRULE(this.assignment) },
      { ALT: () => this.SUBRULE(this.group) },
      { ALT: () => this.SUBRULE(this.lambda) },
      { ALT: () => this.SUBRULE(this.bracket) },
      { ALT: () => this.SUBRULE(this.sql) },
      { ALT: () => this.SUBRULE(this.symbol) },
      { ALT: () => this.SUBRULE(this.command) },
      { ALT: () => this.SUBRULE(this.operator) },
      { ALT: () => this.SUBRULE(this.semiColon) },
    ]);
  });

  private iterator = this.RULE("iterator", () => {
    this.CONSUME(Iterator);
  });

  private assignment = this.RULE("assignment", () => {
    this.OPTION(() => this.SUBRULE(this.operator));
    this.AT_LEAST_ONE(() => this.CONSUME(Colon));
    this.OPTION1(() => this.SUBRULE(this.expression));
  });

  private group = this.RULE("group", () => {
    this.CONSUME(LParen);
    this.OPTION(() => this.SUBRULE(this.bracket));
    this.MANY(() => this.SUBRULE(this.expression));
    this.CONSUME(RParen);
  });

  private lambda = this.RULE("lambda", () => {
    this.CONSUME(LCurly);
    this.OPTION(() => this.SUBRULE(this.bracket));
    this.MANY(() => this.SUBRULE(this.expression));
    this.CONSUME(RCurly);
  });

  private bracket = this.RULE("bracket", () => {
    this.CONSUME(LBracket);
    this.MANY(() => this.SUBRULE(this.expression));
    this.CONSUME(RBracket);
  });

  private sql = this.RULE("sql", () => {
    this.CONSUME(LSql);
    this.MANY(() => this.SUBRULE(this.expression));
    this.CONSUME(RSql);
  });

  private symbol = this.RULE("symbol", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.SUBRULE(this.keyword) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ]);
  });

  private literal = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.charLiteral) },
      { ALT: () => this.SUBRULE(this.symbolLiteral) },
      { ALT: () => this.SUBRULE(this.dateTimeLiteral) },
      { ALT: () => this.SUBRULE(this.timeStampLiteral) },
      { ALT: () => this.SUBRULE(this.dateLiteral) },
      { ALT: () => this.SUBRULE(this.monthLiteral) },
      { ALT: () => this.SUBRULE(this.timeLiteral) },
      { ALT: () => this.SUBRULE(this.fileLiteral) },
      { ALT: () => this.SUBRULE(this.infinityLiteral) },
      { ALT: () => this.SUBRULE(this.binaryLiteral) },
      { ALT: () => this.SUBRULE(this.byteLiteral) },
      { ALT: () => this.SUBRULE(this.numberLiteral) },
    ]);
  });

  private charLiteral = this.RULE("charLiteral", () => {
    this.CONSUME(CharLiteral);
  });

  private symbolLiteral = this.RULE("symbolLiteral", () => {
    this.CONSUME(SymbolLiteral);
  });

  private dateTimeLiteral = this.RULE("dateTimeLiteral", () => {
    this.CONSUME(DateTimeLiteral);
  });

  private timeStampLiteral = this.RULE("timeStampLiteral", () => {
    this.CONSUME(TimeStampLiteral);
  });

  private dateLiteral = this.RULE("dateLiteral", () => {
    this.CONSUME(DateLiteral);
  });

  private monthLiteral = this.RULE("monthLiteral", () => {
    this.CONSUME(MonthLiteral);
  });

  private timeLiteral = this.RULE("timeLiteral", () => {
    this.CONSUME(TimeLiteral);
  });

  private fileLiteral = this.RULE("fileLiteral", () => {
    this.CONSUME(FileLiteral);
  });

  private infinityLiteral = this.RULE("infinityLiteral", () => {
    this.CONSUME(InfinityLiteral);
  });

  private binaryLiteral = this.RULE("binaryLiteral", () => {
    this.CONSUME(BinaryLiteral);
  });

  private byteLiteral = this.RULE("byteLiteral", () => {
    this.CONSUME(ByteLiteral);
  });

  private numberLiteral = this.RULE("numberLiteral", () => {
    this.CONSUME(NumberLiteral);
  });

  private keyword = this.RULE("keyword", () => {
    this.CONSUME(Keyword);
  });

  private identifier = this.RULE("identifier", () => {
    this.CONSUME(Identifier);
  });

  private command = this.RULE("command", () => {
    this.CONSUME(Command);
  });

  private operator = this.RULE("operator", () => {
    this.CONSUME(Operator);
  });

  private semiColon = this.RULE("semiColon", () => {
    this.CONSUME(SemiColon);
  });

  public parse(script: string) {
    const lexed = QLexer.tokenize(script);
    this.input = lexed.tokens;
    return this.script();
  }
}

export const QParser = new Parser();
