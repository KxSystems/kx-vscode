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
  Command,
  Documentation,
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
  TestBlock,
  WhiteSpace,
  CommentEol,
  TestLambdaBlock,
  Colon,
  DoubleColon,
} from "./tokens";
import {
  CommentBegin,
  CommentEnd,
  ExitCommentBegin,
  TestBegin,
} from "./ranges";
import { CharLiteral, CommentLiteral } from "./literals";
import { SyntaxError, Token, children, scopped } from "./utils";
import { Identifier } from "./keywords";

function peek(tokens: Token[]): Token | undefined {
  return tokens[tokens.length - 1];
}

function consume(token: Token, stack: Token[]) {
  let top;

  switch (token.tokenType) {
    case Identifier:
      top = peek(stack);
      if (top?.tokenType === Colon || top?.tokenType === DoubleColon) {
        stack.pop();
        token.assignable = true;
        token.assignment = stack.pop();
        if (token.scope) {
          children(token.scope).push(token);
        }
        stack.length = 0;
      }
      stack.push(token);
      break;
    case Colon:
    case DoubleColon:
      top = peek(stack);
      if (top) {
        stack.push(token);
      }
      break;
    case SemiColon:
      stack.length = 0;
      break;
    default:
      stack.push(token);
      break;
  }
}

function statement(tokens: Token[]) {
  const stack: Token[] = [];
  const scope: Token[] = [];

  let order = 1;
  let token, top;

  while ((token = tokens.pop())) {
    token.scope = peek(scope);

    switch (token.tokenType) {
      case LParen:
        top = scope.pop();
        if (top) {
          statement(scopped(top));
        }
        stack.push(token);
        break;
      case RParen:
        scope.push(token);
        break;
      case LBracket:
        top = scope.pop();
        if (top) {
          statement(scopped(top));
        }
        stack.push(token);
        break;
      case RBracket:
        scope.push(token);
        break;
      case LCurly:
        top = scope.pop();
        if (top) {
          statement(scopped(top));
        }
        stack.push(token);
        break;
      case RCurly:
        scope.push(token);
        break;
      default:
        top = peek(scope);
        if (top) {
          scopped(top).unshift(token);
        } else {
          token.order = order++;
          consume(token, stack);
        }
        break;
    }
  }
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const statements: Token[] = [];
  const scope: Token[] = [];

  let namespace = "";
  let token;

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.namespace = namespace;

    switch (token.tokenType) {
      case LParen:
        scope.push(token);
        statements.push(token);
        break;
      case RParen:
        scope.pop();
        statements.push(token);
        break;
      case LBracket:
        scope.push(token);
        statements.push(token);
        break;
      case RBracket:
        scope.pop();
        statements.push(token);
        break;
      case LCurly:
        scope.push(token);
        statements.push(token);
        break;
      case RCurly:
        scope.pop();
        statements.push(token);
        break;
      case SemiColon:
        if (peek(scope)) {
          statements.push(token);
        } else {
          statement(statements);
        }
        break;
      case EndOfLine:
        if (tokens[i + 1]?.tokenType !== WhiteSpace) {
          statement(statements);
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
      case CommentBegin:
      case CommentLiteral:
      case CommentEol:
      case CommentEnd:
      case ExitCommentBegin:
      case Documentation:
      case LineComment:
      case CharLiteral:
      case WhiteSpace:
      case TestBegin:
      case TestBlock:
      case TestLambdaBlock:
        break;
      default:
        statements.push(token);
        break;
    }
  }
  statement(statements);
  return tokens;
}
