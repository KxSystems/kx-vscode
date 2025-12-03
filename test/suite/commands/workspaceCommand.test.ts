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

import { ReplConnection } from "../../../src/classes/replConnection";
import * as serverCommand from "../../../src/commands/serverCommand";
import * as workspaceCommand from "../../../src/commands/workspaceCommand";
import { ext } from "../../../src/extensionVariables";
import { ExecutionTypes } from "../../../src/models/execution";
import { ConnectionManagementService } from "../../../src/services/connectionManagerService";
import { InsightsNode, KdbNode } from "../../../src/services/kdbTreeProvider";
import { WorkspaceTreeProvider } from "../../../src/services/workspaceTreeProvider";
import * as dataSourceUtils from "../../../src/utils/dataSource";
import * as loggers from "../../../src/utils/loggers";
import * as notifications from "../../../src/utils/notifications";

describe("workspaceCommand", () => {
  const kdbUri = vscode.Uri.file("test-kdb.q");
  const insightsUri = vscode.Uri.file("test-insights.q");
  const pythonUri = vscode.Uri.file("test-python.q");

  beforeEach(() => {
    const insightNode = new InsightsNode(
      [],
      "remote",
      { alias: "connection1", auth: false, server: "" },
      vscode.TreeItemCollapsibleState.None,
    );
    const kdbNode = new KdbNode(
      [],
      "local",
      {
        auth: false,
        serverAlias: "connection2",
        serverName: "",
        serverPort: "1",
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );
    ext.serverProvider = <any>{
      async getChildren() {
        return [kdbNode, insightNode];
      },
    };
    ext.connectionsList.push(kdbNode);
    ext.connectionsList.push(insightNode);

    ext.activeTextEditor = <any>{
      document: {
        uri: insightsUri,
        fileName: "test-insights.q",
        getText() {
          return "";
        },
      },
    };

    sinon
      .stub(ConnectionManagementService.prototype, "isConnected")
      .returns(true);
    sinon
      .stub(ConnectionManagementService.prototype, "retrieveMetaContent")
      .returns(JSON.stringify([{ assembly: "assembly", target: "target" }]));
    sinon.stub(vscode.workspace, "getConfiguration").value(() => {
      return {
        get(key: string) {
          switch (key) {
            case "servers":
              return [{ serverAlias: "connection2" }];
            case "insightsEnterpriseConnections":
              return [{ alias: "connection1" }];
            case "connectionMap":
              return {
                [kdbUri.path]: "connection2",
                [pythonUri.path]: "connection1",
                [insightsUri.path]: "connection1",
              };
            case "targetMap":
              return {
                [insightsUri.path]: "assembly target",
              };
          }
          return {};
        },
        update() {},
      };
    });
  });

  afterEach(() => {
    sinon.restore();
    ext.serverProvider = <any>{};
    ext.connectionsList.length = 0;
    ext.activeTextEditor = undefined;
  });

  describe("connectWorkspaceCommands", () => {
    it("should update views on delete and create", () => {
      let cb1, cb2, dsTree, wbTree;
      sinon.stub(vscode.workspace, "createFileSystemWatcher").value(() => ({
        onDidCreate: (cb) => (cb1 = cb),
        onDidDelete: (cb) => (cb2 = cb),
      }));
      ext.dataSourceTreeProvider = <WorkspaceTreeProvider>{
        reload() {
          dsTree = true;
        },
      };
      ext.scratchpadTreeProvider = <WorkspaceTreeProvider>{
        reload() {
          wbTree = true;
        },
      };
      workspaceCommand.connectWorkspaceCommands();
      cb1(vscode.Uri.file("test.kdb.json"));
      assert.strictEqual(dsTree, true);
      cb2(vscode.Uri.file("test.kdb.q"));
      assert.strictEqual(wbTree, true);
    });
  });

  describe("getInsightsServers", () => {
    it("should return insights server aliases as array", () => {
      const result = workspaceCommand.getInsightsServers();
      assert.strictEqual(result[0], "connection1");
    });
  });

  describe("setServerForUri", () => {
    it("should associate a server with an uri", async () => {
      await assert.doesNotReject(() =>
        workspaceCommand.setServerForUri(
          vscode.Uri.file("test.kdb.q"),
          "connection1",
        ),
      );
    });
  });

  describe("pickConnection", () => {
    it("should pick from available servers", async () => {
      sinon.stub(vscode.window, "showQuickPick").value(async () => "test");
      const result = await workspaceCommand.pickConnection(
        vscode.Uri.file("test.kdb.q"),
      );
      assert.strictEqual(result, "test");
    });

    it("should return undefined from (none)", async () => {
      sinon.stub(vscode.window, "showQuickPick").value(async () => "(none)");
      const result = await workspaceCommand.pickConnection(
        vscode.Uri.file("test.kdb.q"),
      );
      assert.strictEqual(result, undefined);
    });
  });

  describe("pickTarget", () => {
    it("should pick from available targets", async () => {
      sinon
        .stub(vscode.window, "showQuickPick")
        .value(async () => "scratchpad");
      let res = await workspaceCommand.pickTarget(insightsUri);
      assert.strictEqual(res, undefined);
      res = await workspaceCommand.pickTarget(kdbUri);
      assert.strictEqual(res, undefined);
    });

    it("should only show scratchpad for .py files", async () => {
      sinon
        .stub(vscode.window, "showQuickPick")
        .value(async () => "scratchpad");
      const res = await workspaceCommand.pickTarget(pythonUri);
      assert.strictEqual(res, undefined);
    });
  });

  describe("getConnectionForUri", () => {
    it("should return node", async () => {
      workspaceCommand.getConnectionForUri(insightsUri);
      workspaceCommand.getConnectionForUri(kdbUri);
    });

    it("should return undefined", async () => {
      ext.connectionsList.length = 0;
      const node = workspaceCommand.getConnectionForUri(insightsUri);
      assert.strictEqual(node, undefined);
    });
  });

  describe("runActiveEditor", () => {
    it("should run query", async () => {
      await workspaceCommand.runActiveEditor();
    });
  });

  describe("ConnectionLensProvider", () => {
    describe("provideCodeLenses", () => {
      it("should return lenses", async () => {
        const document: vscode.TextDocument = <any>{
          uri: kdbUri,
        };
        const provider = new workspaceCommand.ConnectionLensProvider();
        const result = await provider.provideCodeLenses(document);
        assert.ok(result.length >= 1);
      });

      it("should return 2 lenses", async () => {
        const document: vscode.TextDocument = <any>{
          uri: insightsUri,
        };
        const provider = new workspaceCommand.ConnectionLensProvider();
        const result = await provider.provideCodeLenses(document);
        assert.ok(result.length >= 1);
      });
    });
  });

  describe("checkOldDatasourceFiles", () => {
    let oldFilesExistsStub: sinon.SinonStub;

    beforeEach(() => {
      oldFilesExistsStub = sinon.stub(dataSourceUtils, "oldFilesExists");
    });

    afterEach(() => {
      oldFilesExistsStub.restore();
    });
  });

  describe("importOldDSFiles", () => {
    let windowErrorStub,
      windowWithProgressStub,
      windowShowInfo,
      workspaceFolderStub,
      tokenOnCancellationRequestedStub,
      kdbOutputLogStub: sinon.SinonStub;

    beforeEach(() => {
      windowErrorStub = sinon.stub(vscode.window, "showErrorMessage");
      windowWithProgressStub = sinon.stub(vscode.window, "withProgress");
      windowShowInfo = sinon.stub(vscode.window, "showInformationMessage");
      workspaceFolderStub = sinon.stub(vscode.workspace, "workspaceFolders");
      tokenOnCancellationRequestedStub = sinon.stub();
      windowWithProgressStub.callsFake((options, task) => {
        const token = {
          onCancellationRequested: tokenOnCancellationRequestedStub,
        };
        task({}, token);
      });

      kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should show info message if old files do not exist", async () => {
      ext.oldDSformatExists = false;
      await workspaceCommand.importOldDSFiles();
      sinon.assert.calledOnce(windowShowInfo);
    });

    it("should show error message if workspace do not exist", async () => {
      ext.oldDSformatExists = true;
      await workspaceCommand.importOldDSFiles();
      sinon.assert.calledOnce(windowErrorStub);
    });

    describe("runOnRepl", () => {
      let notifyStub, executeStub: sinon.SinonStub;
      const editor = <vscode.TextEditor>{
        document: <any>{
          uri: kdbUri,
          lineAt() {
            return "a:1;a";
          },
          getText() {
            return "a:1;a";
          },
        },
        selection: { active: { line: 0 } },
      };

      beforeEach(() => {
        notifyStub = sinon.stub(notifications, "notify");
        executeStub = sinon.stub(notifications.Runner.prototype, "execute");
      });

      it("should execute q file", async () => {
        await workspaceCommand.runOnRepl(editor, ExecutionTypes.QueryFile);
        sinon.assert.calledOnce(executeStub);
      });

      it("should execute q selection", async () => {
        await workspaceCommand.runOnRepl(editor, ExecutionTypes.QuerySelection);
        sinon.assert.calledOnce(executeStub);
      });

      it("should notify for other execution types", async () => {
        await workspaceCommand.runOnRepl(
          editor,
          ExecutionTypes.PopulateScratchpad,
        );
        sinon.assert.calledOnce(notifyStub);
      });

      it("should notify execution error", async () => {
        executeStub.rejects(new Error("Test"));
        await workspaceCommand.runOnRepl(editor, ExecutionTypes.QueryFile);
        sinon.assert.calledOnce(notifyStub);
      });

      describe("startRepl", () => {
        const conn = <ReplConnection>{ start() {} };

        beforeEach(() => {
          sinon.stub(ReplConnection, "getOrCreateInstance").resolves(conn);
        });
      });
    });
  });

  describe("resetScratchpadFromEditor", () => {
    let getServerForUriStub,
      pickConnectionStub,
      _getConnectionForServerStub,
      resetScratchpadStub: sinon.SinonStub;

    const insightsNode = new InsightsNode(
      [],
      "insightsnode1",
      {
        server: "https://insightsservername.com/",
        alias: "insightsserveralias",
        auth: true,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    beforeEach(() => {
      ext.activeTextEditor = <vscode.TextEditor>{
        options: { insertSpaces: true, indentSize: 4 },
        selection: { active: new vscode.Position(0, 0) },
        document: {
          uri: vscode.Uri.file("/tmp/some.q"),
          getText: () => "",
        },
      };

      getServerForUriStub = sinon.stub(workspaceCommand, "getServerForUri");
      pickConnectionStub = sinon.stub(workspaceCommand, "pickConnection");
      _getConnectionForServerStub = sinon
        .stub(workspaceCommand, "getConnectionForServer")
        .resolves(insightsNode);
      resetScratchpadStub = sinon
        .stub(serverCommand, "resetScratchpad")
        .resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should call resetScratchpad with empty server label", async () => {
      getServerForUriStub.returns("");
      await workspaceCommand.resetScratchpadFromEditor();
      assert.strictEqual(resetScratchpadStub.calledWith(""), true);
    });

    it("should set server to an empty string if no server is found", async () => {
      getServerForUriStub.returns(undefined);
      pickConnectionStub.resolves(undefined);
      await workspaceCommand.resetScratchpadFromEditor();
      assert.strictEqual(resetScratchpadStub.calledWith(""), true);
    });

    it("should not call resetScratchpad if activeTextEditor is not set", async () => {
      ext.activeTextEditor = undefined;
      await workspaceCommand.resetScratchpadFromEditor();
      assert.strictEqual(resetScratchpadStub.called, false);
    });
  });
});
