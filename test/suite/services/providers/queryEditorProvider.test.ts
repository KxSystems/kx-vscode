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

import { createPanel } from "./provider.utils.test";
import { InsightsConnection } from "../../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../../src/classes/localConnection";
import * as dataSourceCommand from "../../../../src/commands/dataSourceCommand";
import * as workspaceCommand from "../../../../src/commands/workspaceCommand";
import { ext } from "../../../../src/extensionVariables";
import { QueryCommand } from "../../../../src/models/messages";
import { createQsql } from "../../../../src/models/query";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import { InsightsNode } from "../../../../src/services/kdbTreeProvider";
import { QueryEditorProvider } from "../../../../src/services/queryEditorProvider";
import * as core from "../../../../src/utils/core";
import * as utils from "../../../../src/utils/uriUtils";
import {
  getMetaNoAssemblyResponse,
  getMetaResponse,
} from "../../../fixtures/api/getMeta";

describe("queryEditorProvider", () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = <vscode.ExtensionContext>{};
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("register", () => {
    it("should register the provider", () => {
      let result = undefined;
      sinon
        .stub(vscode.window, "registerCustomEditorProvider")
        .value(() => (result = true));
      QueryEditorProvider.register(context);
      assert.ok(result);
    });
  });

  describe("resolveCustomTextEditor", () => {
    it("should resolve", async () => {
      const provider = new QueryEditorProvider(context);
      const document = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify({ version: 1 }),
      });
      sinon.stub(utils, "getUri").value(() => "");
      const panel = createPanel();
      await assert.doesNotReject(() =>
        provider.resolveCustomTextEditor(document, panel.panel),
      );
      panel.listeners.onDidReceiveMessage({});
      panel.listeners.onDidChangeViewState();
      panel.listeners.onDidDispose();
    });

    it("should resolve an empty document", async () => {
      const provider = new QueryEditorProvider(context);
      const document = await vscode.workspace.openTextDocument({
        language: "json",
        content: "",
      });
      sinon.stub(utils, "getUri").value(() => "");
      const panel = createPanel();
      await assert.doesNotReject(() =>
        provider.resolveCustomTextEditor(document, panel.panel),
      );
    });
  });

  describe("getQueries", () => {
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
    const insightsConn = new InsightsConnection(
      insightsNode.label,
      insightsNode,
    );
    const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);
    const connMngService = new ConnectionManagementService();
    let isConnectedStub: sinon.SinonStub;

    beforeEach(() => {
      ext.outputChannel = vscode.window.createOutputChannel("kdb", {
        log: true,
      });
      isConnectedStub = sinon.stub(connMngService, "isConnected");
      sinon.stub(connMngService, "retrieveConnectedConnection");
    });

    afterEach(() => {
      insightsConn.meta = undefined;
      ext.connectedConnectionList.length = 0;
      ext.connectedContextStrings.length = 0;
    });

    it("should offer the built in queries when the connection is not connected", async () => {
      isConnectedStub.returns(false);
      const provider = new QueryEditorProvider(context);
      const queries = await provider.getQueries(insightsConn.connLabel);
      assert.deepStrictEqual(
        queries.map((query) => query.name),
        ["qSQL", "SQL", ".kxi.getData"],
      );
    });

    it("should offer the built in queries for a local connection", async () => {
      ext.connectedContextStrings.push(localConn.connLabel);
      ext.connectedConnectionList.push(localConn);
      isConnectedStub.returns(true);
      const provider = new QueryEditorProvider(context);
      const queries = await provider.getQueries(localConn.connLabel);
      assert.deepStrictEqual(
        queries.map((query) => query.name),
        ["qSQL", "SQL", ".kxi.getData"],
      );
    });

    it("should offer the built in queries when the meta has no assembly", async () => {
      ext.connectedContextStrings.push(insightsConn.connLabel);
      ext.connectedConnectionList.push(insightsConn);
      isConnectedStub.returns(true);
      insightsConn.meta = getMetaNoAssemblyResponse;
      const provider = new QueryEditorProvider(context);
      const queries = await provider.getQueries(insightsConn.connLabel);
      assert.deepStrictEqual(
        queries.map((query) => query.name),
        ["qSQL", "SQL", ".kxi.getData"],
      );
    });

    it("should parse the UDAs from the connection meta", async () => {
      ext.connectedContextStrings.push(insightsConn.connLabel);
      ext.connectedConnectionList.push(insightsConn);
      isConnectedStub.returns(true);
      insightsConn.meta = getMetaResponse;
      const provider = new QueryEditorProvider(context);
      const udas = await provider.getQueries(insightsConn.connLabel);
      assert.ok(Array.isArray(udas));
      assert.deepStrictEqual(
        await provider.getQueries(insightsConn.connLabel),
        udas,
      );
    });
  });

  describe("messages", () => {
    const file = { version: 1, query: createQsql() };

    let panel: ReturnType<typeof createPanel>;
    let telemetry: typeof ext.telemetry;
    let isConnected: sinon.SinonStub;
    let pickConnection: sinon.SinonStub;
    let refreshGetMeta: sinon.SinonStub;
    let runDataSource: sinon.SinonStub;
    let populateScratchpad: sinon.SinonStub;
    let offerConnectAction: sinon.SinonStub;
    let applyEdit: sinon.SinonStub;
    let executeCommand: sinon.SinonStub;

    const settled = () => new Promise((resolve) => setImmediate(resolve));

    const send = (command: QueryCommand, msg: any = {}) =>
      panel.listeners.onDidReceiveMessage(<any>{
        command,
        file,
        selectedServer: "server",
        ...msg,
      });

    beforeEach(async () => {
      ext.outputChannel = vscode.window.createOutputChannel("kdb", {
        log: true,
      });
      telemetry = ext.telemetry;
      ext.telemetry = <any>{
        sendEvent: sinon.stub(),
        sendError: sinon.stub(),
      };

      sinon.stub(utils, "getUri").value(() => "");
      sinon.stub(workspaceCommand, "getServerForUri").returns("server");
      sinon
        .stub(workspaceCommand, "getTimeoutForUri")
        .returns(<any>{ value: 30 });
      sinon
        .stub(workspaceCommand, "getConnectionForServer")
        .resolves(undefined);
      pickConnection = sinon
        .stub(workspaceCommand, "pickConnection")
        .resolves();
      isConnected = sinon
        .stub(ConnectionManagementService.prototype, "isConnected")
        .returns(true);
      refreshGetMeta = sinon
        .stub(ConnectionManagementService.prototype, "refreshGetMeta")
        .resolves();
      runDataSource = sinon.stub(dataSourceCommand, "runDataSource").resolves();
      populateScratchpad = sinon
        .stub(dataSourceCommand, "populateScratchpad")
        .resolves();
      offerConnectAction = sinon
        .stub(core, "offerConnectAction")
        .resolves(false);
      applyEdit = sinon.stub(vscode.workspace, "applyEdit").resolves(true);
      executeCommand = sinon.stub(vscode.commands, "executeCommand").resolves();

      const document = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify({ version: 1 }),
      });
      panel = createPanel();
      await new QueryEditorProvider(context).resolveCustomTextEditor(
        document,
        panel.panel,
      );
    });

    afterEach(() => {
      ext.telemetry = telemetry;
    });

    it("should ask for the connection picker", async () => {
      await send(QueryCommand.Connection);

      sinon.assert.calledOnce(pickConnection);
    });

    it("should write a changed file back to the document", async () => {
      await send(QueryCommand.Change);

      sinon.assert.calledOnce(applyEdit);
    });

    it("should leave the document alone when nothing changed", async () => {
      await send(QueryCommand.Change, { file: { version: 1 } });

      sinon.assert.notCalled(applyEdit);
    });

    it("should delegate saving to the workbench", async () => {
      await send(QueryCommand.Save);

      sinon.assert.calledWith(
        executeCommand,
        "workbench.action.files.save",
        sinon.match.any,
      );
    });

    it("should refresh the meta of the selected connection", async () => {
      await send(QueryCommand.Refresh);

      sinon.assert.calledWith(refreshGetMeta, "server");
      sinon.assert.notCalled(offerConnectAction);
    });

    it("should offer to connect before refreshing when disconnected", async () => {
      isConnected.returns(false);

      await send(QueryCommand.Refresh);

      sinon.assert.calledOnce(offerConnectAction);
      sinon.assert.notCalled(refreshGetMeta);
    });

    it("should refresh once the offer to connect is taken", async () => {
      isConnected.returns(false);
      offerConnectAction.resolves(true);

      await send(QueryCommand.Refresh);

      sinon.assert.calledWith(refreshGetMeta, "server");
    });

    it("should run the query with the timeout of the file", async () => {
      await send(QueryCommand.Run);

      sinon.assert.calledOnce(runDataSource);
      const [source, connLabel, executorName, , timeout] =
        runDataSource.firstCall.args;
      assert.strictEqual(source.dataSource.selectedType, "QSQL");
      assert.strictEqual(connLabel, "server");
      assert.strictEqual(typeof executorName, "string");
      assert.strictEqual(timeout, 30);
    });

    it("should offer to connect before running when disconnected", async () => {
      isConnected.returns(false);

      await send(QueryCommand.Run);

      sinon.assert.calledOnce(offerConnectAction);
      sinon.assert.notCalled(runDataSource);
    });

    it("should say the query keeps running when the run is cancelled", async () => {
      runDataSource.rejects(new Error("Cancelled"));

      await assert.doesNotReject(() => send(QueryCommand.Run));
    });

    it("should let a run failure through", async () => {
      runDataSource.rejects(new Error("boom"));

      await assert.rejects(() => send(QueryCommand.Run), /boom/);
    });

    it("should populate the scratchpad", async () => {
      await send(QueryCommand.Populate);

      sinon.assert.calledOnce(populateScratchpad);
      const [source, connLabel, variable, silent, , timeout] =
        populateScratchpad.firstCall.args;
      assert.strictEqual(source.dataSource.selectedType, "QSQL");
      assert.strictEqual(connLabel, "server");
      assert.strictEqual(variable, undefined);
      assert.strictEqual(silent, undefined);
      assert.strictEqual(timeout, 30);
    });

    it("should offer to connect before populating when disconnected", async () => {
      isConnected.returns(false);

      await send(QueryCommand.Populate);

      sinon.assert.calledOnce(offerConnectAction);
      sinon.assert.notCalled(populateScratchpad);
    });

    it("should report a cancelled populate as sent", async () => {
      populateScratchpad.rejects(new Error("Cancelled"));

      await assert.doesNotReject(() => send(QueryCommand.Populate));
    });

    it("should let a populate failure through", async () => {
      populateScratchpad.rejects(new Error("boom"));

      await assert.rejects(() => send(QueryCommand.Populate), /boom/);
    });

    it("should ignore a command it does not know", async () => {
      await send(<QueryCommand>(<unknown>"nonsense"));

      sinon.assert.notCalled(runDataSource);
      sinon.assert.notCalled(populateScratchpad);
      sinon.assert.notCalled(applyEdit);
    });

    it("should update the webview when its own document changes", async () => {
      const changes = sinon.stub(vscode.workspace, "onDidChangeTextDocument");
      const document = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify({ version: 1 }),
      });
      const fresh = createPanel();
      await new QueryEditorProvider(context).resolveCustomTextEditor(
        document,
        fresh.panel,
      );
      const listener = changes.firstCall.args[0];
      await settled();
      fresh.listeners.postMessage = undefined;

      await listener(<any>{ document });
      await settled();

      assert.strictEqual(
        (<any>fresh.listeners.postMessage).command,
        QueryCommand.Update,
      );
    });

    it("should update the webview when the panel becomes active", async () => {
      (<any>panel.panel).active = true;
      await settled();
      panel.listeners.postMessage = undefined;

      panel.listeners.onDidChangeViewState();
      await settled();

      assert.strictEqual(
        (<any>panel.listeners.postMessage).command,
        QueryCommand.Update,
      );
    });

    it("should update the webview when the connection map changes", async () => {
      const configuration = sinon.stub(
        vscode.workspace,
        "onDidChangeConfiguration",
      );
      const document = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify({ version: 1 }),
      });
      const fresh = createPanel();
      await new QueryEditorProvider(context).resolveCustomTextEditor(
        document,
        fresh.panel,
      );
      const listener = configuration.firstCall.args[0];
      await settled();
      fresh.listeners.postMessage = undefined;

      await listener(<any>{ affectsConfiguration: () => true });
      await settled();

      assert.strictEqual(
        (<any>fresh.listeners.postMessage).command,
        QueryCommand.Update,
      );
    });

    it("should ignore a change to another setting", async () => {
      const configuration = sinon.stub(
        vscode.workspace,
        "onDidChangeConfiguration",
      );
      const document = await vscode.workspace.openTextDocument({
        language: "json",
        content: JSON.stringify({ version: 1 }),
      });
      const fresh = createPanel();
      await new QueryEditorProvider(context).resolveCustomTextEditor(
        document,
        fresh.panel,
      );
      const listener = configuration.firstCall.args[0];
      await settled();
      fresh.listeners.postMessage = undefined;

      await listener(<any>{ affectsConfiguration: () => false });
      await settled();

      assert.strictEqual(fresh.listeners.postMessage, undefined);
    });
  });
});
