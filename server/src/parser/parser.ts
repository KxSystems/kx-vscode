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
  Iterator,
  Operator,
} from "./tokens";
import {
  CommentBegin,
  CommentEnd,
  ExitCommentBegin,
  StringBegin,
  StringEnd,
  TestBegin,
} from "./ranges";
import { CharLiteral, CommentLiteral } from "./literals";
import { Token, inParam, testblock } from "./utils";
import { Control, Identifier, LSql, RSql } from "./keywords";
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

interface State {
  order: number;
  exprs: number;
  stack: Token[];
}

function assignment(state: State, token: Token) {
  const { stack } = state;

  if (inParam(token)) {
    token.assignment = [token, token];
  } else {
    let top = peek(stack);
    if (top?.tokenType === Colon || top?.tokenType === DoubleColon) {
      token.assignment = [top];
      stack.pop();
      top = stack.shift();
      if (top) {
        token.assignment.push(top);
        clear(stack);
      }
    }
    stack.push(token);
  }
  token.order = state.order++;
}

function block(state: State, tokens: Token[], scopped = true) {
  if (scopped) {
    const anchor = peek(tokens);
    if (anchor && anchor.scope) {
      tokens.pop();
      tokens = tokens.splice(tokens.indexOf(anchor.scope) + 1);
    }
  }

  const cache: Token[] = [];
  const scope: Token[] = [];

  let token, next;

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];

    switch (token.tokenType) {
      case LParen:
      case LBracket:
      case LCurly:
        scope.push(token);
        cache.push(token);
        break;
      case RBracket:
      case RParen:
      case RCurly:
        next = scope.pop();
        if (next) {
          cache.push(token);
        }
        break;
      case SemiColon:
        if (peek(scope)) {
          cache.push(token);
        } else {
          expression(state, cache);
        }
        break;
      default:
        cache.push(token);
        break;
    }
  }
  expression(state, cache);
}

function expression(state: State, tokens: Token[]) {
  const { stack } = state;

  let token;

  while ((token = tokens.pop())) {
    switch (token.tokenType) {
      case Identifier:
        assignment(state, token);
        break;
      case SemiColon:
        clear(stack);
        break;
      case RCurly:
        tokens.push(token);
        block(state, tokens);
        break;
      case RBracket:
        switch (token.scope?.tangled?.tokenType) {
          case LBracket:
          case LParen:
          case LCurly:
          case Control:
          case Colon:
          case DoubleColon:
          case SemiColon:
          case undefined:
            tokens.push(token);
            block(state, tokens);
            break;
          default:
            stack.push(token);
            break;
        }
        break;
      case RParen:
      case LParen:
        break;
      default:
        stack.push(token);
        break;
    }
  }
  clear(stack);
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const cache: Token[] = [];
  const scope: Token[] = [];

  const state: State = {
    order: 1,
    exprs: 1,
    stack: [],
  };

  let namespace = "";
  let token, next;

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    token.index = i;
    token.scope = peek(scope);
    token.namespace = namespace;

    switch (token.tokenType) {
      case LBracket:
        next = peek(cache);
        if (next) {
          next.tangled = token;
          token.tangled = next;
        }
        scope.push(token);
        cache.push(token);
        token.exprs = state.exprs;
        break;
      case TestBegin:
      case TestBlock:
      case TestLambdaBlock:
      case LParen:
      case LCurly:
      case LSql:
        scope.push(token);
        cache.push(token);
        token.exprs = state.exprs;
        break;
      case RParen:
      case RBracket:
      case RCurly:
      case RSql:
        next = scope.pop();
        if (next) {
          cache.push(token);
          token.exprs = state.exprs;
        }
        break;
      case StringBegin:
        scope.push(token);
        cache.push(token);
        token.exprs = state.exprs;
        token.escaped = '\\"';
        break;
      case StringEnd:
        next = scope.pop();
        if (next) {
          cache.push(token);
          token.exprs = state.exprs;
          token.escaped = '\\"';
        }
        break;
      case SemiColon:
        token.exprs = state.exprs;
        if (token.scope) {
          cache.push(token);
        } else {
          expression(state, cache);
          state.exprs++;
        }
        break;
      case Operator:
      case Iterator:
        if (token.image.startsWith("\\")) {
          token.escaped = `\\${token.image}`;
        }
        cache.push(token);
        token.exprs = state.exprs;
        break;
      case EndOfLine:
        next = tokens[i + 1];
        if (next && isExpression(next)) {
          next = scope.pop();
          if (testblock(next)) {
            block(state, cache, false);
            next!.assignment = [next!, next!];
          } else {
            expression(state, cache);
          }
          token.escaped = ";";
          token.exprs = state.exprs;
          state.exprs++;
        } else if (token.scope?.tokenType === StringBegin) {
          token.exprs = state.exprs;
        }
        break;
      case StringEscape:
        checkEscape(token);
        if (token.image === '\\"' || token.image === "\\\\") {
          token.escaped = `\\\\${token.image}`;
        }
        token.exprs = state.exprs;
        break;
      case CharLiteral:
        token.exprs = state.exprs;
        break;
      case WhiteSpace:
        if (token.scope?.tokenType !== StringBegin) {
          token.escaped = " ";
        }
        token.exprs = state.exprs;
        break;
      case Command: {
        const [cmd, arg] = token.image.split(/[ \t]+/, 2);
        switch (cmd) {
          case "\\d":
            if (arg) {
              namespace = (arg.startsWith(".") && arg.split(".", 2)[1]) || "";
            }
            break;
        }
        token.exprs = state.exprs;
        token.escaped = `system \\"${token.image.slice(1)}\\"`;
        break;
      }
      default:
        if (isExpression(token)) {
          cache.push(token);
          token.exprs = state.exprs;
        }
        break;
    }
  }

  next = peek(scope);

  if (testblock(next)) {
    block(state, cache, false);
    next!.assignment = [next!, next!];
  } else {
    expression(state, cache);
  }

  return tokens;
}
