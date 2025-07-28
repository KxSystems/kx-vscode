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

import * as notebookTestUtils from "./notebookTestUtils.test";
import * as workspaceCommand from "../../../../src/commands/workspaceCommand";
import {
  InsightsNode,
  KdbNode,
} from "../../../../src/services/kdbTreeProvider";
import * as providers from "../../../../src/services/notebookProviders";

describe("Providers", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("getCellKind should return correct kind", () => {
    ["markdown", "q", "python", "sql"].map((languageId, index) => {
      const res = providers.getCellKind(<vscode.NotebookCell>{
        document: { languageId },
      });
      assert.strictEqual(res, index);
    });
  });

  it("updateCellMetadata should apply workspace edit", () => {
    const stub = sinon.stub(vscode.workspace, "applyEdit");
    providers.updateCellMetadata(
      <vscode.NotebookCell>{
        index: 0,
        notebook: { uri: vscode.Uri.file("test") },
      },
      {
        target: "target",
        variable: "variable",
      },
    );
    sinon.assert.calledOnce(stub);
  });

  it("inputVariable should return input variable", async () => {
    sinon.stub(vscode.window, "showInputBox").resolves("variable");
    const res = await providers.inputVariable();
    assert.strictEqual(res, "variable");
  });

  describe("validateInput", () => {
    it("should return undefined for valid input", () => {
      assert.strictEqual(providers.validateInput(".ns.var"), undefined);
    });
    it("should return undefined for empty input", () => {
      assert.strictEqual(providers.validateInput(""), undefined);
    });
    it("should return undefined for undefined input", () => {
      assert.strictEqual(providers.validateInput(undefined), undefined);
    });
    it("should return message for input length > 32", () => {
      assert.ok(providers.validateInput("v".repeat(33)));
    });
    it("should return message for input starting with a number", () => {
      assert.ok(providers.validateInput("1variable"));
    });
    it("should return message for input starting with an underscore", () => {
      assert.ok(providers.validateInput("_variable"));
    });
    it("should return message for input with invalid characters", () => {
      assert.ok(providers.validateInput("\u011f"));
    });
  });

  describe("KxNotebookTargetActionProvider", () => {
    const token = <vscode.CancellationToken>{};
    let instance: providers.KxNotebookTargetActionProvider;
    let changeConfigCallback: any;

    function createInstance() {
      instance = new providers.KxNotebookTargetActionProvider();
    }

    describe("Connection Picked", () => {
      beforeEach(() => {
        sinon.stub(workspaceCommand, "getServerForUri").returns("picked");
        sinon
          .stub(vscode.workspace, "onDidChangeConfiguration")
          .value((callback: any) => (changeConfigCallback = callback));

        createInstance();
      });

      it("should update on config change", () => {
        let fired = false;
        instance.onDidChangeCellStatusBarItems(() => (fired = true));
        assert.ok(changeConfigCallback);
        changeConfigCallback({ affectsConfiguration: () => true });
        assert.ok(fired);
      });

      describe("Local Connection", () => {
        beforeEach(() => {
          sinon
            .stub(workspaceCommand, "getConnectionForServer")
            .resolves(sinon.createStubInstance(KdbNode));
        });

        it("should return 2", async () => {
          const cell = notebookTestUtils.createCell("q", {
            target: "target",
            variable: "variable",
          });
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 2);
        });

        it("should return 2", async () => {
          const cell = notebookTestUtils.createCell("python", {
            target: "target",
            variable: "variable",
          });
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 2);
        });

        it("should return 1", async () => {
          const cell = notebookTestUtils.createCell("sql", {
            target: "target",
            variable: "variable",
          });
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 1);
        });
      });

      describe("Insights Connection", () => {
        beforeEach(() => {
          sinon
            .stub(workspaceCommand, "getConnectionForServer")
            .resolves(sinon.createStubInstance(InsightsNode));
        });

        it("should return only scratchpad", async () => {
          const cell = notebookTestUtils.createCell("q");
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 1);
          assert.strictEqual(res[0].text, "scratchpad");
        });

        it("should return scratchpad and variable", async () => {
          const cell = notebookTestUtils.createCell("q", {
            target: "target",
            variable: "variable",
          });
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 2);
          assert.strictEqual(res[0].text, "target");
          assert.strictEqual(res[1].text, "(variable)");
        });

        it("should return only variable", async () => {
          const cell = notebookTestUtils.createCell("sql", {
            variable: "variable",
          });
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 1);
          assert.strictEqual(res[0].text, "(variable)");
        });

        it("should return none for markdown", async () => {
          const cell = notebookTestUtils.createCell("markdown");
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });

        it("should return target for python", async () => {
          const cell = notebookTestUtils.createCell("python");
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 1);
        });
      });
    });

    describe("Connection Not Picked", () => {
      beforeEach(() => {
        sinon.stub(workspaceCommand, "getServerForUri").returns(undefined);
        createInstance();
      });

      it("should return 1", async () => {
        const cell = notebookTestUtils.createCell("q");
        const res = await instance.provideCellStatusBarItems(cell, token);
        assert.strictEqual(res.length, 1);
      });
    });
  });
});
