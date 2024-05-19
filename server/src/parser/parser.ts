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
import { Control, Identifier, LSql, RSql } from "./keywords";
import { checkEscape } from "./checks";

interface State {
  order: number;
  stack: Token[];
}

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

function collapse(tokens: Token[]) {
  if (tokens.length === 0) {
    return undefined;
  }
  const collapsed: Token[] = [];
  let token;
  while ((token = tokens.pop())) {
    collapsed.push(token);
  }
  return collapsed;
}

function peek(tokens: Token[]): Token | undefined {
  return tokens[tokens.length - 1];
}

function expression(state: State, tokens: Token[]) {
  const { stack } = state;
  let token, top;
  while ((token = tokens.pop())) {
    switch (token.tokenType) {
      case Identifier:
        if (inParam(token)) {
          token.assignment = [token, token];
        } else {
          top = peek(stack);
          if (top?.tokenType === Colon || top?.tokenType === DoubleColon) {
            token.assignment = collapse(stack);
          }
          stack.push(token);
        }
        token.order = state.order++;
        break;
      case LCurly:
        if (!token.apply) {
          stack.push(token);
        }
        break;
      case RCurly:
        if (token.scope && peek(stack)) {
          token.scope.apply = true;
        }
        stack.push(token);
        break;
      case SemiColon:
        collapse(stack);
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

  const state: State = {
    order: 1,
    stack: [],
  };

  let namespace = "";
  let token, next;

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.scope = peek(scope);
    token.namespace = namespace;

    switch (token.tokenType) {
      case LBracket:
        next = peek(cache);
        if (next) {
          next.tangled = token;
        }
        scope.push(token);
        cache.push(token);
        break;
      case LParen:
      case LCurly:
      case LSql:
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
        switch (token.scope?.tokenType) {
          case LParen:
            cache.push(token);
            break;
          case LBracket:
            next = cache[cache.indexOf(token.scope) - 1];
            if (!next || next.tokenType === Control) {
              expression(state, cache);
            } else {
              cache.push(token);
            }
            break;
          default:
            expression(state, cache);
            break;
        }
        break;
      case EndOfLine:
        next = tokens[i + 1];
        if (next && isExpression(next)) {
          expression(state, cache);
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
      case CharLiteral:
      case TestBegin:
      case TestBlock:
      case TestLambdaBlock:
        break;
      default:
        if (isExpression(token)) {
          cache.push(token);
        }
        break;
    }
  }
  expression(state, cache);
  return tokens;
}
