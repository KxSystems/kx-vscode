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

import * as assert from "assert";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Docs", () => {
  let readme: string;
  let images: string[];

  before(() => {
    const root = resolve(__dirname, "..", "..", "..", "..");
    readme = readFileSync(resolve(root, "README.md"), {
      encoding: "utf8",
    });
    images = readdirSync(resolve(root, ".README"));
  });

  describe("README", () => {
    it("should contain secure external links", () => {
      const regex = /\[.*?\]\((.*?)\)/gs;
      let match: RegExpExecArray;
      while ((match = regex.exec(readme))) {
        if (!match[1].startsWith("#")) {
          assert.ok(match[1].startsWith("https://"));
        }
      }
    });
    it("should contain all images", () => {
      for (const img of images) {
        const index = readme.indexOf(`/${img}`);
        assert.ok(index !== -1);
      }
    });
    it("should have valid links to images", () => {
      const regex = /\(https:\/\/([^)]*)\/.README\/([^)]*)\)/gs;
      const linked = new Set();
      let match: RegExpExecArray;
      while ((match = regex.exec(readme))) {
        assert.strictEqual(
          match[1],
          "raw.githubusercontent.com/KxSystems/kx-vscode/main",
        );
        assert.ok(images.includes(match[2]));
        linked.add(match[2]);
      }
      assert.strictEqual(linked.size, images.length);
    });
  });
});
