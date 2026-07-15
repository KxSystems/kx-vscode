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

/**
 * A single stack frame parsed from the native q debugger backtrace (`.Q.bt[]`).
 */
export interface QFrame {
  /** Frame index as reported by q ([0] is the outermost / entry call). */
  index: number;
  /** Absolute file path if the frame originates from a loaded script, else undefined. */
  file?: string;
  /** 1-based source line if known. */
  line?: number;
  /** The source text of the frame. */
  text: string;
  /** 0-based column of the `^` caret q draws under the failing token, if present. */
  column?: number;
  /** True for the frame the debugger currently points at (q marks it `>>`). */
  current: boolean;
}

/**
 * Parse the text `.Q.bt[]` prints. Frame lines look like:
 *   `>>[2]  /path/file.q:1: g:{[z] a:z+1; a+` + "`" + `sym}`
 *   `  [1]  f:{[x] b:x*2; g[b]}`
 * each optionally followed by a caret line whose `^` marks the failing column.
 */
export function parseBacktrace(text: string): QFrame[] {
  const lines = text.split("\n");
  const frames: QFrame[] = [];
  const frameRe = /^(>>|\s\s)\[(\d+)\]\s\s?(.*)$/;
  const fileRe = /^(.*):(\d+):\s(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(frameRe);
    if (!m) continue;

    const current = m[1] === ">>";
    const index = Number(m[2]);
    let body = m[3];
    let file: string | undefined;
    let line: number | undefined;

    const fm = body.match(fileRe);
    if (fm) {
      file = fm[1];
      line = Number(fm[2]);
      body = fm[3];
    }

    // The caret line (if any) is the next line and points at the failing column.
    // Report it relative to the frame's source text (`body` is a suffix of the line).
    let column: number | undefined;
    const next = lines[i + 1];
    if (next && next.trim() === "^") {
      const sourceStart = lines[i].length - body.length;
      column = Math.max(0, next.indexOf("^") - sourceStart);
    }

    frames.push({ index, file, line, text: body, column, current });
  }

  return frames;
}

/** The current execution position of the suspended frame. */
export interface QPosition {
  /** Absolute file path of the current frame, if from a loaded script. */
  file?: string;
  /** 1-based source line the debugger currently points at. */
  line?: number;
  /** 0-based column of the `^` caret within that source line, if drawn. */
  col?: number;
}

/**
 * Extract the current execution position from a `.Q.bt[]` dump: the `>>` frame's
 * `file:line` and the column of the `^` caret q draws under the current token.
 * Unlike a top-level error, a suspended lambda's caret sits a few display lines
 * below the frame header (the frame prints the function's whole source), so scan
 * forward to the caret line, stopping at the next frame. Columns are absolute in
 * the source line (matching the parser), for mapping a step to a statement.
 */
export function parseCurrentPosition(text: string): QPosition | undefined {
  const lines = text.split("\n");
  const frameRe = /^(>>|\s\s)\[(\d+)\]\s\s?(.*)$/;
  const fileRe = /^(.*):(\d+):\s(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(frameRe);
    if (!m || m[1] !== ">>") continue;

    let file: string | undefined;
    let line: number | undefined;
    const fm = m[3].match(fileRe);
    if (fm) {
      file = fm[1];
      line = Number(fm[2]);
    }

    let col: number | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      if (frameRe.test(lines[j])) break;
      if (/^\s*\^\s*$/.test(lines[j])) {
        col = lines[j].indexOf("^");
        break;
      }
    }
    return { file, line, col };
  }
  return undefined;
}
