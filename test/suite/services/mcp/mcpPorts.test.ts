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
import { AddressInfo } from "net";
import * as sinon from "sinon";

import { fakeContext } from "./fakeContext";
import { ext } from "../../../../src/extensionVariables";
import {
  choosePort,
  claimName,
  keyHash,
  MCP_HOST,
  probeHealth,
  savePortClaim,
  workspaceKey,
} from "../../../../src/services/mcp/mcpPorts";

// Starts a local HTTP server that answers with the given handler
function listen(
  handler: http.RequestListener,
): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, MCP_HOST, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe("MCP ports", () => {
  beforeEach(() => {
    ext.context = fakeContext();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("keyHash", () => {
    it("is stable for the same key", () => {
      assert.strictEqual(keyHash("file:///a"), keyHash("file:///a"));
    });

    it("differs between keys and does not contain the key", () => {
      const hash = keyHash("file:///home/user/secret-project");

      assert.notStrictEqual(hash, keyHash("file:///home/user/other"));
      assert.match(hash, /^[0-9a-f]{64}$/);
      assert.ok(!hash.includes("secret-project"));
    });
  });

  describe("claimName", () => {
    it("uses the .code-workspace file name without its extension", () => {
      assert.strictEqual(
        claimName("file:///home/user/proj/team.code-workspace"),
        "team",
      );
    });

    it("uses the folder name for a folder key", () => {
      assert.strictEqual(claimName("file:///home/user/proj"), "proj");
    });
  });

  describe("probeHealth", () => {
    it("reads a kdb MCP server's health without sending a token", async () => {
      let authorization: string | undefined = "unset";
      const server = await listen((req, res) => {
        authorization = req.headers.authorization;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            server: "kdb-mcp",
            workspace: "team",
            keyHash: "abc",
            pid: 1,
          }),
        );
      });
      try {
        const health = await probeHealth(server.port);

        assert.strictEqual(health?.server, "kdb-mcp");
        assert.strictEqual(health?.keyHash, "abc");
        assert.strictEqual(authorization, undefined);
      } finally {
        await server.close();
      }
    });

    it("returns undefined when another program holds the port", async () => {
      const server = await listen((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html>not mcp</html>");
      });
      try {
        assert.strictEqual(await probeHealth(server.port), undefined);
      } finally {
        await server.close();
      }
    });

    it("returns undefined when nothing is listening", async () => {
      const server = await listen((_req, res) => res.end());
      const port = server.port;
      await server.close();

      assert.strictEqual(await probeHealth(port), undefined);
    });
  });

  describe("choosePort", () => {
    it("uses the port saved for this workspace", async function () {
      const key = workspaceKey();
      if (key === undefined) {
        this.skip();
      }
      await savePortClaim(key!, 7601);

      assert.deepStrictEqual(choosePort(), { port: 7601, source: "saved" });
    });
  });
});
