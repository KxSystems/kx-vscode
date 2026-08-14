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

import * as fs from "fs";
import * as path from "path";

export const PROFILE = path.join(
  __dirname,
  "..",
  "..",
  "..",
  ".vscode-test",
  "e2e-user-data",
);

/**
 * Writes the throwaway VS Code profile the end to end window runs under, so a
 * command line run does not touch the developer's own VS Code settings.
 *
 * The connection tests do not rely on it: the debug launcher ignores
 * --user-data-dir and runs against the real profile, so they add the stand-in
 * connection themselves through kdb.connections.add.kdb and remove it again
 * afterwards. Whatever profile is in force, the suite leaves it as it found it.
 */
export function writeProfile() {
  const dir = path.join(PROFILE, "User");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "settings.json"),
    JSON.stringify({ "window.commandCenter": false }, null, 2),
  );
  return PROFILE;
}

if (require.main === module) {
  console.log(`🧾 End to end profile written to ${writeProfile()}`);
}
