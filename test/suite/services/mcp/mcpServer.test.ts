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
import {
  connectedLocal,
  freePort,
  httpRequest,
  serveHttp,
  TOKEN_KEY,
  waitUntil,
} from "./mcpTestHelpers";
import { ext } from "../../../../src/extensionVariables";
import * as mcpAccess from "../../../../src/services/mcp/mcpAccess";
import * as mcpPorts from "../../../../src/services/mcp/mcpPorts";
import * as mcpServer from "../../../../src/services/mcp/mcpServer";
import * as qTimeout from "../../../../src/services/mcp/qTimeout";
import * as notifications from "../../../../src/utils/notifications";

const { kdbMcpServer } = mcpServer;
const WORKSPACE = "file:///home/me/sales.code-workspace";
const disposable = { dispose: () => undefined };

describe("kdb MCP server", () => {
  let port: number;
  let reload: sinon.SinonStub;
  let notify: sinon.SinonStub;
  let choose: sinon.SinonStub;
  let checkTimeouts: sinon.SinonStub;

  // Whether a notification with this text was shown
  function said(pattern: RegExp): boolean {
    return notify.args.some(([message]) => pattern.test(String(message)));
  }

  beforeEach(async () => {
    // The server reads the extension's version when it answers /mcp
    ext.context = Object.assign(fakeContext(), {
      extension: { packageJSON: { version: "0.0.0-test" } },
    }) as any;
    ext.connectedConnectionList.length = 0;
    reload = sinon.stub();
    ext.serverProvider = { reload } as any;
    notify = sinon.stub(notifications, "notify").resolves(undefined);
    checkTimeouts = sinon.stub(qTimeout, "checkProcessTimeouts").resolves();
    port = await freePort();
    choose = sinon
      .stub(mcpPorts, "choosePort")
      .returns({ port, source: "default" });
    // start(true) rather than start(): the server remembers a Don't start
    // choice across tests, and only an explicit retry clears it
    assert.strictEqual(
      await kdbMcpServer.start(true),
      true,
      "the server did not start; check that the test workspace is trusted",
    );
  });

  afterEach(async () => {
    await kdbMcpServer.stop();
    ext.connectedConnectionList.length = 0;
    sinon.restore();
  });

  describe("requests", () => {
    it("answers /health without a token and leaks no folder path", async () => {
      const reply = await httpRequest(port, "GET", "/health");
      const body = JSON.parse(reply.body);

      assert.strictEqual(reply.status, 200);
      assert.strictEqual(body.server, "kdb-mcp");
      assert.ok(!reply.body.includes("file:"));
    });

    it("refuses /mcp without a token", async () => {
      const reply = await httpRequest(port, "GET", "/mcp");

      assert.strictEqual(reply.status, 401);
      assert.strictEqual(reply.headers["www-authenticate"], "Bearer");
    });

    it("refuses /mcp with a wrong token", async () => {
      const reply = await httpRequest(port, "GET", "/mcp", {
        Authorization: "Bearer not-the-token",
      });

      assert.strictEqual(reply.status, 401);
    });

    it("accepts the token on /mcp, and still rejects GET there", async () => {
      const token = await kdbMcpServer.getToken();

      const reply = await httpRequest(port, "GET", "/mcp", {
        Authorization: `Bearer ${token}`,
      });

      assert.strictEqual(reply.status, 405);
    });

    it("refuses a Host header for another name (DNS rebinding)", async () => {
      const reply = await httpRequest(port, "GET", "/health", {
        Host: `evil.example:${port}`,
      });

      assert.strictEqual(reply.status, 403);
    });

    it("refuses a browser origin that is not local", async () => {
      const reply = await httpRequest(port, "GET", "/health", {
        Origin: "https://evil.example",
      });

      assert.strictEqual(reply.status, 403);
    });

    it("returns 404 for unknown paths with a token", async () => {
      const token = await kdbMcpServer.getToken();

      const reply = await httpRequest(port, "GET", "/nothing", {
        Authorization: `Bearer ${token}`,
      });

      assert.strictEqual(reply.status, 404);
    });

    it("refuses POST to /health and says which method it allows", async () => {
      const reply = await httpRequest(port, "POST", "/health");

      assert.strictEqual(reply.status, 405);
      assert.strictEqual(reply.headers.allow, "GET");
    });

    it("answers the MCP initialize request on POST /mcp", async () => {
      const token = await kdbMcpServer.getToken();
      const initialize = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        },
      });

      const reply = await httpRequest(
        port,
        "POST",
        "/mcp",
        {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        initialize,
      );

      assert.strictEqual(reply.status, 200);
      assert.match(reply.body, /"serverInfo"/);
      assert.match(reply.body, /"name":"kdb"/);
    });

    it("refuses POST /mcp while kdb.mcp.enabled is off", async () => {
      const token = await kdbMcpServer.getToken();
      sinon.stub(mcpAccess, "isMcpEnabled").returns(false);

      const reply = await httpRequest(port, "POST", "/mcp", {
        Authorization: `Bearer ${token}`,
      });

      assert.strictEqual(reply.status, 503);
    });
  });

  describe("token and definition", () => {
    it("offers the URL and bearer token once a token exists", async () => {
      const token = await kdbMcpServer.getToken();

      const definition = kdbMcpServer.definition();

      assert.ok(definition, "expected a definition while running");
      assert.strictEqual(
        definition.uri.toString(),
        `http://127.0.0.1:${port}/mcp`,
      );
      assert.strictEqual(definition.headers.Authorization, `Bearer ${token}`);
    });

    it("stores a new token and tells listeners when it is regenerated", async () => {
      const before = await kdbMcpServer.getToken();
      const listener = sinon.spy();
      const subscription = kdbMcpServer.onDidChange(listener);

      await kdbMcpServer.regenerateToken();
      const after = await kdbMcpServer.getToken();
      subscription.dispose();

      assert.notStrictEqual(after, before);
      assert.strictEqual(await ext.context.secrets.get(TOKEN_KEY), after);
      assert.ok(listener.calledOnce);
    });

    it("picks up a token another window stored", async () => {
      await kdbMcpServer.getToken();
      await ext.context.secrets.store(TOKEN_KEY, "from-another-window");

      await kdbMcpServer.reloadToken();

      assert.strictEqual(await kdbMcpServer.getToken(), "from-another-window");
    });
  });

  describe("start and stop", () => {
    it("stops listening on stop(), then starts again on the same port", async () => {
      const token = await kdbMcpServer.getToken();

      await kdbMcpServer.stop();
      assert.strictEqual(kdbMcpServer.running, false);
      assert.strictEqual(kdbMcpServer.currentPort, undefined);
      await assert.rejects(httpRequest(port, "GET", "/health"));

      assert.strictEqual(await kdbMcpServer.start(), true);
      assert.strictEqual(kdbMcpServer.currentPort, port);
      assert.strictEqual(
        (
          await httpRequest(port, "GET", "/mcp", {
            Authorization: `Bearer ${token}`,
          })
        ).status,
        405,
      );
    });

    it("keeps the running server when start() is called again", async () => {
      assert.strictEqual(await kdbMcpServer.start(), true);

      assert.strictEqual(kdbMcpServer.currentPort, port);
    });

    it("names the workspace after its .code-workspace file", () => {
      sinon.stub(mcpPorts, "workspaceKey").returns(WORKSPACE);

      assert.strictEqual(mcpServer.workspaceName(), "sales");
    });

    it("says no folder when none is open", () => {
      sinon.stub(mcpPorts, "workspaceKey").returns(undefined);

      assert.strictEqual(mcpServer.workspaceName(), "no folder");
    });
  });

  describe("starting when the port is taken", () => {
    beforeEach(async () => {
      await kdbMcpServer.stop();
      sinon.stub(mcpPorts, "workspaceKey").returns(WORKSPACE);
    });

    it("stays off when another window for this workspace holds the port", async () => {
      const health = {
        server: "kdb-mcp",
        workspace: "sales",
        keyHash: mcpPorts.keyHash(WORKSPACE),
        pid: 1,
      };
      const other = await serveHttp((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(health));
      }, port);

      try {
        assert.strictEqual(await kdbMcpServer.start(true), false);

        assert.strictEqual(kdbMcpServer.running, false);
        assert.ok(said(/already used by another VS Code window/));
      } finally {
        await other.close();
      }
    });

    it("uses the port the user picks when another program holds this one", async () => {
      const other = await serveHttp(
        (_req, res) => res.writeHead(404).end(),
        port,
      );
      const next = await freePort();
      const ask = sinon.stub(mcpPorts, "askForAnotherPort").resolves(next);

      try {
        assert.strictEqual(await kdbMcpServer.start(true), true);

        assert.strictEqual(kdbMcpServer.currentPort, next);
        assert.ok(ask.calledOnce);
        assert.ok(said(/is used by another program/));
      } finally {
        await other.close();
      }
    });

    it("stays off when the user picks Don't start", async () => {
      const other = await serveHttp(
        (_req, res) => res.writeHead(404).end(),
        port,
      );
      sinon.stub(mcpPorts, "askForAnotherPort").resolves(undefined);

      try {
        assert.strictEqual(await kdbMcpServer.start(true), false);

        assert.strictEqual(kdbMcpServer.running, false);
      } finally {
        await other.close();
      }
    });

    it("does not move a port set in the workspace settings", async () => {
      choose.returns({ port, source: "setting" });
      const other = await serveHttp(
        (_req, res) => res.writeHead(404).end(),
        port,
      );
      const ask = sinon.stub(mcpPorts, "askForAnotherPort");

      try {
        assert.strictEqual(await kdbMcpServer.start(true), false);

        assert.ok(ask.notCalled);
        assert.ok(said(/sets kdb\.mcp\.port/));
      } finally {
        await other.close();
      }
    });

    it("says so when a saved port has to move", async () => {
      choose.returns({ port, source: "saved" });
      const other = await serveHttp(
        (_req, res) => res.writeHead(404).end(),
        port,
      );
      const next = await freePort();
      sinon.stub(mcpPorts, "askForAnotherPort").resolves(next);

      try {
        assert.strictEqual(await kdbMcpServer.start(true), true);

        assert.ok(said(new RegExp(`moved from port ${port} to ${next}`)));
      } finally {
        await other.close();
      }
    });

    it("says the server is running once per window, with the agent config", async () => {
      await kdbMcpServer.stop();
      (kdbMcpServer as unknown as { toldRunning: boolean }).toldRunning = false;

      assert.strictEqual(await kdbMcpServer.start(true), true);

      assert.ok(said(new RegExp(`is running on port ${port}\\.`)));
    });
  });

  describe("startMcpServerIfNeeded", () => {
    it("does nothing while no connection is allowed, even if one is connected", async () => {
      await kdbMcpServer.stop();
      ext.connectedConnectionList.push(connectedLocal("local-q"));

      await mcpServer.startMcpServerIfNeeded();

      assert.strictEqual(kdbMcpServer.running, false);
    });

    it("starts the server for an allowed connection that isn't connected, with no timeout check", async () => {
      await kdbMcpServer.stop();
      await mcpAccess.setMcpAccess("other", true);
      ext.connectedConnectionList.push(connectedLocal("local-q"));

      await mcpServer.startMcpServerIfNeeded();

      assert.strictEqual(kdbMcpServer.running, true);
      assert.ok(checkTimeouts.notCalled);
    });

    it("starts the server for an allowed, connected connection and checks q's timeouts", async () => {
      await kdbMcpServer.stop();
      await mcpAccess.setMcpAccess("local-q", true);
      const connection = connectedLocal("local-q");
      ext.connectedConnectionList.push(connection);
      await mcpServer.startMcpServerIfNeeded();

      assert.strictEqual(kdbMcpServer.running, true);
      assert.ok(checkTimeouts.calledOnceWithExactly([connection]));
    });
  });

  describe("stopMcpServerIfUnused", () => {
    it("keeps the server while a connection is allowed, even if none is connected", async () => {
      await mcpAccess.setMcpAccess("local-q", true);

      await mcpServer.stopMcpServerIfUnused();

      assert.strictEqual(kdbMcpServer.running, true);
    });

    it("stops the server when no connection is allowed", async () => {
      await mcpServer.stopMcpServerIfUnused();

      assert.strictEqual(kdbMcpServer.running, false);
    });
  });

  describe("registerMcpServer", () => {
    let provider: any;
    let configListener: (event: vscode.ConfigurationChangeEvent) => void;
    let focusListener: (state: vscode.WindowState) => void;
    let trustListener: () => void;

    beforeEach(() => {
      sinon
        .stub(vscode.lm, "registerMcpServerDefinitionProvider")
        .callsFake((_id, registered) => {
          provider = registered;
          return disposable;
        });
      sinon
        .stub(vscode.workspace, "onDidChangeConfiguration")
        .callsFake((listener: any) => {
          configListener = listener;
          return disposable;
        });
      sinon
        .stub(vscode.window, "onDidChangeWindowState")
        .callsFake((listener: any) => {
          focusListener = listener;
          return disposable;
        });
      sinon
        .stub(vscode.workspace, "onDidGrantWorkspaceTrust")
        .callsFake((listener: any) => {
          trustListener = listener;
          return disposable;
        });
      const context = Object.assign(fakeContext(), { subscriptions: [] });
      mcpServer.registerMcpServer(
        context as unknown as vscode.ExtensionContext,
      );
    });

    // The config event for one setting, as VS Code sends it
    function changed(setting: string): vscode.ConfigurationChangeEvent {
      return {
        affectsConfiguration: (key: string) => key === setting,
      } as vscode.ConfigurationChangeEvent;
    }

    it("offers Copilot the definition while the server runs", async () => {
      await kdbMcpServer.getToken();

      assert.strictEqual(provider.provideMcpServerDefinitions().length, 1);
    });

    it("offers Copilot nothing while the server is stopped", async () => {
      await kdbMcpServer.stop();

      assert.strictEqual(provider.provideMcpServerDefinitions().length, 0);
    });

    it("stops the server when kdb.mcp.enabled is turned off", async () => {
      sinon.stub(mcpAccess, "isMcpEnabled").returns(false);

      configListener(changed("kdb.mcp.enabled"));

      await waitUntil(() => !kdbMcpServer.running);
      assert.ok(reload.calledOnce);
    });

    it("starts the server when kdb.mcp.enabled is turned on with an allowed connection", async () => {
      await kdbMcpServer.stop();
      sinon.stub(mcpAccess, "isMcpEnabled").returns(true);
      await mcpAccess.setMcpAccess("local-q", true);

      configListener(changed("kdb.mcp.enabled"));

      await waitUntil(() => kdbMcpServer.running);
    });

    it("restarts the server when kdb.mcp.port changes", async () => {
      const restart = sinon.spy(kdbMcpServer, "restart");

      configListener(changed("kdb.mcp.port"));

      await waitUntil(() => restart.calledOnce && kdbMcpServer.running);
    });

    it("starts the server when the workspace is trusted", async () => {
      await kdbMcpServer.stop();
      await mcpAccess.setMcpAccess("local-q", true);

      trustListener();

      await waitUntil(() => kdbMcpServer.running);
    });

    it("refreshes the menus and stops an unused server when the window gains focus", async () => {
      focusListener({ focused: true } as vscode.WindowState);

      await waitUntil(() => !kdbMcpServer.running);
      assert.ok(reload.calledOnce);
    });

    it("starts the server when the window gains focus after another window allowed a connection", async () => {
      await kdbMcpServer.stop();
      await mcpAccess.setMcpAccess("local-q", true);

      focusListener({ focused: true } as vscode.WindowState);

      await waitUntil(() => kdbMcpServer.running);
    });

    it("starts the server on registration when a connection is allowed", async () => {
      await kdbMcpServer.stop();
      await mcpAccess.setMcpAccess("local-q", true);
      const context = Object.assign(fakeContext(), { subscriptions: [] });

      mcpServer.registerMcpServer(
        context as unknown as vscode.ExtensionContext,
      );

      await waitUntil(() => kdbMcpServer.running);
    });

    it("does nothing when the window loses focus", () => {
      focusListener({ focused: false } as vscode.WindowState);

      assert.ok(reload.notCalled);
      assert.strictEqual(kdbMcpServer.running, true);
    });
  });
});
