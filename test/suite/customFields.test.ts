/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import assert from "assert";
import { JSDOM } from "jsdom";

import { DateTimeNanoPicker } from "../../src/webview/components/custom-fields/date-time-nano-picker";

const { window } = new JSDOM("<!doctype html><html><body></body></html>");
(global as any).window = window;
(global as any).document = window.document;
(global as any).CustomEvent = window.CustomEvent;
(global as any).HTMLElement = window.HTMLElement;

describe("DateTimeNanoPicker (component)", () => {
  describe("DateTimeNanoPicker (logic)", () => {
    let picker: DateTimeNanoPicker;

    beforeEach(() => {
      picker = new DateTimeNanoPicker();
    });

    it("should initialize with default values", () => {
      assert.strictEqual(picker.value, "");
      assert.strictEqual(picker.label, "");
      assert.strictEqual(picker.helpText, "");
      assert.strictEqual(picker.required, false);
      assert.match(picker.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.strictEqual(picker.time, "00:00:00");
      assert.strictEqual(picker.nanos, "000000000");
    });

    it("should parse QDateTime string correctly", () => {
      picker.parseQDateTime("2014.11.22D17:43:40.123456789");
      assert.strictEqual(picker.date, "2014-11-22");
      assert.strictEqual(picker.time, "17:43:40");
      assert.strictEqual(picker.nanos, "123456789");
    });

    it("should pad nanoseconds to 9 digits", () => {
      picker.parseQDateTime("2014.11.22D17:43:40.1");
      assert.strictEqual(picker.nanos, "100000000");
    });

    it("should convert fields to QDateTime string", () => {
      picker.dispatchEvent = () => true;
      picker.date = "2020-01-02";
      picker.time = "12:34:56";
      picker.nanos = "987654321";
      picker.parseValuesToQDateTime();
      assert.strictEqual(picker.value, "2020.01.02D12:34:56.987654321");
    });

    it("should dispatch change event when value changes", () => {
      let eventValue = "";
      picker.dispatchEvent = (event: CustomEvent) => {
        eventValue = event.detail.value;
        return true;
      };
      picker.date = "2022-12-31";
      picker.time = "23:59:59";
      picker.nanos = "123";
      picker.parseValuesToQDateTime();
      assert.strictEqual(eventValue, "2022.12.31D23:59:59.123000000");
    });
  });

  describe("DateTimeNanoPicker (DOM integration)", () => {
    let picker: HTMLElement;

    beforeEach(() => {
      if (!window.customElements.get("date-time-nano-picker")) {
        window.customElements.define(
          "date-time-nano-picker",
          DateTimeNanoPicker,
        );
      }
      picker = document.createElement("date-time-nano-picker");
      document.body.appendChild(picker);
    });

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("should be an HTMLElement", () => {
      assert.ok(picker instanceof window.HTMLElement);
    });

    it("should have the correct tag name", () => {
      assert.strictEqual(picker.tagName.toLowerCase(), "date-time-nano-picker");
    });
  });
});
