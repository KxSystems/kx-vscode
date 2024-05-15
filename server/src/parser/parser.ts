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
  TestLambdaBlock,
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
import {
  SyntaxError,
  Token,
  children,
  isFullyQualified,
  lookAround,
} from "./utils";

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const statements: Token[] = [];
  const scopes: Token[] = [];

  let order = 1;
  let paren = 0;
  let bracket = 0;
  let table = 0;
  let curly = 0;
  let argument = false;
  let namespace = "";
  let token: Token, prev: Token;

  const peek = (tokens: Token[]) => tokens[tokens.length - 1];

  const consume = () => {
    let done = false;
    let sql = 0;
    let stack: Token[] = [];
    let current;

    const push = (token: Token) => {
      stack.push(token);
      token.order = order;
    };

    const pop = (reset = false) => {
      const popped = stack.pop();
      if (reset) {
        stack = [];
      }
      return popped;
    };

    while (!done && (current = statements.pop())) {
      switch (current.tokenType) {
        case LParen:
        case LBracket:
        case LTable:
          if (current.order) {
            done = true;
            pop(true);
            order++;
            statements.push(current);
          } else {
            push(current);
          }
          break;
        case SemiColon:
          pop(true);
          order++;
          break;
        case Identifier:
        case TestBegin:
        case TestBlock:
        case TestLambdaBlock:
        case Keyword:
        case SymbolLiteral:
        case NumberLiteral:
        case StringEnd:
          if (argument) {
            current.assignment = current;
            current.local = true;
          } else {
            prev = peek(stack);
            if (prev) {
              if (prev.tokenType === Colon || prev.tokenType === DoubleColon) {
                pop();
                current.assignment = pop(true);
                current.local =
                  !isFullyQualified(current) &&
                  current.scope &&
                  current.assignment &&
                  prev.tokenType !== DoubleColon;
              }
            }
          }

          current.assignable = !sql && !table;

          if (current.assignable && current.assignment) {
            switch (current.tokenType) {
              case SymbolLiteral:
              case StringEnd:
                current.error = SyntaxError.AssignedToLiteral;
                break;
              case NumberLiteral:
                const value = parseFloat(current.image);
                if (value < 0 || value > 2) {
                  current.error = SyntaxError.AssignedToLiteral;
                }
                break;
              case Keyword:
                current.error = SyntaxError.AssignedToKeyword;
                break;
            }
          }

          if (current.scope && !isFullyQualified(current)) {
            if (current.local === undefined) {
              current.local = !!children(current.scope).find(
                (child) =>
                  child.local &&
                  child.assignable &&
                  child.image === current!.image,
              );
            }
            children(current.scope).push(current);
          }
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
    token.namespace = namespace;
    token.scope = peek(scopes);

    switch (token.tokenType) {
      case LTable:
        statements.push(token);
        paren++;
        table++;
        break;
      case LParen:
        statements.push(token);
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
        prev = peek(scopes);
        if (prev) {
          argument = lookAround(tokens, token, -1) === prev;
          if (argument) {
            prev.argument = token;
          }
        }
        statements.push(token);
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
        statements.push(token);
        scopes.push(token);
        curly++;
        consume();
        order++;
        break;
      case RCurly:
        if (curly) {
          curly--;
          scopes.pop();
        }
        break;
      case SemiColon:
        if (paren || bracket || table) {
          statements.push(token);
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
      case TestLambdaBlock:
        scopes.pop();
        scopes.push(token);
        statements.push(token);
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
      case WhiteSpace:
        break;
      case StringEscape:
        switch (token.image.slice(1)) {
          case "n":
          case "r":
          case "t":
          case "\\":
          case "/":
          case '"':
            break;
          default:
            const value = parseInt(token.image.slice(1));
            if (!value || value < 100 || value > 377) {
              token.error = SyntaxError.InvalidEscape;
            }
            break;
        }
        break;
      default:
        statements.push(token);
        break;
    }
  }
  consume();
  return tokens;
}
