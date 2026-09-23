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

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as vscode from "vscode";

import { activate, file, focus, settle, until } from "./utils";
import { CONNECTION as KDB, start as startKdb } from "./utils/connection";
import { ASSEMBLY, TIER } from "./utils/fixtures";
import {
  CONNECTION,
  dial,
  ensure,
  insights,
  instanceAt,
  start,
} from "./utils/insights";
import { FakeInsights } from "./utils/insightsServer";
import { answer, clear, untilRaised } from "./utils/prompt";

/**
 * Resetting a scratchpad, and the execution timeout every Insights request
 * carries. Both are settings and confirmations rather than code, so what they
 * are asserted on is the request that leaves — or the absence of one.
 */

const RESET = "/scratchpadmanager/reset";
const CONFIRMATION = "Reset Scratchpad?";

// Copies of main.q under the paths kdb.connectionMap and kdb.timeoutMap assign
// to this suite.
const TIMED_FILE = file("timeout.q");
const TIMED_TARGET = file("timeout.target.q");
const ASSIGNED = [TIMED_FILE, TIMED_TARGET];

// What kdb.timeoutMap gives timeout.q in the workspace settings, and what
// kdb.defaultTimeout leaves everything else on.
const OVERRIDDEN = 5;
const DEFAULT = 30;

async function reset(connLabel = CONNECTION) {
  insights.clear();
  await vscode.commands.executeCommand("kdb.scratchpad.reset", {
    label: connLabel,
  });
}

// The first request a run sent, once it has arrived.
async function run(uri: vscode.Uri) {
  insights.clear();
  await focus(uri);
  await vscode.commands.executeCommand("kdb.execute.fileQuery");
  await until(() => insights.queries().length > 0, `a request for ${uri.path}`);
  return insights.queries()[0];
}

describe("The Insights scratchpad", () => {
  before(async () => {
    await activate();
    for (const assigned of ASSIGNED) {
      fs.copyFileSync(file("main.q").fsPath, assigned.fsPath);
    }
    await start();
  });

  beforeEach(() => clear());

  after(async () => {
    for (const assigned of ASSIGNED) {
      fs.rmSync(assigned.fsPath, { force: true });
    }
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  describe("resetting it", () => {
    it("asks before it resets, and resets when told to", async () => {
      answer(CONFIRMATION, "Yes");
      await reset();

      await until(
        () => insights.calls(RESET).length > 0,
        "the reset to be sent",
      );
      assert.strictEqual(insights.calls(RESET)[0].method, "POST");
    });

    it("sends nothing when the reset is declined", async () => {
      answer(CONFIRMATION, "No");
      await reset();

      await settle();

      assert.deepStrictEqual(insights.calls(RESET), []);
    });

    it("refuses a connection that is not an Insights one", async () => {
      await startKdb();
      await reset(KDB);

      await untilRaised("connect to an Insights connection");
      assert.deepStrictEqual(insights.calls(RESET), []);
    });

    /**
     * The endpoint exists further back than the confirmation does, but the
     * command asks for 1.13 before it offers to reset at all.
     */
    describe("against an instance older than 1.13", () => {
      const OLD = instanceAt(25203, "TESTRESET");
      const old = new FakeInsights();
      old.version = "1.12.0";

      before(async () => {
        await old.listen(25203);
        await ensure(OLD);
        await dial(OLD.alias, old);
      });

      after(async () => {
        await vscode.commands.executeCommand(
          "kdb.connections.disconnect",
          OLD.alias,
        );
        await old.close();
      });

      it("says so rather than offering to reset", async () => {
        old.clear();
        await vscode.commands.executeCommand("kdb.scratchpad.reset", {
          label: OLD.alias,
        });

        await untilRaised("version 1.13 or higher");
        assert.deepStrictEqual(old.calls(RESET), []);
      });
    });
  });

  /**
   * Every Insights request carries the execution timeout the file resolves to,
   * as a header for the scratchpad and inside the body for a DAP, which reads
   * it in milliseconds.
   */
  describe("the execution timeout", () => {
    it("sends the workspace default with a file that has no timeout of its own", async () => {
      const request = await run(TIMED_TARGET);

      assert.strictEqual(request.headers.timeout, undefined);
      assert.strictEqual(request.body.opts?.timeout, DEFAULT * 1000);
    });

    it("sends the timeout the file was given instead", async () => {
      const request = await run(TIMED_FILE);

      assert.strictEqual(request.headers.timeout, String(OVERRIDDEN));
    });

    it("targets the assembly the file is assigned to", async () => {
      const request = await run(TIMED_TARGET);

      assert.deepStrictEqual(request.body.scope, {
        affinity: "soft",
        assembly: ASSEMBLY,
        tier: TIER,
      });
    });
  });
});
