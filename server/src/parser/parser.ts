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
import { Keyword } from "./keywords";
import { QLexer, QTokens } from "./lexer";
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
  SymbolLiteral,
  TimeStampLiteral,
} from "./literals";
import {
  Colon,
  Command,
  DoubleColon,
  DynamicLoad,
  EndOfLine,
  Identifier,
  LBracket,
  LCurly,
  LParen,
  Operator,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
} from "./tokens";

class Parser extends CstParser {
  constructor() {
    super(QTokens, { recoveryEnabled: true });
    this.performSelfAnalysis();
  }

  public script = this.RULE("script", () => {
    this.MANY(() => this.SUBRULE(this.entity));
  });

  private entity = this.RULE("entity", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.dynamicLoad) },
      { ALT: () => this.SUBRULE(this.doubleColon) },
      { ALT: () => this.SUBRULE(this.command) },
      { ALT: () => this.SUBRULE(this.endOfLine) },
      { ALT: () => this.SUBRULE(this.charLiteral) },
      { ALT: () => this.SUBRULE(this.symbolLiteral) },
      { ALT: () => this.SUBRULE(this.timeStampLiteral) },
      { ALT: () => this.SUBRULE(this.dateTimeLiteral) },
      { ALT: () => this.SUBRULE(this.miliTimeLiteral) },
      { ALT: () => this.SUBRULE(this.nanoTimeLiteral) },
      { ALT: () => this.SUBRULE(this.dateLiteral) },
      { ALT: () => this.SUBRULE(this.monthLiteral) },
      { ALT: () => this.SUBRULE(this.secondLiteral) },
      { ALT: () => this.SUBRULE(this.minuteLiteral) },
      { ALT: () => this.SUBRULE(this.floatLiteral) },
      { ALT: () => this.SUBRULE(this.binaryLiteral) },
      { ALT: () => this.SUBRULE(this.byteLiteral) },
      { ALT: () => this.SUBRULE(this.integerLiteral) },
      { ALT: () => this.SUBRULE(this.keyword) },
      { ALT: () => this.SUBRULE(this.identifier) },
      { ALT: () => this.SUBRULE(this.operator) },
      { ALT: () => this.SUBRULE(this.semiColon) },
      { ALT: () => this.SUBRULE(this.colon) },
      { ALT: () => this.SUBRULE(this.lparen) },
      { ALT: () => this.SUBRULE(this.rparen) },
      { ALT: () => this.SUBRULE(this.lbracket) },
      { ALT: () => this.SUBRULE(this.rbracket) },
      { ALT: () => this.SUBRULE(this.lcurly) },
      { ALT: () => this.SUBRULE(this.rcurly) },
    ]);
  });

  private dynamicLoad = this.RULE("dynamicLoad", () => {
    this.CONSUME(DynamicLoad);
  });

  private command = this.RULE("command", () => {
    this.CONSUME(Command);
  });

  private charLiteral = this.RULE("charLiteral", () => {
    this.CONSUME(CharLiteral);
  });

  private symbolLiteral = this.RULE("symbolLiteral", () => {
    this.CONSUME(SymbolLiteral);
  });

  private timeStampLiteral = this.RULE("timeStampLiteral", () => {
    this.CONSUME(TimeStampLiteral);
  });

  private dateTimeLiteral = this.RULE("dateTimeLiteral", () => {
    this.CONSUME(DateTimeLiteral);
  });

  private miliTimeLiteral = this.RULE("miliTimeLiteral", () => {
    this.CONSUME(MiliTimeLiteral);
  });

  private nanoTimeLiteral = this.RULE("nanoTimeLiteral", () => {
    this.CONSUME(NanoTimeLiteral);
  });

  private dateLiteral = this.RULE("dateLiteral", () => {
    this.CONSUME(DateLiteral);
  });

  private monthLiteral = this.RULE("monthLiteral", () => {
    this.CONSUME(MonthLiteral);
  });

  private secondLiteral = this.RULE("secondLiteral", () => {
    this.CONSUME(SecondLiteral);
  });

  private minuteLiteral = this.RULE("minuteLiteral", () => {
    this.CONSUME(MinuteLiteral);
  });

  private floatLiteral = this.RULE("floatLiteral", () => {
    this.CONSUME(FloatLiteral);
  });

  private binaryLiteral = this.RULE("binaryLiteral", () => {
    this.CONSUME(BinaryLiteral);
  });

  private byteLiteral = this.RULE("byteLiteral", () => {
    this.CONSUME(ByteLiteral);
  });

  private integerLiteral = this.RULE("integerLiteral", () => {
    this.CONSUME(IntegerLiteral);
  });

  private keyword = this.RULE("keyword", () => {
    this.CONSUME(Keyword);
  });

  private identifier = this.RULE("identifier", () => {
    this.CONSUME(Identifier);
  });

  private endOfLine = this.RULE("endOfLine", () => {
    this.CONSUME(EndOfLine);
  });

  private doubleColon = this.RULE("doubleColon", () => {
    this.CONSUME(DoubleColon);
  });

  private operator = this.RULE("operator", () => {
    this.CONSUME(Operator);
  });

  private semiColon = this.RULE("semiColon", () => {
    this.CONSUME(SemiColon);
  });

  private colon = this.RULE("colon", () => {
    this.CONSUME(Colon);
  });

  private lparen = this.RULE("lparen", () => {
    this.CONSUME(LParen);
  });

  private rparen = this.RULE("rparen", () => {
    this.CONSUME(RParen);
  });

  private lcurly = this.RULE("lcurly", () => {
    this.CONSUME(LCurly);
  });

  private rcurly = this.RULE("rcurly", () => {
    this.CONSUME(RCurly);
  });

  private lbracket = this.RULE("lbracket", () => {
    this.CONSUME(LBracket);
  });

  private rbracket = this.RULE("rbracket", () => {
    this.CONSUME(RBracket);
  });

  public parse(script: string) {
    const lexed = QLexer.tokenize(script);
    this.input = lexed.tokens;
    return this.script();
  }
}

export const QParser = new Parser();
