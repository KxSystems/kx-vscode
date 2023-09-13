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

import * as fs from "fs";
import * as path from "path";

import { createCoverageMap } from "istanbul-lib-coverage";
import { create } from "istanbul-reports";

const REPO_ROOT = path.join(__dirname, "../..");

export function instrument() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const iLibInstrument = require("istanbul-lib-instrument");

  const instrumenter = iLibInstrument.createInstrumenter();
  const files = rreaddir(path.resolve(REPO_ROOT, "out"));
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (/\.js\.map$/.test(file)) {
      continue;
    }

    const inputPath = path.join(REPO_ROOT, "out", files[i]);
    const outputPath = path.join(REPO_ROOT, "out-cov", files[i]);

    if (!/\.js$/.test(file) || /(^|[\\/])test[\\/]/.test(file)) {
      copyFile(inputPath, outputPath);
      continue;
    }

    let map = null;
    try {
      map = JSON.parse(fs.readFileSync(`${inputPath}.map`).toString());
    } catch (err) {
      // missing source map
    }

    const instrumentedCode = instrumenter.instrumentSync(
      fs.readFileSync(inputPath).toString(),
      inputPath,
      map
    );
    safeWriteFile(outputPath, instrumentedCode);
  }
}

export function createReport(): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const iLibSourceMaps = require("istanbul-lib-source-maps");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const iLibReport = require("istanbul-lib-report");

  const global = new Function("return this")();

  const mapStore = iLibSourceMaps.createSourceMapStore();
  const coverageMap = createCoverageMap(global.__coverage__);
  const transformed = mapStore.transformCoverage(coverageMap);

  const tree = iLibReport.summarizers.flat(transformed.map);
  const context = iLibReport.createContext({
    dir: path.join(REPO_ROOT, `coverage-reports`),
  });

  const reports = [
    create("json"),
    create("lcov"),
    create("html"),
    create("text"),
  ];
  reports.forEach((report) => tree.visit(report, context));
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
  result: string[]
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
