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
          replaceOutput(_) {},
          executionOrder: 0,
          token: new vscode.CancellationTokenSource().token,
        };
      },
    };
  }

  describe("REPL Connection", () => {
    let replaceOutputStub: sinon.SinonStub;

    beforeEach(() => {
      replaceOutputStub = sinon.stub(
        controlller.KxNotebookController.prototype,
        "replaceOutput",
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
        sinon.assert.calledOnceWithMatch(replaceOutputStub, sinon.match.any, {
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
        sinon.assert.calledOnceWithMatch(replaceOutputStub, sinon.match.any, {
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
        sinon.assert.calledOnceWithMatch(replaceOutputStub, sinon.match.any, {
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
                replaceOutput(_) {},
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
});
