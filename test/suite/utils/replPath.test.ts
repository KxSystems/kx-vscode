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

import {
  moduleSearchPath,
  pathContains,
  selectRepl,
} from "../../../src/utils/replPath";

// Build absolute-ish paths using the running platform's separator.
const p = (...segments: string[]) => path.join(path.sep, "ws", ...segments);

describe("replPath", () => {
  describe("pathContains", () => {
    it("should match when base equals target", () => {
      assert.strictEqual(pathContains(p("a"), p("a")), true);
    });

    it("should match a direct child", () => {
      assert.strictEqual(pathContains(p("a"), p("a", "x.q")), true);
    });

    it("should match a nested descendant", () => {
      assert.strictEqual(pathContains(p("a"), p("a", "b", "x.q")), true);
    });

    it("should not match a sibling with a shared prefix", () => {
      assert.strictEqual(pathContains(p("foo"), p("foobar", "x.q")), false);
    });

    it("should not match a parent (target above base)", () => {
      assert.strictEqual(pathContains(p("a", "b"), p("a", "x.q")), false);
    });

    it("should not match an unrelated path", () => {
      assert.strictEqual(pathContains(p("a"), p("c", "x.q")), false);
    });

    describe("on a case-insensitive (win32) filesystem", () => {
      const original = Object.getOwnPropertyDescriptor(process, "platform")!;

      beforeEach(() => {
        Object.defineProperty(process, "platform", {
          value: "win32",
          configurable: true,
        });
      });

      afterEach(() => {
        Object.defineProperty(process, "platform", original);
      });

      it("should match regardless of case", () => {
        assert.strictEqual(pathContains(p("A"), p("a", "x.q")), true);
      });
    });
  });

  describe("selectRepl", () => {
    const mk = (baseFsPath: string | undefined, exited = false) => ({
      baseFsPath,
      exited,
    });

    it("should return undefined when there are no candidates", () => {
      assert.strictEqual(selectRepl(p("a", "x.q"), []), undefined);
    });

    it("should return the single containing candidate", () => {
      const candidate = mk(p("a"));
      assert.strictEqual(selectRepl(p("a", "x.q"), [candidate]), candidate);
    });

    it("should pick the most specific (longest base) candidate", () => {
      const root = mk(p());
      const folder = mk(p("a", "b"));
      assert.strictEqual(
        selectRepl(p("a", "b", "x.q"), [root, folder]),
        folder,
      );
    });

    it("should skip exited candidates", () => {
      const folder = mk(p("a", "b"), true);
      const root = mk(p());
      assert.strictEqual(selectRepl(p("a", "b", "x.q"), [folder, root]), root);
    });

    it("should ignore non-containing candidates", () => {
      assert.strictEqual(selectRepl(p("a", "x.q"), [mk(p("c"))]), undefined);
    });

    it("should ignore candidates without a base directory (DEFAULT)", () => {
      assert.strictEqual(selectRepl(p("a", "x.q"), [mk(undefined)]), undefined);
    });
  });

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
