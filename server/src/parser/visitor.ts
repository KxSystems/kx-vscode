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

  private createEntity(entity: Partial<Entity>): Entity {
    return {
      type: entity.type || EntityType.UNKNOWN,
      image: entity.image || "",
      startOffset: entity.startOffset || 0,
      endOffset: (entity.endOffset || 0) + 1,
      scope: this.scope,
    };
  }

  script(ctx: any) {
    ctx.entity?.forEach((rule: any) => this.visit(rule));
  }

  entity(ctx: any) {
    ctx.doubleColon?.forEach((rule: any) => this.visit(rule));
    ctx.command?.forEach((rule: any) => this.visit(rule));
    ctx.endOfLine?.forEach((rule: any) => this.visit(rule));
    ctx.charLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.symbolLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.timeStampLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.dateTimeLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.miliTimeLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.nanoTimeLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.dateLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.monthLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.secondLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.minuteLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.floatLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.binaryLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.byteLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.integerLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.keyword?.forEach((rule: any) => this.visit(rule));
    ctx.identifier?.forEach((rule: any) => this.visit(rule));
    ctx.operator?.forEach((rule: any) => this.visit(rule));
    ctx.semiColon?.forEach((rule: any) => this.visit(rule));
    ctx.colon?.forEach((rule: any) => this.visit(rule));
    ctx.lparen?.forEach((rule: any) => this.visit(rule));
    ctx.rparen?.forEach((rule: any) => this.visit(rule));
    ctx.lbracket?.forEach((rule: any) => this.visit(rule));
    ctx.rbracket?.forEach((rule: any) => this.visit(rule));
    ctx.lcurly?.forEach((rule: any) => this.visit(rule));
    ctx.rcurly?.forEach((rule: any) => this.visit(rule));
  }

  doubleColon(ctx: any) {
    const entity = this.createEntity({
      ...ctx.DoubleColon[0],
      type: EntityType.DOUBLE_COLON,
    });
    this.symbols.push(entity);
  }

  command(ctx: any) {
    const entity = this.createEntity({
      ...ctx.Command[0],
      type: EntityType.COMMAND,
    });
    this.symbols.push(entity);
  }

  endOfLine(ctx: any) {
    const entity = this.createEntity({
      ...ctx.EndOfLine[0],
      type: EntityType.ENDOFLINE,
    });
    this.symbols.push(entity);
  }

  charLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.CharLiteral[0],
      type: EntityType.CHAR_LITERAL,
    });
    this.symbols.push(entity);
  }

  symbolLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.SymbolLiteral[0],
      type: EntityType.SYMBOL_LITERAL,
    });
    this.symbols.push(entity);
  }

  timeStampLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.TimeStampLiteral[0],
      type: EntityType.TIMESTAMP_LITERAL,
    });
    this.symbols.push(entity);
  }

  dateTimeLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.DateTimeLiteral[0],
      type: EntityType.DATETIME_LITERAL,
    });
    this.symbols.push(entity);
  }

  miliTimeLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.MiliTimeLiteral[0],
      type: EntityType.MILITIME_LITERAL,
    });
    this.symbols.push(entity);
  }

  nanoTimeLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.NanoTimeLiteral[0],
      type: EntityType.NANOTIME_LITERAL,
    });
    this.symbols.push(entity);
  }

  dateLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.DateLiteral[0],
      type: EntityType.DATE_LITERAL,
    });
    this.symbols.push(entity);
  }

  monthLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.MonthLiteral[0],
      type: EntityType.MONTH_LITERAL,
    });
    this.symbols.push(entity);
  }

  secondLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.SecondLiteral[0],
      type: EntityType.SECOND_LITERAL,
    });
    this.symbols.push(entity);
  }

  minuteLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.MinuteLiteral[0],
      type: EntityType.MINUTE_LITERAL,
    });
    this.symbols.push(entity);
  }

  floatLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.FloatLiteral[0],
      type: EntityType.FLOAT_LITERAL,
    });
    this.symbols.push(entity);
  }

  binaryLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.BinaryLiteral[0],
      type: EntityType.BINARY_LITERAL,
    });
    this.symbols.push(entity);
  }

  byteLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.ByteLiteral[0],
      type: EntityType.BYTE_LITERAL,
    });
    this.symbols.push(entity);
  }

  integerLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.IntegerLiteral[0],
      type: EntityType.INTEGER_LITERAL,
    });
    this.symbols.push(entity);
  }

  keyword(ctx: any) {
    const entity = this.createEntity({
      ...ctx.Keyword[0],
      type: EntityType.KEYWORD,
    });
    this.symbols.push(entity);
  }

  identifier(ctx: any) {
    const entity = this.createEntity({
      ...ctx.Identifier[0],
      type: EntityType.IDENTIFIER,
    });
    this.symbols.push(entity);
  }

  operator(ctx: any) {
    const entity = this.createEntity({
      ...ctx.Operator[0],
      type: EntityType.OPERATOR,
    });
    this.symbols.push(entity);
  }

  colon(ctx: any) {
    const entity = this.createEntity({
      ...ctx.Colon[0],
      type: EntityType.COLON,
    });
    this.symbols.push(entity);
  }

  lparen(ctx: any) {
    const entity = this.createEntity({
      ...ctx.LParen[0],
      type: EntityType.LPAREN,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
  }

  rparen(ctx: any) {
    const entity = this.createEntity({
      ...ctx.RParen[0],
      type: EntityType.RPAREN,
    });
    this.scopes.pop();
    this.symbols.push(entity);
  }

  lbracket(ctx: any) {
    const entity = this.createEntity({
      ...ctx.LBracket[0],
      type: EntityType.LBRACKET,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
  }

  rbracket(ctx: any) {
    const entity = this.createEntity({
      ...ctx.RBracket[0],
      type: EntityType.RBRACKET,
    });
    this.scopes.pop();
    this.symbols.push(entity);
  }

  lcurly(ctx: any) {
    const entity = this.createEntity({
      ...ctx.LCurly[0],
      type: EntityType.LCURLY,
    });
    this.symbols.push(entity);
    this.scopes.push(entity);
  }

  rcurly(ctx: any) {
    const entity = this.createEntity({
      ...ctx.RCurly[0],
      type: EntityType.RCURLY,
    });
    this.scopes.pop();
    this.symbols.push(entity);
  }
}

export enum EntityType {
  UNKNOWN = "UNKNOWN",
  DOUBLE_COLON = "DOUBLE_COLON",
  COMMAND = "COMMAND",
  ENDOFLINE = "ENDOFLINE",
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
  KEYWORD = "KEYWORD",
  IDENTIFIER = "IDENTIFIER",
  OPERATOR = "OPERATOR",
  COLON = "COLON",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",
  LCURLY = "LCURLY",
  RCURLY = "RCURLY",
}

export interface Entity {
  type: EntityType;
  image: string;
  startOffset: number;
  endOffset: number;
  scope?: Entity;
}

export interface QAst {
  script: Entity[];
  assign: Entity[];
}

export function getNameScope(entity: Entity): Entity | undefined {
  let scope;
  while ((scope = entity.scope)) {
    if (scope.type === EntityType.LCURLY) {
      break;
    }
    entity = scope;
  }
  return scope;
}

export function isLiteral(entity: Entity) {
  switch (entity.type) {
    case EntityType.CHAR_LITERAL:
    case EntityType.SYMBOL_LITERAL:
    case EntityType.TIMESTAMP_LITERAL:
    case EntityType.DATETIME_LITERAL:
    case EntityType.MILITIME_LITERAL:
    case EntityType.NANOTIME_LITERAL:
    case EntityType.DATE_LITERAL:
    case EntityType.MONTH_LITERAL:
    case EntityType.SECOND_LITERAL:
    case EntityType.MINUTE_LITERAL:
    case EntityType.FLOAT_LITERAL:
    case EntityType.BINARY_LITERAL:
    case EntityType.BYTE_LITERAL:
    case EntityType.INTEGER_LITERAL:
      return true;
    default:
      return false;
  }
}

export function analyze(cstNode: CstNode | CstNode[]): QAst {
  const visitor = new QVisitor();
  visitor.visit(cstNode);

  const script = visitor.symbols;
  const ast: QAst = {
    script,
    assign: [],
  };

  for (let i = 0; i < script.length; i++) {
    switch (script[i].type) {
      case EntityType.COLON:
      case EntityType.DOUBLE_COLON:
        let entity;
        if (
          script[i + 1]?.type === EntityType.LBRACKET &&
          script[i - 1]?.type === EntityType.OPERATOR
        ) {
          entity = script[i + 2];
        } else {
          let c = i - 1;
          c >= 0 && script[c].type === EntityType.OPERATOR && c--;
          while (c >= 0 && script[c].scope !== script[i].scope) {
            c--;
          }
          c >= 0 && script[c].type === EntityType.LBRACKET && c--;
          entity = script[c];
        }
        if (entity) {
          if (script[i].type === EntityType.DOUBLE_COLON) {
            entity.scope = undefined;
          }
          ast.assign.push(entity);
        }
        break;
      case EntityType.LBRACKET:
        if (script[i - 1]?.type === EntityType.LCURLY) {
          let c = i + 1;
          const anchor = script[c]?.scope;
          while (c < script.length && anchor === script[c].scope) {
            ast.assign.push(script[c]);
            c++;
          }
        }
        break;
    }
  }

  return ast;
}
