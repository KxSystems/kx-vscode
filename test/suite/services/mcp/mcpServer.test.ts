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
import * as http from "http";
import * as net from "net";
import * as sinon from "sinon";

import { fakeContext } from "./fakeContext";
import { ext } from "../../../../src/extensionVariables";
import * as mcpPorts from "../../../../src/services/mcp/mcpPorts";
import { kdbMcpServer } from "../../../../src/services/mcp/mcpServer";
import * as notifications from "../../../../src/utils/notifications";

// A port nothing is using right now
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

type Reply = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

function send(
  port: number,
  path: string,
  headers: http.OutgoingHttpHeaders = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: { Host: `127.0.0.1:${port}`, ...headers },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("kdb MCP server", () => {
  let port: number;

  beforeEach(async () => {
    ext.context = fakeContext();
    port = await freePort();
    sinon.stub(mcpPorts, "choosePort").returns({ port, source: "default" });
    // Keeps port messages out of the test window
    sinon
      .stub(notifications, "notify")
      .returns(Promise.resolve(undefined) as any);
    assert.strictEqual(
      await kdbMcpServer.start(),
      true,
      "the server did not start; check that the test workspace is trusted",
    );
  });

  afterEach(async () => {
    await kdbMcpServer.stop();
    sinon.restore();
  });

  it("answers /health without a token and leaks no folder path", async () => {
    const reply = await send(port, "/health");
    const body = JSON.parse(reply.body);

    assert.strictEqual(reply.status, 200);
    assert.strictEqual(body.server, "kdb-mcp");
    assert.ok(!reply.body.includes("file:"));
  });

  it("refuses /mcp without a token", async () => {
    const reply = await send(port, "/mcp");

    assert.strictEqual(reply.status, 401);
    assert.strictEqual(reply.headers["www-authenticate"], "Bearer");
  });

  it("refuses /mcp with a wrong token", async () => {
    const reply = await send(port, "/mcp", {
      Authorization: "Bearer not-the-token",
    });

    assert.strictEqual(reply.status, 401);
  });

  it("accepts the token on /mcp, and still rejects GET there", async () => {
    const token = await kdbMcpServer.getToken();

    const reply = await send(port, "/mcp", {
      Authorization: `Bearer ${token}`,
    });

    assert.strictEqual(reply.status, 405);
  });

  it("refuses a Host header for another name (DNS rebinding)", async () => {
    const reply = await send(port, "/health", {
      Host: `evil.example:${port}`,
    });

    assert.strictEqual(reply.status, 403);
  });

  it("refuses a browser origin that is not local", async () => {
    const reply = await send(port, "/health", {
      Origin: "https://evil.example",
    });

    assert.strictEqual(reply.status, 403);
  });

  it("returns 404 for unknown paths with a token", async () => {
    const token = await kdbMcpServer.getToken();

    const reply = await send(port, "/nothing", {
      Authorization: `Bearer ${token}`,
    });

    assert.strictEqual(reply.status, 404);
  });

  it("stops listening on stop()", async () => {
    await kdbMcpServer.stop();

    assert.strictEqual(kdbMcpServer.running, false);
    await assert.rejects(send(port, "/health"));
  });
});
