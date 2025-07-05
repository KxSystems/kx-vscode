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

import { InsightsConnection } from "../../src/classes/insightsConnection";
import { LocalConnection } from "../../src/classes/localConnection";
import * as serverCommand from "../../src/commands/serverCommand";
import * as workspaceCommand from "../../src/commands/workspaceCommand";
import { ext } from "../../src/extensionVariables";
import { ConnectionManagementService } from "../../src/services/connectionManagerService";
import { InsightsNode, KdbNode } from "../../src/services/kdbTreeProvider";
import * as controlller from "../../src/services/notebookController";
import * as providers from "../../src/services/notebookProviders";
import * as serializer from "../../src/services/notebookSerializer";
import * as notifications from "../../src/utils/notifications";

describe("Notebooks", () => {
  const result = {
    table: {
      count: 2,
      columns: [
        {
          name: "x",
          type: "longs",
          values: ["0", "1"],
          order: [0, 1],
        },
        {
          name: "y",
          type: "longs",
          values: ["0", "1"],
          order: [0, 1],
        },
      ],
    },

    png: {
      count: 66,
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
    },

    text: "text result",
  };

  function createNotebook() {
    return <vscode.NotebookDocument>{ uri: vscode.Uri.file("test.kxnb") };
  }

  function createCell(languageId?: string, metadata = {}) {
    return <vscode.NotebookCell>{
      document: {
        languageId,
        getText() {
          return "expressions";
        },
      },
      notebook: { uri: vscode.Uri.file("test") },
      metadata,
    };
  }

  afterEach(() => {
    sinon.restore();
  });

  describe("Controller", () => {
    let executeQueryStub: sinon.SinonStub;
    let notifyStub: sinon.SinonStub;
    let instance: controlller.KxNotebookController;
    let success: boolean;

    beforeEach(() => {
      executeQueryStub = sinon.stub(serverCommand, "executeQuery");
      notifyStub = sinon.stub(notifications, "notify");
      sinon
        .stub(vscode.notebooks, "createNotebookController")
        .returns(<vscode.NotebookController>{});
    });

    afterEach(() => {
      instance = undefined;
      success = undefined;
    });

    function createInstance() {
      instance = new controlller.KxNotebookController();
    }

    function createController() {
      return <vscode.NotebookController>{
        createNotebookCellExecution(_) {
          return <vscode.NotebookCellExecution>{
            start() {},
            end(status) {
              success = status;
            },
            replaceOutput(_) {},
            executionOrder: 0,
          };
        },
      };
    }

    describe("Connection Picked", () => {
      beforeEach(() => {
        sinon.stub(workspaceCommand, "getServerForUri").returns("picked");
      });

      describe("Connected", () => {
        describe("Insights Connection", () => {
          beforeEach(() => {
            sinon
              .stub(
                ConnectionManagementService.prototype,
                "retrieveConnectedConnection",
              )
              .returns(sinon.createStubInstance(InsightsConnection));
          });

          describe("Node Not Exists", () => {
            beforeEach(() => {
              sinon
                .stub(workspaceCommand, "getConnectionForServer")
                .resolves(undefined);

              createInstance();
            });

            it("should notify missing connection with error", async () => {
              await instance.execute(
                [createCell()],
                createNotebook(),
                createController(),
              );
              sinon.assert.calledOnceWithMatch(
                notifyStub,
                sinon.match.string,
                notifications.MessageKind.ERROR,
                sinon.match.any,
              );
              assert.strictEqual(success, undefined);
            });
          });
        });

        describe("Local Connection", () => {
          beforeEach(() => {
            sinon
              .stub(
                ConnectionManagementService.prototype,
                "retrieveConnectedConnection",
              )
              .returns(sinon.createStubInstance(LocalConnection));
          });

          describe("Node Exists", () => {
            beforeEach(() => {
              sinon
                .stub(workspaceCommand, "getConnectionForServer")
                .resolves(sinon.createStubInstance(KdbNode));

              createInstance();
            });

            describe("q cell", () => {
              it("should display table results", async () => {
                executeQueryStub.resolves(result.table);
                await instance.execute(
                  [createCell("q")],
                  createNotebook(),
                  createController(),
                );
                sinon.assert.notCalled(notifyStub);
                assert.strictEqual(success, true);
              });

              it("should display png results", async () => {
                executeQueryStub.resolves(result.png);
                await instance.execute(
                  [createCell("q")],
                  createNotebook(),
                  createController(),
                );
                sinon.assert.notCalled(notifyStub);
                assert.strictEqual(success, true);
              });

              it("should display text results", async () => {
                executeQueryStub.resolves(result.text);
                await instance.execute(
                  [createCell("q")],
                  createNotebook(),
                  createController(),
                );
                sinon.assert.notCalled(notifyStub);
                assert.strictEqual(success, true);
              });
            });

            describe("python cell", () => {
              const text = "results";

              it("should display text results", async () => {
                executeQueryStub.resolves(text);
                await instance.execute(
                  [createCell("python")],
                  createNotebook(),
                  createController(),
                );
                sinon.assert.notCalled(notifyStub);
                assert.strictEqual(success, true);
              });
            });

            describe("sql cell", () => {
              it("should display not supported", async () => {
                executeQueryStub.resolves({});
                await instance.execute(
                  [createCell("sql")],
                  createNotebook(),
                  createController(),
                );
                sinon.assert.calledOnceWithExactly(
                  notifyStub,
                  sinon.match.string,
                  notifications.MessageKind.DEBUG,
                  sinon.match.any,
                );
                assert.strictEqual(success, false);
              });
            });
          });

          describe("Node Not Exists", () => {
            beforeEach(() => {
              sinon
                .stub(workspaceCommand, "getConnectionForServer")
                .resolves(undefined);

              createInstance();
            });

            it("should notify missing connection with error", async () => {
              await instance.execute(
                [createCell()],
                createNotebook(),
                createController(),
              );
              sinon.assert.calledOnceWithExactly(
                notifyStub,
                sinon.match.string,
                notifications.MessageKind.ERROR,
                sinon.match.any,
              );
              assert.strictEqual(success, undefined);
            });
          });
        });
      });
    });

    describe("Connection Not Picked", () => {
      beforeEach(() => {
        sinon.stub(workspaceCommand, "getServerForUri").returns(undefined);
      });

      describe("Connected", () => {
        const text = "results";

        afterEach(() => {
          ext.activeConnection = undefined;
        });

        describe("LocalConnection", () => {
          beforeEach(() => {
            ext.activeConnection = sinon.createStubInstance(LocalConnection);
            createInstance();
          });

          describe("q cell", () => {
            it("should display results", async () => {
              executeQueryStub.resolves(text);
              await instance.execute(
                [createCell("q")],
                createNotebook(),
                createController(),
              );
              sinon.assert.notCalled(notifyStub);
              assert.strictEqual(success, true);
            });
          });
        });
      });

      describe("Disconnected", () => {
        beforeEach(() => {
          createInstance();
        });

        describe("LocalConnection", () => {
          describe("q cell", async () => {
            it("should show warning message", async () => {
              await instance.execute(
                [createCell("q")],
                createNotebook(),
                createController(),
              );
              sinon.assert.calledOnceWithExactly(
                notifyStub,
                sinon.match.string,
                notifications.MessageKind.WARNING,
                sinon.match.any,
              );
              assert.strictEqual(success, undefined);
            });
          });
        });
      });
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

          it("should return none", async () => {
            const cell = createCell("q", {
              target: "target",
              variable: "variable",
            });
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 0);
          });

          it("should return none", async () => {
            const cell = createCell("python", {
              target: "target",
              variable: "variable",
            });
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 0);
          });

          it("should return none", async () => {
            const cell = createCell("sql", {
              target: "target",
              variable: "variable",
            });
            const res = await instance.provideCellStatusBarItems(cell, token);
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
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].text, "scratchpad");
          });

          it("should return scratchpad and variable", async () => {
            const cell = createCell("q", {
              target: "target",
              variable: "variable",
            });
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 2);
            assert.strictEqual(res[0].text, "target");
            assert.strictEqual(res[1].text, "(variable)");
          });

          it("should return only variable", async () => {
            const cell = createCell("sql", {
              variable: "variable",
            });
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].text, "(variable)");
          });

          it("should return none for markdown", async () => {
            const cell = createCell("markdown");
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 0);
          });

          it("should return none for python", async () => {
            const cell = createCell("python");
            const res = await instance.provideCellStatusBarItems(cell, token);
            assert.strictEqual(res.length, 0);
          });
        });
      });

      describe("Connection Not Picked", () => {
        beforeEach(() => {
          sinon.stub(workspaceCommand, "getServerForUri").returns(undefined);
          createInstance();
        });

        it("should return none", async () => {
          const cell = createCell("q");
          const res = await instance.provideCellStatusBarItems(cell, token);
          assert.strictEqual(res.length, 0);
        });
      });
    });
  });
});
