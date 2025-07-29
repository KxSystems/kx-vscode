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

import assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { TreeItemCollapsibleState } from "vscode";

import { ext } from "../../../src/extensionVariables";
import { NewConnectionPannel } from "../../../src/panels/newConnection";
import { InsightsNode, KdbNode } from "../../../src/services/kdbTreeProvider";
import * as connLabel from "../../../src/utils/connLabel";
import * as loggers from "../../../src/utils/loggers";

describe("kdbNewConnectionPanel", () => {
  let createWebviewPanelStub: sinon.SinonStub;
  let mockWebviewPanel: any;
  let mockWebview: any;
  let disposeStub: sinon.SinonStub;
  let onDidDisposeStub: sinon.SinonStub;
  let postMessageStub: sinon.SinonStub;
  let onDidReceiveMessageStub: sinon.SinonStub;
  let clearWorkspaceLabelsStub: sinon.SinonStub;
  let _retrieveConnLabelsNamesStub: sinon.SinonStub;
  let _kdbOutputLogStub: sinon.SinonStub;

  const uriTest: vscode.Uri = vscode.Uri.parse("test");
  const insightsNode = new InsightsNode(
    [],
    "insightsnode1",
    {
      server: "insightsservername",
      alias: "insightsserveralias",
      auth: true,
    },
    TreeItemCollapsibleState.None,
  );
  const kdbNode = new KdbNode(
    [],
    "kdbnode1",
    {
      serverName: "kdbservername",
      serverPort: "kdbserverport",
      auth: true,
      serverAlias: "kdbserveralias",
      managed: false,
      tls: true,
    },
    TreeItemCollapsibleState.None,
  );
  const localNode = new KdbNode(
    [],
    "local",
    {
      serverName: "kdbservername",
      serverPort: "kdbserverport",
      auth: false,
      serverAlias: "local",
      managed: true,
      tls: false,
    },
    TreeItemCollapsibleState.None,
  );

  beforeEach(() => {
    // Create dispose stub that simulates the real behavior
    disposeStub = sinon.stub().callsFake(() => {
      // Simulate the real dispose behavior: set currentPanel to undefined
      (NewConnectionPannel as any).currentPanel = undefined;
    });

    onDidDisposeStub = sinon.stub().returns({ dispose: sinon.stub() });
    postMessageStub = sinon.stub();
    onDidReceiveMessageStub = sinon.stub();

    // Mock webview
    mockWebview = {
      html: "",
      asWebviewUri: sinon.stub().returns(vscode.Uri.parse("file://test")),
      onDidReceiveMessage: onDidReceiveMessageStub,
      postMessage: postMessageStub,
      cspSource: "test-csp-source",
    };

    // Mock webview panel with dispose behavior that clears currentPanel
    mockWebviewPanel = {
      webview: mockWebview,
      title: "",
      dispose: disposeStub,
      onDidDispose: onDidDisposeStub,
      onDidChangeViewState: sinon.stub(),
      visible: true,
      active: true,
      viewColumn: vscode.ViewColumn.One,
    };

    // Stub createWebviewPanel
    createWebviewPanelStub = sinon
      .stub(vscode.window, "createWebviewPanel")
      .returns(mockWebviewPanel);

    // Setup ext mock
    Object.assign(ext, {
      connLabelList: [],
      labelColors: [],
      isBundleQCreated: false,
    });

    // Stub utility functions
    clearWorkspaceLabelsStub = sinon.stub(connLabel, "clearWorkspaceLabels");
    _retrieveConnLabelsNamesStub = sinon
      .stub(connLabel, "retrieveConnLabelsNames")
      .returns([]);
    _kdbOutputLogStub = sinon.stub(loggers, "kdbOutputLog");
  });

  afterEach(() => {
    // Clear currentPanel first to avoid disposal loops
    if (NewConnectionPannel.currentPanel) {
      (NewConnectionPannel as any).currentPanel = undefined;
    }
    sinon.restore();
  });

  it("should create a new panel", () => {
    NewConnectionPannel.render(uriTest);

    assert.ok(
      createWebviewPanelStub.calledOnce,
      "createWebviewPanel should be called once",
    );
    assert.ok(
      clearWorkspaceLabelsStub.calledOnce,
      "clearWorkspaceLabels should be called",
    );
    assert.ok(
      postMessageStub.calledWith({
        command: "refreshLabels",
        data: ext.connLabelList,
        colors: ext.labelColors,
      }),
      "postMessage should be called with refreshLabels",
    );
    assert.ok(
      NewConnectionPannel.currentPanel,
      "NewConnectionPannel.currentPanel should be truthy",
    );
  });

  it("should close the panel if open", () => {
    NewConnectionPannel.render(uriTest);
    assert.ok(
      NewConnectionPannel.currentPanel,
      "First panel should be created",
    );

    // Reset call count for dispose stub
    disposeStub.resetHistory();

    // Call render again - should dispose first panel
    NewConnectionPannel.render(uriTest);

    // Verify first panel's dispose was called
    assert.ok(disposeStub.calledOnce, "First panel dispose should be called");

    // After dispose is called, currentPanel should be undefined
    assert.strictEqual(
      NewConnectionPannel.currentPanel,
      undefined,
      "CurrentPanel should be undefined after second render",
    );
  });

  it("should close", () => {
    NewConnectionPannel.render(uriTest);
    assert.ok(NewConnectionPannel.currentPanel, "Panel should be created");

    NewConnectionPannel.close();

    assert.ok(disposeStub.calledOnce, "Panel dispose should be called");
    assert.strictEqual(
      NewConnectionPannel.currentPanel,
      undefined,
      "NewConnectionPannel.currentPanel should be undefined",
    );
  });

  it("should make sure the Create New Connection panel is rendered, check if the web component exists", () => {
    NewConnectionPannel.render(uriTest);
    const expectedHtml = `<kdb-new-connection-view/>`;
    const actualHtml = mockWebview.html;
    assert.ok(
      actualHtml.indexOf(expectedHtml) !== -1,
      "Panel HTML should include expected web component",
    );
  });

  it("should render panel with edit connection data for insights", () => {
    NewConnectionPannel.render(uriTest, insightsNode);
    const expectedHtml = `<kdb-new-connection-view/>`;
    const actualHtml = mockWebview.html;

    // Verify editConnection message was posted
    assert.ok(
      postMessageStub.calledWith(
        sinon.match({
          command: "editConnection",
        }),
      ),
      "editConnection message should be posted",
    );

    assert.ok(
      actualHtml.indexOf(expectedHtml) !== -1,
      "Panel HTML should include expected web component",
    );
  });

  it("should render panel with edit connection data for kdb", () => {
    NewConnectionPannel.render(uriTest, kdbNode);
    const expectedHtml = `<kdb-new-connection-view/>`;
    const actualHtml = mockWebview.html;

    // Verify editConnection message was posted
    assert.ok(
      postMessageStub.calledWith(
        sinon.match({
          command: "editConnection",
        }),
      ),
      "editConnection message should be posted",
    );

    assert.ok(
      actualHtml.indexOf(expectedHtml) !== -1,
      "Panel HTML should include expected web component",
    );
  });

  it("should render panel with edit connection data for local", () => {
    NewConnectionPannel.render(uriTest, localNode);
    const expectedHtml = `<kdb-new-connection-view/>`;
    const actualHtml = mockWebview.html;

    // Verify editConnection message was posted
    assert.ok(
      postMessageStub.calledWith(
        sinon.match({
          command: "editConnection",
        }),
      ),
      "editConnection message should be posted",
    );

    assert.ok(
      actualHtml.indexOf(expectedHtml) !== -1,
      "Panel HTML should include expected web component",
    );
  });

  it("should refreshLabels", () => {
    NewConnectionPannel.render(uriTest);
    postMessageStub.resetHistory(); // Clear previous calls

    NewConnectionPannel.refreshLabels();

    assert.ok(
      postMessageStub.calledWith({
        command: "refreshLabels",
        data: ext.connLabelList,
        colors: ext.labelColors,
      }),
      "refreshLabels message should be posted",
    );

    assert.ok(
      NewConnectionPannel.currentPanel,
      "NewConnectionPannel.currentPanel should be truthy",
    );
  });

  it("should handle panel disposal correctly", () => {
    NewConnectionPannel.render(uriTest);
    const panel = NewConnectionPannel.currentPanel;

    assert.ok(panel, "Panel should be created");
    assert.ok(onDidDisposeStub.calledOnce, "onDidDispose should be registered");

    // Test that the dispose method exists and is callable
    assert.ok(
      typeof panel.dispose === "function",
      "dispose method should exist",
    );

    // Call the actual dispose method to test behavior
    panel.dispose();

    assert.strictEqual(
      NewConnectionPannel.currentPanel,
      undefined,
      "Panel should be undefined after disposal",
    );
  });

  it("should not refresh labels when no current panel", () => {
    // Don't create a panel
    NewConnectionPannel.refreshLabels();

    // postMessage should not be called since there's no panel
    assert.ok(
      postMessageStub.notCalled,
      "postMessage should not be called when no panel exists",
    );
  });

  it("should handle webview message reception", () => {
    NewConnectionPannel.render(uriTest);

    // Verify onDidReceiveMessage was registered
    assert.ok(
      onDidReceiveMessageStub.calledOnce,
      "onDidReceiveMessage should be registered",
    );

    // Get the message handler
    const messageHandler = onDidReceiveMessageStub.getCall(0).args[0];
    assert.ok(
      typeof messageHandler === "function",
      "Message handler should be a function",
    );
  });

  it("should handle close when no panel exists", () => {
    // Try to close without creating a panel
    NewConnectionPannel.close();

    // Should not crash or throw
    assert.ok(
      disposeStub.notCalled,
      "dispose should not be called when no panel exists",
    );
  });

  it("should register onDidDispose handler", () => {
    NewConnectionPannel.render(uriTest);

    // Verify onDidDispose was called to register the handler
    assert.ok(
      onDidDisposeStub.calledOnce,
      "onDidDispose should be called to register disposal handler",
    );

    // Verify it was called with a function
    const disposeHandler = onDidDisposeStub.getCall(0).args[0];
    assert.ok(
      typeof disposeHandler === "function",
      "Dispose handler should be a function",
    );
  });

  it("should handle webview panel title correctly", () => {
    // Test new connection title
    NewConnectionPannel.render(uriTest);
    assert.ok(
      createWebviewPanelStub.calledWith(
        "kdbNewConnection",
        "New Connection",
        vscode.ViewColumn.One,
        sinon.match.any,
      ),
      "Should create panel with 'New Connection' title",
    );

    // Clear and test edit connection title
    (NewConnectionPannel as any).currentPanel = undefined;
    createWebviewPanelStub.resetHistory();

    NewConnectionPannel.render(uriTest, kdbNode);
    assert.ok(
      createWebviewPanelStub.calledWith(
        "kdbNewConnection",
        "Edit Connection",
        vscode.ViewColumn.One,
        sinon.match.any,
      ),
      "Should create panel with 'Edit Connection' title when editing",
    );
  });
});
