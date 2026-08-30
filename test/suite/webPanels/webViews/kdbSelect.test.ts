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
import * as sinon from "sinon";

import { KdbSelect } from "../../../../src/webview/components/kdbSelect";

describe("KdbSelect", () => {
  let select: KdbSelect;

  function markup(template: any): string {
    if (!template || typeof template !== "object") {
      return String(template ?? "");
    }
    if (Array.isArray(template)) {
      return template.map(markup).join("");
    }
    const strings = (template.strings || []).join(" ");
    return strings + (template.values || []).map(markup).join("");
  }

  function press(key: string) {
    const event = <KeyboardEvent>(<unknown>{
      key,
      preventDefault() {},
      stopPropagation() {},
    });
    select.handleKeydown(event);
  }

  beforeEach(() => {
    select = new KdbSelect();
    select.options = ["price", "sym", "time", "sprice"];
  });

  afterEach(() => {
    sinon.restore();
  });

  function values(entries: any[]) {
    return entries.map((entry) => entry.value);
  }

  describe("entries", () => {
    it("should offer an empty option first", () => {
      assert.strictEqual(select.entries()[0].value, "");
    });

    it("should keep a value the options do not list", () => {
      select.value = "gone";
      assert.deepStrictEqual(values(select.entries()).slice(0, 2), [
        "",
        "gone",
      ]);
    });

    it("should not repeat a value the options list", () => {
      select.value = "sym";
      assert.deepStrictEqual(values(select.entries()), [
        "",
        "price",
        "sym",
        "time",
        "sprice",
      ]);
    });

    it("should offer no empty option when it is required", () => {
      select.required = true;
      assert.deepStrictEqual(values(select.entries()), select.options);
    });

    it("should take a text and a group of its own", () => {
      select.options = [
        { value: "a%20label", label: "a label", group: "Labels" },
      ];
      assert.deepStrictEqual(select.entries()[1], {
        value: "a%20label",
        text: "a label",
        group: "Labels",
        color: "",
      });
    });

    it("should show the text of the value it holds", () => {
      select.options = [{ value: "a%20label", label: "a label" }];
      select.value = "a%20label";
      assert.strictEqual(select.textOf(select.value), "a label");
    });

    it("should show a value it has no option for as it is", () => {
      assert.strictEqual(select.textOf("gone"), "gone");
    });
  });

  describe("filtered", () => {
    it("should offer everything when nothing is typed", () => {
      assert.deepStrictEqual(select.filtered(), select.entries());
    });

    it("should rank a prefix match above a contained one", () => {
      select.filter = "pri";
      assert.deepStrictEqual(values(select.filtered()), ["price", "sprice"]);
    });

    it("should match regardless of case and surrounding space", () => {
      select.filter = "  SYM ";
      assert.deepStrictEqual(values(select.filtered()), ["sym"]);
    });

    it("should drop the empty option once a filter is typed", () => {
      select.filter = "s";
      assert.ok(!values(select.filtered()).includes(""));
    });

    it("should find nothing when no option matches", () => {
      select.filter = "zzz";
      assert.deepStrictEqual(select.filtered(), []);
    });

    it("should match the text rather than the value", () => {
      select.options = [{ value: "a%20label", label: "a label" }];
      select.filter = "label";
      assert.deepStrictEqual(values(select.filtered()), ["a%20label"]);
    });

    it("should keep the groups in the order they were given", () => {
      select.options = [
        { value: "sortCols", group: "Optional" },
        { value: "scope", group: "Distinguished" },
        { value: "startTS", group: "Optional" },
      ];
      select.filter = "s";
      assert.deepStrictEqual(values(select.filtered()), [
        "sortCols",
        "startTS",
        "scope",
      ]);
    });
  });

  describe("reveal", () => {
    it("should open the list on the current value", () => {
      select.value = "time";
      select.reveal();
      assert.strictEqual(select.open, true);
      assert.strictEqual(select.filter, "");
      assert.strictEqual(select.filtered()[select.active].value, "time");
    });

    it("should open on the empty option when there is no value", () => {
      select.reveal();
      assert.strictEqual(select.active, 0);
    });
  });

  describe("keyboard", () => {
    it("should open on an arrow key without moving", () => {
      select.value = "sym";
      press("ArrowDown");
      assert.strictEqual(select.open, true);
      assert.strictEqual(select.filtered()[select.active].value, "sym");
    });

    it("should walk the list and wrap around", () => {
      select.reveal();
      const last = select.filtered().length - 1;
      press("ArrowUp");
      assert.strictEqual(select.active, last);
      press("ArrowDown");
      assert.strictEqual(select.active, 0);
    });

    it("should jump to the ends of the list", () => {
      select.reveal();
      press("End");
      assert.strictEqual(select.active, select.filtered().length - 1);
      press("Home");
      assert.strictEqual(select.active, 0);
    });

    it("should commit the active option on Enter", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      select.reveal();
      press("ArrowDown");
      press("Enter");
      assert.strictEqual(select.value, "price");
      assert.strictEqual(select.open, false);
      assert.deepStrictEqual(
        dispatch.args.map((args) => (args[0] as Event).type),
        ["input", "change"],
      );
    });

    it("should leave the value alone on Escape", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      select.value = "sym";
      select.reveal();
      press("ArrowDown");
      press("Escape");
      assert.strictEqual(select.value, "sym");
      assert.strictEqual(select.open, false);
      assert.strictEqual(dispatch.called, false);
    });

    it("should close on Tab", () => {
      select.reveal();
      press("Tab");
      assert.strictEqual(select.open, false);
    });

    it("should ignore Enter while closed", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      press("Enter");
      assert.strictEqual(dispatch.called, false);
    });
  });

  describe("select", () => {
    it("should report a new value once", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      select.select("sym");
      assert.strictEqual(select.value, "sym");
      assert.strictEqual(dispatch.callCount, 2);
    });

    it("should stay quiet when the value has not changed", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      select.value = "sym";
      select.select("sym");
      assert.strictEqual(dispatch.called, false);
    });

    it("should clear the value through the empty option", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      select.value = "sym";
      select.select("");
      assert.strictEqual(select.value, "");
      assert.strictEqual(dispatch.callCount, 2);
    });
  });

  describe("multiple", () => {
    beforeEach(() => {
      select.multiple = true;
      select.options = [
        { value: "prod", color: "#FF0000" },
        { value: "team-a" },
        { value: "scratch" },
      ];
    });

    it("should hold every value that is picked", () => {
      select.select("prod");
      select.select("scratch");
      assert.deepStrictEqual(select.values, ["prod", "scratch"]);
    });

    it("should let go of a value that is picked again", () => {
      select.values = ["prod", "scratch"];
      select.select("prod");
      assert.deepStrictEqual(select.values, ["scratch"]);
    });

    it("should stay open and keep the filter while picking", () => {
      select.reveal();
      select.filter = "a";
      select.select("team-a");
      assert.strictEqual(select.open, true);
      assert.strictEqual(select.filter, "a");
    });

    it("should report every pick", () => {
      const dispatch = sinon.stub(select, "dispatchEvent");
      select.select("prod");
      assert.deepStrictEqual(
        dispatch.args.map((args) => (args[0] as Event).type),
        ["input", "change"],
      );
    });

    it("should offer no empty option", () => {
      assert.ok(!values(select.entries()).includes(""));
    });

    it("should keep a value the options no longer list", () => {
      select.values = ["deleted"];
      assert.deepStrictEqual(values(select.entries())[0], "deleted");
    });

    it("should drop the last badge on Backspace with nothing typed", () => {
      select.values = ["prod", "scratch"];
      press("Backspace");
      assert.deepStrictEqual(select.values, ["prod"]);
    });

    it("should leave the badges alone on Backspace while filtering", () => {
      select.values = ["prod"];
      select.filter = "sc";
      press("Backspace");
      assert.deepStrictEqual(select.values, ["prod"]);
    });

    it("should render a badge for every value it holds", () => {
      select.values = ["prod", "deleted"];
      const rendered = markup(select.renderBadges());
      assert.ok(rendered.includes("prod"));
      assert.ok(rendered.includes("deleted"));
      assert.ok(rendered.includes("#FF0000"));
      assert.strictEqual(rendered.split("Remove ").length - 1, 2);
    });

    it("should tick the options it holds", () => {
      select.values = ["prod"];
      select.reveal();
      const rendered = markup(select.renderList());
      assert.ok(rendered.includes("✓"));
      assert.ok(rendered.includes('aria-multiselectable="'));
    });
  });

  describe("placement", () => {
    it("should follow the field it belongs to while open", () => {
      select.connectedCallback();
      select.reveal();
      assert.doesNotThrow(() => select.place());
      window.dispatchEvent?.(new Event("scroll"));
      select.disconnectedCallback();
    });
  });

  describe("render", () => {
    it("should render a combobox", () => {
      const rendered = markup(select.render());
      assert.ok(rendered.includes('role="combobox"'));
      assert.ok(rendered.includes('aria-autocomplete="list"'));
    });

    it("should render no list while closed", () => {
      assert.ok(!markup(select.render()).includes('role="listbox"'));
    });

    it("should render an option for every match", () => {
      select.reveal();
      const rendered = markup(select.render());
      assert.ok(rendered.includes('role="listbox"'));
      assert.strictEqual(
        rendered.split('role="option"').length - 1,
        select.filtered().length,
      );
    });

    it("should say when nothing matches", () => {
      select.filter = "zzz";
      select.open = true;
      assert.ok(markup(select.renderList()).includes("No matches"));
    });

    it("should name the empty option after the placeholder", () => {
      select.empty = "Select a query...";
      select.reveal();
      assert.ok(markup(select.renderList()).includes("Select a query..."));
    });

    it("should fall back to Select... when there is no placeholder", () => {
      select.reveal();
      assert.ok(markup(select.renderList()).includes("Select..."));
    });

    it("should head each group with its name", () => {
      select.options = [
        { value: "sortCols", group: "Optional parameters" },
        { value: "scope", group: "Distinguished parameters" },
      ];
      select.reveal();
      const rendered = markup(select.renderList());
      assert.ok(rendered.includes("Optional parameters"));
      assert.ok(rendered.includes("Distinguished parameters"));
      assert.strictEqual(rendered.split('role="presentation"').length - 1, 2);
    });

    it("should highlight the matched part of an option", () => {
      select.filter = "ric";
      const label = <any>select.renderLabel("price");
      assert.ok(markup(label).includes('class="match"'));
      assert.deepStrictEqual(label.values, ["p", "ric", "e"]);
    });

    it("should leave an option alone when nothing is typed", () => {
      const label = <any>select.renderLabel("price");
      assert.ok(!markup(label).includes('class="match"'));
      assert.deepStrictEqual(label.values, ["price"]);
    });

    it("should keep showing the value as a placeholder while filtering", () => {
      select.value = "sym";
      select.reveal();
      assert.ok(markup(select.render()).includes("sym"));
    });
  });
});
