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
  EndOfLineCstChildren,
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
  MiliTimeLiteralCstChildren,
  MinuteLiteralCstChildren,
  MonthLiteralCstChildren,
  NanoTimeLiteralCstChildren,
  NumberLiteralCstChildren,
  OperatorCstChildren,
  ScriptCstChildren,
  SecondLiteralCstChildren,
  SemiColonCstChildren,
  SpaceCstChildren,
  SymbolCstChildren,
  SymbolLiteralCstChildren,
  TimeStampLiteralCstChildren,
} from "./types";
import { CstNode, IToken } from "chevrotain";
import { QParser } from "./parser";

const BaseQVisitor = QParser.getBaseCstVisitorConstructorWithDefaults();

class QVisitor extends BaseQVisitor implements ICstNodeVisitor<void, void> {
  private tokens: Token[] = [];
  private assigns: Token[] = [];
  private scopes: Token[] = [];
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

  private get current() {
    return this.tokens[this.tokens.length - 1];
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

  private backtrack(
    find: TokenType[],
    count = 1,
    scope = true,
    skip = [TokenType.SPACE]
  ) {
    let c = this.tokens.length - 1;
    const anchor = this.tokens[c];
    let current: Token;
    while (count > 0 && c > 0) {
      count--;
      c--;
      current = this.tokens[c];
      if (current.statement !== anchor.statement) {
        break;
      }
      if (skip.indexOf(current.type) >= 0) {
        count++;
        continue;
      }
      if (scope && current.scope !== anchor.scope) {
        count++;
        continue;
      }
      if (find.indexOf(current.type) >= 0) {
        return current;
      }
    }
    return undefined;
  }

  script(ctx: ScriptCstChildren) {
    ctx.expression?.forEach((rule) => this.visit(rule));
  }

  expression(ctx: ExpressionCstChildren) {
    ctx.assignment?.forEach((rule) => this.visit(rule));
    ctx.bracket?.forEach((rule) => this.visit(rule));
    ctx.command?.forEach((rule) => this.visit(rule));
    ctx.endOfLine?.forEach((rule) => this.visit(rule));
    ctx.group?.forEach((rule) => this.visit(rule));
    ctx.iterator?.forEach((rule) => this.visit(rule));
    ctx.lambda?.forEach((rule) => this.visit(rule));
    ctx.operator?.forEach((rule) => this.visit(rule));
    ctx.semiColon?.forEach((rule) => this.visit(rule));
    ctx.space?.forEach((rule) => this.visit(rule));
    ctx.symbol?.forEach((rule) => this.visit(rule));
  }

  space(ctx: SpaceCstChildren) {
    this.statement--;
    this.consume({ ...ctx.Space[0], type: TokenType.SPACE });
  }

  semiColon(ctx: SemiColonCstChildren) {
    this.consume({ ...ctx.SemiColon[0], type: TokenType.SEMICOLON });
    this.statement++;
  }

  endOfLine(ctx: EndOfLineCstChildren) {
    this.consume({ ...ctx.EndOfLine[0], type: TokenType.ENDOFLINE });
    this.statement++;
  }

  group(ctx: GroupCstChildren) {
    this.push({ ...ctx.LParen[0], type: TokenType.GROUP });
    ctx.expression?.forEach((rule) => this.visit(rule));
    this.pop();
  }

  lambda(ctx: LambdaCstChildren) {
    this.push({ ...ctx.LCurly[0], type: TokenType.LAMBDA });
    ctx.space?.forEach((rule) => this.visit(rule));
    ctx.bracket?.forEach((rule) => this.visit(rule));
    ctx.expression?.forEach((rule) => this.visit(rule));
    this.pop();
  }

  bracket(ctx: BracketCstChildren) {
    this.push({ ...ctx.LBracket[0], type: TokenType.BRACKET });
    const lambda = this.backtrack([TokenType.LAMBDA], 1, false);
    const group = this.backtrack([TokenType.GROUP], 1, false);
    if (group) {
      group.type = TokenType.TABLE;
    }
    const assignment = this.backtrack([TokenType.ASSIGN_INFIX]);
    let symbol: Token | undefined;
    ctx.expression?.forEach((rule) => {
      this.visit(rule);
      if (lambda) {
        symbol = this.current;
      } else if (assignment && !symbol && rule.children.symbol) {
        symbol = this.current;
        if (assignment.name === "DoubleColon") {
          symbol.scope = undefined;
        }
      }
    });
    if (symbol) {
      if (!scope(symbol, NoAssignTypes)) {
        this.assigns.push(symbol);
      }
    }
    this.pop();
  }

  assignment(ctx: AssignmentCstChildren) {
    ctx.operator?.forEach((rule) => this.visit(rule));
    ctx.space?.forEach((rule) => this.visit(rule));
    this.consume({
      ...(ctx.Colon || ctx.DoubleColon || [])[0],
      type: ctx.operator ? TokenType.ASSIGN_INFIX : TokenType.ASSIGN,
    });
    const assignment = this.current;
    if (!scope(this.current, NoAssignTypes)) {
      const count = ctx.operator ? 2 : 1;
      const symbol = this.backtrack(SymbolTypes, count, true, [
        TokenType.SPACE,
        TokenType.BRACKET,
      ]);
      if (symbol) {
        if (assignment.name === "DoubleColon") {
          symbol.scope = undefined;
        }
        this.assigns.push(symbol);
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
    ctx.miliTimeLiteral?.forEach((rule) => this.visit(rule));
    ctx.minuteLiteral?.forEach((rule) => this.visit(rule));
    ctx.monthLiteral?.forEach((rule) => this.visit(rule));
    ctx.nanoTimeLiteral?.forEach((rule) => this.visit(rule));
    ctx.numberLiteral?.forEach((rule) => this.visit(rule));
    ctx.secondLiteral?.forEach((rule) => this.visit(rule));
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

  miliTimeLiteral(ctx: MiliTimeLiteralCstChildren) {
    this.consume({ ...ctx.MiliTimeLiteral[0], type: TokenType.LITERAL });
  }

  minuteLiteral(ctx: MinuteLiteralCstChildren) {
    this.consume({ ...ctx.MinuteLiteral[0], type: TokenType.LITERAL });
  }

  monthLiteral(ctx: MonthLiteralCstChildren) {
    this.consume({ ...ctx.MonthLiteral[0], type: TokenType.LITERAL });
  }

  nanoTimeLiteral(ctx: NanoTimeLiteralCstChildren) {
    this.consume({ ...ctx.NanoTimeLiteral[0], type: TokenType.LITERAL });
  }

  numberLiteral(ctx: NumberLiteralCstChildren) {
    this.consume({ ...ctx.NumberLiteral[0], type: TokenType.LITERAL });
  }

  secondLiteral(ctx: SecondLiteralCstChildren) {
    this.consume({ ...ctx.SecondLiteral[0], type: TokenType.LITERAL });
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
  LAMBDA,
  BRACKET,
  GROUP,
  TABLE,
  SQL,
  ITERATOR,
  OPERATOR,
  COMMAND,
  ASSIGN,
  ASSIGN_INFIX,
  SPACE,
  SEMICOLON,
  ENDOFLINE,
}

export const SymbolTypes = [
  TokenType.LITERAL,
  TokenType.KEYWORD,
  TokenType.IDENTIFIER,
];

export const AssignTypes = [TokenType.ASSIGN, TokenType.ASSIGN_INFIX];
export const NoAssignTypes = [TokenType.TABLE, TokenType.SQL];

export function scope(
  token: Token,
  types = [TokenType.LAMBDA]
): Token | undefined {
  let scope;
  while ((scope = token.scope)) {
    if (types.indexOf(scope.type) >= 0) {
      break;
    }
    token = scope;
  }
  return scope;
}

export function analyze(cstNode: CstNode | CstNode[]): QAst {
  const visitor = new QVisitor();
  visitor.visit(cstNode);
  return visitor.ast();
}
