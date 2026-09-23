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
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

import { activate, settle, until } from "./utils";
import * as dialog from "./utils/dialog";
import { insights, start as startInsights } from "./utils/insights";
import * as prompt from "./utils/prompt";
import {
  CREDENTIALS,
  INSIGHTS_ALIASES,
  KDB_ALIASES,
  exportedConnections,
} from "../fixtures/config/connections";

/**
 * The connections panel, driven through the commands its title bar runs: New,
 * Refresh, Import and Export. The list it is exercised against is imported
 * from a file, the way a user moving between machines gets one.
 *
 * The file dialogs and the export's quick pick are stood in for — see
 * utils/dialog.ts — because a dialog the workbench draws cannot be handed an
 * answer through any API. Everything on the extension side of them is real: the
 * settings the imports land in, the file the exports write, and the
 * notifications either raises on the way.
 *
 * What the panel then *shows* for these connections — the order, the labels,
 * the icons — is asserted in test/suite/services/kdbTree/connectionsPanel.test.ts.
 * A tree view's items belong to the extension host that registered them and no
 * API reaches into them from out here.
 */

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), "kx-e2e-connections-"));
const at = (name: string) => vscode.Uri.file(path.join(SCRATCH, name));

const IMPORT = at("connections.json");
const IMPORT_YAML = at("connections.yaml");
const EXPORTED = at("exported.json");
const EXPORTED_WITH_AUTH = at("exported-with-auth.json");
const EXPORTED_SINGLE = at("exported-single.json");

const FIXTURE = exportedConnections();

const SELECT_FILE = "Select JSON File";
const SAVE_FILE = "Save Exported Connections";
const EXPORT_AUTH = "export username and password";

interface Declared {
  serverAlias?: string;
  alias?: string;
  username?: string;
  password?: string;
}

const setting = (name: string) =>
  vscode.workspace.getConfiguration().get<{ [key: string]: Declared }>(name) ??
  {};

const KDB_SETTING = "kdb.servers";
const INSIGHTS_SETTING = "kdb.insightsEnterpriseConnections";

const aliasOf = (entry: Declared) => entry.serverAlias ?? entry.alias;

/**
 * Every connection in the settings, from both lists.
 *
 * A list rather than one object keyed by the two merged: both settings key
 * their entries by the alias, so a q connection and an Insights connection
 * sharing a name are two entries under one key and merging loses one of them.
 */
const declared = () => [
  ...Object.values(setting(KDB_SETTING)),
  ...Object.values(setting(INSIGHTS_SETTING)),
];

const aliases = () =>
  declared()
    .map(aliasOf)
    .filter((alias): alias is string => alias !== undefined);

const declaredAs = (alias: string) =>
  declared().find((entry) => aliasOf(entry) === alias);

// What this suite declares, i.e. the fixture and the renamed duplicates of it.
const imported = (entry: Declared) => {
  const alias = aliasOf(entry) ?? "";
  return [...KDB_ALIASES, ...INSIGHTS_ALIASES].some(
    (known) => alias === known || alias.startsWith(`${known}-`),
  );
};

/**
 * The panel having caught up with the settings.
 *
 * Import and export both read the list the tree fills in as it renders, not
 * the settings, and the tree only renders while the view is on screen — the
 * same reason utils/connection.ts reveals it after declaring a connection.
 */
async function rendered() {
  await vscode.commands.executeCommand("kdb-servers.focus");
  await settle();
}

async function importFrom(uri: vscode.Uri) {
  await rendered();
  dialog.opens(uri);
  await vscode.commands.executeCommand("kdb.connections.import");
}

/**
 * Exports through one of the panel's export commands and returns what was
 * written, as JSON.
 *
 * An export that runs before the tree has rendered finds nothing in the list
 * it builds the file from and writes nothing at all, so this reveals the view
 * and tries again rather than reporting the empty run as the answer. Such an
 * attempt never reaches the save dialog, so each one starts from a cleared
 * recording and what a caller reads back is the attempt that wrote the file.
 */
async function exportTo(
  command: string,
  target: vscode.Uri,
  includeAuth: boolean,
  ...args: unknown[]
) {
  for (
    let attempt = 0;
    attempt < 10 && !fs.existsSync(target.fsPath);
    attempt++
  ) {
    await rendered();
    dialog.clear();
    dialog.picks(EXPORT_AUTH, includeAuth ? "Yes" : "No");
    dialog.saves(target);
    await vscode.commands.executeCommand(command, ...args);

    for (let wait = 0; wait < 8 && !fs.existsSync(target.fsPath); wait++) {
      await settle();
    }
  }

  assert.ok(
    fs.existsSync(target.fsPath),
    `${command} wrote nothing to ${target.fsPath}`,
  );

  const written = fs.readFileSync(target.fsPath, "utf8");
  return { written, content: JSON.parse(written) };
}

describe("Connections panel", () => {
  let existing: { kdb: object; insights: object };

  /**
   * The settings as they were found, without taking anything declared since
   * with them. The shared Insights instance is declared by whichever suite
   * reaches it first — which is this one — and every suite after it expects to
   * still find it, so only what this suite imported is taken out and the
   * snapshot is laid back over the rest.
   */
  const restore = async () => {
    const configuration = vscode.workspace.getConfiguration();

    for (const [name, snapshot] of [
      [KDB_SETTING, existing.kdb],
      [INSIGHTS_SETTING, existing.insights],
    ] as const) {
      const kept = Object.fromEntries(
        Object.entries(setting(name)).filter(([, entry]) => !imported(entry)),
      );

      await configuration.update(
        name,
        { ...kept, ...snapshot },
        vscode.ConfigurationTarget.Global,
      );
    }
  };

  before(async () => {
    await activate();

    existing = {
      kdb: { ...setting(KDB_SETTING) },
      insights: { ...setting(INSIGHTS_SETTING) },
    };

    fs.writeFileSync(IMPORT.fsPath, JSON.stringify(FIXTURE, null, 2));

    fs.writeFileSync(
      IMPORT_YAML.fsPath,
      [
        "connections:",
        "  KDB:",
        ...FIXTURE.connections.KDB.map(
          (server) => `    - serverAlias: ${server.serverAlias}`,
        ),
        "  Insights:",
        ...FIXTURE.connections.Insights.map(
          (insight) => `    - alias: ${insight.alias}`,
        ),
        "",
      ].join("\n"),
    );
  });

  beforeEach(() => {
    prompt.clear();
    dialog.clear();
  });

  after(async () => {
    await restore();
    dialog.uninstall();
    prompt.clear();
    fs.rmSync(SCRATCH, { recursive: true, force: true });
  });

  describe("New", () => {
    const panels = () =>
      vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .filter(
          (tab) =>
            tab.input instanceof vscode.TabInputWebview &&
            tab.input.viewType.includes("kdbNewConnection"),
        );

    beforeEach(async () => {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      await until(() => panels().length === 0, "the editors to be closed");
    });

    after(async () => {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    });

    it("opens the new connection window", async () => {
      await vscode.commands.executeCommand("kdb.connections.add");
      await until(
        () => panels()[0]?.isActive === true,
        "the new connection panel to open",
      );

      assert.strictEqual(panels()[0].label, "New Connection");
    });

    it("keeps one window however often it is asked for", async () => {
      await vscode.commands.executeCommand("kdb.connections.add");
      await until(() => panels().length === 1, "the new connection panel");

      await vscode.commands.executeCommand("kdb.connections.add");
      await settle();

      assert.strictEqual(panels().length, 1);
      assert.strictEqual(panels()[0].isActive, true);
    });
  });

  describe("Refresh", () => {
    /**
     * Refreshing reloads the tree and asks every connected connection for its
     * metadata again. The reload itself is not observable from out here, but
     * the request is: the stand-in Insights instance records it.
     */
    it("asks the connected connections for their metadata again", async () => {
      await startInsights();
      insights.clear();

      await vscode.commands.executeCommand(
        "kdb.connections.refresh.serverObjects",
      );

      await until(
        () => insights.calls("/meta").length > 0,
        `the metadata to be requested again (requests: ${insights.requests.length})`,
      );
    });
  });

  describe("Import", () => {
    it("reports the file it was not given", async () => {
      dialog.cancels("open", SELECT_FILE);
      await vscode.commands.executeCommand("kdb.connections.import");

      await prompt.untilRaised("No file selected.");
      assert.deepStrictEqual(aliases().includes(KDB_ALIASES[0]), false);
    });

    it("asks for a JSON file", async () => {
      dialog.cancels("open", SELECT_FILE);
      await vscode.commands.executeCommand("kdb.connections.import");

      const [request] = dialog.raised("open");
      assert.deepStrictEqual(
        {
          label: request.options.openLabel,
          many: request.options.canSelectMany,
          filters: request.options.filters,
        },
        {
          label: SELECT_FILE,
          many: false,
          filters: { "JSON Files": ["json"], "All Files": ["*"] },
        },
      );
    });

    it("rejects a file that is not JSON", async () => {
      await importFrom(IMPORT_YAML);

      await prompt.untilRaised("Invalid JSON format.");
      assert.deepStrictEqual(aliases().includes(KDB_ALIASES[0]), false);
    });

    it("rejects JSON that is not a list of connections", async () => {
      const wrong = at("wrong.json");
      fs.writeFileSync(wrong.fsPath, JSON.stringify({ servers: [] }));

      await importFrom(wrong);

      await prompt.untilRaised("JSON does not match the required format.");
    });

    it("rejects a list with no connections in it", async () => {
      const empty = at("empty.json");
      fs.writeFileSync(
        empty.fsPath,
        JSON.stringify({ connections: { KDB: [], Insights: [] } }),
      );

      await importFrom(empty);

      await prompt.untilRaised(
        "There is no KDB or Insights connections to import",
      );
    });

    it("imports the connections in the file", async () => {
      await importFrom(IMPORT);

      await prompt.untilRaised("Connections imported successfully.");

      for (const alias of [...KDB_ALIASES, ...INSIGHTS_ALIASES]) {
        assert.ok(
          aliases().includes(alias),
          `${alias} was not imported (declared: ${aliases()})`,
        );
      }
    });

    it("leaves the connections alone when a duplicate import is cancelled", async () => {
      const known = aliases();
      prompt.answer("importing connections with the same name", "Cancel");

      await importFrom(IMPORT);

      await prompt.untilRaised("importing connections with the same name");
      await settle();

      assert.deepStrictEqual(aliases(), known);
    });

    it("renames the duplicates when asked to duplicate them", async () => {
      prompt.answer("importing connections with the same name", "Duplicate");

      await importFrom(IMPORT);

      await prompt.untilRaised("Connections imported successfully.");
      await until(
        () => aliases().includes("mike-q-1"),
        `the duplicate to be named mike-q-1 (declared: ${aliases()})`,
      );

      assert.deepStrictEqual(declaredAs("mike-q-1"), {
        serverAlias: "mike-q-1",
        serverName: "localhost",
        serverPort: "25103",
        auth: false,
        tls: false,
      });
    });

    /**
     * What an imported connection is declared as, on the settings the import
     * above leaves behind — imported here first if it has not run, so these
     * hold up on their own under a grep or an .only as well.
     */
    describe("Declared", () => {
      before(async () => {
        if (KDB_ALIASES.every((alias) => aliases().includes(alias))) {
          return;
        }
        prompt.clear();
        dialog.clear();

        await importFrom(IMPORT);
        await prompt.untilRaised("Connections imported successfully.");
      });

      it("imports what each connection was declared with", () => {
        assert.deepStrictEqual(declaredAs("mike-q"), {
          serverAlias: "mike-q",
          serverName: "localhost",
          serverPort: "25103",
          auth: false,
          tls: false,
        });

        assert.deepStrictEqual(declaredAs("zulu-insights"), {
          alias: "zulu-insights",
          server: "https://zulu.example.com",
          auth: true,
          realm: "keycloak",
          insecure: false,
        });
      });

      it("keeps the imported credentials out of the settings", () => {
        const secured = declaredAs("alpha-q");

        assert.strictEqual(secured?.username, undefined);
        assert.strictEqual(secured?.password, undefined);
      });
    });
  });

  describe("Export", () => {
    let exported: { written: string; content: any };
    let offered: dialog.Request[];

    before(async () => {
      prompt.clear();
      dialog.clear();
      exported = await exportTo("kdb.connections.export.all", EXPORTED, false);
      offered = [...dialog.requests];
    });

    it("exports every connection it knows about", () => {
      const names = [
        ...exported.content.connections.KDB.map(
          (server: any) => server.serverAlias,
        ),
        ...exported.content.connections.Insights.map(
          (insight: any) => insight.alias,
        ),
      ];

      for (const alias of [...KDB_ALIASES, ...INSIGHTS_ALIASES]) {
        assert.ok(
          names.includes(alias),
          `${alias} was not exported (exported: ${names})`,
        );
      }
    });

    it("asks whether to export the credentials before asking where to save", () => {
      assert.deepStrictEqual(
        offered.map((request) => request.kind).slice(0, 2),
        ["pick", "save"],
      );
    });

    it("offers to save it as JSON", () => {
      const [save] = offered.filter((request) => request.kind === "save");

      assert.deepStrictEqual(
        { prompt: save.prompt, filters: save.options.filters },
        {
          prompt: SAVE_FILE,
          filters: { "JSON Files": ["json"], "All Files": ["*"] },
        },
      );
    });

    /**
     * The exported file on its own terms. Connections are exchanged as JSON —
     * not as the YAML the Insights artefacts in a workspace are written in — and
     * both lists are always present, so an import never has to guess which of
     * the two a file carries.
     */
    it("writes a JSON file in the shape the import accepts", () => {
      const { written, content } = exported;

      assert.deepStrictEqual(Object.keys(content), ["connections"]);
      assert.deepStrictEqual(Object.keys(content.connections).sort(), [
        "Insights",
        "KDB",
      ]);
      assert.ok(Array.isArray(content.connections.KDB));
      assert.ok(Array.isArray(content.connections.Insights));

      assert.strictEqual(written, JSON.stringify(content, null, 2));
    });

    it("opens the file it wrote", async () => {
      await until(
        () =>
          vscode.window.visibleTextEditors.some(
            (editor) => editor.document.uri.fsPath === EXPORTED.fsPath,
          ),
        "the exported file to be opened",
      );
    });

    it("leaves the credentials out unless they were asked for", () => {
      const secured = exported.content.connections.KDB.find(
        (server: any) => server.serverAlias === "alpha-q",
      );

      assert.deepStrictEqual(
        {
          auth: secured.auth,
          username: secured.username,
          password: secured.password,
        },
        { auth: false, username: undefined, password: undefined },
      );
    });

    it("includes the credentials when they were asked for", async () => {
      const { content } = await exportTo(
        "kdb.connections.export.all",
        EXPORTED_WITH_AUTH,
        true,
      );
      const secured = content.connections.KDB.find(
        (server: any) => server.serverAlias === "alpha-q",
      );

      assert.deepStrictEqual(
        {
          auth: secured.auth,
          username: secured.username,
          password: secured.password,
        },
        { auth: true, ...CREDENTIALS },
      );
    });

    it("exports the one connection it was pointed at", async () => {
      const { content } = await exportTo(
        "kdb.connections.export.single",
        EXPORTED_SINGLE,
        false,
        { label: "mike-q [localhost:25103]" },
      );

      assert.deepStrictEqual(content, {
        connections: {
          Insights: [],
          KDB: [
            {
              serverAlias: "mike-q",
              serverName: "localhost",
              serverPort: "25103",
              auth: false,
              tls: false,
            },
          ],
        },
      });
    });

    it("writes nothing when nobody chooses a file", async () => {
      const before = fs.readdirSync(SCRATCH).sort();
      dialog.picks(EXPORT_AUTH, "No");
      dialog.cancels("save", SAVE_FILE);

      await vscode.commands.executeCommand("kdb.connections.export.all");
      await settle();

      assert.deepStrictEqual(
        dialog.raised("save").map((request) => request.prompt),
        [SAVE_FILE],
      );
      assert.deepStrictEqual(fs.readdirSync(SCRATCH).sort(), before);
    });

    it("reports an export nobody asked about the credentials for", async () => {
      dialog.cancels("pick", EXPORT_AUTH);

      await vscode.commands.executeCommand("kdb.connections.export.all");
      await settle();

      assert.deepStrictEqual(
        dialog.requests.map((request) => request.kind),
        ["pick"],
      );
    });
  });
});
