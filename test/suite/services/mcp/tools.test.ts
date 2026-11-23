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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { fakeContext } from "./fakeContext";
import { LocalConnection } from "../../../../src/classes/localConnection";
import { ext } from "../../../../src/extensionVariables";
import { queryConstants } from "../../../../src/models/queryResult";
import {
  InsightsNode,
  KdbNode,
} from "../../../../src/services/kdbTreeProvider";
import { setMcpAccess } from "../../../../src/services/mcp/mcpAccess";
import { registerTools } from "../../../../src/services/mcp/tools";
import * as loggers from "../../../../src/utils/loggers";
import * as notifications from "../../../../src/utils/notifications";

type ToolResult = {
  content: { type: string; text: string }[];
  isError?: boolean;
};
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

const SERVER_DETAILS = {
  serverAlias: "",
  serverName: "127.0.0.1",
  serverPort: "5001",
  tls: false,
  auth: false,
  managed: false,
};

// KdbNode appends [host:port] to its label, and that label is the name MCP
// clients use, so tests name connections the same way
function nodeName(label: string): string {
  return `${label}[${SERVER_DETAILS.serverName}:${SERVER_DETAILS.serverPort}]`;
}

// Captures the handlers registerTools() gives the server
function captureTools(): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) =>
      handlers.set(name, handler),
  };
  registerTools(server as unknown as McpServer, "test-workspace");
  return handlers;
}

// A local connection that is connected in this window, or not
function addLocal(label: string, connected: boolean): LocalConnection {
  const node = new KdbNode(
    [],
    label,
    SERVER_DETAILS,
    vscode.TreeItemCollapsibleState.None,
  );
  ext.connectionsList.push(node);
  const conn = new LocalConnection("127.0.0.1:5001", node.label, []);
  conn.connected = connected;
  ext.connectedConnectionList.push(conn);
  return conn;
}

function addInsightsNodeNamed(label: string): void {
  ext.connectionsList.push(
    new InsightsNode(
      [],
      label,
      { alias: label, server: "insights", auth: false },
      vscode.TreeItemCollapsibleState.None,
    ),
  );
}

describe("MCP tools", () => {
  let tools: Map<string, Handler>;

  beforeEach(() => {
    ext.context = fakeContext();
    ext.connectionsList.length = 0;
    ext.connectedConnectionList.length = 0;
    tools = captureTools();
  });

  afterEach(() => {
    sinon.restore();
  });

  function runQ(connection: string, code: string): Promise<ToolResult> {
    return tools.get("run_q")!({ connection, code });
  }

  describe("list_connections", () => {
    it("lists only allowed connections that are connected", async () => {
      addLocal("prod", true);
      addLocal("off", true);
      addLocal("sleeping", false);
      await setMcpAccess(nodeName("prod"), true);
      await setMcpAccess(nodeName("sleeping"), true);

      const result = await tools.get("list_connections")!({});
      const body = JSON.parse(result.content[0].text);

      assert.deepStrictEqual(body.connections, [{ name: nodeName("prod") }]);
      assert.strictEqual(body.workspace, "test-workspace");
    });

    it("leaves out a label that an Insights connection shares", async () => {
      addLocal("shared", true);
      addInsightsNodeNamed(nodeName("shared"));
      await setMcpAccess(nodeName("shared"), true);

      const result = await tools.get("list_connections")!({});

      assert.deepStrictEqual(
        JSON.parse(result.content[0].text).connections,
        [],
      );
    });
  });

  describe("run_q refusals", () => {
    it("refuses a connection that does not exist", async () => {
      const result = await runQ("nope", "1+1");

      assert.strictEqual(result.isError, true);
      assert.match(result.content[0].text, /No connection named 'nope'/);
    });

    it("refuses a connection that is not allowed", async () => {
      const conn = addLocal("prod", true);
      const execute = sinon.stub(conn, "executeQuery").resolves("42");

      const result = await runQ(nodeName("prod"), "1+1");

      assert.strictEqual(result.isError, true);
      assert.match(result.content[0].text, /not allowed for MCP/);
      assert.strictEqual(execute.called, false);
    });

    it("refuses an allowed connection that is not connected", async () => {
      addLocal("prod", false);
      await setMcpAccess(nodeName("prod"), true);

      const result = await runQ(nodeName("prod"), "1+1");

      assert.match(result.content[0].text, /allowed but not connected/);
    });

    it("refuses a label that an Insights connection shares", async () => {
      const conn = addLocal("prod", true);
      addInsightsNodeNamed(nodeName("prod"));
      await setMcpAccess(nodeName("prod"), true);
      const execute = sinon.stub(conn, "executeQuery").resolves("42");

      const result = await runQ(nodeName("prod"), "1+1");

      assert.match(
        result.content[0].text,
        /Insights connections aren't supported/,
      );
      assert.strictEqual(execute.called, false);
    });
  });

  describe("run_q", () => {
    it("runs the query without a trailing semicolon", async () => {
      const conn = addLocal("prod", true);
      await setMcpAccess(nodeName("prod"), true);
      const execute = sinon.stub(conn, "executeQuery").resolves("42");

      const result = await runQ(nodeName("prod"), "1+1;");

      assert.strictEqual(execute.firstCall.args[0], "1+1");
      assert.strictEqual(result.isError, false);
      assert.strictEqual(result.content[0].text, "42");
    });

    it("reports a q error as an error result", async () => {
      const conn = addLocal("prod", true);
      await setMcpAccess(nodeName("prod"), true);
      sinon.stub(conn, "executeQuery").resolves(`${queryConstants.error}type`);

      const result = await runQ(nodeName("prod"), "bad");

      assert.strictEqual(result.isError, true);
      assert.strictEqual(result.content[0].text, `${queryConstants.error}type`);
    });

    it("cuts output at the configured limit and says so", async () => {
      const conn = addLocal("prod", true);
      await setMcpAccess(nodeName("prod"), true);
      sinon.stub(conn, "executeQuery").resolves("x".repeat(25000));

      const result = await runQ(nodeName("prod"), "til 25000");
      const text = result.content[0].text;

      assert.ok(text.startsWith("x".repeat(20000)));
      assert.ok(text.includes("Output cut short: the first 20000 of 25000"));
    });

    it("reports a query that runs past the timeout", async () => {
      const conn = addLocal("prod", true);
      await setMcpAccess(nodeName("prod"), true);
      sinon.stub(conn, "executeQuery").returns(new Promise(() => undefined));
      // Keeps the popup out of the test window and records what it offers
      const offered = sinon.stub(notifications, "notify").resolves(undefined);
      const clock = sinon.useFakeTimers();
      try {
        const pending = runQ(nodeName("prod"), "1+1");
        await clock.tickAsync(60_000);
        const result = await pending;

        assert.strictEqual(result.isError, true);
        assert.match(
          result.content[0].text,
          /did not finish within 60 seconds/,
        );
        // The log also calls notify, so pick out the offer by its button
        const offers = offered
          .getCalls()
          .filter((call) => call.args[3] === "Disconnect");
        assert.strictEqual(offers.length, 1);
        assert.strictEqual(
          offers[0].args[1],
          notifications.MessageKind.WARNING,
        );
      } finally {
        clock.restore();
      }
    });

    it("keeps the q text out of the log", async () => {
      const conn = addLocal("prod", true);
      await setMcpAccess(nodeName("prod"), true);
      sinon.stub(conn, "executeQuery").resolves("ok");
      const logged = sinon.stub(loggers, "kdbOutputLog");
      const code = "\\password secret_password_123";

      await runQ(nodeName("prod"), code);

      const messages = logged.getCalls().map((call) => String(call.args[0]));
      assert.ok(messages.length > 0);
      assert.ok(
        messages.every((message) => !message.includes("secret_password_123")),
      );
      assert.ok(
        messages.some((message) =>
          message.includes(`(${code.length} characters)`),
        ),
      );
    });
  });
});
