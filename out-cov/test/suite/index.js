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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const glob_1 = __importDefault(require("glob"));
const mocha_1 = __importDefault(require("mocha"));
const path = __importStar(require("path"));
const coverage_1 = require("../coverage");
function run() {
    const options = {
        ui: "bdd",
        color: true,
        reporter: "mocha-multi-reporters",
        reporterOptions: {
            reporterEnabled: "spec, mocha-junit-reporter",
            mochaJunitReporterReporterOptions: {
                mochaFile: path.join(__dirname, "..", "..", "test-results.xml"),
            },
        },
    };
    const mocha = new mocha_1.default(options);
    const testsRoot = path.join(__dirname, "..");
    return new Promise((c, e) => {
        (0, glob_1.default)("**/**.test.js", { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err);
            }
            files.forEach((f) => mocha.addFile(path.join(testsRoot, f)));
            try {
                mocha.run((failures) => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    }
                    else {
                        c();
                    }
                });
            }
            catch (err) {
                console.error(err);
                e(err);
            }
        });
    }).then(() => {
        if (process.env["GENERATE_COVERAGE"]) {
            (0, coverage_1.createReport)();
        }
    });
}
exports.run = run;
//# sourceMappingURL=index.js.map