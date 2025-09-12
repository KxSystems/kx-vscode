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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import "../../../fixtures";
import * as assert from "assert";
import * as sinon from "sinon";

import { KdbChartView } from "../../../../src/webview/components/kdbChartView";

describe("kdbChartView.ts", () => {
  let view: KdbChartView;

  beforeEach(async () => {
    view = new KdbChartView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectedCallback", () => {
    it("should add an event listener", () => {
      let result = undefined;
      sinon.stub(window, "addEventListener").value(() => (result = true));
      view.connectedCallback();
      assert.ok(result);
    });
  });

  describe("disconnectedCallback", () => {
    it("should remove an event listener", () => {
      let result = undefined;
      sinon.stub(window, "removeEventListener").value(() => (result = true));
      view.disconnectedCallback();
      assert.ok(result);
    });
  });

  it("should update from message", () => {
    const data = { charts: [{ data: "test" }] };
    view.message(<MessageEvent>{
      data: JSON.stringify(data),
    });
    assert.deepStrictEqual(view.plot, data);
    const result = view.render();
    assert.ok(result);
  });
});
