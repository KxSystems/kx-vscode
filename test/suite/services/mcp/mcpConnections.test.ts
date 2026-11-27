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

import { fakeContext } from "./fakeContext";
import { kdbNode, LOCAL_NODE_LABEL } from "./mcpTestHelpers";
import { LocalConnection } from "../../../../src/classes/localConnection";
import { ext } from "../../../../src/extensionVariables";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import { InsightsNode } from "../../../../src/services/kdbTreeProvider";
import * as mcpAccess from "../../../../src/services/mcp/mcpAccess";
import * as mcpServer from "../../../../src/services/mcp/mcpServer";
import * as core from "../../../../src/utils/core";
import * as notifications from "../../../../src/utils/notifications";

const OTHER_NODE_LABEL = "other[127.0.0.1:5001]";
const service = new ConnectionManagementService();

describe("MCP and connection management", () => {
  beforeEach(() => {
    ext.context = fakeContext();
    ext.connectedConnectionList.length = 0;
    ext.connectedContextStrings.length = 0;
    ext.serverProvider = { reload: sinon.stub(), refresh: sinon.stub() } as any;
    sinon.stub(notifications, "notify").resolves(undefined);
    // No saved servers, so removeConnection skips the settings update
    sinon.stub(core, "getServers").returns({} as any);
  });

  afterEach(() => {
    ext.connectedConnectionList.length = 0;
    sinon.restore();
  });

  it("removeConnection clears the MCP access of the deleted connection", async () => {
    await mcpAccess.setMcpAccess(LOCAL_NODE_LABEL, true);

    await service.removeConnection(kdbNode("local-q"));

    assert.strictEqual(mcpAccess.isMcpAllowed(LOCAL_NODE_LABEL), false);
  });

  it("removeConnection leaves other connections' access alone", async () => {
    await mcpAccess.setMcpAccess(OTHER_NODE_LABEL, true);

    await service.removeConnection(kdbNode("local-q"));

    assert.strictEqual(mcpAccess.isMcpAllowed(OTHER_NODE_LABEL), true);
  });

  it("connecting a KdbNode starts the MCP server", () => {
    const start = sinon.stub(mcpServer, "startMcpServerIfNeeded").resolves();
    sinon.stub(service, "setActiveConnection");
    sinon.stub(vscode.commands, "executeCommand");

    service.connectSuccessBehaviour(kdbNode("local-q"));

    assert.ok(start.calledOnce);
  });

  it("connecting an Insights node does not start the MCP server", () => {
    const start = sinon.stub(mcpServer, "startMcpServerIfNeeded").resolves();
    sinon.stub(service, "setActiveConnection");
    sinon.stub(vscode.commands, "executeCommand");
    const insights = new InsightsNode(
      ["child"],
      "insights-label",
      { alias: "insights-label", server: "host", auth: false },
      vscode.TreeItemCollapsibleState.None,
    );

    service.connectSuccessBehaviour(insights);

    assert.ok(start.notCalled);
  });

  it("disconnecting asks the MCP server whether it is still needed", () => {
    const stop = sinon.stub(mcpServer, "stopMcpServerIfUnused").resolves();
    const connection = new LocalConnection("localhost:5001", "server1", []);
    ext.connectedConnectionList.push(connection);

    service.disconnectBehaviour(connection);

    assert.ok(stop.calledOnce);
  });
});
