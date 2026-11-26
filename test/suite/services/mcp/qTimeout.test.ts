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

import { LocalConnection } from "../../../../src/classes/localConnection";
import {
  agentToolTimeoutSeconds,
  checkProcessTimeouts,
  explainProcessStop,
} from "../../../../src/services/mcp/qTimeout";
import * as notifications from "../../../../src/utils/notifications";

const READ_T = '{string system"T"}';
const SET_T = '{system"T ",string x}';

// Overrides kdb.mcp.* settings; anything else gets its default
function useSettings(settings: Record<string, unknown>): void {
  sinon.stub(vscode.workspace, "getConfiguration").returns({
    get: (key: string, fallback?: unknown) =>
      key in settings ? settings[key] : fallback,
  } as unknown as vscode.WorkspaceConfiguration);
}

// A connection whose \T reads as the given value (or fails to read)
function connectionWithT(t: number | Error): {
  conn: LocalConnection;
  raw: sinon.SinonStub;
} {
  const conn = new LocalConnection("127.0.0.1:5001", "local-q", []);
  const raw = sinon.stub(conn, "executeQueryRaw").callsFake(async (code) => {
    if (code !== READ_T) {
      return "";
    }
    if (t instanceof Error) {
      throw t;
    }
    // q answers string system"T" with a char vector, e.g. "0"
    return String(t);
  });
  return { conn, raw };
}

describe("MCP q timeout", () => {
  let notify: sinon.SinonStub;

  beforeEach(() => {
    notify = sinon.stub(notifications, "notify").resolves(undefined);
  });

  afterEach(() => {
    sinon.restore();
  });

  function shown(kind: notifications.MessageKind): string[] {
    return notify
      .getCalls()
      .filter((call) => call.args[1] === kind)
      .map((call) => String(call.args[0]));
  }

  describe("agentToolTimeoutSeconds", () => {
    it("is the MCP timeout plus the grace and a margin", () => {
      assert.strictEqual(agentToolTimeoutSeconds(), 72);
    });

    it("follows kdb.mcp.queryTimeoutSeconds", () => {
      useSettings({ "mcp.queryTimeoutSeconds": 120 });

      assert.strictEqual(agentToolTimeoutSeconds(), 132);
    });
  });

  describe("checkProcessTimeouts", () => {
    it("suggests \\T when the process has none, without changing it", async () => {
      const { conn, raw } = connectionWithT(0);

      await checkProcessTimeouts([conn]);

      assert.ok(raw.calledOnceWith(READ_T));
      assert.ok(raw.neverCalledWith(SET_T));
      const warnings = shown(notifications.MessageKind.WARNING);
      assert.strictEqual(warnings.length, 1);
      assert.match(
        warnings[0],
        /^'local-q' has no query timeout\. Set the timeout on the process to match the 60-second MCP query timeout\.$/,
      );
    });

    it("suggests aligning them when \\T is longer than the MCP timeout", async () => {
      const { conn } = connectionWithT(120);

      await checkProcessTimeouts([conn]);

      const info = shown(notifications.MessageKind.INFO);
      assert.strictEqual(info.length, 1);
      assert.match(
        info[0],
        /^'local-q' stops queries after 120 seconds \(\\T\), but agent queries time out after 60\. Set \\T 60 on the process, or raise kdb\.mcp\.queryTimeoutSeconds to 120\.$/,
      );
    });

    it("only logs when \\T is shorter than the MCP timeout", async () => {
      const { conn } = connectionWithT(10);

      await checkProcessTimeouts([conn]);

      assert.deepStrictEqual(shown(notifications.MessageKind.WARNING), []);
      assert.deepStrictEqual(shown(notifications.MessageKind.INFO), []);
    });

    it("skips a process that refuses to report \\T", async () => {
      const { conn } = connectionWithT(new Error("access"));

      await checkProcessTimeouts([conn]);

      assert.deepStrictEqual(shown(notifications.MessageKind.WARNING), []);
      assert.ok(
        shown(notifications.MessageKind.DEBUG).some((line) =>
          line.includes("Couldn't read \\T on 'local-q'"),
        ),
      );
    });

    it("treats an empty reply as unreadable, not as \\T 0", async () => {
      const conn = new LocalConnection("127.0.0.1:5001", "local-q", []);
      // What executeQueryRaw resolves for a falsy q result
      sinon.stub(conn, "executeQueryRaw").resolves("");

      await checkProcessTimeouts([conn]);

      assert.deepStrictEqual(shown(notifications.MessageKind.WARNING), []);
    });

    it("checks each connection once", async () => {
      const { conn, raw } = connectionWithT(0);

      await checkProcessTimeouts([conn]);
      await checkProcessTimeouts([conn]);

      assert.strictEqual(raw.callCount, 1);
    });
  });

  describe("explainProcessStop", () => {
    it("calls a 'stop at \\T a timeout", async () => {
      const { conn } = connectionWithT(60);

      const stop = await explainProcessStop(conn, 60_200);

      assert.strictEqual(stop.timedOut, true);
      assert.match(
        stop.message,
        /stopped the query after its 60-second execution limit\. It is no longer running\./,
      );
      assert.match(stop.message, /keeping them aligned/);
    });

    it("does not call an early 'stop a timeout", async () => {
      const { conn } = connectionWithT(60);

      const stop = await explainProcessStop(conn, 3_000);

      assert.strictEqual(stop.timedOut, false);
      assert.match(stop.message, /after 3 seconds/);
      assert.match(stop.message, /not necessarily by a timeout/);
      assert.match(stop.message, /It is no longer running/);
    });

    it("does not call a 'stop well past \\T a timeout", async () => {
      const { conn } = connectionWithT(10);

      const stop = await explainProcessStop(conn, 40_000);

      assert.strictEqual(stop.timedOut, false);
    });

    it("reports a plain stop when the process has no \\T", async () => {
      const { conn } = connectionWithT(0);

      const stop = await explainProcessStop(conn, 5_000);

      assert.strictEqual(stop.timedOut, false);
      assert.doesNotMatch(stop.message, /execution limit/);
    });

    it("reports a plain stop when \\T can't be read", async () => {
      const { conn } = connectionWithT(new Error("access"));

      const stop = await explainProcessStop(conn, 60_000);

      assert.strictEqual(stop.timedOut, false);
    });
  });
});
