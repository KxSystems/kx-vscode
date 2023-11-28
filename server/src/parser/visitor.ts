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
  }

  expression(ctx: any) {
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
    let i = this.symbols.length;
    let symbol = undefined;
    while (i > 0) {
      i--;
      symbol = this.symbols[i];
      if (
        symbol.scope === this.scope &&
        symbol.type === EntityType.IDENTIFIER
      ) {
        break;
      }
    }
    if (!symbol) {
      return;
    }
    const entity = this.createEntity({
      ...symbol,
      type: EntityType.ASSIGNMENT,
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
}

export enum EntityType {
  LIST = "LIST",
  LAMBDA = "LAMBDA",
  BRACKET = "BRACKET",
  ASSIGNMENT = "ASSIGNMENT",
  IDENTIFIER = "IDENTIFIER",
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
