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

import { runTests } from "@vscode/test-electron";
import * as path from "path";

import { instrument } from "./coverage";

async function main() {
  try {
    console.log("=== RUN TEST DEBUG ===");
    console.log(`Process arguments: ${process.argv.join(" ")}`);
    console.log(`Current working directory: ${process.cwd()}`);

    const extensionDevelopmentPath = path.join(__dirname, "../../");
    console.log(`Extension development path: ${extensionDevelopmentPath}`);

    let extensionTestsPath = path.join(__dirname, "./suite/index");
    console.log(`Default extension tests path: ${extensionTestsPath}`);

    const hasCoverageFlag = process.argv.indexOf("--coverage") >= 0;
    console.log(`Has --coverage flag: ${hasCoverageFlag}`);

    if (hasCoverageFlag) {
      console.log("🔧 Coverage mode enabled, instrumenting code...");

      try {
        instrument();
        console.log("✅ Code instrumentation completed");
      } catch (error) {
        console.error("❌ Code instrumentation failed:", error);
        throw error;
      }

      extensionTestsPath = path.join(
        __dirname,
        "../../out-cov/test/suite/index",
      );
      console.log(`Instrumented extension tests path: ${extensionTestsPath}`);

      process.env["GENERATE_COVERAGE"] = "1";
      console.log(
        `✅ GENERATE_COVERAGE set to: ${process.env["GENERATE_COVERAGE"]}`,
      );
    } else {
      console.log("⚠️ Coverage mode disabled, running normal tests");
    }

    console.log("🚀 Starting VS Code tests...");
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
    });
    console.log("✅ VS Code tests completed");
  } catch (err) {
    console.log(err);
    console.error("Failed to run tests.");
    process.exit(1);
  }
}

main();
