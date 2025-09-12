/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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
import { Diagnostic, Position, Range } from "vscode-languageserver";

import { Identifier, LSql, RSql } from "./keywords";
import { QLexer } from "./lexer";
import { ExitCommentBegin } from "./ranges";
import {
  Colon,
  Command,
  Comparator,
  Cond,
  CutDrop,
  DoubleColon,
  EndOfLine,
  Iterator,
  LBracket,
  LCurly,
  LParen,
  Operator,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  WhiteSpace,
} from "./tokens";

export interface Token extends IToken {
  index?: number;
  namespace?: string;
  call?: Token;
  mode?: Token;
  feat?: Token;
  scope?: Token;
  rank?: number;
  error?: Diagnostic;
}

export class Source {
  declare readonly tokens: Token[];
  readonly errors: Token[] = [];
  readonly references: Token[] = [];
  readonly definitions: Token[] = [];

  private constructor(
    readonly uri: string,
    text: string,
  ) {
    this.tokens = QLexer.tokenize(text).tokens as Token[];
  }

  private handleRCurly(scope: Token) {
    const tokens = this.definitions.filter((token) => token.scope === scope);
    const rank = scope.rank ?? 0;

    this.references.forEach((reference) => {
      if (reference.scope !== scope) {
        return;
      }
      if (reference.image.startsWith(".")) {
        reference.scope = undefined;
      } else {
        const name = Name(reference);
        const found = tokens.find((token) => name === Name(token));

        if (!found) {
          if (rank === 0 && (name === "x" || name === "y" || name === "z")) {
            return;
          }
          reference.scope = undefined;
        }
      }
    });
  }

  private parse() {
    const modes: Token[] = [];
    const feats: Token[] = [];
    const scope: Token[] = [];
    const stack: Token[] = [];

    let index = 0;
    let namespace = ".";
    let command: string;
    let token: Token | undefined;
    let current: Token;

    const Assign = (pattern = true) => {
      let count = 0;

      while ((token = stack.pop())) {
        if (Type(token) === Identifier) {
          this.definitions.push(token);
          count++;
          if (!pattern) {
            stack.length = 0;
            break;
          }
        }
      }
      return count;
    };

    for (let i = 0; i < this.tokens.length; i++) {
      current = this.tokens[i];
      current.mode = Peek(modes);
      current.feat = Peek(feats);
      current.scope = Peek(scope);
      current.index = index;
      current.namespace = namespace;

      switch (Type(current)) {
        case LParen:
          modes.push(current);
          stack.push(current);
          break;
        case RParen:
          if (Type(current.feat) === LParen) {
            feats.pop();
          }
          modes.pop();
          stack.push(current);
          break;
        case LCurly:
          scope.push(current);
          modes.push(current);
          stack.length = 0;
          token = Peek(this.definitions);
          if (token) token.call = current;
          this.definitions.push(current);
          break;
        case RCurly:
          token = Peek(scope);
          if (token && Type(token) === LCurly) this.handleRCurly(token);
          scope.pop();
          modes.pop();
          stack.length = 0;
          break;
        case LBracket:
          token = Seek(this.tokens, i, -1);
          if (token && (Type(token) === LCurly || Type(token) === LParen)) {
            feats.push(token);
          }
          modes.push(current);
          stack.length = 0;
          break;
        case RBracket:
          if (Type(current.feat) === LCurly) {
            current.feat!.rank = Assign();
            feats.pop();
          } else if (Type(current.feat) !== LParen) {
            stack.length = 0;
          }
          modes.pop();
          break;
        case LSql:
          modes.push(current);
          stack.length = 0;
          break;
        case RSql:
          modes.pop();
          stack.length = 0;
          break;
        case Identifier:
          stack.push(current);
          this.references.push(current);
          break;
        case Colon:
          if (Type(current.feat) === LParen || Type(current.mode) === LSql) {
            stack.forEach((token) =>
              this.references.splice(this.references.indexOf(token), 1),
            );
            stack.length = 0;
          } else if (Type(current.feat) !== LCurly) {
            Assign(Type(Peek(stack)) === RParen && Type(stack[0]) === LParen);
          }
          break;
        case SemiColon:
          if (
            Type(current.feat) !== LCurly &&
            Type(current.feat) !== LParen &&
            Type(current.mode) !== LParen
          ) {
            stack.length = 0;
          }
          if (!current.mode) {
            index++;
          }
          break;
        case EndOfLine:
          if (Type(this.tokens[i + 1]) !== WhiteSpace) {
            stack.length = 0;
            index++;
          }
          break;
        case Command:
          command = current.image.split(/^\\d[ \t]+/s)[1];
          if (command !== undefined) {
            namespace = command || ".";
          }
          stack.length = 0;
          break;
        case Iterator:
        case DoubleColon:
        case Comparator:
        case CutDrop:
        case Operator:
        case Cond:
          stack.length = 0;
          break;
        case ExitCommentBegin:
          return;
      }
    }
  }

  private process() {
    for (const reference of this.references) {
      const definition = this.definitions.find(
        (token) => Name(token) === Name(reference),
      );

      if (definition?.call) reference.call = definition.call;
    }
  }

  get symbols() {
    return this.definitions.filter((token) => token.scope === undefined);
  }

  tokenAt(position: Position) {
    return this.tokens.find((token) => {
      const { start, end } = RangeFrom(token);

      return (
        start.line <= position.line &&
        end.line >= position.line &&
        start.character <= position.character &&
        end.character >= position.character
      );
    });
  }

  static create(uri: string, text: string) {
    const source = new Source(uri, text);

    source.parse();
    source.process();
    return source;
  }
}

function Seek(tokens: Token[], index: number, step = 1): Token | undefined {
  index += step;
  while (
    tokens[index] &&
    (Type(tokens[index]) === WhiteSpace || Type(tokens[index]) === EndOfLine)
  ) {
    index += step;
  }
  return tokens[index];
}

export function Peek(tokens: Token[]): Token | undefined {
  return tokens[tokens.length - 1];
}

export function Scope(token?: Token) {
  return token?.scope;
}

export function Name(token?: Token) {
  return token
    ? token.namespace === "." || token.image.startsWith(".")
      ? token.image
      : token.namespace + "." + token.image
    : "";
}

export function Type(token?: Token) {
  return token?.tokenType;
}

export function Param(token?: Token) {
  return Type(token?.feat) === LCurly;
}

export function Callable(token?: Token) {
  return !!token?.call;
}

export function Token(token: Partial<Token>) {
  return token as Token;
}

export function RangeFrom(token: Token): Range {
  return Range.create(
    (token.startLine || 1) - 1,
    (token.startColumn || 1) - 1,
    (token.endLine || 1) - 1,
    token.endColumn || 1,
  );
}

// TODO
export function Namespace(token: Token) {
  const name = Name(token);

  return (name.startsWith(".") && name.split(".", 3)[1]) || "";
}

// TODO
export function Relative(token: Token, source: Token | undefined) {
  return source?.namespace
    ? Name(token).replace(new RegExp(`^\\${source.namespace}\\.`), "")
    : Name(token);
}
