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

export function instrumentQSource(source: string, filePath: string): string {
  const lines = source.split("\n");
  const result: string[] = [];

  const scopeStack: Set<string>[] = [];
  const scopeStartDepth: number[] = [];
  let braceDepth = 0;

  const topLevelVars = new Set<string>();

  let inString = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("/")) {
      result.push(line);
      continue;
    }

    const { netOpen, netClose, params, assignments } = analyzeQLine(
      line,
      inString,
    );
    inString = computeStringState(line, inString);

    const depthBefore = braceDepth;
    const enclosingScope =
      scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null;
    braceDepth += netOpen - netClose;

    if (netOpen > 0) {
      for (let b = 0; b < netOpen; b++) {
        const depth = depthBefore + b + 1;
        if (params !== null && b === 0) {
          scopeStack.push(new Set<string>(params));
          scopeStartDepth.push(depth);
        } else {
          scopeStack.push(new Set<string>());
          scopeStartDepth.push(depth);
        }
      }
    }

    if (!/^\}+$/.test(trimmed)) {
      const allVars = new Set<string>();
      if (depthBefore === 0) {
        for (const v of topLevelVars) allVars.add(v);
      } else {
        for (const scope of scopeStack) {
          for (const v of scope) allVars.add(v);
        }
      }

      const varList = [...allVars];
      const localsExpr =
        varList.length === 0
          ? `()!()`
          : varList.length === 1
            ? `(enlist\`${varList[0]})!enlist(${varList[0]})`
            : `\`${varList.join("`")}!(${varList.join(";")})`;

      const indent = line.match(/^(\s*)/)?.[1] ?? "";
      const escaped = filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      result.push(`${indent}.debug.bp["${escaped}";${lineNum};${localsExpr}];`);

      for (const name of assignments) {
        if (depthBefore === 0) {
          topLevelVars.add(name);
        } else if (enclosingScope) {
          enclosingScope.add(name);
        }
      }
    }

    if (netClose > 0) {
      for (let b = 0; b < netClose; b++) {
        if (scopeStack.length > 0) {
          scopeStack.pop();
          scopeStartDepth.pop();
        }
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

interface LineAnalysis {
  netOpen: number;
  netClose: number;
  params: string[] | null;
  assignments: string[];
}

function analyzeQLine(line: string, startInString: boolean): LineAnalysis {
  let open = 0;
  let close = 0;
  let inStr = startInString;
  let params: string[] | null = null;
  const assignments: string[] = [];

  let nesting = 0;
  let atStatementStart = true;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inStr) {
      if (ch === '"') inStr = false;
      continue;
    }

    if (ch === '"') {
      inStr = true;
      atStatementStart = false;
      continue;
    }
    if (ch === "/") break;

    if (ch === "{") {
      open++;
      nesting++;
      atStatementStart = false;
      const rest = line.slice(i + 1).trimStart();
      if (open === 1 && rest.startsWith("[")) {
        const end = rest.indexOf("]");
        if (end !== -1) {
          const paramStr = rest.slice(1, end).trim();
          params = paramStr
            ? paramStr
                .split(";")
                .map((p) => p.trim())
                .filter(Boolean)
            : [];
        }
      }
      continue;
    }
    if (ch === "}") {
      close++;
      if (nesting > 0) nesting--;
      atStatementStart = false;
      continue;
    }
    if (ch === "(" || ch === "[") {
      nesting++;
      atStatementStart = false;
      continue;
    }
    if (ch === ")" || ch === "]") {
      if (nesting > 0) nesting--;
      atStatementStart = false;
      continue;
    }

    if (nesting === 0 && ch === ";") {
      atStatementStart = true;
      continue;
    }
    if (ch === " " || ch === "\t") continue;

    if (nesting === 0 && atStatementStart) {
      const m = line.slice(i).match(/^([a-zA-Z][a-zA-Z0-9_.]*)\s*:/);
      if (m) assignments.push(m[1]);
    }
    atStatementStart = false;
  }

  return { netOpen: open, netClose: close, params, assignments };
}

function computeStringState(line: string, startInString: boolean): boolean {
  let inStr = startInString;
  for (const ch of line) {
    if (ch === '"') inStr = !inStr;
  }
  return inStr;
}
