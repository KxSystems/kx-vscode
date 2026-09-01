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

import * as notebookTestUtils from "./notebookTest.utils.test";
import { setActiveTarget } from "../../../../src/classes/activeTarget";
import { InsightsConnection } from "../../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../../src/classes/localConnection";
import { ReplConnection } from "../../../../src/classes/replConnection";
import * as dataSourceCommand from "../../../../src/commands/dataSourceCommand";
import * as serverCommand from "../../../../src/commands/serverCommand";
import * as workspaceCommand from "../../../../src/commands/workspaceCommand";
import { ext } from "../../../../src/extensionVariables";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import { KdbNode } from "../../../../src/services/kdbTreeProvider";
import * as controlller from "../../../../src/services/notebookController";
import * as notifications from "../../../../src/utils/notifications";
import * as plotUtils from "../../../../src/utils/plotUtils";
import * as queryUtils from "../../../../src/utils/queryUtils";

describe("Controller", () => {
  const result = notebookTestUtils.result;

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
    sinon.restore();
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
          appendOutput(_) {},
          clearOutput() {},
          executionOrder: 0,
          token: new vscode.CancellationTokenSource().token,
        };
      },
    };
  }

  describe("REPL Connection", () => {
    let writeOutputStub: sinon.SinonStub;

    beforeEach(() => {
      writeOutputStub = sinon.stub(
        controlller.KxNotebookController.prototype,
        "writeOutput",
      );
      sinon
        .stub(ReplConnection.prototype, "executeQuery")
        .resolves({ output: "RESULT" });
      sinon.stub(workspaceCommand, "getServerForUri").returns(undefined);
      sinon.stub(queryUtils, "getPythonWrapper").returns("expression");
      createInstance();
    });

    describe("q cell", () => {
      it("should execute", async () => {
        await instance.execute(
          [notebookTestUtils.createCell("q")],
          notebookTestUtils.createNotebook(),
          createController(),
        );
        sinon.assert.calledOnceWithMatch(writeOutputStub, sinon.match.any, {
          text: "RESULT",
          mime: "text/plain",
        });
      });
    });

    describe("python cell", () => {
      it("should execute", async () => {
        await instance.execute(
          [notebookTestUtils.createCell("python")],
          notebookTestUtils.createNotebook(),
          createController(),
        );
        sinon.assert.calledOnceWithMatch(writeOutputStub, sinon.match.any, {
          text: "RESULT",
          mime: "text/plain",
        });
      });
    });

    describe("sql cell", () => {
      it("should execute", async () => {
        await instance.execute(
          [notebookTestUtils.createCell("sql")],
          notebookTestUtils.createNotebook(),
          createController(),
        );
        sinon.assert.calledOnceWithMatch(writeOutputStub, sinon.match.any, {
          text: "RESULT",
          mime: "text/plain",
        });
      });
    });

    describe("interrupt", () => {
      it("should cancel the REPL query when the cell is interrupted", async () => {
        const cancelStub = sinon.stub(ReplConnection.prototype, "cancel");
        const source = new vscode.CancellationTokenSource();

        // Interrupt while the query is in flight; a token cancelled up front
        // would fire after the listener is disposed.
        (<sinon.SinonStub>ReplConnection.prototype.executeQuery).callsFake(
          async () => {
            source.cancel();
            return { output: "" };
          },
        );

        await instance.execute(
          [notebookTestUtils.createCell("q")],
          notebookTestUtils.createNotebook(),
          <vscode.NotebookController>{
            createNotebookCellExecution(_) {
              return <vscode.NotebookCellExecution>(<unknown>{
                start() {},
                end() {},
                appendOutput(_) {},
                clearOutput() {},
                executionOrder: 0,
                token: source.token,
              });
            },
          },
        );

        sinon.assert.calledOnce(cancelStub);
      });
    });
  });

  describe("Unassigned notebook", () => {
    const connLabel = "activeConnection";

    afterEach(() => {
      setActiveTarget(undefined);
      ext.connectionConsoles.delete(connLabel);
    });

    it("should run on the active connection", async () => {
      const conn = new LocalConnection("127.0.0.1:5001", connLabel, []);
      sinon
        .stub(
          ConnectionManagementService.prototype,
          "retrieveConnectedConnection",
        )
        .returns(conn);
      // getActiveTarget drops a connection target without a live console.
      ext.connectionConsoles.set(connLabel, <any>{});
      setActiveTarget({ kind: "connection", connLabel });

      const replStub = sinon.stub(ReplConnection.prototype, "executeQuery");
      executeQueryStub.resolves(result.text);
      createInstance();

      await instance.execute(
        [notebookTestUtils.createCell("q")],
        notebookTestUtils.createNotebook(),
        createController(),
      );

      sinon.assert.calledOnce(executeQueryStub);
      sinon.assert.notCalled(replStub);
      assert.strictEqual(success, true);
    });
  });

  describe("Connection Picked", () => {
    // resolveRunTarget resolves the assignment, the active target and the
    // REPL fallback, so it is the seam the controller routes through.
    const runOn = (conn: unknown) =>
      sinon
        .stub(workspaceCommand, "resolveRunTarget")
        .resolves(
          conn
            ? <workspaceCommand.RunTarget>{ kind: "connection", conn }
            : undefined,
        );

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

        describe("Connection Not Exists", () => {
          beforeEach(() => {
            runOn(undefined);

            createInstance();
          });

          it("should notify missing connection with error", async () => {
            await instance.execute(
              [notebookTestUtils.createCell()],
              notebookTestUtils.createNotebook(),
              createController(),
            );
            assert.strictEqual(success, undefined);
          });
        });

        describe("Connection Exists", () => {
          beforeEach(() => {
            runOn(sinon.createStubInstance(InsightsConnection));

            createInstance();
          });

          it("should execute sql cell", async () => {
            await instance.execute(
              [notebookTestUtils.createCell("sql")],
              notebookTestUtils.createNotebook(),
              createController(),
            );
            assert.strictEqual(success, true);
          });
        });

        describe("Populate Scratchpad", () => {
          let populateScratchpadStub: sinon.SinonStub;

          beforeEach(() => {
            runOn(sinon.createStubInstance(InsightsConnection));

            populateScratchpadStub = sinon.stub(
              dataSourceCommand,
              "populateScratchpad",
            );

            createInstance();
          });

          it("should call populate scratchpad if variable is set", async () => {
            await instance.execute(
              [
                notebookTestUtils.createCell("q", {
                  target: "test-target",
                  variable: "test-variable",
                }),
              ],
              notebookTestUtils.createNotebook(),
              createController(),
            );
            assert.strictEqual(success, true);
            sinon.assert.calledOnce(populateScratchpadStub);
          });
        });
      });

      describe("Output escaping", () => {
        let writeOutputStub: sinon.SinonStub;

        beforeEach(() => {
          const conn = new LocalConnection("127.0.0.1:5001", "testLabel", []);
          sinon
            .stub(
              ConnectionManagementService.prototype,
              "retrieveConnectedConnection",
            )
            .returns(conn);
          runOn(conn);
          writeOutputStub = sinon.stub(
            controlller.KxNotebookController.prototype,
            "writeOutput",
          );
          createInstance();
        });

        const rendered = () => writeOutputStub.lastCall.args[1];

        it("should escape markup in a column name and a cell value", async () => {
          executeQueryStub.resolves({
            count: 1,
            columns: [
              {
                name: "x<y",
                type: "symbols",
                values: ["<b>a</b> & b"],
                order: [0],
              },
            ],
          });

          await instance.execute(
            [notebookTestUtils.createCell("sql")],
            notebookTestUtils.createNotebook(),
            createController(),
          );

          assert.strictEqual(rendered().mime, "text/html");
          assert.ok(
            rendered().text.includes("<th>x&lt;y [symbols]</th>"),
            rendered().text,
          );
          assert.ok(
            rendered().text.includes("<td>&lt;b&gt;a&lt;/b&gt; &amp; b</td>"),
            rendered().text,
          );
        });

        it("should escape markup in a text result", async () => {
          executeQueryStub.resolves("{x<y}\n     ^");

          await instance.execute(
            [notebookTestUtils.createCell("q")],
            notebookTestUtils.createNotebook(),
            createController(),
          );

          assert.strictEqual(
            rendered().text,
            `<p class="results-txt">{x&lt;y}<br/>     ^</p>`,
          );
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
            const mockNode = new KdbNode(
              [],
              "kdbnode1",
              {
                serverName: "kdbservername",
                serverPort: "kdbserverport",
                auth: true,
                serverAlias: "kdbserveralias",
                tls: true,
              },
              vscode.TreeItemCollapsibleState.None,
            );
            const mockConnection = new LocalConnection(
              "127.0.0.1:5001",
              "testLabel",
              [],
            );

            sinon
              .stub(workspaceCommand, "getConnectionForServer")
              .resolves(mockNode);
            runOn(mockConnection);

            createInstance();
          });

          describe("q cell", () => {
            it("should display table results", async () => {
              executeQueryStub.resolves(result.table);
              await instance.execute(
                [notebookTestUtils.createCell("q")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.calledOnce(notifyStub);
              assert.strictEqual(success, true);
            });

            it("should display png results", async () => {
              executeQueryStub.resolves(result.png);
              await instance.execute(
                [notebookTestUtils.createCell("q")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.calledOnce(notifyStub);
              assert.strictEqual(success, true);
            });

            it("should display text results", async () => {
              executeQueryStub.resolves(result.text);
              await instance.execute(
                [notebookTestUtils.createCell("q")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.calledOnce(notifyStub);
              assert.strictEqual(success, true);
            });
          });

          describe("python cell", () => {
            it("should display text results", async () => {
              executeQueryStub.resolves(result.text);
              await instance.execute(
                [notebookTestUtils.createCell("python")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.calledOnce(notifyStub);
              assert.strictEqual(success, true);
            });
          });

          describe("sql cell", () => {
            it("should display table results", async () => {
              executeQueryStub.resolves(result.table);
              await instance.execute(
                [notebookTestUtils.createCell("sql")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.calledOnce(notifyStub);
              assert.strictEqual(success, true);
            });

            it("should display an error for an unrenderable result", async () => {
              executeQueryStub.resolves({});
              await instance.execute(
                [notebookTestUtils.createCell("sql")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.calledTwice(notifyStub);
              assert.strictEqual(success, false);
            });
          });
        });

        describe("Connection Not Exists", () => {
          beforeEach(() => {
            runOn(undefined);

            createInstance();
          });

          it("should notify missing connection with error", async () => {
            await instance.execute(
              [notebookTestUtils.createCell()],
              notebookTestUtils.createNotebook(),
              createController(),
            );

            assert.strictEqual(success, undefined);
          });
        });
      });
    });
  });

  describe("Websocket images", () => {
    const image = "data:image/png;base64,iVBORw0KGgo=";

    const MIRROR_MS = 10;

    let cell: any;
    let applyEditStub: sinon.SinonStub;

    function createDeferredController() {
      return <vscode.NotebookController>{
        createNotebookCellExecution(_) {
          return <vscode.NotebookCellExecution>(<any>{
            start() {},
            end(status: boolean) {
              success = status;
            },
            clearOutput() {
              return mirror(() => (cell.outputs = []));
            },
            appendOutput(outputs: any) {
              return mirror(
                () => (cell.outputs = [...cell.outputs, ...toArray(outputs)]),
              );
            },
            executionOrder: 0,
            token: new vscode.CancellationTokenSource().token,
          });
        },
      };
    }

    const toArray = (outputs: any) =>
      Array.isArray(outputs) ? outputs : [outputs];

    const mirror = (apply: () => void) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          apply();
          resolve();
        }, MIRROR_MS),
      );

    const settle = () =>
      new Promise<void>((resolve) => setTimeout(resolve, MIRROR_MS * 3));

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
      ext.pendingImageTargets.clear();

      cell = notebookTestUtils.createCell("q");
      cell.kind = vscode.NotebookCellKind.Code;
      cell.index = 0;
      cell.outputs = [];

      applyEditStub = sinon
        .stub(vscode.workspace, "applyEdit")
        .callsFake(async (edit: any) => {
          const entry = (edit._edits || []).find((e: any) =>
            Array.isArray(e.cells),
          );
          if (entry) {
            cell.outputs = entry.cells[0].outputs || [];
          }
          return true;
        });

      sinon
        .stub(
          ConnectionManagementService.prototype,
          "retrieveConnectedConnection",
        )
        .returns(sinon.createStubInstance(LocalConnection));
      sinon.stub(workspaceCommand, "resolveRunTarget").resolves(<
        workspaceCommand.RunTarget
      >{
        kind: "connection",
        conn: sinon.createStubInstance(LocalConnection),
      });
      executeQueryStub.resolves(notebookTestUtils.result.table);

      createInstance();
    });

    afterEach(() => {
      ext.pendingImageTargets.clear();
    });

    const requestID = () => [...ext.pendingImageTargets.keys()].pop() || "";

    async function runWithImage() {
      let respond: (result: unknown) => void;
      executeQueryStub.returns(new Promise((resolve) => (respond = resolve)));

      const running = instance.execute(
        [cell],
        notebookTestUtils.createNotebook(),
        createDeferredController(),
      );
      await tick();
      await plotUtils.renderImage(requestID(), image);
      respond(notebookTestUtils.result.table);
      await running;
      await settle();
    }

    it("should show both the result and an image that arrives while the cell runs", async () => {
      await runWithImage();

      sinon.assert.notCalled(applyEditStub);
      assert.strictEqual(cell.outputs.length, 2);
    });

    it("should drop the previous outputs when a cell showing an image is rerun", async () => {
      await runWithImage();
      await runWithImage();
      await runWithImage();

      assert.strictEqual(cell.outputs.length, 2);
    });

    it("should show both the result and an image that arrives once the cell ended", async () => {
      await instance.execute(
        [cell],
        notebookTestUtils.createNotebook(),
        createDeferredController(),
      );
      await plotUtils.renderImage(requestID(), image);
      await settle();

      assert.strictEqual(cell.outputs.length, 2);
    });
  });
});
