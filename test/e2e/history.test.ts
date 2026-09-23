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
import * as vscode from "vscode";

import { activate, until } from "./utils";
import { CONNECTION as KDB, kdb, start as startKdb } from "./utils/connection";
import {
  CONNECTION as INSIGHTS,
  insights,
  start as startInsights,
} from "./utils/insights";
import { clear, untilRaised } from "./utils/prompt";

/**
 * Rerunning and copying an entry of the query history.
 *
 * The history itself is a tree, and a tree's contents are not reachable from a
 * test window, so what these drive are the commands its items run, given the
 * entry the tree would hand them. Everything past that point is real: the
 * query goes back to the process it was run on the first time.
 */

// The entry the tree hands the commands. Only the connection, the query and
// how it was run are read; the rest is what the tree draws its label from.
const entry = (
  connectionName: string,
  query: string,
  kdbConnection = true,
) => ({
  details: {
    executorName: "history.q",
    connectionName,
    connectionType: kdbConnection ? 1 : 0,
    query,
    time: new Date().toISOString(),
    success: true,
    language: "q",
  },
});

const KDB_QUERY = '"HISTORY_ON_KDB"';
const INSIGHTS_QUERY = '"HISTORY_ON_INSIGHTS"';

describe("Query history", () => {
  before(async () => {
    await activate();
    await startKdb();
    await startInsights();
  });

  beforeEach(() => clear());

  describe("rerunning an entry", () => {
    it("sends the query back to the kdb+ process it was run on", async () => {
      kdb.clear();
      await vscode.commands.executeCommand(
        "kdb.queryHistory.rerun",
        entry(KDB, KDB_QUERY),
      );

      await until(
        () => kdb.queries().some((request) => request.args?.code === KDB_QUERY),
        `the query to reach ${KDB} (sent ${kdb
          .queries()
          .map((request) => request.args?.code)
          .join(", ")})`,
      );
    });

    it("sends the query back to the Insights connection it was run on", async () => {
      insights.clear();
      await vscode.commands.executeCommand(
        "kdb.queryHistory.rerun",
        entry(INSIGHTS, INSIGHTS_QUERY, false),
      );

      await until(
        () => insights.queries().length > 0,
        "the query to reach the Insights connection",
      );

      const request = insights.queries()[0];
      assert.strictEqual(request.path, "/scratchpadmanager/scratchpad/display");
      assert.strictEqual(request.body.expression, INSIGHTS_QUERY);
    });
  });

  describe("copying an entry", () => {
    it("puts the query on the clipboard", async () => {
      const clipboard = await vscode.env.clipboard.readText();
      try {
        await vscode.commands.executeCommand(
          "kdb.queryHistory.copyQuery",
          entry(KDB, KDB_QUERY),
        );

        await untilRaised("copied to clipboard");
        assert.strictEqual(await vscode.env.clipboard.readText(), KDB_QUERY);
      } finally {
        await vscode.env.clipboard.writeText(clipboard);
      }
    });
  });
});
