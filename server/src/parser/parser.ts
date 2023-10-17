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
  Colon,
  Dot,
  EndOfLine,
  Identifier,
  Infix,
  Keyword,
  LBracket,
  LCurly,
  LParen,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  Underscore,
} from "./tokens";

class Parser extends CstParser {
  constructor() {
    super(QTokens, { recoveryEnabled: true });
    this.performSelfAnalysis();
  }

  public script = this.RULE("script", () => {
    this.MANY(() => this.SUBRULE(this.statement));
  });

  private statement = this.RULE("statement", () => {
    this.MANY(() => this.SUBRULE(this.expression));
    this.SUBRULE(this.terminate);
  });

  private terminate = this.RULE("terminate", () => {
    this.OR([
      { ALT: () => this.CONSUME(EndOfLine) },
      { ALT: () => this.CONSUME(SemiColon) },
    ]);
  });

  private expression = this.RULE("expression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.literal) },
      { ALT: () => this.SUBRULE(this.keyword) },
      { ALT: () => this.SUBRULE(this.list) },
      { ALT: () => this.SUBRULE(this.lambda) },
      { ALT: () => this.SUBRULE(this.bracket) },
      { ALT: () => this.SUBRULE(this.assignment) },
      { ALT: () => this.SUBRULE(this.infix) },
      { ALT: () => this.SUBRULE(this.identifier) },
    ]);
  });

  private list = this.RULE("list", () => {
    this.CONSUME(LParen);
    this.MANY_SEP({
      SEP: SemiColon,
      DEF: () => this.MANY(() => this.SUBRULE(this.expression)),
    });
    this.CONSUME(RParen);
  });

  private lambda = this.RULE("lambda", () => {
    this.CONSUME(LCurly);
    this.OPTION(() => this.SUBRULE(this.bracket));
    this.MANY_SEP({
      SEP: SemiColon,
      DEF: () => this.MANY(() => this.SUBRULE(this.expression)),
    });
    this.CONSUME(RCurly);
  });

  private bracket = this.RULE("bracket", () => {
    this.CONSUME(LBracket);
    this.MANY_SEP({
      SEP: SemiColon,
      DEF: () => this.MANY(() => this.SUBRULE(this.expression)),
    });
    this.CONSUME(RBracket);
  });

  private assignment = this.RULE("assignment", () => {
    this.OPTION(() => this.SUBRULE(this.infix));
    this.CONSUME(Colon);
    this.SUBRULE(this.expression);
  });

  private infix = this.RULE("infix", () => {
    this.CONSUME(Infix);
  });

  private literal = this.RULE("literal", () => {
    this.OR([
      { ALT: () => this.CONSUME(CharLiteral) },
      { ALT: () => this.CONSUME(TimeStampLiteral) },
      { ALT: () => this.CONSUME(DateTimeLiteral) },
      { ALT: () => this.CONSUME(MiliTimeLiteral) },
      { ALT: () => this.CONSUME(NanoTimeLiteral) },
      { ALT: () => this.CONSUME(DateLiteral) },
      { ALT: () => this.CONSUME(MonthLiteral) },
      { ALT: () => this.CONSUME(SecondLiteral) },
      { ALT: () => this.CONSUME(MinuteLiteral) },
      { ALT: () => this.CONSUME(FloatLiteral) },
      { ALT: () => this.CONSUME(BinaryLiteral) },
      { ALT: () => this.CONSUME(ByteLiteral) },
      { ALT: () => this.CONSUME(IntegerLiteral) },
    ]);
  });

  private keyword = this.RULE("keyword", () => {
    this.OR([
      { ALT: () => this.CONSUME(Keyword) },
      { ALT: () => this.CONSUME(Underscore) },
      { ALT: () => this.CONSUME(Dot) },
      { ALT: () => this.CONSUME(BinaryColon) },
    ]);
  });

  private identifier = this.RULE("identifier", () => {
    this.CONSUME(Identifier);
  });

  public parse(script: string) {
    const lexed = QLexer.tokenize(script);
    this.input = lexed.tokens;
    return this.script();
  }
}

export const QParser = new Parser();
