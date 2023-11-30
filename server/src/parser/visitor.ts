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
    ctx.dateTimeLiteral?.forEach((rule: any) => this.visit(rule));
    ctx.identifier?.forEach((rule: any) => this.visit(rule));
    ctx.endOfLine?.forEach((rule: any) => this.visit(rule));
    ctx.doubleColon?.forEach((rule: any) => this.visit(rule));
    ctx.operator?.forEach((rule: any) => this.visit(rule));
    ctx.colon?.forEach((rule: any) => this.visit(rule));
    ctx.lparen?.forEach((rule: any) => this.visit(rule));
    ctx.rparen?.forEach((rule: any) => this.visit(rule));
    ctx.lbracket?.forEach((rule: any) => this.visit(rule));
    ctx.rbracket?.forEach((rule: any) => this.visit(rule));
    ctx.lcurly?.forEach((rule: any) => this.visit(rule));
    ctx.rcurly?.forEach((rule: any) => this.visit(rule));
  }

  dateTimeLiteral(ctx: any) {
    const entity = this.createEntity({
      ...ctx.DateTimeLiteral[0],
      type: EntityType.DATETIME_LITERAL,
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

  endOfLine(ctx: any) {
    const entity = this.createEntity({
      ...ctx.EndOfLine[0],
      type: EntityType.ENDOFLINE,
    });
    this.symbols.push(entity);
  }

  doubleColon(ctx: any) {
    const entity = this.createEntity({
      ...ctx.DoubleColon[0],
      type: EntityType.DOUBLE_COLON,
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
  ENDOFLINE = "ENDOFLINE",
  DOUBLE_COLON = "DOUBLE_COLON",
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
  related?: Entity[];
}

export interface QAst {
  script: Entity[];
}

export function analyze(cstNode: CstNode | CstNode[]): QAst {
  const visitor = new QVisitor();
  visitor.visit(cstNode);
  return { script: visitor.symbols };
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
