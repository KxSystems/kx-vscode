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
import { freePort, serveHttp } from "./mcpTestHelpers";
import { ext } from "../../../../src/extensionVariables";
import {
  askForAnotherPort,
  choosePort,
  claimName,
  describePortHolder,
  forgetPortClaim,
  getPortClaims,
  keyHash,
  nextFreePort,
  probeHealth,
  savePortClaim,
  workspaceKey,
} from "../../../../src/services/mcp/mcpPorts";

// Keys for workspaces that aren't local folders, so their claims are kept
const REMOTE_KEY = "untitled-claims-test:demo";
const REMOTE_FORGET_KEY = "untitled-claims-test:forget";

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
      const server = await serveHttp((req, res) => {
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
      const server = await serveHttp((_req, res) => {
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
      const server = await serveHttp((_req, res) => res.end());
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

  describe("nextFreePort", () => {
    // A port nothing is using, with the ten below it as the "taken" port
    async function freeBase(): Promise<number> {
      return (await freePort()) - 10;
    }

    it("starts ten above the taken port", async () => {
      const taken = await freeBase();

      assert.strictEqual(await nextFreePort(taken), taken + 10);
    });

    it("skips a port another workspace has claimed", async () => {
      const taken = await freeBase();
      await savePortClaim("vscode-remote://other/proj", taken + 10);

      const port = await nextFreePort(taken);

      assert.ok(port !== undefined && port > taken + 10);
    });

    it("skips a port that is already bound", async () => {
      const server = await serveHttp((_req, res) => res.end());
      try {
        const port = await nextFreePort(server.port - 10);

        assert.ok(port !== undefined && port > server.port);
      } finally {
        await server.close();
      }
    });

    it("returns undefined when there is no room above the taken port", async () => {
      assert.strictEqual(await nextFreePort(65530), undefined);
    });
  });

  describe("port claims", () => {
    it("keeps a claim for a remote workspace", async () => {
      await savePortClaim(REMOTE_KEY, 7470);

      assert.strictEqual(getPortClaims()[REMOTE_KEY], 7470);
    });

    it("drops a claim for a local folder that no longer exists", async () => {
      const gone = "file:///no/such/folder/for/claims-test.code-workspace";
      await savePortClaim(gone, 7471);

      assert.strictEqual(getPortClaims()[gone], undefined);
    });

    it("forgets a claim", async () => {
      await savePortClaim(REMOTE_FORGET_KEY, 7472);

      await forgetPortClaim(REMOTE_FORGET_KEY);

      assert.strictEqual(getPortClaims()[REMOTE_FORGET_KEY], undefined);
    });
  });

  describe("describePortHolder", () => {
    it("names the workspace of another kdb MCP server", () => {
      assert.strictEqual(
        describePortHolder({ server: "kdb-mcp", workspace: "sales" }),
        "the kdb MCP server for workspace 'sales'",
      );
    });

    it("says another program when nothing identified itself", () => {
      assert.strictEqual(describePortHolder(undefined), "another program");
    });
  });

  describe("askForAnotherPort", () => {
    it("returns the suggested free port when the user picks it", async () => {
      sinon
        .stub(vscode.window, "showWarningMessage")
        .callsFake(((_message: string, ...items: string[]) =>
          Promise.resolve(
            items.find((item) => item.startsWith("Use port")),
          )) as any);

      const next = await askForAnotherPort(7460, "is used by another program");

      assert.strictEqual(typeof next, "number");
      assert.ok(
        next! >= 7470,
        "the suggestion starts ten above the taken port",
      );
    });

    it("returns undefined when the user picks Don't start", async () => {
      sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves("Don't start" as any);

      assert.strictEqual(
        await askForAnotherPort(7460, "is used by another program"),
        undefined,
      );
    });

    it("returns the port typed in when the user chooses one", async () => {
      sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves("Choose port…" as any);
      sinon.stub(vscode.window, "showInputBox").resolves("7777");

      assert.strictEqual(
        await askForAnotherPort(7460, "is used by another program"),
        7777,
      );
    });

    it("returns undefined when the typed port is cancelled", async () => {
      sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves("Choose port…" as any);
      sinon.stub(vscode.window, "showInputBox").resolves(undefined);

      assert.strictEqual(
        await askForAnotherPort(7460, "is used by another program"),
        undefined,
      );
    });

    it("rejects a port outside the allowed range", async () => {
      sinon
        .stub(vscode.window, "showWarningMessage")
        .resolves("Choose port…" as any);
      const input = sinon
        .stub(vscode.window, "showInputBox")
        .resolves(undefined);

      await askForAnotherPort(7460, "is used by another program");

      const validate = input.firstCall.args[0]!.validateInput!;
      assert.ok(validate("80"), "a privileged port is refused");
      assert.ok(validate("65536"), "a port above 65535 is refused");
      assert.strictEqual(validate("7777"), undefined);
    });
  });
});
