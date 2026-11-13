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

export interface QFrame {
  index: number;

  file?: string;

  line?: number;

  text: string;

  column?: number;

  current: boolean;

  sourceLine?: string;

  block: string[];
}

const FRAME_RE = /^(>>|\s\s)\[(\d+)\]\s\s?(.*)$/;
const FILE_RE = /^(.*):(\d+):\s(.*)$/;

export function parseBacktrace(text: string): QFrame[] {
  const lines = text.split("\n");
  const frames: QFrame[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = FRAME_RE.exec(lines[i]);
    if (!m) continue;

    const current = m[1] === ">>";
    const index = Number(m[2]);
    let body = m[3];
    let file: string | undefined;
    let line: number | undefined;

    const fm = FILE_RE.exec(body);
    if (fm) {
      file = fm[1];
      line = Number(fm[2]);
      body = fm[3];
    }

    let column: number | undefined;
    const next = lines[i + 1];
    if (next && next.trim() === "^") {
      const sourceStart = lines[i].length - body.length;
      column = Math.max(0, next.indexOf("^") - sourceStart);
    }

    let sourceLine: string | undefined;
    if (file === undefined) {
      for (let j = i + 1; j < lines.length; j++) {
        if (FRAME_RE.test(lines[j])) break;
        if (/^\s*\^\s*$/.test(lines[j]) && j > i + 1) {
          sourceLine = lines[j - 1];
          break;
        }
      }
    }

    const block: string[] = [];
    for (let j = i + 1; j < lines.length && !FRAME_RE.test(lines[j]); j++) {
      block.push(lines[j]);
    }
    while (block.length > 0 && block[block.length - 1].trim() === "") {
      block.pop();
    }

    frames.push({
      index,
      file,
      line,
      text: body,
      column,
      current,
      sourceLine,
      block,
    });
  }

  return frames;
}

export interface QPosition {
  file?: string;

  line?: number;

  col?: number;

  index?: number;

  sourceLine?: string;

  name?: string;
}

export function parseCurrentPosition(text: string): QPosition | undefined {
  const lines = text.split("\n");
  const hasCurrent = lines.some((l) => l.startsWith(">>"));

  for (let i = 0; i < lines.length; i++) {
    const m = FRAME_RE.exec(lines[i]);
    if (!m) continue;
    if (hasCurrent && m[1] !== ">>") continue;

    let file: string | undefined;
    let line: number | undefined;
    const fm = FILE_RE.exec(m[3]);
    if (fm) {
      file = fm[1];
      line = Number(fm[2]);
    }

    const name =
      file === undefined
        ? (/^([.\w]+)[@:]/.exec(m[3])?.[1] ?? undefined)
        : undefined;

    let col: number | undefined;
    let sourceLine: string | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      if (FRAME_RE.test(lines[j])) break;
      if (/^\s*\^\s*$/.test(lines[j])) {
        col = lines[j].indexOf("^");

        if (j === i + 1) {
          const body = fm ? fm[3] : m[3];
          col = Math.max(0, col - (lines[i].length - body.length));
        } else if (file === undefined) {
          sourceLine = lines[j - 1];
        }
        break;
      }
    }
    return { file, line, col, index: Number(m[2]), sourceLine, name };
  }
  return undefined;
}
