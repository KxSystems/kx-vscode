/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import * as fs from "fs";
import { createCoverageMap } from "istanbul-lib-coverage";
import { createInstrumenter } from "istanbul-lib-instrument";
import { createContext } from "istanbul-lib-report";
import { create } from "istanbul-reports";
import * as path from "path";

const REPO_ROOT = path.join(__dirname, "../..");

export function instrument() {
  const instrumenter = createInstrumenter({
    coverageVariable: "__coverage__",
    preserveComments: true,
    compact: false,
    esModules: true,
    autoWrap: true,
    produceSourceMap: true,
  });

  const files = rreaddir(path.resolve(REPO_ROOT, "out"));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (/\.js\.map$/.test(file)) {
      continue;
    }

    const inputPath = path.join(REPO_ROOT, "out", files[i]);
    const outputPath = path.join(REPO_ROOT, "out-cov", files[i]);

    if (!/\.js$/.test(file) || /(^|[\\/])(test|ipc)[\\/]/.test(file)) {
      copyFile(inputPath, outputPath);
      continue;
    }

    let map = undefined;
    try {
      const mapContent = fs.readFileSync(`${inputPath}.map`).toString();
      map = JSON.parse(mapContent);
    } catch {
      // missing source map - map remains undefined
    }

    const sourceCode = fs.readFileSync(inputPath).toString();

    const relativePath = path.relative(REPO_ROOT, inputPath);

    const instrumentedCode = instrumenter.instrumentSync(
      sourceCode,
      relativePath,
      map,
    );

    safeWriteFile(outputPath, instrumentedCode);
  }
}

export function createReport(): void {
  const global = new Function("return this")();

  if (!global.__coverage__ || Object.keys(global.__coverage__).length === 0) {
    console.warn("No coverage data available to generate report");
    return;
  }

  const coverageMap = createCoverageMap(global.__coverage__);

  // Use the simpler approach that we know works
  const context = createContext({
    dir: path.join(REPO_ROOT, `coverage-reports`),
    coverageMap: coverageMap,
  });

  const reports = [
    create("json"),
    create("lcov"),
    create("cobertura"),
    create("html"),
    create("text"),
  ];

  reports.forEach((report) => {
    try {
      report.execute(context);
    } catch (err) {
      console.error(
        `Failed to generate ${report.constructor.name} report:`,
        err,
      );
    }
  });
}

function copyFile(inputPath: string, outputPath: string): void {
  safeWriteFile(outputPath, fs.readFileSync(inputPath));
}

function safeWriteFile(filePath: string, contents: Buffer | string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

function ensureDir(dirname: string): void {
  if (fs.existsSync(dirname)) {
    return;
  }
  ensureDir(path.dirname(dirname));
  fs.mkdirSync(dirname);
}

function rreaddir(dirname: string): string[] {
  const result: string[] = [];
  _rreaddir(dirname, dirname, result);
  return result;
}

function _rreaddir(
  dirname: string,
  relativeTo: string,
  result: string[],
): void {
  const entries = fs.readdirSync(dirname);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryPath = path.join(dirname, entry);
    if (fs.statSync(entryPath).isDirectory()) {
      _rreaddir(entryPath, relativeTo, result);
    } else {
      result.push(path.relative(relativeTo, entryPath));
    }
  }
}
