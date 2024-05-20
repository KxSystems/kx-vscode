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
  CommentEndOfLine,
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
import { Token, inParam } from "./utils";
import { Identifier, LSql, RSql } from "./keywords";
import { checkEscape } from "./checks";

function isExpression(token: Token) {
  switch (token.tokenType) {
    case CommentBegin:
    case CommentLiteral:
    case CommentEndOfLine:
    case CommentEnd:
    case Documentation:
    case LineComment:
    case WhiteSpace:
    case ExitCommentBegin:
      return false;
  }
  return true;
}

function clear(tokens: Token[]) {
  while (tokens.pop()) {}
}

function peek(tokens: Token[]): Token | undefined {
  return tokens[tokens.length - 1];
}

function expression(tokens: Token[]) {
  const stack: Token[] = [];
  let token, top;
  while ((token = tokens.pop())) {
    switch (token.tokenType) {
      case Identifier:
        if (inParam(token)) {
          token.assignment = [token, token];
        } else {
          top = peek(stack);
          if (top?.tokenType === Colon || top?.tokenType === DoubleColon) {
            token.assignment = [top];
            stack.pop();
            top = stack.pop();
            if (top) {
              token.assignment.push(top);
            }
          }
          stack.push(token);
        }
        break;
      case SemiColon:
        clear(stack);
        break;
      case LParen:
      case RParen:
        break;
      default:
        stack.push(token);
        break;
    }
  }
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const cache: Token[] = [];
  const scope: Token[] = [];

  let namespace = "";
  let order = 1;
  let token, next;

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.order = order;
    token.scope = peek(scope);
    token.namespace = namespace;

    switch (token.tokenType) {
      case LBracket:
      case LParen:
      case LCurly:
      case LSql:
        next = peek(cache);
        if (next) {
          next.tangled = token;
          token.tangled = next;
        }
        scope.push(token);
        cache.push(token);
        break;
      case RParen:
      case RBracket:
      case RCurly:
      case RSql:
        scope.pop();
        cache.push(token);
        break;
      case SemiColon:
        if (token.scope) {
          cache.push(token);
        } else {
          expression(cache);
          order++;
        }
        break;
      case EndOfLine:
        next = tokens[i + 1];
        if (next && isExpression(next)) {
          expression(cache);
          order++;
        }
        break;
      case Command:
        {
          const [cmd, arg] = token.image.split(/\s+/, 2);
          switch (cmd) {
            case "\\d":
              if (arg) {
                namespace = arg.split(/\.+/, 2)[1] || "";
              }
              break;
          }
        }
        break;
      case StringEscape:
        checkEscape(token);
        break;
      case TestBegin:
      case TestBlock:
      case TestLambdaBlock:
        scope.pop();
        token.scope = undefined;
        scope.push(token);
        token.assignment = [token, token];
        break;
      case CharLiteral:
        break;
      default:
        if (isExpression(token)) {
          cache.push(token);
        }
        break;
    }
  }
  expression(cache);
  return tokens;
}
