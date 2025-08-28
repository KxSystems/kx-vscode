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
import * as sinon from "sinon";
import * as vscode from "vscode";

import { CancellationEvent } from "../../../src/models/cancellationEvent";
import * as userInteraction from "../../../src/utils/userInteraction";

interface ITestItem extends vscode.QuickPickItem {
  id: number;
  label: string;
  description: string;
  testProperty: string;
}

describe("userInteraction", () => {
  let windowMock: sinon.SinonMock;

  beforeEach(() => {
    windowMock = sinon.mock(vscode.window);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("showInputBox should return a value", async () => {
    const option: vscode.InputBoxOptions = {};

    windowMock.expects("showInputBox").withArgs(option).returns("test");
    const result = await userInteraction.showInputBox(option);

    assert.strictEqual(result, "test");
  });

  it("showInputBox should throw cancellation event", async () => {
    const option: vscode.InputBoxOptions = {};

    windowMock.expects("showInputBox").withArgs(option).returns(undefined);
    await assert.rejects(
      userInteraction.showInputBox(option),
      CancellationEvent,
    );
  });

  it("showQuickPick should return a value", async () => {
    const option: vscode.QuickPickOptions = {};
    const items: vscode.QuickPickItem[] = [
      {
        description: "test 1",
        label: "test 1",
      },
      {
        description: "test 2",
        label: "test 2",
      },
    ];

    windowMock
      .expects("showQuickPick")
      .withArgs(items, option)
      .returns(items[1]);
    const result = await userInteraction.showQuickPick(items, option);

    assert.deepStrictEqual(result, items[1]);
  });

  it("showQuickPick with custom items should return a value", async () => {
    const option: vscode.QuickPickOptions = {};
    const items: ITestItem[] = [
      {
        description: "test 1",
        id: 1,
        label: "test 1",
        testProperty: "test 1",
      },
      {
        description: "test 2",
        id: 2,
        label: "test 2",
        testProperty: "test 2",
      },
    ];

    windowMock
      .expects("showQuickPick")
      .withArgs(items, option)
      .returns(items[1]);
    const result = await userInteraction.showQuickPick(items, option);

    assert.deepStrictEqual(result, items[1]);
  });

  it("showQuickPick should throw cancellation event", async () => {
    const option: vscode.QuickPickOptions = {};
    const items: vscode.QuickPickItem[] = [
      {
        description: "test 1",
        label: "test 1",
      },
      {
        description: "test 2",
        label: "test 2",
      },
    ];

    windowMock
      .expects("showQuickPick")
      .withArgs(items, option)
      .returns(undefined);
    await assert.rejects(
      userInteraction.showQuickPick(items, option),
      CancellationEvent,
    );
  });

  it("showOpenFolderDialog should return a folder path", async () => {
    const folderPath = "test/test";
    const uris: vscode.Uri[] = [{ fsPath: folderPath } as vscode.Uri];

    windowMock.expects("showOpenDialog").returns(uris);
    const result = await userInteraction.showOpenFolderDialog();

    assert.deepStrictEqual(result, folderPath);
  });

  it("showOpenFolderDialog should return path of first folder", async () => {
    const folderPath1 = "test/test";
    const folderPath2 = "test2/test2";
    const uris: vscode.Uri[] = [
      { fsPath: folderPath1 },
      { fsPath: folderPath2 },
    ] as vscode.Uri[];

    windowMock.expects("showOpenDialog").returns(uris);
    const result = await userInteraction.showOpenFolderDialog();

    assert.strictEqual(result, folderPath1);
  });

  it("showOpenFolderDialog should throw cancellation event if dialog cancelled", async () => {
    windowMock.expects("showOpenDialog").returns(undefined);
    await assert.rejects(
      userInteraction.showOpenFolderDialog(),
      CancellationEvent,
    );
  });
});
