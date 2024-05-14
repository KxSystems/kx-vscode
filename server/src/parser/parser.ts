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
  LTable,
  TestBlock,
  WhiteSpace,
  CommentEol,
} from "./tokens";
import { Identifier, Keyword, LSql, RSql } from "./keywords";
import {
  CommentBegin,
  CommentEnd,
  ExitCommentBegin,
  StringEnd,
  TestBegin,
} from "./ranges";
import {
  CharLiteral,
  CommentLiteral,
  NumberLiteral,
  SymbolLiteral,
} from "./literals";
import { Token, lookAround } from "./utils";

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const stack: Token[] = [];
  const scope: Token[] = [];

  let paren = 0;
  let bracket = 0;
  let table = 0;
  let curly = 0;
  let order = 0;
  let argument = false;
  let namespace = "";
  let token: Token, prev: Token;

  const peek = (tokens: Token[]) => tokens[tokens.length - 1];

  const consume = () => {
    let done = false;
    let sql = 0;
    let expressions: Token[] = [];
    let current;

    const push = (token: Token) => {
      expressions.push(token);
      token.order = order;
    };

    const pop = (reset = false) => {
      const popped = expressions.pop();
      if (reset) {
        expressions = [];
      }
      return popped;
    };

    while (!done && (current = stack.pop())) {
      switch (current.tokenType) {
        case LParen:
        case LBracket:
        case LTable:
          done = true;
          pop(true);
          order++;
          break;
        case SemiColon:
          pop(true);
          order++;
          break;
        case Identifier:
        case Keyword:
        case SymbolLiteral:
        case NumberLiteral:
        case StringEnd:
          if (argument) {
            current.assignment = current;
          } else {
            prev = peek(expressions);
            if (prev) {
              if (prev.tokenType === Colon || prev.tokenType === DoubleColon) {
                pop();
                current.assignment = pop(true);
                if (current.assignment && prev.tokenType === DoubleColon) {
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
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.order = -1;
    token.namespace = namespace;
    token.scope = scope[scope.length - 1];

    switch (token.tokenType) {
      case LTable:
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
          consume();
          paren--;
          if (table && paren === 0) {
            table--;
          }
        }
        break;
      case LBracket:
        prev = peek(scope);
        if (prev) {
          argument = lookAround(tokens, token, -1) === prev;
          if (argument) {
            prev.argument = token;
          }
        }
        stack.push(token);
        bracket++;
        break;
      case RBracket:
        if (bracket) {
          consume();
          bracket--;
          argument = false;
        }
        break;
      case LCurly:
        stack.push(token);
        scope.push(token);
        curly++;
        consume();
        order++;
        break;
      case RCurly:
        if (curly) {
          curly--;
          scope.pop();
        }
        break;
      case SemiColon:
        if (paren || bracket || table) {
          stack.push(token);
        } else {
          consume();
          order++;
        }
        break;
      case EndOfLine:
        if (tokens[i + 1]?.tokenType !== WhiteSpace) {
          consume();
          order++;
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
      case TestBegin:
      case TestBlock:
        scope.pop();
        scope.push(token);
        stack.push(token);
        consume();
        order++;
        break;
      case CommentBegin:
      case CommentLiteral:
      case CommentEol:
      case CommentEnd:
      case ExitCommentBegin:
      case Documentation:
      case LineComment:
      case CharLiteral:
      case StringEscape:
      case WhiteSpace:
        break;
      default:
        stack.push(token);
        break;
    }
  }
  consume();
  return tokens;
}
