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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import { CstNode } from "chevrotain";
import { QParser } from "./parser";

const BaseQVisitor = QParser.getBaseCstVisitorConstructorWithDefaults();

class QVisitor extends BaseQVisitor {
  readonly symbols: Entity[] = [];
  private scopes: Entity[] = [];

  constructor() {
    super();
    this.validateVisitor();
  }

  private get scope() {
    const size = this.scopes.length;
    return size === 0 ? undefined : this.scopes[size - 1];
  }

  createEntity(entity: Partial<Entity>): Entity {
    return {
      type: entity.type || EntityType.IDENTIFIER,
      image: entity.image || "",
      startOffset: entity.startOffset || 0,
      endOffset: (entity.endOffset || 0) + 1,
      scope: this.scope,
    };
  }

  script(ctx: any) {
    ctx.statement?.forEach((rule: any) => this.visit(rule));
  }

  statement(ctx: any) {
    ctx.expression?.forEach((rule: any) => this.visit(rule));
    ctx.terminate?.forEach((rule: any) => this.visit(rule));
  }

  expression(ctx: any) {
    ctx.literal?.forEach((rule: any) => this.visit(rule));
    ctx.keyword?.forEach((rule: any) => this.visit(rule));
    ctx.list?.forEach((rule: any) => this.visit(rule));
    ctx.lambda?.forEach((rule: any) => this.visit(rule));
    ctx.bracket?.forEach((rule: any) => this.visit(rule));
    ctx.assignment?.forEach((rule: any) => this.visit(rule));
    ctx.identifier?.forEach((rule: any) => this.visit(rule));
  }

  list(ctx: any) {
    const entity = this.createEntity({
      type: EntityType.LIST,
      startOffset: ctx.LParen[0].startOffset,
      endOffset: ctx.RParen[0].endOffset,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
    ctx.expression?.forEach((rule: any) => this.visit(rule));
    this.scopes.pop();
  }

  lambda(ctx: any) {
    const entity = this.createEntity({
      type: EntityType.LAMBDA,
      startOffset: ctx.LCurly[0].startOffset,
      endOffset: ctx.RCurly[0].endOffset,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
    ctx.bracket?.forEach((rule: any) => this.visit(rule));
    ctx.expression?.forEach((rule: any) => this.visit(rule));
    this.scopes.pop();
  }

  bracket(ctx: any) {
    const entity = this.createEntity({
      type: EntityType.BRACKET,
      startOffset: ctx.LBracket[0].startOffset,
      endOffset: ctx.RBracket[0].endOffset,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
    ctx.expression?.forEach((rule: any) => this.visit(rule));
    this.scopes.pop();
  }

  assignment(ctx: any) {
    const entity = this.createEntity({
      type: EntityType.ASSIGNMENT,
      startOffset: ctx.Colon[0].startOffset,
      endOffset: ctx.Colon[0].endOffset,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
    ctx.expression?.forEach((rule: any) => this.visit(rule));
    this.scopes.pop();
  }

  identifier(ctx: any) {
    const entity = this.createEntity({
      ...ctx.Identifier[0],
      type: EntityType.IDENTIFIER,
    });
    this.symbols.push(entity);
  }

  keyword(ctx: any) {
    const entity = this.createEntity({
      ...(ctx.Keyword || ctx.Underscore || ctx.Dot || ctx.BinaryColon)[0],
      type: EntityType.KEYWORD,
    });
    this.symbols.push(entity);
  }

  literal(ctx: any) {
    let type: EntityType;
    let item: any;

    if (ctx.CharLiteral) {
      type = EntityType.CHAR_LITERAL;
      item = ctx.CharLiteral;
    } else if (ctx.SymbolLiteral) {
      type = EntityType.SYMBOL_LITERAL;
      item = ctx.SymbolLiteral;
    } else if (ctx.TimeStampLiteral) {
      type = EntityType.TIMESTAMP_LITERAL;
      item = ctx.TimeStampLiteral;
    } else if (ctx.DateTimeLiteral) {
      type = EntityType.DATETIME_LITERAL;
      item = ctx.DateTimeLiteral;
    } else if (ctx.MiliTimeLiteral) {
      type = EntityType.MILITIME_LITERAL;
      item = ctx.MiliTimeLiteral;
    } else if (ctx.NanoTimeLiteral) {
      type = EntityType.NANOTIME_LITERAL;
      item = ctx.NanoTimeLiteral;
    } else if (ctx.DateLiteral) {
      type = EntityType.DATE_LITERAL;
      item = ctx.DateLiteral;
    } else if (ctx.MonthLiteral) {
      type = EntityType.MONTH_LITERAL;
      item = ctx.MonthLiteral;
    } else if (ctx.SecondLiteral) {
      type = EntityType.SECOND_LITERAL;
      item = ctx.SecondLiteral;
    } else if (ctx.MinuteLiteral) {
      type = EntityType.MINUTE_LITERAL;
      item = ctx.MinuteLiteral;
    } else if (ctx.FloatLiteral) {
      type = EntityType.FLOAT_LITERAL;
      item = ctx.FloatLiteral;
    } else if (ctx.BinaryLiteral) {
      type = EntityType.BINARY_LITERAL;
      item = ctx.BinaryLiteral;
    } else if (ctx.ByteLiteral) {
      type = EntityType.BYTE_LITERAL;
      item = ctx.ByteLiteral;
    } else if (ctx.IntegerLiteral) {
      type = EntityType.INTEGER_LITERAL;
      item = ctx.IntegerLiteral;
    } else {
      type = EntityType.LITERAL;
    }

    if (item) {
      const entity = this.createEntity({
        ...item[0],
        type,
      });
      this.symbols.push(entity);
    }
  }

  terminate(ctx: any) {
    if (ctx.EndOfLine) {
      const entity = this.createEntity({
        ...ctx.EndOfLine[0],
        type: EntityType.EOL,
      });
      this.symbols.push(entity);
    }
  }
}

export enum EntityType {
  EOL = "EOL",
  LIST = "LIST",
  LAMBDA = "LAMBDA",
  BRACKET = "BRACKET",
  ASSIGNMENT = "ASSIGNMENT",
  IDENTIFIER = "IDENTIFIER",
  KEYWORD = "KEYWORD",
  LITERAL = "LITERAL",
  CHAR_LITERAL = "CHAR_LITERAL",
  SYMBOL_LITERAL = "SYMBOL_LITERAL",
  TIMESTAMP_LITERAL = "TIMESTAMP_LITERAL",
  DATETIME_LITERAL = "DATETIME_LITERAL",
  MILITIME_LITERAL = "MILITIME_LITERAL",
  NANOTIME_LITERAL = "NANOTIME_LITERAL",
  DATE_LITERAL = "DATE_LITERAL",
  MONTH_LITERAL = "MONTH_LITERAL",
  SECOND_LITERAL = "SECOND_LITERAL",
  MINUTE_LITERAL = "MINUTE_LITERAL",
  FLOAT_LITERAL = "FLOAT_LITERAL",
  BINARY_LITERAL = "BINARY_LITERAL",
  BYTE_LITERAL = "BYTE_LITERAL",
  INTEGER_LITERAL = "INTEGER_LITERAL",
}

export interface Entity {
  type: EntityType;
  image: string;
  startOffset: number;
  endOffset: number;
  scope?: Entity;
}

export interface QAst {
  symbols: Entity[];
}

export function getSymbolScope(entity: Entity) {
  let scope;
  while ((scope = entity.scope)) {
    if (scope.type === EntityType.LAMBDA) {
      break;
    }
  }
  return scope;
}

export function analyze(cstNode: CstNode | CstNode[]): QAst {
  const visitor = new QVisitor();
  visitor.visit(cstNode);
  return { symbols: visitor.symbols };
}
