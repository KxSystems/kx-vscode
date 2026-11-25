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
import { ACCESS_KEY } from "./mcpTestHelpers";
import { ext } from "../../../../src/extensionVariables";
import {
  EXPLAINED_KEY,
  getMcpAllowedLabels,
  isMcpAllowed,
  isMcpEnabled,
  purgeLegacyMcpAccess,
  setMcpAccess,
  updateMcpAccessOnEdit,
  updateMcpContext,
} from "../../../../src/services/mcp/mcpAccess";

describe("MCP access", () => {
  beforeEach(() => {
    ext.context = fakeContext();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("allows only the labels that were set", async () => {
    await setMcpAccess("local-q", true);

    assert.strictEqual(isMcpAllowed("local-q"), true);
    assert.strictEqual(isMcpAllowed("dev"), false);
  });

  it("removes access when it is set to false", async () => {
    await setMcpAccess("local-q", true);
    await setMcpAccess("local-q", false);

    assert.strictEqual(isMcpAllowed("local-q"), false);
  });

  it("does not treat inherited object properties as allowed labels", () => {
    assert.strictEqual(isMcpAllowed("toString"), false);
    assert.strictEqual(isMcpAllowed("__proto__"), false);
  });

  it("skips the write when access is already in that state", async () => {
    await setMcpAccess("local-q", true);
    const update = sinon.spy(ext.context.globalState, "update");

    await setMcpAccess("local-q", true);

    assert.strictEqual(update.called, false);
  });

  it("drops legacy read-only entries and asks for confirmation again", async () => {
    await ext.context.globalState.update(ACCESS_KEY, {
      "local-q": true,
      old: "read",
    });
    await ext.context.globalState.update(EXPLAINED_KEY, true);

    await purgeLegacyMcpAccess();

    assert.strictEqual(isMcpAllowed("local-q"), true);
    assert.strictEqual(isMcpAllowed("old"), false);
    assert.strictEqual(ext.context.globalState.get(EXPLAINED_KEY), undefined);
  });

  it("leaves access alone when no legacy entries exist", async () => {
    await setMcpAccess("local-q", true);
    await ext.context.globalState.update(EXPLAINED_KEY, true);

    await purgeLegacyMcpAccess();

    assert.strictEqual(isMcpAllowed("local-q"), true);
    assert.strictEqual(ext.context.globalState.get(EXPLAINED_KEY), true);
  });

  describe("updateMcpAccessOnEdit", () => {
    const OLD = "dev [127.0.0.1:5001]";
    const RENAMED = "research [127.0.0.1:5001]";
    const MOVED = "dev [10.0.0.1:5001]";

    it("keeps access on a rename to the same host and port", async () => {
      await setMcpAccess(OLD, true);

      await updateMcpAccessOnEdit(OLD, RENAMED, true);

      assert.strictEqual(isMcpAllowed(RENAMED), true);
      assert.strictEqual(isMcpAllowed(OLD), false);
    });

    it("clears access when the host or port changes", async () => {
      await setMcpAccess(OLD, true);

      await updateMcpAccessOnEdit(OLD, MOVED, false);

      assert.strictEqual(isMcpAllowed(MOVED), false);
      assert.strictEqual(isMcpAllowed(OLD), false);
    });

    it("does not grant access on a rename that had none", async () => {
      await updateMcpAccessOnEdit(OLD, RENAMED, true);

      assert.strictEqual(isMcpAllowed(RENAMED), false);
    });

    it("keeps access when the label is unchanged (auth, TLS or tags edits)", async () => {
      await setMcpAccess(OLD, true);

      await updateMcpAccessOnEdit(OLD, OLD, true);

      assert.strictEqual(isMcpAllowed(OLD), true);
    });
  });

  describe("isMcpEnabled", () => {
    it("is on by default", () => {
      sinon
        .stub(vscode.workspace, "getConfiguration")
        .returns({ get: (_key: string, fallback: unknown) => fallback } as any);

      assert.strictEqual(isMcpEnabled(), true);
    });

    it("follows the kdb.mcp.enabled setting", () => {
      sinon
        .stub(vscode.workspace, "getConfiguration")
        .returns({ get: () => false } as any);

      assert.strictEqual(isMcpEnabled(), false);
    });
  });

  describe("bulk access", () => {
    it("lists every allowed label", async () => {
      await setMcpAccess("dev", true);
      await setMcpAccess("prod", true);
      await setMcpAccess("gone", true);
      await setMcpAccess("gone", false);

      assert.deepStrictEqual(getMcpAllowedLabels().sort(), ["dev", "prod"]);
    });

    it("sets the kdb.mcp.allowed context to the allowed labels", async () => {
      const execute = sinon.stub(vscode.commands, "executeCommand").resolves();
      await setMcpAccess("dev", true);

      updateMcpContext();

      assert.ok(execute.calledWith("setContext", "kdb.mcp.allowed", ["dev"]));
    });
  });
});
