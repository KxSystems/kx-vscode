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

import {
  ExportedConnections,
  Insights,
  Server,
} from "../../../src/models/connectionsModels";

/**
 * A list of pre-existing connections in the shape the connections panel
 * exports and imports, used by the tests that cover how the panel presents
 * them.
 *
 * Three things are deliberate. The entries are out of order, and out of order in
 * a way a single alphabetical pass would not fix: `alpha-insights` sorts before
 * every q connection here, so a panel that only sorted by name would put it at
 * the top instead of below them. The aliases are alphanumeric with hyphens,
 * which is all validateServerAlias accepts. And nothing here is imported at run
 * time — only types are — so test/e2e can use the same list without pulling a
 * second copy of the extension's modules into the window it drives.
 */

export const KDB_ALIASES = ["alpha-q", "mike-q", "zulu-q"];

export const INSIGHTS_ALIASES = ["alpha-insights", "zulu-insights"];

export const SORTED_ALIASES = [...KDB_ALIASES, ...INSIGHTS_ALIASES];

export const CREDENTIALS = { username: "e2e-user", password: "e2e-secret" };

export function exportedConnections(): ExportedConnections {
  return {
    connections: {
      Insights: [
        {
          alias: "zulu-insights",
          server: "https://zulu.example.com",
          auth: true,
          realm: "keycloak",
          insecure: false,
        },
        {
          alias: "alpha-insights",
          server: "https://alpha.example.com",
          auth: true,
          realm: "",
          insecure: true,
        },
      ],
      KDB: [
        {
          serverAlias: "zulu-q",
          serverName: "127.0.0.1",
          serverPort: "25101",
          auth: false,
          tls: true,
        },
        {
          serverAlias: "alpha-q",
          serverName: "127.0.0.1",
          serverPort: "25102",
          auth: true,
          tls: false,
          ...CREDENTIALS,
        },
        {
          serverAlias: "mike-q",
          serverName: "localhost",
          serverPort: "25103",
          auth: false,
          tls: false,
        },
      ],
    },
  };
}

export function declaredConnections(): { servers: Server; insights: Insights } {
  const exported = exportedConnections();

  return {
    servers: Object.fromEntries(
      exported.connections.KDB.map((server) => [server.serverAlias, server]),
    ),
    insights: Object.fromEntries(
      exported.connections.Insights.map((insight) => [insight.alias, insight]),
    ),
  };
}
