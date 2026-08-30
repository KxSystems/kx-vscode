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

import * as assert from "assert";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const NULLABLE = new Map<string, string>([
  ["--vscode-input-border", "dark, light"],
  ["--vscode-button-border", "dark, light"],
  ["--vscode-button-secondaryBackground", "high contrast dark"],
  ["--vscode-button-secondaryHoverBackground", "high contrast"],
  ["--vscode-toolbar-hoverBackground", "high contrast"],
  ["--vscode-toolbar-hoverOutline", "dark, light"],
  ["--vscode-toolbar-activeBackground", "high contrast"],
  ["--vscode-textBlockQuote-background", "high contrast dark"],
  ["--vscode-widget-shadow", "high contrast"],
  ["--vscode-checkbox-selectBackground", "not registered for every kind"],
  ["--vscode-panel-border", "set by the theme only"],
]);

function styleSources() {
  const root = resolve(__dirname, "..", "..", "..", "..", "..");
  const components = join(root, "src", "webview", "components");

  return [
    ...readdirSync(components)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => join(components, name)),
    join(root, "src", "utils", "webviewPage.ts"),
  ];
}

describe("theme tokens", () => {
  it("should give every token that a theme may not define a fallback", () => {
    const bare = /var\(\s*(--vscode-[\w.-]+)\s*\)/g;
    const offenders: string[] = [];

    for (const file of styleSources()) {
      const source = readFileSync(file, { encoding: "utf8" });
      let match: RegExpExecArray | null;
      while ((match = bare.exec(source))) {
        const token = match[1];
        if (NULLABLE.has(token)) {
          offenders.push(
            `${file.split("/").pop()}: ${token} is undefined in ${NULLABLE.get(token)}`,
          );
        }
      }
    }

    assert.deepStrictEqual(offenders, []);
  });

  it("should not reference Shoelace tokens", () => {
    for (const file of styleSources()) {
      const source = readFileSync(file, { encoding: "utf8" });
      assert.ok(
        !source.includes("--sl-"),
        `${file.split("/").pop()} still uses a Shoelace token`,
      );
    }
  });
});
