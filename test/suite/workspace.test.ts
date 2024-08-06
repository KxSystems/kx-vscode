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
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as workspaceHelper from "../../src/utils/workspace";

describe("Workspace tests", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const testWorkspaceFolder: any[] = [
    {
      uri: {
        fsPath: "testPath1",
      },
    },
    {
      uri: {
        fsPath: "testPath2",
      },
    },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workspaceMock: sinon.SinonStub<any[], any>;

  beforeEach(() => {
    workspaceMock = sinon.stub(vscode.workspace, "workspaceFolders");
  });

  afterEach(() => {
    workspaceMock.restore();
  });

  it("getWorkspaceRoot should throw exception when no workspace opened", () => {
    workspaceMock.value(undefined);
    assert.throws(
      () => workspaceHelper.getWorkspaceRoot(),
      Error,
      "Workspace root should be defined.",
    );
  });

  it("getWorkspaceRoot should return workspace root path", async () => {
    workspaceMock.value(testWorkspaceFolder);
    const result = workspaceHelper.getWorkspaceRoot();
    assert.strictEqual(result, testWorkspaceFolder[0].uri.fsPath);
  });

  it("isWorkspaceOpen should return false when no workspace is opened", () => {
    workspaceMock.value(undefined);
    const result = workspaceHelper.isWorkspaceOpen();
    assert.strictEqual(result, false);
  });

  it("isWorkspaceOpen should return true when workspace is opened", () => {
    workspaceMock.value(testWorkspaceFolder);
    const result = workspaceHelper.isWorkspaceOpen();
    assert.strictEqual(result, true);
  });
});

describe("activateTextDocument", () => {
  it("should activate document", async () => {
    sinon.stub(vscode.workspace, "openTextDocument").value(() => ({}));
    const stub = sinon.stub(vscode.window, "showTextDocument");
    const uri = vscode.Uri.file("/test/test.q");
    await workspaceHelper.activateTextDocument(uri);
    assert.strictEqual(stub.calledOnce, true);
  });
});
