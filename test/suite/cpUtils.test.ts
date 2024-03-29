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

import * as assert from "assert";
import * as cpUtils from "../../server/src/utils/cpUtils";

describe("cpUtils", () => {
  describe("wrapArgInQuotes", () => {
    it("should return a quoted string for string", () => {
      const result = cpUtils.wrapArgInQuotes("test");
      assert.strictEqual(result.substring(1, 5), "test");
    });

    it("should return a string value for boolean", () => {
      const result = cpUtils.wrapArgInQuotes(true);
      assert.strictEqual(result, "true");
    });

    it("should return a string value for number", () => {
      const result = cpUtils.wrapArgInQuotes(1);
      assert.strictEqual(result, "1");
    });

    it("should return an empty quoted string for none", () => {
      const result = cpUtils.wrapArgInQuotes();
      assert.strictEqual(result.length, 2);
    });
  });

  describe("executeCommand", () => {
    it("should throw an exception for none", async () => {
      await assert.rejects(cpUtils.executeCommand("./", "__none"));
    });
  });
});
