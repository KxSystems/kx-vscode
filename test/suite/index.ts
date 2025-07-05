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

import { glob } from "glob";
import Mocha from "mocha";
import * as path from "path";

import { generateCoverageReport } from "../coverage";

export async function run(): Promise<void> {
  const headless = !!process.env.CI;

  const options: Mocha.MochaOptions = {
    ui: "bdd",
    color: true,
    reporter: "mocha-multi-reporters",
    timeout: headless ? 2_000 : 600_000,
    reporterOptions: {
      reporterEnabled: "spec, mocha-junit-reporter",
      mochaJunitReporterReporterOptions: {
        mochaFile: path.join(__dirname, "..", "..", "test-results.xml"),
      },
    },
  };

  const mocha = new Mocha(options);
  const testsRoot = path.join(__dirname, "..");

  try {
    const files = await glob("**/suite/**.test.js", { cwd: testsRoot });

    files.forEach((f) => mocha.addFile(path.join(testsRoot, f)));

    return new Promise<void>((resolve, reject) => {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    }).then(() => {
      if (process.env["GENERATE_COVERAGE"]) {
        try {
          generateCoverageReport();
          console.log("✅ Coverage generation completed successfully");
        } catch (error) {
          console.error("❌ Coverage generation failed:", error);
          throw error;
        }
      } else {
        // console.log(
        //   "❌ GENERATE_COVERAGE not set, skipping coverage generation",
        // );
      }
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}
