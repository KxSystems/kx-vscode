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
import { Identifier, IdentifierPattern, LSql, RSql } from "./keywords";
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

function isIdentifier(image: string): boolean {
  const matches = IdentifierPattern.exec(image);
  return !matches || matches[0] === image;
}

function setQualified(token: Token, namespace: string): void {
  token.identifier =
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
  Table,
  Sql,
  Quke,
}

export interface Token extends IToken {
  kind?: TokenKind;
  identifier?: string;
  identifierKind?: IdentifierKind;
  scope?: Token;
  lambda?: Token;
  description?: string;
}

export function parse(text: string): Token[] {
  const result = QLexer.tokenize(text);
  const tokens = result.tokens as Token[];
  const scopes: Token[] = [];

  let namespace = "";
  let sql = 0;
  let table = 0;
  let argument = 0;
  let token, prev, next: IToken;

  for (let i = 0; i < tokens.length; i++) {
    token = tokens[i];
    switch (token.tokenType) {
      case Identifier:
        if (argument) {
          token.kind = TokenKind.Assignment;
          token.identifierKind = IdentifierKind.Argument;
          token.scope = scopes[scopes.length - 1];
          token.identifier = token.image;
        } else {
          token.kind = TokenKind.Identifier;
          if (!token.image.includes(".")) {
            token.scope = scopes[scopes.length - 1];
          }
          setQualified(token, namespace);
        }
        break;
      case Colon:
      case DoubleColon:
        prev = tokens[i - 1];
        if (prev?.kind === TokenKind.Identifier) {
          if (sql) {
            prev.identifierKind = IdentifierKind.Sql;
          } else if (table) {
            prev.identifierKind = IdentifierKind.Table;
          } else {
            prev.kind = TokenKind.Assignment;
            if (token.tokenType === DoubleColon) {
              prev.scope = undefined;
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
        next = tokens[i + 1];
        if (next?.tokenType === LBracket) {
          argument++;
        }
        scopes.push(token);
        break;
      case RBracket:
        if (argument) {
          argument--;
        }
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
        break;
      case RParen:
        if (table) {
          table--;
        }
        break;
      case Command:
        const [cmd, arg] = args(token.image, 2);
        switch (cmd) {
          case "\\d":
            if (arg && arg.startsWith(".") && isIdentifier(arg)) {
              namespace = arg === "." ? "" : arg;
            }
            break;
        }
        break;
      case Bench:
      case Feature:
      case Replicate:
      case Should:
      case TimeLimit:
      case Tolerance:
        token.identifierKind = IdentifierKind.Quke;
        scopes.pop();
        break;
      case After:
      case AfterEach:
      case Baseline:
      case Before:
      case BeforeEach:
      case Behaviour:
      case Expect:
      case Property:
      case Setup:
      case SkipIf:
      case Teardown:
      case ToMatch:
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
