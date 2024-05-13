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

import { IToken } from "chevrotain";
import { QLexer } from "./lexer";
import {
  Colon,
  Command,
  Documentation,
  DoubleColon,
  EndOfLine,
  LBracket,
  LCurly,
  LParen,
  LineComment,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  StringEscape,
  Table,
  TestBlock,
  TestLambdaBlock,
  WhiteSpace,
} from "./tokens";
import { Identifier, LSql, RSql, System } from "./keywords";
import {
  CommentBegin,
  CommentEnd,
  ExitCommentBegin,
  TestBegin,
} from "./ranges";
import { CharLiteral } from "./literals";

function args(image: string, count: number): string[] {
  return image.split(/\s+/, count);
}

function setQualified(token: Token, namespace: string): void {
  token.identifier =
    token.identifierKind === IdentifierKind.Unassignable ||
    !namespace ||
    !namespace.startsWith(".") ||
    token.scope ||
    token.image.startsWith(".")
      ? token.image
      : `${namespace}.${token.image}`;
}

export const enum TokenKind {
  Identifier,
  Assignment,
}

export const enum IdentifierKind {
  Argument,
  Unassignable,
  Quke,
}

export interface Token extends IToken {
  kind?: TokenKind;
  namespace?: string;
  identifier?: string;
  identifierKind?: IdentifierKind;
  scope?: Token;
  lambda?: Token;
  nullary?: boolean;
  reverse?: number;
  index?: number;
  statement?: number;
}

export interface Token2 extends IToken {
  index?: number;
  order?: number;
  consumed?: boolean;
  scope?: Token2;
  assignable?: boolean;
  assignment?: Token2;
}

export function parse2(text: string): Token2[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token2[];
  const stack: Token2[] = [];
  const scope: Token2[] = [];

  let table = 0;
  let paren = 0;
  let bracket = 0;
  let curly = 0;
  let ignore = 0;
  let order = 0;
  let token, next, current;
  let expressions: Token2[] = [];

  const consume = () => {
    let done = false;
    let sql = 0;
    let peek;

    while (!done && (current = stack.pop())) {
      switch (current.tokenType) {
        case Table:
        case LParen:
        case LBracket:
        case LCurly:
          if (current.consumed) {
            expressions.push(current);
            current.order = order;
          } else {
            stack.push(current);
            order++;
            done = true;
          }
          break;
        case SemiColon:
          order++;
          break;
        case Identifier:
          peek = expressions[expressions.length - 1];
          if (peek?.tokenType === Colon || peek?.tokenType === DoubleColon) {
            expressions.pop();
            current.assignment = expressions.pop();
            expressions = [];
            if (peek.tokenType === DoubleColon) {
              current.scope = undefined;
            }
          }
          expressions.push(current);
          current.order = order;
          current.assignable = !sql && !table;
          break;
        case RSql:
          sql++;
          expressions.push(current);
          current.order = order;
          break;
        case LSql:
          if (sql) {
            sql--;
          }
          expressions.push(current);
          current.order = order;
          break;
        default:
          expressions.push(current);
          current.order = order;
          break;
      }
      current.consumed = true;
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.order = order;
    token.scope = scope[scope.length - 1];

    switch (token.tokenType) {
      case Table:
        stack.push(token);
        paren++;
        table++;
        break;
      case LParen:
        stack.push(token);
        paren++;
        break;
      case RParen:
        if (paren) {
          paren--;
          consume();
          if (table && paren === 0) {
            table--;
          }
        }
        break;
      case LBracket:
        stack.push(token);
        bracket++;
        break;
      case RBracket:
        if (bracket) {
          bracket--;
          consume();
        }
        break;
      case LCurly:
        stack.push(token);
        scope.push(token);
        curly++;
        break;
      case RCurly:
        if (curly) {
          curly--;
          consume();
          scope.pop();
        }
        break;
      case EndOfLine:
        if (!ignore) {
          next = tokens[i + 1];
          if (next?.tokenType !== WhiteSpace) {
            consume();
            order++;
          }
        }
        break;
      case SemiColon:
        if (paren || bracket || curly) {
          stack.push(token);
        } else {
          consume();
          order++;
        }
        break;
      case Documentation:
      case LineComment:
      case TestBegin:
      case WhiteSpace:
      case CharLiteral:
      case StringEscape:
        break;
      case CommentBegin:
      case ExitCommentBegin:
        ignore++;
        break;
      case CommentEnd:
        if (ignore) {
          ignore--;
        }
        break;
      default:
        !ignore && stack.push(token);
        break;
    }
  }
  consume();
  return tokens;
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const scopes: Token[] = [];

  let namespace = "";
  let statement = 0;
  let sql = 0;
  let table = 0;
  let reverse = 0;
  let argument = 0;
  let token, prev, next: IToken;

  const _namespace = (arg: string) => {
    if (arg) {
      const args = arg.split(/\.+/, 2);
      namespace = args[1] ? `.${args[1]}` : "";
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.statement = statement;
    token.reverse = reverse;
    token.namespace = namespace;
    switch (token.tokenType) {
      case Identifier:
        if (argument) {
          token.kind = TokenKind.Assignment;
          token.identifierKind = IdentifierKind.Argument;
          token.scope = scopes[scopes.length - 1];
          token.identifier = token.image;
          break;
        }
        token.kind = TokenKind.Identifier;
        if (sql || table) {
          token.identifierKind = IdentifierKind.Unassignable;
        }
        if (!token.image.includes(".")) {
          token.scope = scopes[scopes.length - 1];
        }
        setQualified(token, namespace);
        break;
      case Colon:
      case DoubleColon:
        prev = tokens[i - 1];
        if (prev?.kind === TokenKind.Identifier) {
          if (prev.identifierKind !== IdentifierKind.Unassignable) {
            prev.kind = TokenKind.Assignment;
            if (token.tokenType === DoubleColon) {
              prev.scope = undefined;
              prev.kind = TokenKind.Identifier;
            }
            setQualified(prev, namespace);
          }
        }
        break;
      case EndOfLine:
        next = tokens[i + 1];
        if (next?.tokenType !== WhiteSpace) {
          statement++;
        }
        break;
      case SemiColon:
        if (!reverse) {
          statement++;
        }
        break;
      case LCurly:
        prev = tokens[i - 2];
        if (prev?.kind === TokenKind.Assignment && !prev.lambda) {
          prev.lambda = token;
        }
        token.nullary = true;
        next = tokens[i + 1];
        if (next?.tokenType === LBracket) {
          token.nullary = false;
          argument++;
        }
        scopes.push(token);
        break;
      case LBracket:
        reverse++;
        break;
      case RBracket:
        if (argument) {
          argument--;
        }
        reverse--;
        break;
      case RCurly:
        scopes.pop();
        break;
      case LSql:
        sql++;
        break;
      case RSql:
        sql--;
        break;
      case LParen:
        next = tokens[i + 1];
        if (table || next?.tokenType === LBracket) {
          table++;
        }
        reverse++;
        break;
      case RParen:
        if (table) {
          table--;
        }
        reverse--;
        break;
      case Command:
        const [cmd, arg] = args(token.image, 2);
        switch (cmd) {
          case "\\d":
            _namespace(arg);
            break;
        }
        break;
      case System:
        break;
      case TestBlock:
        token.identifierKind = IdentifierKind.Quke;
        scopes.pop();
        break;
      case TestLambdaBlock:
        scopes.pop();
        token.kind = TokenKind.Assignment;
        token.identifierKind = IdentifierKind.Quke;
        token.lambda = token;
        scopes.push(token);
        break;
    }
  }

  return tokens;
}
