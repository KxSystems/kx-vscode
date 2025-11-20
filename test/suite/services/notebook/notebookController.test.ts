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

import * as notebookTestUtils from "./notebookTest.utils.test";
import { InsightsConnection } from "../../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../../src/classes/localConnection";
import { ReplConnection } from "../../../../src/classes/replConnection";
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
      sinon.stub(workspaceCommand, "getServerForUri").returns(ext.REPL);
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
  });

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

        describe("Connection Not Exists", () => {
          beforeEach(() => {
            sinon.stub(workspaceCommand, "findConnection").resolves(undefined);

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
            sinon
              .stub(workspaceCommand, "findConnection")
              .resolves(sinon.createStubInstance(InsightsConnection));

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
            sinon
              .stub(workspaceCommand, "findConnection")
              .resolves(mockConnection);

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
              sinon.assert.notCalled(notifyStub);
              assert.strictEqual(success, true);
            });

            it("should display png results", async () => {
              executeQueryStub.resolves(result.png);
              await instance.execute(
                [notebookTestUtils.createCell("q")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.notCalled(notifyStub);
              assert.strictEqual(success, true);
            });

            it("should display text results", async () => {
              executeQueryStub.resolves(result.text);
              await instance.execute(
                [notebookTestUtils.createCell("q")],
                notebookTestUtils.createNotebook(),
                createController(),
              );
              sinon.assert.notCalled(notifyStub);
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
              sinon.assert.notCalled(notifyStub);
              assert.strictEqual(success, true);
            });
          });

          describe("sql cell", () => {
            it("should display not supported", async () => {
              executeQueryStub.resolves({});
              await instance.execute(
                [notebookTestUtils.createCell("sql")],
                notebookTestUtils.createNotebook(),
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

        describe("Connection Not Exists", () => {
          beforeEach(() => {
            sinon.stub(workspaceCommand, "findConnection").resolves(undefined);

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
              [notebookTestUtils.createCell("q")],
              notebookTestUtils.createNotebook(),
              createController(),
            );
            sinon.assert.notCalled(notifyStub);
            assert.strictEqual(success, true);
          });
        });

        describe("q cell with target", () => {
          it("should error", async () => {
            executeQueryStub.resolves(text);
            await instance.execute(
              [notebookTestUtils.createCell("q", { target: "target" })],
              notebookTestUtils.createNotebook(),
              createController(),
            );
            sinon.assert.called(notifyStub);
          });
        });

        describe("q cell with variable", () => {
          it("should error", async () => {
            executeQueryStub.resolves(text);
            await instance.execute(
              [notebookTestUtils.createCell("q", { variable: "variable" })],
              notebookTestUtils.createNotebook(),
              createController(),
            );
            sinon.assert.called(notifyStub);
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
              [notebookTestUtils.createCell("q")],
              notebookTestUtils.createNotebook(),
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
