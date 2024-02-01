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

import { runTests } from "@vscode/test-electron";
import * as path from "path";
import { instrument } from "./coverage";

async function main() {
  try {
    const extensionDevelopmentPath = path.join(__dirname, "../../");

    let extensionTestsPath = path.join(__dirname, "./suite/index");
    if (process.argv.indexOf("--coverage") >= 0) {
      // generate instrumented files at out-cov
      instrument();

      // load the instrumented files
      extensionTestsPath = path.join(
        __dirname,
        "../../out-cov/test/suite/index",
      );

      // signal that the coverage data should be gathered
      process.env["GENERATE_COVERAGE"] = "1";
    }

    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.log(err);
    console.error("Failed to run tests.");
    process.exit(1);
  }
}

main();
