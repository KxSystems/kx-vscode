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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import "../../../fixtures";
import * as assert from "assert";

import {
  LOCAL,
  NANOS,
  TEXT,
  joinTimestamp,
  splitTimestamp,
} from "../../../../src/webview/converters";
import { Bind } from "../../../../src/webview/directives";

describe("converters", () => {
  describe("TEXT", () => {
    it("should show an empty string for a missing value", () => {
      assert.strictEqual(TEXT.toValue(undefined), "");
      assert.strictEqual(TEXT.toValue(null), "");
    });

    it("should show a non string value as text", () => {
      assert.strictEqual(TEXT.toValue(42), "42");
      assert.strictEqual(TEXT.toFormat(true), "true");
    });

    it("should store what was typed", () => {
      assert.strictEqual(TEXT.toModel(" value "), " value ");
    });
  });

  describe("timestamps", () => {
    it("should split a full timestamp", () => {
      assert.deepStrictEqual(splitTimestamp("2024-01-01T10:20:30.123456789"), {
        local: "2024-01-01T10:20:30",
        nanos: "123456789",
      });
    });

    it("should pad a partial fraction", () => {
      assert.strictEqual(
        splitTimestamp("2024-01-01T10:20:30.5").nanos,
        "500000000",
      );
    });

    it("should split a value with no fraction", () => {
      assert.deepStrictEqual(splitTimestamp("2024-01-01T10:20"), {
        local: "2024-01-01T10:20",
        nanos: "000000000",
      });
    });

    it("should split an empty value", () => {
      assert.deepStrictEqual(splitTimestamp(undefined), {
        local: "",
        nanos: "000000000",
      });
    });

    it("should join the halves, filling in the seconds", () => {
      assert.strictEqual(
        joinTimestamp("2024-01-01T10:20", "1"),
        "2024-01-01T10:20:00.100000000",
      );
    });

    it("should stay empty without a date", () => {
      assert.strictEqual(joinTimestamp("", "123"), "");
    });

    it("should show each half of a bound value", () => {
      assert.strictEqual(
        LOCAL.toValue("2024-01-01T10:20:30.123456789"),
        "2024-01-01T10:20:30",
      );
      assert.strictEqual(
        NANOS.toFormat("2024-01-01T10:20:30.123456789"),
        "123456789",
      );
    });
  });
});

describe("bind", () => {
  function createInput() {
    const listeners: { [key: string]: () => void } = {};
    const element = {
      value: "",
      readOnly: false,
      addEventListener(name: string, listener: () => void) {
        listeners[name] = listener;
      },
    };
    return {
      element,
      listeners,
      directive: new Bind(<any>{ element }),
    };
  }

  it("should show the model value", () => {
    const input = createInput();
    input.directive.render("value");
    assert.strictEqual(input.element.value, "value");
  });

  it("should stop writing once the field is dirty", () => {
    const input = createInput();
    input.directive.render("value");
    input.listeners.focus();
    input.listeners.input();
    input.element.value = "typed";
    input.directive.render("other");
    assert.strictEqual(input.element.value, "typed");
  });

  it("should let the model speak again after a blur", () => {
    const input = createInput();
    input.directive.render("value");
    input.listeners.focus();
    input.listeners.input();
    input.listeners.blur();
    input.directive.render("other");
    assert.strictEqual(input.element.value, "other");
  });

  it("should let the model speak again when rebound to another value", () => {
    const input = createInput();
    input.directive.render("value", TEXT, "first");
    input.listeners.focus();
    input.listeners.input();
    input.directive.render("other", TEXT, "second");
    assert.strictEqual(input.element.value, "other");
  });
});
