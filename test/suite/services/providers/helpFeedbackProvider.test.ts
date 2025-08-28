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
import Path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { HelpFeedbackProvider } from "../../../../src/services/helpFeedbackProvider";

describe("HelpFeedbackProvider", () => {
  let provider: HelpFeedbackProvider;

  beforeEach(() => {
    provider = new HelpFeedbackProvider();
  });

  it("should return all help items in getChildren", () => {
    const children = provider.getChildren();

    assert.strictEqual(children.length, 4);
    assert.ok(children[0] instanceof vscode.TreeItem);
    assert.strictEqual(children[0].label, "Extension Documentation");
    assert.strictEqual(children[1].label, "Suggest a Feature");
    assert.strictEqual(children[2].label, "Provide Feedback");
    assert.strictEqual(children[3].label, "Report a Bug");
  });

  it("should return the same item in getTreeItem", () => {
    const children = provider.getChildren();

    for (const item of children) {
      const treeItem = provider.getTreeItem(item);

      assert.strictEqual(treeItem, item);
    }
  });

  it("should set correct command and iconPath for each HelpItem", () => {
    const children = provider.getChildren();
    const expected = [
      {
        label: "Extension Documentation",
        command: "kdb.help.openDocumentation",
        icon: "help-doc.svg",
      },
      {
        label: "Suggest a Feature",
        command: "kdb.help.suggestFeature",
        icon: "feature.svg",
      },
      {
        label: "Provide Feedback",
        command: "kdb.help.provideFeedback",
        icon: "feedback.svg",
      },
      {
        label: "Report a Bug",
        command: "kdb.help.reportBug",
        icon: "bug.svg",
      },
    ];

    function normalizePath(p: string) {
      return p.replace(/\\/g, "/");
    }

    children.forEach((item, idx) => {
      assert.strictEqual(item.label, expected[idx].label);
      assert.deepStrictEqual(item.command, {
        command: expected[idx].command,
        title: expected[idx].label,
      });
      if (
        typeof item.iconPath === "object" &&
        item.iconPath !== null &&
        "light" in item.iconPath &&
        "dark" in item.iconPath
      ) {
        const actualLight = normalizePath(item.iconPath.light.toString());
        const expectedLight = normalizePath(
          Path.join("resources", "light", expected[idx].icon),
        );
        const actualDark = normalizePath(item.iconPath.dark.toString());
        const expectedDark = normalizePath(
          Path.join("resources", "dark", expected[idx].icon),
        );

        assert.ok(actualLight.endsWith(expectedLight));
        assert.ok(actualDark.endsWith(expectedDark));
      }
    });
  });

  it("should emit onDidChangeTreeData event", (done) => {
    const spy = sinon.spy();

    provider.onDidChangeTreeData(spy);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Accessing private member for test
    provider._onDidChangeTreeData.fire();
    setTimeout(() => {
      assert.ok(spy.calledOnce);
      done();
    }, 10);
  });
});
