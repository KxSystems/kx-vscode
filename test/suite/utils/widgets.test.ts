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
import * as sinon from "sinon";
import * as vscode from "vscode";

import * as widgets from "../../../src/utils/widgets";

describe("Widgets", () => {
  describe("showInputPicker", () => {
    let onDidChangeValue: any;
    let onDidChangeSelection: any;
    let onDidAccept: any;
    let onDidHide: any;

    const picker = <any>{
      show() {},
      hide() {},
      onDidChangeValue(listener: any) {
        onDidChangeValue = listener;
      },
      onDidChangeSelection(listener: any) {
        onDidChangeSelection = listener;
      },
      onDidAccept(listener: any) {
        onDidAccept = listener;
      },
      onDidHide(listener: any) {
        onDidHide = listener;
      },
    };

    const items = ["first", "second"];

    const options = {
      placeHolder: "pick",
      title: "Picker",
    };

    beforeEach(() => {
      sinon.stub(vscode.window, "createQuickPick").returns(picker);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return undefined", async () => {
      setTimeout(() => {
        onDidHide();
      });
      const res = await widgets.showInputPicker(items, options);
      assert.strictEqual(res, undefined);
    });

    it("should return input", async () => {
      setTimeout(() => {
        onDidChangeValue(items[0]);
        onDidAccept();
        onDidHide();
      });
      const res = await widgets.showInputPicker(items, options);
      assert.strictEqual(res, items[0]);
    });

    it("should return selection", async () => {
      setTimeout(() => {
        onDidChangeSelection([{ label: items[1] }]);
        onDidAccept();
        onDidHide();
      });
      const res = await widgets.showInputPicker(items, options);
      assert.strictEqual(res, items[1]);
    });
  });
});
