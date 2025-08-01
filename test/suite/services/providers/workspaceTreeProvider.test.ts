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

import { ext } from "../../../../src/extensionVariables";
import { WorkspaceTreeProvider } from "../../../../src/services/workspaceTreeProvider";

describe("workspaceTreeProvider", () => {
  let provider: WorkspaceTreeProvider;

  function stubWorkspaceFile(path: string) {
    const parsed = Path.parse(path);
    sinon
      .stub(vscode.workspace, "workspaceFolders")
      .value([{ uri: vscode.Uri.file(parsed.dir) }]);
    sinon
      .stub(vscode.workspace, "getWorkspaceFolder")
      .value(() => vscode.Uri.file(parsed.dir));
    sinon
      .stub(vscode.workspace, "findFiles")
      .value(async () => [vscode.Uri.file(path)]);
    sinon
      .stub(vscode.workspace, "openTextDocument")
      .value(async (uri: vscode.Uri) => uri);
  }

  beforeEach(() => {
    sinon.stub(ext, "serverProvider").value({ onDidChangeTreeData() {} });
    provider = new WorkspaceTreeProvider("**/*.kdb.q", "scratchpad");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getChildren", () => {
    it("should return workspace scratchpad items", async () => {
      stubWorkspaceFile("/workspace/test.kdb.q");
      let result = await provider.getChildren();
      assert.strictEqual(result.length, 1);
      result = await provider.getChildren(provider.getTreeItem(result[0]));
      assert.strictEqual(result.length, 1);
    });

    it("should return workspace python items", async () => {
      stubWorkspaceFile("/workspace/test.kdb.py");
      let result = await provider.getChildren();
      assert.strictEqual(result.length, 1);
      result = await provider.getChildren(provider.getTreeItem(result[0]));
      assert.strictEqual(result.length, 1);
    });

    it("should return workspace datasource items", async () => {
      stubWorkspaceFile("/workspace/test.kdb.json");
      let result = await provider.getChildren();
      assert.strictEqual(result.length, 1);
      result = await provider.getChildren(provider.getTreeItem(result[0]));
      assert.strictEqual(result.length, 1);
    });
  });
});
