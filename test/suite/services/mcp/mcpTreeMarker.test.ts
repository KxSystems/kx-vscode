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
import { ext } from "../../../../src/extensionVariables";
import * as mcpAccess from "../../../../src/services/mcp/mcpAccess";

// children[2] is the user and children[3] the password, which is masked
const CREDENTIALS = ["child", "child", "user", "pw"];

describe("MCP marker in the kdb explorer", () => {
  beforeEach(() => {
    ext.context = fakeContext();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("shows MCP on an allowed connection while MCP is on", async () => {
    sinon.stub(mcpAccess, "isMcpEnabled").returns(true);
    await mcpAccess.setMcpAccess(LOCAL_NODE_LABEL, true);

    const node = kdbNode("local-q");

    assert.strictEqual(node.description, "MCP");
    assert.match(
      (node.tooltip as vscode.MarkdownString).value,
      /MCP access allowed/,
    );
  });

  it("adds MCP after the user and masked password", async () => {
    sinon.stub(mcpAccess, "isMcpEnabled").returns(true);
    await mcpAccess.setMcpAccess(LOCAL_NODE_LABEL, true);

    const node = kdbNode("local-q", CREDENTIALS);

    assert.strictEqual(node.description, "user:** · MCP");
  });

  it("shows no marker on a connection without access", () => {
    sinon.stub(mcpAccess, "isMcpEnabled").returns(true);

    const node = kdbNode("local-q");

    assert.strictEqual(node.description, "");
    assert.doesNotMatch(
      (node.tooltip as vscode.MarkdownString).value,
      /MCP access allowed/,
    );
  });

  it("hides the marker while kdb.mcp.enabled is off", async () => {
    sinon.stub(mcpAccess, "isMcpEnabled").returns(false);
    await mcpAccess.setMcpAccess(LOCAL_NODE_LABEL, true);

    assert.strictEqual(kdbNode("local-q").description, "");
  });
});
