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

import { readdirSync, statSync } from "fs";
import { join } from "path";

function toCamelCase(str: string): string {
  return str
    .split(/[-_\s]/)
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

function isTestFile(fileName: string): boolean {
  return (
    fileName.endsWith(".test.js") &&
    fileName !== "index.test.js" &&
    !fileName.endsWith(".utils.test.js")
  );
}

function loadTestsFromDirectory(dirPath: string): void {
  const items = readdirSync(dirPath).sort((a, b) => a.localeCompare(b));

  const testFiles = items.filter((item) => {
    const itemPath = join(dirPath, item);
    return statSync(itemPath).isFile() && isTestFile(item);
  });

  testFiles.forEach((file) => {
    const filePath = join(dirPath, file);
    eval("require")(filePath);
  });

  const directories = items.filter((item) => {
    const itemPath = join(dirPath, item);
    return statSync(itemPath).isDirectory();
  });

  directories.forEach((dir) => {
    const subDirPath = join(dirPath, dir);
    const camelCaseName = toCamelCase(dir);

    describe(camelCaseName, () => {
      loadTestsFromDirectory(subDirPath);
    });
  });
}

describe("KDB VSCode Extension Unit Tests", () => {
  loadTestsFromDirectory(__dirname);
});
