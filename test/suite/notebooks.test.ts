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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import * as serverCommand from "../../src/commands/serverCommand";
import * as workspaceCommand from "../../src/commands/workspaceCommand";
import { ext } from "../../src/extensionVariables";
import { InsightsNode, KdbNode } from "../../src/services/kdbTreeProvider";
import * as controlller from "../../src/services/notebookController";
import * as providers from "../../src/services/notebookProviders";
import * as serializer from "../../src/services/notebookSerializer";

describe("Notebooks", () => {
  const notebook = <vscode.NotebookDocument>{
    uri: vscode.Uri.file("/test.kxnb"),
  };

  let activeConnectionStub: sinon.SinonStub;
  let executeQueryStub: sinon.SinonStub;

  beforeEach(() => {
    activeConnectionStub = sinon.stub(ext, "activeConnection");
    executeQueryStub = sinon.stub(serverCommand, "executeQuery");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Controller", () => {
    const cells: vscode.NotebookCell[] = [
      {
        document: <vscode.TextDocument>{
          getText() {
            return "a:1;a";
          },
        },
        executionSummary: <vscode.NotebookCellExecutionSummary>{},
        index: 1,
        kind: vscode.NotebookCellKind.Code,
        metadata: {},
        notebook: <vscode.NotebookDocument>{},
        outputs: [],
      },
    ];

    const executor = {
      executionOrder: 1,
      start() {},
      end() {},
      replaceOutput() {},
    };

    let instance: controlller.KxNotebookController;

    beforeEach(() => {
      sinon.stub(vscode.notebooks, "createNotebookController").returns(<
        vscode.NotebookController
      >(<unknown>{
        createNotebookCellExecution() {
          return executor;
        },
        dispose() {},
      }));
      instance = new controlller.KxNotebookController();
    });

    afterEach(() => {
      instance.dispose();
      instance = undefined;
    });

    it("should show warning message if not connected", async () => {
      activeConnectionStub.value(undefined);
      const msg = sinon.stub(vscode.window, "showWarningMessage");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(msg.calledOnce);
    });

    it("should end execution on error", async () => {
      activeConnectionStub.value({});
      executeQueryStub.resolves({});
      const end = sinon.stub(executor, "end");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(end.calledOnce);
    });

    it("should execute code for number result", async () => {
      activeConnectionStub.value({});
      executeQueryStub.resolves(1);
      const res = sinon.stub(executor, "replaceOutput");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(res.calledOnce);
    });

    it("should execute code for plot result", async () => {
      activeConnectionStub.value({});
      executeQueryStub.resolves({
        count: 50046,
        columns: [
          {
            name: "values",
            type: "bytes",
            values: [
              "0x89",
              "0x50",
              "0x4e",
              "0x47",
              "0x0d",
              "0x0a",
              "0x1a",
              "0x0a",
              ..."0x00,".repeat(58).split(","),
            ],
          },
        ],
      });
      const res = sinon.stub(executor, "replaceOutput");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(res.calledOnce);
    });

    it("should execute code for string result", async () => {
      activeConnectionStub.value({});
      executeQueryStub.resolves("result");
      const res = sinon.stub(executor, "replaceOutput");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(res.calledOnce);
    });

    it("should execute code for table result", async () => {
      activeConnectionStub.value({});
      executeQueryStub.resolves({
        count: 2,
        columns: [
          { name: "x", type: "longs", values: ["0", "1"], order: [0, 1] },
          { name: "y", type: "longs", values: ["0", "1"], order: [0, 1] },
        ],
      });

      const res = sinon.stub(executor, "replaceOutput");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(res.calledOnce);
    });
  });

  describe("Serializer", () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let instance: serializer.KxNotebookSerializer;

    beforeEach(() => {
      instance = new serializer.KxNotebookSerializer();
    });

    afterEach(() => {
      instance = undefined;
    });

    it("should deserialize empty notebook", async () => {
      const deserialized = await instance.deserializeNotebook(
        encoder.encode(""),
        <vscode.CancellationToken>{},
      );
      assert.strictEqual(deserialized.cells.length, 0);
    });

    it("should serialize and deserialize notebook", async () => {
      const data: vscode.NotebookData = {
        cells: [
          {
            kind: vscode.NotebookCellKind.Code,
            value: "a:1",
            languageId: "q",
            outputs: [
              {
                items: [
                  { data: encoder.encode("Results"), mime: "text/plain" },
                ],
              },
            ],
          },
        ],
      };
      const serialized = await instance.serializeNotebook(
        data,
        <vscode.CancellationToken>{},
      );
      const deserialized = await instance.deserializeNotebook(
        serialized,
        <vscode.CancellationToken>{},
      );

      for (let i = 0; i < deserialized.cells.length; i++) {
        assert.strictEqual(deserialized.cells[i].kind, data.cells[i].kind);
        assert.strictEqual(deserialized.cells[i].value, data.cells[i].value);
        assert.strictEqual(
          deserialized.cells[i].languageId,
          data.cells[i].languageId,
        );
        for (let j = 0; j < deserialized.cells[i].outputs.length; j++) {
          for (
            let k = 0;
            k < deserialized.cells[i].outputs[j].items.length;
            k++
          ) {
            assert.strictEqual(
              decoder.decode(deserialized.cells[i].outputs[j].items[k].data),
              decoder.decode(data.cells[i].outputs[j].items[k].data),
            );
          }
        }
      }
    });
  });

  describe("Providers", () => {
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

    it("validateInput should return input variable", async () => {
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
        assert.strictEqual(providers.validateInput(), undefined);
      });
      it("should return message for input length > 32", () => {
        assert.ok(providers.validateInput("a".repeat(33)));
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
      let provider: providers.KxNotebookTargetActionProvider;

      beforeEach(() => {
        sinon.stub(workspaceCommand, "getServerForUri").returns("server");
        provider = new providers.KxNotebookTargetActionProvider();
      });

      function createCell(languageId: string, metadata = {}) {
        return <vscode.NotebookCell>{
          document: { languageId },
          notebook: { uri: vscode.Uri.file("test") },
          metadata,
        };
      }

      describe("Local Connection", () => {
        beforeEach(() => {
          sinon
            .stub(workspaceCommand, "getConnectionForServer")
            .resolves(sinon.createStubInstance(KdbNode));
        });

        it("should return none", async () => {
          const cell = createCell("q", {
            target: "target",
            variable: "variable",
          });
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });

        it("should return none", async () => {
          const cell = createCell("python", {
            target: "target",
            variable: "variable",
          });
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });

        it("should return none", async () => {
          const cell = createCell("sql", {
            target: "target",
            variable: "variable",
          });
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });
      });

      describe("Insights Connection", () => {
        beforeEach(() => {
          sinon
            .stub(workspaceCommand, "getConnectionForServer")
            .resolves(sinon.createStubInstance(InsightsNode));
        });

        it("should return only scratchpad", async () => {
          const cell = createCell("q");
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 1);
          assert.strictEqual(res[0].text, "scratchpad");
        });

        it("should return scratchpad and variable", async () => {
          const cell = createCell("q", {
            target: "target",
            variable: "variable",
          });
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 2);
          assert.strictEqual(res[0].text, "target");
          assert.strictEqual(res[1].text, "(variable)");
        });

        it("should return only variable", async () => {
          const cell = createCell("sql", {
            variable: "variable",
          });
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 1);
          assert.strictEqual(res[0].text, "(variable)");
        });

        it("should return none for Markdown", async () => {
          const cell = createCell("markdown");
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });

        it("should return none for Python", async () => {
          const cell = createCell("python");
          const res = await provider.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });
      });
    });
  });
});
