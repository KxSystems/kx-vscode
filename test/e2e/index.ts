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

import { glob } from "glob";
import Mocha from "mocha";
import * as path from "path";

// These tests drive the activated extension through its real commands, against
// a real workspace and a stand-in q process, so they are slower and less
// isolated than test/suite. They run in their own VS Code window; see
// test/runE2E.ts.
export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
    timeout: 60_000,
    reporter: "mocha-multi-reporters",
    reporterOptions: {
      reporterEnabled: "spec, mocha-junit-reporter",
      mochaJunitReporterReporterOptions: {
        mochaFile: path.join(__dirname, "..", "..", "test-results-e2e.xml"),
      },
    },
  });

  const testsRoot = path.join(__dirname, "..");

  // TEST_FILE narrows the run to one file, the same way test/suite/index.ts
  // does. The launch configurations pass the open editor's name, which for
  // local.test.ts arrives as "local.test".
  const testFile = process.env.TEST_FILE?.replace(/\.test$/m, "");
  const pattern = testFile ? `e2e/**/${testFile}.test.js` : "e2e/**/*.test.js";

  if (testFile) {
    console.log(`🧪 Running specific end to end file: ${testFile}.test.js`);
  }

  const files = await glob(pattern, { cwd: testsRoot });

  if (files.length === 0) {
    throw new Error(
      `❌ No end to end test files found for: ${testFile ?? "any tests"}`,
    );
  }

  files.forEach((file) => mocha.addFile(path.join(testsRoot, file)));

  return new Promise<void>((resolve, reject) => {
    mocha.run((failures) =>
      failures > 0 ? reject(new Error(`${failures} tests failed.`)) : resolve(),
    );
  });
}
