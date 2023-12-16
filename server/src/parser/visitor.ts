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

import type {
  AssignmentCstChildren,
  BinaryLiteralCstChildren,
  BracketCstChildren,
  ByteLiteralCstChildren,
  CharLiteralCstChildren,
  CommandCstChildren,
  DateLiteralCstChildren,
  DateTimeLiteralCstChildren,
  ExpressionCstChildren,
  FileLiteralCstChildren,
  GroupCstChildren,
  ICstNodeVisitor,
  IdentifierCstChildren,
  InfinityLiteralCstChildren,
  IteratorCstChildren,
  KeywordCstChildren,
  LambdaCstChildren,
  LiteralCstChildren,
  MonthLiteralCstChildren,
  NumberLiteralCstChildren,
  OperatorCstChildren,
  ScriptCstChildren,
  SemiColonCstChildren,
  SqlCstChildren,
  SymbolCstChildren,
  SymbolLiteralCstChildren,
  TimeLiteralCstChildren,
  TimeStampLiteralCstChildren,
} from "./types";
import { CstNode, IToken } from "chevrotain";
import { QParser } from "./parser";

const BaseQVisitor = QParser.getBaseCstVisitorConstructorWithDefaults();

class QVisitor extends BaseQVisitor implements ICstNodeVisitor<void, void> {
  private tokens: Token[] = [];
  private scopes: Token[] = [];
  private assigns: Token[] = [];
  private statement = 0;

  constructor() {
    super();
    this.validateVisitor();
  }

  ast(): QAst {
    return {
      script: this.tokens,
      assign: this.assigns,
    };
  }

  private consume(ctx: IToken & Partial<Token>) {
    const token = {
      type: ctx.type || TokenType.LITERAL,
      name: ctx.tokenType.name,
      image: ctx.image,
      startOffset: ctx.startOffset,
      endOffset: (ctx.endOffset || ctx.startOffset) + 1,
      statement: this.statement,
      scope: this.scopes[this.scopes.length - 1],
    };
    this.tokens.push(token);
    return token;
  }

  private push(ctx: IToken & Partial<Token>) {
    const token = this.consume(ctx);
    this.scopes.push(token);
    return token;
  }

  private pop() {
    return this.scopes.pop();
  }

  private scoped(delta = 0) {
    let c = this.tokens.length - 1;
    const anchor = this.tokens[c].scope;
    while (anchor && c > 0) {
      c--;
      if (this.tokens[c] === anchor) {
        break;
      }
    }
    return c + delta;
  }

  private peek(
    type: TokenType[],
    skip: TokenType[] = [],
    count = 1,
    scope = true
  ) {
    let c = this.tokens.length - 1;
    const anchor = this.tokens[c];
    let current: Token;
    while (count > 0 && c > 0) {
      c--;
      current = this.tokens[c];
      if (current.statement !== anchor.statement) {
        break;
      }
      if (scope && current.scope !== anchor.scope) {
        continue;
      }
      if (skip.indexOf(current.type) >= 0) {
        continue;
      }
      if (type.indexOf(current.type) >= 0) {
        return current;
      }
      count--;
    }
    return undefined;
  }

  private assign(token: Token, tag?: string) {
    token.tag = tag;
    this.assigns.push(token);
  }

  script(ctx: ScriptCstChildren) {
    ctx.expression?.forEach((rule) => this.visit(rule));
  }

  expression(ctx: ExpressionCstChildren) {
    ctx.assignment?.forEach((rule) => this.visit(rule));
    ctx.bracket?.forEach((rule) => this.visit(rule));
    ctx.command?.forEach((rule) => this.visit(rule));
    ctx.group?.forEach((rule) => this.visit(rule));
    ctx.iterator?.forEach((rule) => this.visit(rule));
    ctx.lambda?.forEach((rule) => this.visit(rule));
    ctx.operator?.forEach((rule) => this.visit(rule));
    ctx.semiColon?.forEach((rule) => this.visit(rule));
    ctx.sql?.forEach((rule) => this.visit(rule));
    ctx.symbol?.forEach((rule) => this.visit(rule));
  }

  semiColon(ctx: SemiColonCstChildren) {
    this.consume({ ...ctx.SemiColon[0], type: TokenType.SEMICOLON });
    this.statement++;
  }

  sql(ctx: SqlCstChildren) {
    this.push({ ...ctx.LSql[0], type: TokenType.SQL });
    ctx.expression?.forEach((rule) => this.visit(rule));
    this.pop();
  }

  bracket(ctx: BracketCstChildren) {
    this.push({ ...ctx.LBracket[0], type: TokenType.BRACKET });
    ctx.expression?.forEach((rule) => this.visit(rule));
    this.pop();
  }

  group(ctx: GroupCstChildren) {
    const type = ctx.bracket ? TokenType.TABLE : TokenType.GROUP;
    this.push({ ...ctx.LParen[0], type });
    ctx.bracket?.forEach((rule) => this.visit(rule));
    ctx.expression?.forEach((rule) => this.visit(rule));
    this.pop();
  }

  lambda(ctx: LambdaCstChildren) {
    this.push({ ...ctx.LCurly[0], type: TokenType.LAMBDA });
    if (ctx.bracket) {
      this.visit(ctx.bracket);
      for (let i = this.scoped(); i < this.tokens.length; i++) {
        const token = this.tokens[i];
        if (token.type === TokenType.IDENTIFIER) {
          this.assign(token, "ARGUMENT");
        }
      }
    }
    ctx.expression?.forEach((rule) => this.visit(rule));
    this.pop();
  }

  assignment(ctx: AssignmentCstChildren) {
    ctx.operator?.forEach((rule) => this.visit(rule));
    const assignment = this.consume({
      ...ctx.Colon[0],
      type: TokenType.ASSIGN,
    });
    let symbol = this.peek(SymbolTypes, [
      TokenType.OPERATOR,
      TokenType.BRACKET,
    ]);
    if (ctx.expression) {
      this.visit(ctx.expression);
      if (ctx.operator && ctx.expression[0].children.bracket) {
        symbol = this.tokens[this.scoped(1)];
      } else {
        if (ctx.expression[0].children.semiColon) {
          symbol = undefined;
        }
      }
    } else {
      symbol = undefined;
    }
    if (symbol) {
      if (!scope(assignment, NoAssignTypes)) {
        if (ctx.Colon.length > 1) {
          const local = this.assigns.find(
            (token) =>
              token.type === TokenType.IDENTIFIER &&
              token.image === symbol?.image &&
              scope(token) === scope(assignment)
          );
          if (!local) {
            symbol.scope = undefined;
          }
        }
        this.assign(symbol, "ASSIGNED");
      }
    }
  }

  symbol(ctx: SymbolCstChildren) {
    ctx.literal?.forEach((rule) => this.visit(rule));
    ctx.keyword?.forEach((rule) => this.visit(rule));
    ctx.identifier?.forEach((rule) => this.visit(rule));
  }

  literal(ctx: LiteralCstChildren) {
    ctx.binaryLiteral?.forEach((rule) => this.visit(rule));
    ctx.byteLiteral?.forEach((rule) => this.visit(rule));
    ctx.charLiteral?.forEach((rule) => this.visit(rule));
    ctx.dateLiteral?.forEach((rule) => this.visit(rule));
    ctx.dateTimeLiteral?.forEach((rule) => this.visit(rule));
    ctx.fileLiteral?.forEach((rule) => this.visit(rule));
    ctx.infinityLiteral?.forEach((rule) => this.visit(rule));
    ctx.monthLiteral?.forEach((rule) => this.visit(rule));
    ctx.numberLiteral?.forEach((rule) => this.visit(rule));
    ctx.symbolLiteral?.forEach((rule) => this.visit(rule));
    ctx.timeStampLiteral?.forEach((rule) => this.visit(rule));
  }

  binaryLiteral(ctx: BinaryLiteralCstChildren) {
    this.consume({ ...ctx.BinaryLiteral[0], type: TokenType.LITERAL });
  }

  byteLiteral(ctx: ByteLiteralCstChildren) {
    this.consume({ ...ctx.ByteLiteral[0], type: TokenType.LITERAL });
  }

  charLiteral(ctx: CharLiteralCstChildren) {
    this.consume({ ...ctx.CharLiteral[0], type: TokenType.LITERAL });
  }

  dateLiteral(ctx: DateLiteralCstChildren) {
    this.consume({ ...ctx.DateLiteral[0], type: TokenType.LITERAL });
  }

  dateTimeLiteral(ctx: DateTimeLiteralCstChildren) {
    this.consume({ ...ctx.DateTimeLiteral[0], type: TokenType.LITERAL });
  }

  fileLiteral(ctx: FileLiteralCstChildren) {
    this.consume({ ...ctx.FileLiteral[0], type: TokenType.LITERAL });
  }

  infinityLiteral(ctx: InfinityLiteralCstChildren) {
    this.consume({ ...ctx.InfinityLiteral[0], type: TokenType.LITERAL });
  }

  monthLiteral(ctx: MonthLiteralCstChildren) {
    this.consume({ ...ctx.MonthLiteral[0], type: TokenType.LITERAL });
  }

  timeLiteral(ctx: TimeLiteralCstChildren) {
    this.consume({ ...ctx.TimeLiteral[0], type: TokenType.LITERAL });
  }

  numberLiteral(ctx: NumberLiteralCstChildren) {
    this.consume({ ...ctx.NumberLiteral[0], type: TokenType.LITERAL });
  }

  symbolLiteral(ctx: SymbolLiteralCstChildren) {
    this.consume({ ...ctx.SymbolLiteral[0], type: TokenType.LITERAL });
  }

  timeStampLiteral(ctx: TimeStampLiteralCstChildren) {
    this.consume({ ...ctx.TimeStampLiteral[0], type: TokenType.LITERAL });
  }

  keyword(ctx: KeywordCstChildren) {
    this.consume({ ...ctx.Keyword[0], type: TokenType.KEYWORD });
  }

  identifier(ctx: IdentifierCstChildren) {
    this.consume({ ...ctx.Identifier[0], type: TokenType.IDENTIFIER });
  }

  iterator(ctx: IteratorCstChildren) {
    this.consume({ ...ctx.Iterator[0], type: TokenType.ITERATOR });
  }

  command(ctx: CommandCstChildren) {
    this.consume({ ...ctx.Command[0], type: TokenType.COMMAND });
  }

  operator(ctx: OperatorCstChildren) {
    this.consume({ ...ctx.Operator[0], type: TokenType.OPERATOR });
  }
}

export interface Token {
  type: TokenType;
  name: string;
  scope?: Token;
  tag?: string;
  statement: number;
  image: string;
  startOffset: number;
  endOffset: number;
}

export interface QAst {
  script: Token[];
  assign: Token[];
}

export const enum TokenType {
  LITERAL,
  KEYWORD,
  IDENTIFIER,
  SQL,
  GROUP,
  LAMBDA,
  BRACKET,
  TABLE,
  ITERATOR,
  OPERATOR,
  COMMAND,
  ASSIGN,
  SEMICOLON,
}

export const SymbolTypes = [
  TokenType.LITERAL,
  TokenType.KEYWORD,
  TokenType.IDENTIFIER,
];

export const NoAssignTypes = [TokenType.TABLE, TokenType.SQL];

export function scope(token: Token, types = [TokenType.LAMBDA]) {
  let scope;
  while ((scope = token.scope)) {
    if (types.indexOf(scope.type) >= 0) {
      break;
    }
    token = scope;
  }
  return scope;
}

export function analyze(cstNode: CstNode | CstNode[]) {
  const visitor = new QVisitor();
  visitor.visit(cstNode);
  return visitor.ast();
}
