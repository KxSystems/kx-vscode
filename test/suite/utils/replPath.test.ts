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

import * as assert from "node:assert";
import * as path from "node:path";

import { moduleSearchPath } from "../../../src/utils/replPath";

// Build absolute-ish paths using the running platform's separator.
const p = (...segments: string[]) => path.join(path.sep, "ws", ...segments);

describe("replPath", () => {
  describe("moduleSearchPath", () => {
    it("should prepend the base directory's mod folder to an existing QPATH", () => {
      assert.strictEqual(
        moduleSearchPath(p("proj"), "/existing", "/qhome", ":"),
        `${p("proj", "mod")}:/existing`,
      );
    });

    it("should fall back to the global QHOME/mod when QPATH is unset", () => {
      assert.strictEqual(
        moduleSearchPath(p("proj"), undefined, "/qhome", ":"),
        `${p("proj", "mod")}:${path.join("/qhome", "mod")}`,
      );
    });

    it("should use only the base mod folder when neither QPATH nor QHOME is set", () => {
      assert.strictEqual(
        moduleSearchPath(p("proj"), undefined, undefined, ":"),
        p("proj", "mod"),
      );
    });
  });
});
