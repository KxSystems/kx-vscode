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
import { ext } from "../../src/extensionVariables";
import * as controlller from "../../src/services/notebookController";
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

    it("should end execution on error", async () => {
      activeConnectionStub.value({});
      executeQueryStub.resolves({});
      const end = sinon.stub(executor, "end");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(end.calledOnce);
    });

    it("should show warning message if not connected", async () => {
      const msg = sinon.stub(vscode.window, "showWarningMessage");
      await instance.execute(cells, notebook, <vscode.NotebookController>{});
      assert.ok(msg.calledOnce);
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
        count: 1,
        columns: [{ name: "values", type: "long", values: ["1"], order: [0] }],
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
});
