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
    // Calls are logged; other test files usually create this first
    ext.outputChannel ??= vscode.window.createOutputChannel("kdb", {
      log: true,
    });
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
      addLocal("local-q", true);
      addLocal("off", true);
      addLocal("sleeping", false);
      await setMcpAccess(nodeName("local-q"), true);
      await setMcpAccess(nodeName("sleeping"), true);

      const result = await tools.get("list_connections")!({});
      const body = JSON.parse(result.content[0].text);

      assert.deepStrictEqual(body.connections, [{ name: nodeName("local-q") }]);
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
      const conn = addLocal("local-q", true);
      const execute = sinon.stub(conn, "executeQuery").resolves("42");

      const result = await runQ(nodeName("local-q"), "1+1");

      assert.strictEqual(result.isError, true);
      assert.match(result.content[0].text, /not allowed for MCP/);
      assert.strictEqual(execute.called, false);
    });

    it("refuses an allowed connection that is not connected", async () => {
      addLocal("local-q", false);
      await setMcpAccess(nodeName("local-q"), true);

      const result = await runQ(nodeName("local-q"), "1+1");

      assert.match(result.content[0].text, /allowed but not connected/);
    });

    it("refuses a label that an Insights connection shares", async () => {
      const conn = addLocal("local-q", true);
      addInsightsNodeNamed(nodeName("local-q"));
      await setMcpAccess(nodeName("local-q"), true);
      const execute = sinon.stub(conn, "executeQuery").resolves("42");

      const result = await runQ(nodeName("local-q"), "1+1");

      assert.match(
        result.content[0].text,
        /Insights connections aren't supported/,
      );
      assert.strictEqual(execute.called, false);
    });
  });

  describe("run_q", () => {
    it("runs the query without a trailing semicolon", async () => {
      const conn = addLocal("local-q", true);
      await setMcpAccess(nodeName("local-q"), true);
      const execute = sinon.stub(conn, "executeQuery").resolves("42");

      const result = await runQ(nodeName("local-q"), "1+1;");

      assert.strictEqual(execute.firstCall.args[0], "1+1");
      assert.strictEqual(result.isError, false);
      assert.strictEqual(result.content[0].text, "42");
    });

    it("reports a q error as an error result", async () => {
      const conn = addLocal("local-q", true);
      await setMcpAccess(nodeName("local-q"), true);
      sinon.stub(conn, "executeQuery").resolves(`${queryConstants.error}type`);

      const result = await runQ(nodeName("local-q"), "bad");

      assert.strictEqual(result.isError, true);
      assert.strictEqual(result.content[0].text, `${queryConstants.error}type`);
    });

    it("cuts output at the configured limit and says so", async () => {
      const conn = addLocal("local-q", true);
      await setMcpAccess(nodeName("local-q"), true);
      sinon.stub(conn, "executeQuery").resolves("x".repeat(25000));

      const result = await runQ(nodeName("local-q"), "til 25000");
      const text = result.content[0].text;

      assert.ok(text.startsWith("x".repeat(20000)));
      assert.ok(text.includes("Output cut short: the first 20000 of 25000"));
    });

    it("reports a query that runs past the timeout", async () => {
      const conn = addLocal("local-q", true);
      await setMcpAccess(nodeName("local-q"), true);
      sinon.stub(conn, "executeQuery").returns(new Promise(() => undefined));
      // Keeps the popup out of the test window and records what it shows
      const offered = sinon.stub(notifications, "notify").resolves(undefined);
      const clock = sinon.useFakeTimers();
      try {
        const pending = runQ(nodeName("local-q"), "1+1");
        await clock.tickAsync(62_000);
        const result = await pending;

        assert.strictEqual(result.isError, true);
        assert.match(
          result.content[0].text,
          /exceeded its configured 60-second execution budget, and q did not respond within the additional 2-second grace period/,
        );
        // The log also calls notify, so pick out the warning by its kind
        const warnings = offered
          .getCalls()
          .filter((call) => call.args[1] === notifications.MessageKind.WARNING);
        assert.strictEqual(warnings.length, 1);
        assert.match(
          String(warnings[0].args[0]),
          /exceeded its configured 60-second execution budget, and q did not respond within the additional 2-second grace period/,
        );
        // Nothing is offered: disconnecting wouldn't stop the query in q
        assert.strictEqual(warnings[0].args.length, 3);
      } finally {
        clock.restore();
      }
    });

    it("explains a 'stop from q and keeps q's error", async () => {
      const conn = addLocal("local-q", true);
      await setMcpAccess(nodeName("local-q"), true);
      sinon.stub(conn, "executeQuery").resolves(`${queryConstants.error}stop`);
      // \T reads as 0, so it isn't put down to a timeout
      sinon.stub(conn, "executeQueryRaw").resolves("0");

      const result = await runQ(nodeName("local-q"), "do[1e9;1]");
      const text = result.content[0].text;

      assert.strictEqual(result.isError, true);
      assert.match(text, /stopped the query \('stop\)/);
      assert.match(text, /It is no longer running/);
      assert.ok(text.endsWith(`${queryConstants.error}stop`));
    });

    it("keeps the q text out of the log", async () => {
      const conn = addLocal("local-q", true);
      await setMcpAccess(nodeName("local-q"), true);
      sinon.stub(conn, "executeQuery").resolves("ok");
      const logged = sinon.stub(loggers, "kdbOutputLog");
      const code = "\\password secret_password_123";

      await runQ(nodeName("local-q"), code);

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
