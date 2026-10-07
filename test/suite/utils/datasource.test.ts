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

import * as dataSourceUtils from "../../../src/utils/dataSource";

describe("dataSource", () => {
  it("convertTimeToTimestamp", () => {
    const result = dataSourceUtils.convertTimeToTimestamp("2021-01-01");
    assert.strictEqual(result, "2021-01-01T00:00:00.000000000");
  });

  it("convertTimeToTimestamp", () => {
    const result = dataSourceUtils.convertTimeToTimestamp("testTime");
    assert.strictEqual(result, "");
  });

  it("getConnectedInsightsNode", () => {
    const result = dataSourceUtils.getConnectedInsightsNode();
    assert.strictEqual(result, "");
  });

  it("checkFileFromInsightsNode", () => {
    const file = "test";
    const result = dataSourceUtils.checkFileFromInsightsNode(file);
    assert.strictEqual(result, false);
  });

  it("checkIfTimeParamIsCorrect", () => {
    const result = dataSourceUtils.checkIfTimeParamIsCorrect(
      "2021-01-01",
      "2021-01-02",
    );
    assert.strictEqual(result, true);
    const result2 = dataSourceUtils.checkIfTimeParamIsCorrect(
      "2021-01-02",
      "2021-01-01",
    );
    assert.strictEqual(result2, false);
  });
});
