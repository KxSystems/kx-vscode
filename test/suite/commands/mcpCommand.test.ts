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
  mcpServerName,
  regenerateMcpToken,
  removeAllMcpAccessCommand,
  removeMcpAccess,
  showMcpServers,
} from "../../../src/commands/mcpCommand";
import { ext } from "../../../src/extensionVariables";
import * as mcpAccess from "../../../src/services/mcp/mcpAccess";
import * as mcpPorts from "../../../src/services/mcp/mcpPorts";
import { kdbMcpServer } from "../../../src/services/mcp/mcpServer";
import * as notifications from "../../../src/utils/notifications";
import { fakeContext } from "../services/mcp/fakeContext";
import { kdbNode, LOCAL_NODE_LABEL } from "../services/mcp/mcpTestHelpers";

// Quick pick answers in the order the command asks for them
function answerNext(
  pick: sinon.SinonStub,
  ...answers: Array<(items: any[]) => unknown>
): void {
  answers.forEach((answer, index) => {
    pick.onCall(index).callsFake(async (items: any) => answer(await items));
  });
}

describe("MCP commands", () => {
  let reload: sinon.SinonStub;
  let notify: sinon.SinonStub;

  beforeEach(() => {
    ext.context = fakeContext();
    ext.connectionsList.length = 0;
    ext.connectedConnectionList.length = 0;
    reload = sinon.stub();
    ext.serverProvider = { reload } as any;
    notify = sinon.stub(notifications, "notify").resolves(undefined);
  });

  afterEach(async () => {
    // Allowing access starts the server, even with nothing connected
    await kdbMcpServer.stop();
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
      const dialog = sinon
        .stub(vscode.window, "showInformationMessage")
        .resolves("Allow" as any);

      await allowMcpAccess(kdbNode("local-q"));

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
      assert.strictEqual(mcpAccess.isMcpAllowed(LOCAL_NODE_LABEL), true);
      assert.strictEqual(
        ext.context.globalState.get(mcpAccess.EXPLAINED_KEY),
        true,
      );
    });

    it("leaves access off when it is declined", async () => {
      sinon.stub(vscode.window, "showInformationMessage").resolves(undefined);

      await allowMcpAccess(kdbNode("local-q"));

      assert.strictEqual(mcpAccess.isMcpAllowed(LOCAL_NODE_LABEL), false);
      assert.strictEqual(
        ext.context.globalState.get(mcpAccess.EXPLAINED_KEY),
        undefined,
      );
    });

    it("doesn't ask again once it has been accepted", async () => {
      await ext.context.globalState.update(mcpAccess.EXPLAINED_KEY, true);
      const dialog = sinon.stub(vscode.window, "showInformationMessage");

      await allowMcpAccess(kdbNode("local-q"));

      assert.ok(dialog.notCalled);
      assert.strictEqual(mcpAccess.isMcpAllowed(LOCAL_NODE_LABEL), true);
    });

    it("explains that the setting is off and allows nothing when MCP is off", async () => {
      sinon.stub(mcpAccess, "isMcpEnabled").returns(false);
      const dialog = sinon.stub(vscode.window, "showInformationMessage");

      await allowMcpAccess(kdbNode("local-q"));

      assert.ok(dialog.notCalled);
      assert.strictEqual(mcpAccess.isMcpAllowed(LOCAL_NODE_LABEL), false);
      assert.match(notify.firstCall.args[0], /kdb\.mcp\.enabled/);
    });
  });

  describe("removing access", () => {
    it("removes access from one connection and refreshes the menus", async () => {
      await mcpAccess.setMcpAccess(LOCAL_NODE_LABEL, true);

      await removeMcpAccess(kdbNode("local-q"));

      assert.strictEqual(mcpAccess.isMcpAllowed(LOCAL_NODE_LABEL), false);
      assert.ok(reload.calledOnce);
      assert.ok(notify.calledOnce);
    });

    it("does nothing when not given a connection", async () => {
      await removeMcpAccess(undefined);

      assert.ok(reload.notCalled);
    });

    it("removes access from every connection", async () => {
      await mcpAccess.setMcpAccess("dev", true);
      await mcpAccess.setMcpAccess("prod", true);

      await removeAllMcpAccessCommand();

      assert.deepStrictEqual(mcpAccess.getMcpAllowedLabels(), []);
      assert.ok(reload.calledOnce);
      assert.ok(notify.calledOnce);
    });
  });

  describe("regenerateMcpToken", () => {
    it("replaces the token and says the agent configs need updating", async () => {
      const before = await kdbMcpServer.getToken();

      await regenerateMcpToken();

      assert.notStrictEqual(await kdbMcpServer.getToken(), before);
      assert.match(notify.firstCall.args[0], /was replaced/);
    });
  });

  describe("mcpServerName", () => {
    it("builds a name from the workspace label", () => {
      assert.strictEqual(mcpServerName("Taxi Analysis"), "kdb-taxi-analysis");
    });

    it("drops characters that agents can't use in a server name", () => {
      assert.strictEqual(mcpServerName("  ¡Hola!! Q  "), "kdb-hola-q");
    });

    it("falls back to kdb when nothing is left", () => {
      assert.strictEqual(mcpServerName("!!!"), "kdb");
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

    it("asks the user to allow and connect when the server isn't running", async () => {
      sinon.stub(kdbMcpServer, "running").get(() => false);
      const pick = sinon.stub(vscode.window, "showQuickPick");

      await generateMcpConfig();

      assert.ok(pick.notCalled);
      assert.match(notify.firstCall.args[0], /isn't running/);
    });

    it("says MCP is off when kdb.mcp.enabled is off", async () => {
      sinon.stub(mcpAccess, "isMcpEnabled").returns(false);
      const pick = sinon.stub(vscode.window, "showQuickPick");

      await generateMcpConfig();

      assert.ok(pick.notCalled);
      assert.match(notify.firstCall.args[0], /turned off/);
    });
  });

  describe("showMcpServers", () => {
    it("says so when no workspace has a saved port", async () => {
      sinon.stub(mcpPorts, "getPortClaims").returns({});
      const pick = sinon.stub(vscode.window, "showQuickPick");

      await showMcpServers();

      assert.ok(pick.notCalled);
      assert.match(notify.firstCall.args[0], /No workspace has/);
    });

    it("forgets the saved port of another workspace", async () => {
      const other = "file:///home/me/other.code-workspace";
      sinon
        .stub(mcpPorts, "workspaceKey")
        .returns("file:///home/me/this.code-workspace");
      sinon.stub(mcpPorts, "getPortClaims").returns({ [other]: 7500 });
      const forget = sinon.stub(mcpPorts, "forgetPortClaim").resolves();
      const pick = sinon.stub(vscode.window, "showQuickPick");
      answerNext(
        pick,
        (items) => items[0],
        () => ({ label: "Forget port", action: "forget" }),
      );

      await showMcpServers();

      assert.ok(forget.calledOnceWithExactly(other));
    });

    it("keeps the port this window is using", async () => {
      const here = "file:///home/me/this.code-workspace";
      sinon.stub(mcpPorts, "workspaceKey").returns(here);
      sinon.stub(mcpPorts, "getPortClaims").returns({ [here]: 7500 });
      const forget = sinon.stub(mcpPorts, "forgetPortClaim").resolves();
      const pick = sinon.stub(vscode.window, "showQuickPick");
      answerNext(
        pick,
        (items) => items[0],
        () => ({ label: "Forget port", action: "forget" }),
      );

      await showMcpServers();

      assert.ok(forget.notCalled);
      assert.match(notify.lastCall.args[0], /can't be forgotten here/);
    });

    it("copies a Claude Code config for another workspace's port", async () => {
      sinon
        .stub(mcpPorts, "getPortClaims")
        .returns({ "file:///home/me/other.code-workspace": 7500 });
      sinon.stub(kdbMcpServer, "getToken").resolves("secret-token");
      const pick = sinon.stub(vscode.window, "showQuickPick");
      answerNext(
        pick,
        (items) => items[0],
        () => ({ label: "Generate MCP config", action: "copy" }),
        (items) => items.find((item) => item.agent === "claude"),
        (items) => items[0],
      );

      await showMcpServers();

      const copied = await vscode.env.clipboard.readText();
      assert.ok(copied.includes('"url": "http://127.0.0.1:7500/mcp"'));
      // The default is the environment variable, so the token stays out
      assert.ok(copied.includes("${KDB_MCP_TOKEN}"));
      assert.ok(!copied.includes("secret-token"));
    });
  });
});
