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
  WhiteSpace,
} from "./tokens";
import { Identifier, Keyword, LSql, RSql } from "./keywords";
import {
  CommentBegin,
  CommentEnd,
  ExitCommentBegin,
  TestBegin,
} from "./ranges";
import { CharLiteral } from "./literals";

export interface Token extends IToken {
  index?: number;
  order?: number;
  consumed?: boolean;
  namespace?: string;
  scope?: Token;
  argument?: boolean;
  assignable?: boolean;
  assignment?: Token;
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const stack: Token[] = [];
  const scope: Token[] = [];

  let table = 0;
  let paren = 0;
  let bracket = 0;
  let curly = 0;
  let ignore = 0;
  let order = 0;
  let argument = false;
  let namespace = "";
  let token, next, prev;

  const consume = () => {
    let done = false;
    let sql = 0;
    let current: Token | undefined;
    let peek: Token | undefined;
    let expressions: Token[] = [];

    const push = (token: Token) => {
      expressions.push(token);
      token.order = order;
    };

    while (!done && (current = stack.pop())) {
      switch (current.tokenType) {
        case Table:
        case LParen:
        case LBracket:
        case LCurly:
          if (current.consumed) {
            push(current);
          } else {
            stack.push(current);
            order++;
            done = true;
          }
          break;
        case SemiColon:
          expressions = [];
          order++;
          break;
        case Keyword:
        case Identifier:
          if (argument) {
            current.argument = true;
            current.assignment = current;
          } else {
            peek = expressions[expressions.length - 1];
            if (peek) {
              if (peek.tokenType === Colon || peek.tokenType === DoubleColon) {
                expressions.pop();
                current.assignment = expressions.pop();
                expressions = [];
                if (peek.tokenType === DoubleColon) {
                  current.scope = undefined;
                }
              }
            }
          }
          current.assignable = !sql && !table;
          push(current);
          break;
        case RSql:
          sql++;
          push(current);
          break;
        case LSql:
          if (sql) {
            sql--;
          }
          push(current);
          break;
        default:
          push(current);
          break;
      }
      current.consumed = true;
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.order = order;
    token.namespace = namespace;
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
        prev = scope[scope.length - 1];
        if (prev) {
          argument = true;
          for (let index = prev.index! + 1; index < i; index++) {
            next = tokens[index].tokenType;
            if (next !== WhiteSpace && next !== EndOfLine) {
              argument = false;
              break;
            }
          }
        }
        stack.push(token);
        bracket++;
        break;
      case RBracket:
        if (bracket) {
          bracket--;
          consume();
          argument = false;
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
      case Command:
        const [cmd, arg] = token.image.split(/\s+/, 2);
        switch (cmd) {
          case "\\d":
            if (arg) {
              namespace = arg.split(/\.+/, 2)[1] || "";
            }
            break;
        }
        break;
      case TestBlock:
        scope.pop();
        scope.push(token);
        break;
      default:
        if (!ignore) {
          stack.push(token);
        }
        break;
    }
  }
  consume();
  return tokens;
}
