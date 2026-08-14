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

import { runTests } from "@vscode/test-electron";
import * as path from "path";

import { writeProfile } from "./e2e/profile";

// A second VS Code window, opened on test/e2e/workspace so the extension sees
// real workspace settings (including the stand-in q) and real files.
async function main() {
  if (process.platform === "win32") {
    // ReplConnection spawns the q binary through cmd.exe, which cannot run the
    // extensionless fakeq/bin/q the workspace points at. Running these on
    // Windows needs a .cmd (or .exe) stand-in first.
    console.log("⏭️  Skipping end to end tests on Windows");
    return;
  }

  try {
    const extensionDevelopmentPath = path.join(__dirname, "../../");
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath: path.join(__dirname, "./e2e/index"),
      launchArgs: [
        path.join(extensionDevelopmentPath, "test", "e2e", "workspace"),
        "--disable-workspace-trust",
        `--user-data-dir=${writeProfile()}`,
      ],
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
