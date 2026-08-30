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
import { ext } from "../../../../src/extensionVariables";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import { InsightsNode } from "../../../../src/services/kdbTreeProvider";
import { QueryEditorProvider } from "../../../../src/services/queryEditorProvider";
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
});
