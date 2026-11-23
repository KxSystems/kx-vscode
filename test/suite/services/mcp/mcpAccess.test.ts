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

import { fakeContext } from "./fakeContext";
import { ext } from "../../../../src/extensionVariables";
import {
  EXPLAINED_KEY,
  isMcpAllowed,
  purgeLegacyMcpAccess,
  setMcpAccess,
} from "../../../../src/services/mcp/mcpAccess";

// The globalState key mcpAccess.ts stores access under
const ACCESS_KEY = "kdb.mcp.access";

describe("MCP access", () => {
  beforeEach(() => {
    ext.context = fakeContext();
  });

  afterEach(() => {
    sinon.restore();
  });

  it("allows only the labels that were set", async () => {
    await setMcpAccess("prod", true);

    assert.strictEqual(isMcpAllowed("prod"), true);
    assert.strictEqual(isMcpAllowed("dev"), false);
  });

  it("removes access when it is set to false", async () => {
    await setMcpAccess("prod", true);
    await setMcpAccess("prod", false);

    assert.strictEqual(isMcpAllowed("prod"), false);
  });

  it("does not treat inherited object properties as allowed labels", () => {
    assert.strictEqual(isMcpAllowed("toString"), false);
    assert.strictEqual(isMcpAllowed("__proto__"), false);
  });

  it("skips the write when access is already in that state", async () => {
    await setMcpAccess("prod", true);
    const update = sinon.spy(ext.context.globalState, "update");

    await setMcpAccess("prod", true);

    assert.strictEqual(update.called, false);
  });

  it("drops legacy read-only entries and asks for confirmation again", async () => {
    await ext.context.globalState.update(ACCESS_KEY, {
      prod: true,
      old: "read",
    });
    await ext.context.globalState.update(EXPLAINED_KEY, true);

    await purgeLegacyMcpAccess();

    assert.strictEqual(isMcpAllowed("prod"), true);
    assert.strictEqual(isMcpAllowed("old"), false);
    assert.strictEqual(ext.context.globalState.get(EXPLAINED_KEY), undefined);
  });

  it("leaves access alone when no legacy entries exist", async () => {
    await setMcpAccess("prod", true);
    await ext.context.globalState.update(EXPLAINED_KEY, true);

    await purgeLegacyMcpAccess();

    assert.strictEqual(isMcpAllowed("prod"), true);
    assert.strictEqual(ext.context.globalState.get(EXPLAINED_KEY), true);
  });
});
