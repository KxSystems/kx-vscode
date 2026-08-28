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
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ext } from "../../../../src/extensionVariables";
import { Insights, Server } from "../../../../src/models/connectionsModels";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import {
  InsightsNode,
  KdbNode,
  KdbTreeProvider,
} from "../../../../src/services/kdbTreeProvider";
import { getInsights, getServers } from "../../../../src/utils/core";
import {
  INSIGHTS_ALIASES,
  KDB_ALIASES,
  SORTED_ALIASES,
  declaredConnections,
} from "../../../fixtures/config/connections";

/**
 * What the connections panel shows for a list of pre-existing connections:
 * the order the connections come out in, the label each one carries and the
 * icon it is drawn with.
 *
 * These live here rather than in test/e2e because a tree provider's items are
 * not reachable from another extension host — VS Code exposes no API for the
 * contents of a view. So the panel is driven at its source: the same
 * getServers()/getInsights() pair activation builds the provider from, and the
 * same getChildren() the view calls.
 */
describe("connections panel", () => {
  let stored: { servers: Server; insights: Insights };

  const declare = (servers: Server, insights: Insights) =>
    sinon.stub(vscode.workspace, "getConfiguration").returns(<any>{
      get: (section: string, fallback?: unknown) => {
        switch (section) {
          case "kdb.servers":
            return servers;
          case "kdb.insightsEnterpriseConnections":
            return insights;
          default:
            return fallback;
        }
      },
      update: sinon.stub(),
    });

  const shown = async () => {
    const provider = new KdbTreeProvider(getServers(), getInsights());
    return <(KdbNode | InsightsNode)[]>await provider.getChildren();
  };

  const aliasOf = (node: KdbNode | InsightsNode) =>
    node instanceof KdbNode ? node.details.serverAlias : node.details.alias;

  const iconOf = (node: KdbNode | InsightsNode) =>
    path.basename((<{ dark: vscode.Uri }>node.iconPath).dark.fsPath);

  beforeEach(() => {
    stored = declaredConnections();

    ext.connectionsList.length = 0;
    ext.kdbConnectionAliasList.length = 0;
    ext.kdbrootNodes.length = 0;
    ext.kdbinsightsNodes.length = 0;
    ext.connLabelList.length = 0;
    ext.connectedConnectionList.length = 0;
    ext.activeConnection = undefined;
    ext.connectionNode = undefined;

    sinon
      .stub(
        ConnectionManagementService.prototype,
        "retrieveInsightsConnVersion",
      )
      .resolves("0");
    sinon
      .stub(
        ConnectionManagementService.prototype,
        "retrieveInsightsConnQEEnabled",
      )
      .resolves(undefined);
  });

  afterEach(() => {
    sinon.restore();
    ext.connectionsList.length = 0;
    ext.kdbConnectionAliasList.length = 0;
    ext.kdbrootNodes.length = 0;
    ext.kdbinsightsNodes.length = 0;
    ext.connectedConnectionList.length = 0;
    ext.activeConnection = undefined;
    ext.connectionNode = undefined;
  });

  describe("order", () => {
    it("sorts the connections alphabetically", async () => {
      declare(stored.servers, stored.insights);

      const aliases = (await shown()).map(aliasOf);

      assert.deepStrictEqual(aliases, SORTED_ALIASES);
    });

    it("sorts the connections alphabetically whatever order they are stored in", async () => {
      const reverse = <T>(list: { [key: string]: T }): { [key: string]: T } =>
        Object.fromEntries(Object.entries(list).reverse());

      declare(reverse(stored.servers), reverse(stored.insights));

      const aliases = (await shown()).map(aliasOf);

      assert.deepStrictEqual(aliases, SORTED_ALIASES);
    });

    it("groups the connections by type", async () => {
      declare(stored.servers, stored.insights);

      const types = (await shown()).map((node) =>
        node instanceof KdbNode ? "q" : "insights",
      );

      assert.deepStrictEqual(types, [
        ...KDB_ALIASES.map(() => "q"),
        ...INSIGHTS_ALIASES.map(() => "insights"),
      ]);
    });

    /**
     * The type grouping is what is being pinned here rather than the sorting:
     * alpha-insights sorts before every q connection in the fixture, so a
     * panel that sorted by name alone would show it above them.
     */
    it("puts the Insights connections below the q connections", async () => {
      declare(stored.servers, stored.insights);

      const nodes = await shown();
      const lastQ = nodes.reduce(
        (last, node, index) => (node instanceof KdbNode ? index : last),
        -1,
      );
      const firstInsights = nodes.findIndex(
        (node) => node instanceof InsightsNode,
      );

      assert.ok(
        lastQ < firstInsights,
        `q connections end at ${lastQ}, Insights start at ${firstInsights}`,
      );
      assert.strictEqual(aliasOf(nodes[firstInsights]), "alpha-insights");
    });

    it("puts the Insights connections below a bundled q connection", async () => {
      declare(
        {
          local: {
            serverAlias: "local",
            serverName: "127.0.0.1",
            serverPort: "5001",
            auth: false,
            tls: false,
          },
        },
        stored.insights,
      );

      const aliases = (await shown()).map(aliasOf);

      assert.deepStrictEqual(aliases, ["local", ...INSIGHTS_ALIASES]);
    });
  });

  describe("labels", () => {
    it("shows the name given to a q connection before its server details", async () => {
      declare(stored.servers, stored.insights);

      const labels = (await shown())
        .filter((node) => node instanceof KdbNode)
        .map((node) => node.label);

      assert.deepStrictEqual(labels, [
        "alpha-q [127.0.0.1:25102]",
        "mike-q [localhost:25103]",
        "zulu-q [127.0.0.1:25101]",
      ]);
    });

    it("shows only the server details for a q connection with no name", async () => {
      declare(
        {
          "": {
            serverAlias: "",
            serverName: "127.0.0.1",
            serverPort: "5001",
            auth: false,
            tls: false,
          },
        },
        {},
      );

      const [node] = await shown();

      assert.strictEqual(node.label, "[127.0.0.1:5001]");
    });

    it("shows the name given to an Insights connection", async () => {
      declare({}, stored.insights);

      const labels = (await shown()).map((node) => node.label);

      assert.deepStrictEqual(labels, INSIGHTS_ALIASES);
    });
  });

  describe("icons", () => {
    it("draws each connection with the icon for its type", async () => {
      declare(stored.servers, stored.insights);

      const icons = (await shown()).map(iconOf);

      assert.deepStrictEqual(icons, [
        ...KDB_ALIASES.map(() => "conn-kdb.svg"),
        ...INSIGHTS_ALIASES.map(() => "conn-insights.svg"),
      ]);
    });

    it("draws a connected connection with the connected icon", async () => {
      declare(stored.servers, stored.insights);
      ext.connectedConnectionList.push(<any>{
        connLabel: "zulu-q [127.0.0.1:25101]",
      });

      const icons = new Map(
        (await shown()).map((node) => [node.label, iconOf(node)]),
      );

      assert.strictEqual(
        icons.get("zulu-q [127.0.0.1:25101]"),
        "conn-kdb-connected.svg",
      );
      assert.strictEqual(
        icons.get("alpha-q [127.0.0.1:25102]"),
        "conn-kdb.svg",
      );
    });

    it("draws the active connection with the active icon", async () => {
      declare(stored.servers, stored.insights);
      const active = <any>{ connLabel: "alpha-insights" };
      ext.connectedConnectionList.push(active);
      ext.activeConnection = active;

      const icons = new Map(
        (await shown()).map((node) => [node.label, iconOf(node)]),
      );

      assert.strictEqual(
        icons.get("alpha-insights"),
        "conn-insights-active.svg",
      );
      assert.strictEqual(icons.get("zulu-insights"), "conn-insights.svg");
    });
  });
});
