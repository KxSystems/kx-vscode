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

    let sourceFilePath = files[i];

    sourceFilePath = sourceFilePath.replace(/\.js$/, ".ts");

    const instrumentedCode = instrumenter.instrumentSync(
      sourceCode,
      sourceFilePath,
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
      console.log(
        `✅ Generated ${report.constructor.name} report successfully`,
      );
    } catch (err) {
      console.error(
        `❌ Failed to generate ${report.constructor.name} report:`,
        err,
      );
    }
  });

  const summary = coverageMap.getCoverageSummary();
  console.log("\n=== COVERAGE SUMMARY ===");
  console.log(
    `Lines: ${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`,
  );
  console.log(
    `Functions: ${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total})`,
  );
}

export function fixLcovPaths(): void {
  const lcovPath = path.join(REPO_ROOT, "coverage-reports", "lcov.info");

  if (!fs.existsSync(lcovPath)) {
    console.warn("❌ lcov.info file not found");
    return;
  }

  let content = fs.readFileSync(lcovPath, "utf8");

  // console.log("\n=== FIXING LCOV PATHS ===");

  // const originalSfLines = content.match(/^SF:.*$/gm);
  // if (originalSfLines) {
  //   console.log("Original SF lines (first 5):");
  //   originalSfLines.slice(0, 5).forEach((line) => console.log(`  ${line}`));
  // }

  content = content.replace(/\\/g, "/");

  const repoRootEscaped = REPO_ROOT.replace(/[/\\]/g, "[/\\\\]");
  content = content.replace(
    new RegExp(`^SF:.*${repoRootEscaped}[/\\\\](.*)$`, "gm"),
    "SF:$1",
  );

  content = content.replace(/^SF:.*\/out\/(.*?)\.js$/gm, "SF:$1.ts");

  content = content.replace(/^SF:(src|server)\/(.*?)\.js$/gm, "SF:$1/$2.ts");

  content = content.replace(/^SF:(.*?)\.js$/gm, "SF:$1.ts");

  content = content.replace(/^SF:(src)\/\1\//gm, "SF:$1/");
  content = content.replace(/^SF:(server)\/\1\//gm, "SF:$1/");

  fs.writeFileSync(lcovPath, content);

  // const fixedSfLines = content.match(/^SF:.*$/gm);
  // if (fixedSfLines) {
  //   console.log("Fixed SF lines (first 5):");
  //   fixedSfLines.slice(0, 5).forEach((line) => console.log(`  ${line}`));
  // }

  console.log("✅ Fixed lcov.info paths");
}

export function debugLcov(): void {
  const lcovPath = path.join(REPO_ROOT, "coverage-reports", "lcov.info");

  if (!fs.existsSync(lcovPath)) {
    console.warn("❌ lcov.info file not found");
    return;
  }

  const content = fs.readFileSync(lcovPath, "utf8");

  console.log("\n=== LCOV DEBUG ===");

  const sfLines = content.match(/^SF:.*$/gm);
  if (sfLines) {
    console.log(`Found ${sfLines.length} source files:`);
    sfLines.forEach((line) => console.log(`  ${line}`));
  } else {
    console.log("❌ No SF (Source File) lines found in lcov.info");
  }
}

export function generateCoverageReport(): void {
  const coverageReportsDir = path.join(REPO_ROOT, "coverage-reports");

  const global = new Function("return this")();
  if (!global.__coverage__ || Object.keys(global.__coverage__).length === 0) {
    console.warn("❌ No coverage data available to generate report");
    console.warn("This might be because:");
    console.warn("1. Tests are not running with instrumented code");
    console.warn("2. No tests are actually executing the source code");
    console.warn("3. The coverage variable is not being set correctly");
    return;
  }

  if (!fs.existsSync(coverageReportsDir)) {
    console.log(`Creating coverage reports directory: ${coverageReportsDir}`);
    fs.mkdirSync(coverageReportsDir, { recursive: true });
  }

  createReport();

  const lcovPath = path.join(coverageReportsDir, "lcov.info");
  if (!fs.existsSync(lcovPath)) {
    console.error(`❌ lcov.info was not created at ${lcovPath}`);
    return;
  }

  console.log(`✅ lcov.info created at ${lcovPath}`);
  const stats = fs.statSync(lcovPath);
  console.log(`File size: ${stats.size} bytes`);

  fixLcovPaths();

  if (fs.existsSync(lcovPath)) {
    const finalStats = fs.statSync(lcovPath);
    console.log(`✅ Final lcov.info size: ${finalStats.size} bytes`);
  } else {
    console.error(`❌ lcov.info missing after processing!`);
  }

  console.log("✅ Coverage report generation completed!");
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
