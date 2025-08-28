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

import * as loggers from "../../../src/utils/loggers";
import * as workspaceHelper from "../../../src/utils/workspace";

describe("Workspace tests", () => {
  const testWorkspaceFolder: any[] = [
    {
      uri: vscode.Uri.file("testPath1"),
    },
    {
      uri: vscode.Uri.file("testPath2"),
    },
  ];

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

  describe("activateTextDocument", () => {
    it("should activate document", async () => {
      sinon.stub(vscode.workspace, "openTextDocument").value(() => ({}));
      const stub = sinon.stub(vscode.window, "showTextDocument");
      const uri = vscode.Uri.file("/test/test.q");

      await workspaceHelper.activateTextDocument(uri);
      assert.strictEqual(stub.calledOnce, true);
    });
  });

  describe("addWorkspaceFile", () => {
    it("should reject when no workspace", async () => {
      await assert.rejects(
        workspaceHelper.addWorkspaceFile(undefined, "test", ".q"),
      );
    });
    it("should return file uri", async () => {
      sinon.stub(loggers, "kdbOutputLog");
      workspaceMock.value(testWorkspaceFolder);
      sinon
        .stub(vscode.workspace, "getWorkspaceFolder")
        .returns(testWorkspaceFolder[0]);
      const uri = vscode.Uri.file("test.q");
      const result = await workspaceHelper.addWorkspaceFile(uri, "test", ".q");

      assert.ok(result.fsPath.endsWith("test-1.q"));
      sinon.restore();
    });
  });

  describe("setUriContent", () => {
    it("should reject when no workspace", async () => {
      const applyEdit = sinon.stub(vscode.workspace, "applyEdit");
      const uri = vscode.Uri.file("test.q");

      await workspaceHelper.setUriContent(uri, "test");
      assert.ok(applyEdit.calledOnce);
    });
  });

  describe("workspaceHas", () => {
    it("should return false", async () => {
      const uri = vscode.Uri.file("test.q");
      const result = workspaceHelper.workspaceHas(uri);

      assert.strictEqual(result, false);
    });
  });

  describe("openWith", () => {
    it("should call command", async () => {
      const executeCommand = sinon.stub(vscode.commands, "executeCommand");
      const uri = vscode.Uri.file("test.q");

      await workspaceHelper.openWith(uri, "test");
      assert.strictEqual(executeCommand.calledOnce, true);
    });
  });

  describe("pickWorkspace", () => {
    let showQuickPickStub: sinon.SinonStub;

    beforeEach(() => {
      showQuickPickStub = sinon.stub(vscode.window, "showQuickPick");
    });

    afterEach(() => {
      showQuickPickStub.restore();
    });

    it("should return undefined for no workspace folders", async () => {
      workspaceMock.value(undefined);
      const res = await workspaceHelper.pickWorkspace();
      assert.strictEqual(res, undefined);
    });

    it("should return undefined for empty workspace folders", async () => {
      workspaceMock.value([]);
      const res = await workspaceHelper.pickWorkspace();
      assert.strictEqual(res, undefined);
    });

    it("should return the picked folder", async () => {
      const folder = {};
      workspaceMock.value([folder]);
      const res = await workspaceHelper.pickWorkspace();
      assert.strictEqual(res, folder);
    });

    it("should return the picked folder", async () => {
      workspaceMock.value(testWorkspaceFolder);
      showQuickPickStub.resolves(<any>{ folder: testWorkspaceFolder[1] });
      const res = await workspaceHelper.pickWorkspace();
      assert.strictEqual(res, testWorkspaceFolder[1]);
    });

    it("should return first workspace when cancelled", async () => {
      workspaceMock.value(testWorkspaceFolder);
      showQuickPickStub.resolves(undefined);
      const res = await workspaceHelper.pickWorkspace();
      assert.strictEqual(res, testWorkspaceFolder[0]);
    });
  });
});
