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

import glob from "glob";
import Mocha from "mocha";
import * as path from "path";

import { createReport } from "../coverage";

export function run(): Promise<void> {
  const options: Mocha.MochaOptions = {
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

  const mocha = new Mocha(options);
  const testsRoot = path.join(__dirname, "..");

  return new Promise<void>((c, e) => {
    glob("**/**.test.js", { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      files.forEach((f) => mocha.addFile(path.join(testsRoot, f)));

      try {
        mocha.run((failures) => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  }).then(() => {
    if (process.env["GENERATE_COVERAGE"]) {
      createReport();
    }
  });
}
