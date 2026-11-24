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

import {
  allowMcpAccess,
  generateMcpConfig,
} from "../../../src/commands/mcpCommand";
import { ext } from "../../../src/extensionVariables";
import { KdbNode } from "../../../src/services/kdbTreeProvider";
import {
  EXPLAINED_KEY,
  isMcpAllowed,
} from "../../../src/services/mcp/mcpAccess";
import { kdbMcpServer } from "../../../src/services/mcp/mcpServer";
import * as notifications from "../../../src/utils/notifications";
import { fakeContext } from "../services/mcp/fakeContext";

function kdbNode(label: string): KdbNode {
  return new KdbNode(
    [],
    label,
    {
      serverAlias: "",
      serverName: "127.0.0.1",
      serverPort: "5001",
      tls: false,
      auth: false,
    },
    vscode.TreeItemCollapsibleState.None,
  );
}

describe("MCP commands", () => {
  beforeEach(() => {
    ext.context = fakeContext();
    ext.connectionsList.length = 0;
    ext.connectedConnectionList.length = 0;
    ext.serverProvider = { reload: sinon.stub() } as any;
    sinon.stub(notifications, "notify").resolves(undefined);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("consent dialog", () => {
    beforeEach(function () {
      // Access is only offered in trusted workspaces
      if (!vscode.workspace.isTrusted) {
        this.skip();
      }
    });

    it("asks the first time, with the credentials warning, and allows on accept", async () => {
      const node = kdbNode("local-q");
      const dialog = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves("Allow" as any);

      await allowMcpAccess(node);

      assert.ok(dialog.calledOnce);
      const [message, options] = dialog.firstCall.args as unknown as [
        string,
        vscode.MessageOptions,
      ];
      assert.match(message, /Allow AI agents to query/);
      assert.strictEqual(options.modal, true);
      assert.match(
        options.detail ?? "",
        /Don't type passwords or other credentials/,
      );
      assert.strictEqual(isMcpAllowed(node.label), true);
      assert.strictEqual(ext.context.globalState.get(EXPLAINED_KEY), true);
    });

    it("leaves access off when it is declined", async () => {
      const node = kdbNode("local-q");
      sinon.stub(vscode.window, "showInformationMessage").resolves(undefined);

      await allowMcpAccess(node);

      assert.strictEqual(isMcpAllowed(node.label), false);
      assert.strictEqual(ext.context.globalState.get(EXPLAINED_KEY), undefined);
    });

    it("doesn't ask again once it has been accepted", async () => {
      await ext.context.globalState.update(EXPLAINED_KEY, true);
      const node = kdbNode("local-q");
      const dialog = sinon.stub(vscode.window, "showInformationMessage");

      await allowMcpAccess(node);

      assert.ok(dialog.notCalled);
      assert.strictEqual(isMcpAllowed(node.label), true);
    });
  });

  describe("generateMcpConfig", () => {
    it("sets tool_timeout_sec in the Codex config", async () => {
      sinon.stub(kdbMcpServer, "running").get(() => true);
      sinon.stub(kdbMcpServer, "currentPort").get(() => 7464);
      sinon.stub(kdbMcpServer, "getToken").resolves("token");
      // Codex, then the first token choice
      sinon
        .stub(vscode.window, "showQuickPick")
        .callsFake(async (items: any) => {
          const list = await items;
          return list.find((item: any) => item.label === "Codex") ?? list[0];
        });
      // The clipboard can't be stubbed, so the test reads what was copied
      await vscode.env.clipboard.writeText("");

      await generateMcpConfig();

      const toml = await vscode.env.clipboard.readText();
      assert.match(toml, /^\[mcp_servers\.kdb-/);
      assert.match(toml, /^tool_timeout_sec = 72$/m);
    });
  });
});
