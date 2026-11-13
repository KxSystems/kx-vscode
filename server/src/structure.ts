/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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

import { TokenType } from "chevrotain";

import {
  Control,
  Identifier,
  Keyword,
  LSql,
  Module,
  Reserved,
  RSql,
  System,
} from "./parser/keywords";
import { CommentLiteral } from "./parser/literals";
import { parse } from "./parser/parser";
import {
  CommentBegin,
  CommentEnd,
  ExitCommentBegin,
  StringBegin,
  StringEnd,
} from "./parser/ranges";
import {
  Command,
  CommentEndOfLine,
  Cond,
  Documentation,
  EndOfLine,
  LBracket,
  LCurly,
  LineComment,
  LParen,
  RBracket,
  RCurly,
  RParen,
  SemiColon,
  Colon,
  DoubleColon,
  WhiteSpace,
} from "./parser/tokens";
import { Token, inSql, inTable } from "./parser/utils";

export interface TopLevelStatement {
  startLine: number;
  startChar: number;
  endLine: number;
  text: string;
  namespace: string;
}

export interface LambdaPath {
  name: string;
  path: number[];
  startLine: number;
  rootLine: number;
  rootColumn?: number;
}

export interface LambdaTarget {
  name: string;
  path: number[];
  line: number;
  column: number;
  rootLine: number;
  rootColumn?: number;
}

export interface LambdaSpan {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface StatementSeparator {
  line: number;
  column: number;
}

export interface LineIdentifier {
  name: string;
  canon: string;
}

interface Unit {
  type?: TokenType;
  token?: Token;
  image: string;
  offset: number;
  line: number;
  column: number;
  endLine: number;
  end: number;
  trivia: boolean;
  foreign: boolean;
  string: boolean;
  namespace: string;
  contColumn: number;
}

interface Range {
  open: number;
  close: number;
}

const RESERVED = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "avg",
  "bin",
  "binr",
  "cor",
  "cos",
  "cov",
  "delete",
  "dev",
  "div",
  "do",
  "enlist",
  "exec",
  "exit",
  "exp",
  "getenv",
  "hopen",
  "if",
  "in",
  "insert",
  "last",
  "like",
  "log",
  "max",
  "min",
  "prd",
  "select",
  "setenv",
  "sin",
  "sqrt",
  "ss",
  "sum",
  "tan",
  "update",
  "var",
  "wavg",
  "while",
  "within",
  "wsum",
  "xexp",
  "from",
  "by",
]);

const WORDS = new Set<TokenType>([
  Identifier,
  Keyword,
  Reserved,
  System,
  Module,
  Control,
  LSql,
  RSql,
]);

const TRIVIA = new Set<TokenType>([
  WhiteSpace,
  EndOfLine,
  LineComment,
  Documentation,
  CommentBegin,
  CommentEnd,
  CommentLiteral,
  CommentEndOfLine,
  ExitCommentBegin,
]);

const OPENS = new Set<TokenType>([LParen, LBracket, LCurly]);
const CLOSES = new Set<TokenType>([RParen, RBracket, RCurly]);
const FOREIGN = ["k)", "p)", "s)"];

const IDENT = /^[a-zA-Z]\w*$/;
const DOTTED = /^[a-zA-Z0-9_.]*\.[a-zA-Z0-9_.]*$/;

function firstNonBlank(line: string) {
  const match = /[^ \t]/.exec(line);
  return match ? match.index : -1;
}

function blockCommentLines(lines: string[]) {
  const result = new Array<boolean>(lines.length).fill(false);
  const marks: number[] = [];
  const opens: boolean[] = [];
  lines.forEach((line, i) => {
    const chars = line.replace(/ /g, "");
    if (chars === "/" || chars === "\\") {
      marks.push(i);
      opens.push(chars === "/");
    }
  });
  let i = 0;
  while (i < marks.length) {
    if (opens[i]) {
      let j = i + 1;
      while (j < marks.length && opens[j]) {
        j++;
      }
      const end = j < marks.length ? marks[j] : lines.length - 1;
      for (let k = marks[i]; k <= end; k++) {
        result[k] = true;
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return result;
}

function foreignLineStates(lines: string[]) {
  const n = lines.length;
  const fnb = lines.map(firstNonBlank);
  const candidate = lines.map(
    (line, i) =>
      fnb[i] >= 0 && FOREIGN.includes(line.slice(fnb[i], fnb[i] + 2)),
  );
  const trivial = lines.map((line, i) => fnb[i] < 0 || line[fnb[i]] === "/");
  const code0 = lines.map((_, i) => !trivial[i] && fnb[i] === 0);
  const inBlock = blockCommentLines(lines);
  const state = new Array<number>(n).fill(0);
  let i = 0;
  while (i < n) {
    if (!candidate[i]) {
      i++;
    } else if (inBlock[i] || fnb[i] !== 0) {
      state[i] = 2;
      i++;
    } else {
      let j = i + 1;
      while (j < n && !code0[j]) {
        j++;
      }
      for (let k = i; k < j; k++) {
        if (k === i || !trivial[k]) {
          state[k] = 1;
        }
      }
      i = j;
    }
  }
  return state;
}

function canonical(name: string, namespace: string) {
  if (name.startsWith(".") || namespace === ".") {
    return name;
  }
  return `${namespace}.${name}`;
}

export class Structure {
  private readonly text: string;
  private readonly units: Unit[] = [];
  private readonly lambdas: Range[] = [];
  private readonly groups: Range[] = [];

  constructor(source: string) {
    this.text = source.replace(/\r\n/g, "\n");
    const lines = this.text.split("\n");
    const state = foreignLineStates(lines);
    const starts: number[] = [];
    let offset = 0;
    for (const line of lines) {
      starts.push(offset);
      offset += line.length + 1;
    }
    const masked = lines
      .map((line, i) =>
        state[i] > 0 && line.length > 0
          ? "/" + "x".repeat(line.length - 1)
          : line,
      )
      .join("\n");
    const lineOf = (at: number) => {
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= at) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      return lo;
    };
    let inString = false;
    for (const token of parse(masked)) {
      const start = token.startOffset;
      const end = start + token.image.length;
      const type = token.tokenType;
      if (type === StringBegin) {
        inString = true;
      }
      const string = inString;
      if (type === StringEnd) {
        inString = false;
      }
      const pieces: [number, number][] = [];
      if (type === EndOfLine || type === CommentEndOfLine) {
        for (let at = start; at < end; at++) {
          if (masked[at] === "\n") {
            pieces.push([at, at + 1]);
          }
        }
      } else {
        pieces.push([start, end]);
      }
      for (const [from, to] of pieces) {
        const line = lineOf(from);
        const lineState = state[line];
        const foreign = type === LineComment && lineState === 1 && !string;
        const trivia =
          !string &&
          !foreign &&
          (TRIVIA.has(type) || (type === LineComment && lineState === 2));
        const column = from - starts[line];
        this.units.push({
          type,
          token,
          image: this.text.slice(from, to),
          offset: from,
          end: to,
          line,
          column,
          endLine: lineOf(Math.max(from, to - 1)),
          trivia,
          foreign,
          string,
          namespace: ".",
          contColumn: foreign ? Number(firstNonBlank(lines[line]) > 0) : column,
        });
      }
    }
    this.assignNamespaces();
    this.collectRanges();
  }

  private structural(unit: Unit) {
    return !unit.string && !unit.trivia && !unit.foreign;
  }

  private isOpen(unit: Unit) {
    return this.structural(unit) && !!unit.type && OPENS.has(unit.type);
  }

  private isClose(unit: Unit) {
    return this.structural(unit) && !!unit.type && CLOSES.has(unit.type);
  }

  private is(unit: Unit | undefined, type: TokenType) {
    return !!unit && this.structural(unit) && unit.type === type;
  }

  private assignNamespaces() {
    let namespace = ".";
    let braces = 0;
    let i = 0;
    while (i < this.units.length) {
      const unit = this.units[i];
      if (this.is(unit, LCurly)) {
        braces++;
      } else if (this.is(unit, RCurly)) {
        braces--;
      }
      if (this.is(unit, Command)) {
        unit.namespace = namespace;
        const [cmd, arg] = unit.image.trim().split(/[ \t]+/, 2);
        if (cmd === "\\d" && arg?.startsWith(".")) {
          namespace = arg;
        }
        i++;
        continue;
      }
      if (this.is(unit, System) && braces === 0) {
        const j = this.skipWhiteSpace(i + 1);
        const begin = this.units[j];
        if (begin && begin.type === StringBegin) {
          let k = j + 1;
          while (k < this.units.length && this.units[k].type !== StringEnd) {
            k++;
          }
          const value = this.text.slice(
            begin.end,
            this.units[k]?.offset ?? begin.end,
          );
          const match = /^d[ \t](.*)$/s.exec(value);
          const arg = match?.[1].trim();
          unit.namespace = namespace;
          for (let m = i + 1; m < j; m++) {
            this.units[m].namespace = namespace;
          }
          if (arg?.startsWith(".")) {
            namespace = arg;
          }
          i = j;
          continue;
        }
      }
      unit.namespace = namespace;
      i++;
    }
  }

  private collectRanges() {
    const stack: number[] = [];
    this.units.forEach((unit, i) => {
      if (this.isOpen(unit)) {
        stack.push(i);
      } else if (this.isClose(unit) && stack.length > 0) {
        const open = stack.pop()!;
        if (this.units[open].type === LCurly) {
          this.lambdas.push({ open, close: i });
        } else {
          this.groups.push({ open, close: i });
        }
      }
    });
  }

  private skipWhiteSpace(i: number, limit = this.units.length) {
    while (
      i < limit &&
      !this.units[i].string &&
      this.units[i].type === WhiteSpace
    ) {
      i++;
    }
    return i;
  }

  private variable(unit: Unit) {
    if (!this.structural(unit) || !unit.type || !WORDS.has(unit.type)) {
      return false;
    }
    if (IDENT.test(unit.image)) {
      return !RESERVED.has(unit.image);
    }
    return unit.image.length > 1 && DOTTED.test(unit.image);
  }

  private innermost(ranges: Range[], idx: number) {
    let best: Range | undefined;
    for (const range of ranges) {
      if (range.open <= idx && idx <= range.close) {
        if (!best || range.close - range.open < best.close - best.open) {
          best = range;
        }
      }
    }
    return best;
  }

  private unitsOnLine(line: number) {
    const result: number[] = [];
    this.units.forEach((unit, i) => {
      if (unit.line === line) {
        result.push(i);
      }
    });
    return result;
  }

  private lambdaAtLine(line: number) {
    for (const idx of this.unitsOnLine(line)) {
      const home = this.innermost(this.lambdas, idx);
      if (home) {
        return home;
      }
    }
    return undefined;
  }

  private statement(first: number, last: number) {
    const head = this.units[first];
    const tail = this.units[last];
    return {
      startLine: head.line,
      startChar: head.column,
      endLine: tail.endLine,
      text: this.text.slice(head.offset, tail.end),
    };
  }

  private segments(boundaries: number[], from: number) {
    const result: [number, number][] = [];
    let start = from;
    for (const boundary of boundaries) {
      let first = -1;
      let last = -1;
      for (let i = start; i <= boundary; i++) {
        if (!this.units[i].trivia) {
          if (first < 0) {
            first = i;
          }
          last = i;
        }
      }
      if (first >= 0) {
        result.push([first, last]);
      }
      start = boundary + 1;
    }
    return result;
  }

  topLevelStatements(): TopLevelStatement[] {
    const n = this.units.length;
    if (n === 0) {
      return [];
    }
    const next = new Array<number>(n + 1).fill(-1);
    for (let i = n - 1; i >= 0; i--) {
      next[i] = this.units[i].trivia ? next[i + 1] : this.units[i].contColumn;
    }
    const boundaries: number[] = [];
    let depth = 0;
    for (let i = 0; i < n; i++) {
      const unit = this.units[i];
      if (this.isOpen(unit)) {
        depth++;
      } else if (this.isClose(unit)) {
        depth--;
      } else if (depth === 0) {
        if (
          this.is(unit, SemiColon) ||
          (!unit.string &&
            (unit.type === EndOfLine || unit.type === CommentEndOfLine) &&
            Math.max(next[i + 1], 0) === 0)
        ) {
          boundaries.push(i);
        }
      }
    }
    if (boundaries[boundaries.length - 1] !== n - 1) {
      boundaries.push(n - 1);
    }
    return this.segments(boundaries, 0).map(([first, last]) => ({
      ...this.statement(first, last),
      namespace: this.units[first].namespace,
    }));
  }

  private rhsStart(j: number) {
    const n = this.units.length;
    let i = this.skipWhiteSpace(j + 1);
    const unit = this.units[i];
    if (!unit || !(this.is(unit, Colon) || this.is(unit, DoubleColon))) {
      return -1;
    }
    i = this.skipWhiteSpace(i + 1);
    return i >= n ? -1 : i;
  }

  private directChildIndex(parent: Range, child: Range) {
    const inside = this.lambdas.filter(
      (range) => parent.open < range.open && range.close < parent.close,
    );
    const direct = inside
      .filter(
        (range) =>
          !inside.some(
            (other) => other.open < range.open && other.close > range.close,
          ),
      )
      .sort((a, b) => a.open - b.open);
    return direct.indexOf(child);
  }

  private rootName(root: Range) {
    const candidate = this.units.findIndex(
      (unit, j) =>
        this.variable(unit) &&
        this.rhsStart(j) === root.open &&
        !(unit.token && (inSql(unit.token) || inTable(unit.token))),
    );
    if (candidate < 0) {
      return undefined;
    }
    const target = this.units[candidate];
    return canonical(target.image, target.namespace);
  }

  private pathOf(home: Range, anonymous: boolean): LambdaPath | null {
    const chain = this.lambdas
      .filter((range) => range.open <= home.open && home.open <= range.close)
      .sort((a, b) => b.close - b.open - (a.close - a.open));
    const root = chain[0];
    const name = this.rootName(root);
    if (name === undefined && !anonymous) {
      return null;
    }
    const path: number[] = [];
    for (let k = 1; k < chain.length; k++) {
      path.push(this.directChildIndex(chain[k - 1], chain[k]));
    }
    const open = this.units[root.open];
    return {
      name: name ?? "",
      path,
      startLine: this.units[home.open].line,
      rootLine: open.line,
      ...(name === undefined ? { rootColumn: open.column } : {}),
    };
  }

  lambdaPath(
    line: number,
    anonymous = false,
    column?: number,
  ): LambdaPath | null {
    const home =
      column === undefined
        ? this.lambdaAtLine(line)
        : this.executing(this.unitAt(line, column));
    return home ? this.pathOf(home, anonymous) : null;
  }

  private executing(at: number) {
    if (at < 0) {
      return undefined;
    }
    return this.innermost(
      this.lambdas.filter((range) => range.open !== at && range.close !== at),
      at,
    );
  }

  private unitAt(line: number, column: number) {
    let fallback = -1;
    for (let i = 0; i < this.units.length; i++) {
      const unit = this.units[i];
      if (unit.line !== line) continue;
      if (fallback < 0) fallback = i;
      if (unit.column <= column && column < unit.column + unit.image.length) {
        return i;
      }
    }
    return fallback;
  }

  private separatorsOf(home: Range) {
    const all = [...this.lambdas, ...this.groups];
    const result: number[] = [];
    this.units.forEach((unit, i) => {
      if (!this.is(unit, SemiColon)) {
        return;
      }
      if (this.innermost(this.lambdas, i) !== home) {
        return;
      }
      const direct = this.innermost(all, i);
      if (direct === home || (direct && this.controlBracket(direct.open))) {
        result.push(i);
      }
    });
    return result;
  }

  statementLambdas(line: number, column: number): LambdaTarget[] {
    const at = this.unitAt(line, column);
    const home = this.executing(at);
    if (!home) {
      return [];
    }
    const separators = this.separatorsOf(home);
    const from = Math.max(home.open, ...separators.filter((i) => i < at));
    const to = Math.min(home.close, ...separators.filter((i) => i >= at));
    return this.targets(
      this.lambdas.filter(
        (range) => range !== home && from < range.open && range.close < to,
      ),
    );
  }

  rootLambdas(startLine: number, endLine: number): LambdaSpan[] {
    return this.lambdas
      .filter((range) => {
        const open = this.units[range.open];
        return (
          open.line >= startLine &&
          open.line <= endLine &&
          !this.lambdas.some(
            (other) => other.open < range.open && range.close < other.close,
          ) &&
          this.rootName(range) === undefined
        );
      })
      .sort((a, b) => a.open - b.open)
      .map((range) => {
        const open = this.units[range.open];
        const close = this.units[range.close];
        return {
          line: open.line,
          column: open.column,
          endLine: close.line,
          endColumn: close.column + 1,
        };
      });
  }

  private targets(ranges: Range[]): LambdaTarget[] {
    return [...ranges]
      .sort((a, b) => a.open - b.open)
      .map((range) => ({ range, path: this.pathOf(range, true)! }))
      .map(({ range, path }) => ({
        name: path.name,
        path: path.path,
        line: this.units[range.open].line,
        column: this.units[range.open].column,
        rootLine: path.rootLine,
        ...(path.rootColumn === undefined
          ? {}
          : { rootColumn: path.rootColumn }),
      }));
  }

  private controlBracket(open: number) {
    if (open <= 0 || !this.is(this.units[open], LBracket)) {
      return false;
    }
    const before = this.units[open - 1];
    return (
      this.structural(before) &&
      (before.type === Cond ||
        (before.type === Control &&
          ["if", "while", "do"].includes(before.image)))
    );
  }

  statementSeparators(line: number): StatementSeparator[] {
    const home = this.lambdaAtLine(line);
    if (!home) {
      return [];
    }
    return this.separatorsOf(home).map((i) => ({
      line: this.units[i].line,
      column: this.units[i].column,
    }));
  }

  identifiersOnLines(startLine: number, endLine: number): LineIdentifier[] {
    const seen = new Set<string>();
    const result: LineIdentifier[] = [];
    for (const unit of this.units) {
      if (
        unit.line >= startLine &&
        unit.line <= endLine &&
        this.variable(unit)
      ) {
        const canon = canonical(unit.image, unit.namespace);
        const key = `${unit.image}\u0000${canon}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ name: unit.image, canon });
        }
      }
    }
    return result;
  }
}
