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
  DoubleColon,
  LBracket,
  LCurly,
  LParen,
  RBracket,
  RCurly,
  RParen,
} from "./tokens";
import { CharLiteral } from "./literals";
import { Identifier, LSql, RSql, System } from "./keywords";
import {
  After,
  AfterEach,
  Baseline,
  Before,
  BeforeEach,
  Behaviour,
  Bench,
  Expect,
  Feature,
  Property,
  Replicate,
  Setup,
  Should,
  SkipIf,
  Teardown,
  TimeLimit,
  ToMatch,
  Tolerance,
} from "./quke";

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
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const scopes: Token[] = [];

  let namespace = "";
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
        next = tokens[i + 1];
        if (next?.tokenType === CharLiteral) {
          const [cmd, arg] = args(next.image.slice(1, -1), 2);
          switch (cmd) {
            case "d":
              if (token.startColumn === 1) {
                _namespace(arg);
              }
              break;
          }
        }
        break;
      case Feature:
      case Should:
      case Bench:
      case Replicate:
      case TimeLimit:
      case Tolerance:
        token.identifierKind = IdentifierKind.Quke;
        scopes.pop();
        break;
      case Expect:
      case ToMatch:
      case Property:
      case After:
      case AfterEach:
      case Before:
      case BeforeEach:
      case SkipIf:
      case Baseline:
      case Behaviour:
      case Setup:
      case Teardown:
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
