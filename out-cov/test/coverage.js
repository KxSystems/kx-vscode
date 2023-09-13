"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReport = exports.instrument = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const istanbul_lib_coverage_1 = require("istanbul-lib-coverage");
const istanbul_reports_1 = require("istanbul-reports");
const REPO_ROOT = path.join(__dirname, "../..");
function instrument() {
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
        }
        catch (err) {
            // missing source map
        }
        const instrumentedCode = instrumenter.instrumentSync(fs.readFileSync(inputPath).toString(), inputPath, map);
        safeWriteFile(outputPath, instrumentedCode);
    }
}
exports.instrument = instrument;
function createReport() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const iLibSourceMaps = require("istanbul-lib-source-maps");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const iLibReport = require("istanbul-lib-report");
    const global = new Function("return this")();
    const mapStore = iLibSourceMaps.createSourceMapStore();
    const coverageMap = (0, istanbul_lib_coverage_1.createCoverageMap)(global.__coverage__);
    const transformed = mapStore.transformCoverage(coverageMap);
    const tree = iLibReport.summarizers.flat(transformed.map);
    const context = iLibReport.createContext({
        dir: path.join(REPO_ROOT, `coverage-reports`),
    });
    const reports = [
        (0, istanbul_reports_1.create)("json"),
        (0, istanbul_reports_1.create)("lcov"),
        (0, istanbul_reports_1.create)("html"),
        (0, istanbul_reports_1.create)("text"),
    ];
    reports.forEach((report) => tree.visit(report, context));
}
exports.createReport = createReport;
function copyFile(inputPath, outputPath) {
    safeWriteFile(outputPath, fs.readFileSync(inputPath));
}
function safeWriteFile(filePath, contents) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, contents);
}
function ensureDir(dirname) {
    if (fs.existsSync(dirname)) {
        return;
    }
    ensureDir(path.dirname(dirname));
    fs.mkdirSync(dirname);
}
function rreaddir(dirname) {
    const result = [];
    _rreaddir(dirname, dirname, result);
    return result;
}
function _rreaddir(dirname, relativeTo, result) {
    const entries = fs.readdirSync(dirname);
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryPath = path.join(dirname, entry);
        if (fs.statSync(entryPath).isDirectory()) {
            _rreaddir(entryPath, relativeTo, result);
        }
        else {
            result.push(path.relative(relativeTo, entryPath));
        }
    }
}
//# sourceMappingURL=coverage.js.map