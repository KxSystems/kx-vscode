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

import { activate } from "./utils";
import { ASSEMBLY, DAP, TIER } from "./utils/fixtures";
import { Webview, webview } from "./utils/webview";
import { QueryCommand, QueryMessage } from "../../src/models/messages";
import {
  GET_DATA,
  QSQL,
  QueryFile,
  SQL,
  createGetData,
  createQsql,
  createSql,
} from "../../src/models/query";
import { UDA } from "../../src/models/uda";

/**
 * The query editor, driven the way a user drives it: real clicks on the real
 * dropdowns, real typing into the real fields, and the real messages the
 * custom editor exchanges with the page. What is asserted is what crosses the
 * postMessage boundary, which is all QueryEditorProvider ever sees of the form,
 * plus what the form shows of what it was sent.
 *
 * The component's own logic is covered method by method in
 * test/suite/webPanels/webViews/kdbQueryView.test.ts; this is the half that
 * needs a browser — the shadow DOM, the custom select, and the bindings that
 * keep a field and the model in step.
 */
describe("Query editor view", () => {
  let view: Webview;

  const ROOT = "kdb-query-view";
  const VIEW = `${ROOT} >>> `;

  const SERVER = "TESTINSIGHTS";

  // What the host sends: parseQueryList puts the three builtins ahead of the
  // connection's UDAs, and parseTables/parseTargets read the rest out of the
  // meta the stand-in Insights instance answers with.
  const QUERIES = [createQsql(), createSql(), createGetData()];
  const TABLES = { trade: ["time", "sym", "price", "size"] };
  const TARGETS = [
    ASSEMBLY,
    `${ASSEMBLY} ${TIER}`,
    `${ASSEMBLY} ${TIER} ${DAP}`,
  ];

  const select = (label: string) => `${VIEW}kdb-select[label="${label}"]`;

  before(async () => {
    await activate();
  });

  beforeEach(async () => {
    view = await webview(ROOT, {}, "query.js");
  });

  afterEach(() => {
    view.dispose();
  });

  const settled = () =>
    view.eval((root: string) => __find(root).updateComplete, ROOT);

  /**
   * The update the provider posts whenever the document, the connection or the
   * meta changes; nothing is on the page until one arrives. Messages reach the
   * page in the order they were sent, so the eval settled() runs in is
   * dispatched after this one has been handled.
   */
  const show = async (message: Partial<QueryMessage> = {}) => {
    await view.send({
      command: QueryCommand.Update,
      file: { version: 1 },
      queries: QUERIES,
      tables: TABLES,
      targets: TARGETS,
      isMetaLoaded: true,
      selectedServer: SERVER,
      ...message,
    });
    await settled();
  };

  // Picking an API rebuilds the whole form, so the view has to settle before
  // anything is looked for on it.
  const pick = async (label: string, option: string) => {
    await view.eval(
      (path: string, text: string) => __choose(path, text),
      select(label),
      option,
    );
    await settled();
  };

  const options = (label: string) =>
    view.eval((path: string) => __opened(path), select(label));

  const picked = (label: string) =>
    view.eval((path: string) => __find(path).value, select(label));

  // Each toolbar button carries a codicon glyph ahead of its name, so it is
  // found by the name being in it rather than being all of it.
  const tool = (name: string) =>
    view.eval(
      (root: string, text: string) => {
        const button = [
          ...__find(root).shadowRoot.querySelectorAll("button.tool"),
        ].find((candidate: any) => candidate.textContent.includes(text));
        if (!button) {
          throw new Error(`no ${text} button in the toolbar`);
        }
        button.click();
      },
      ROOT,
      name,
    );

  // The parameters on show, labelled as the form labels them: a name, and a
  // star where a value has to be given.
  const params = () =>
    view.eval(
      (root: string) =>
        [
          ...__find(root).shadowRoot.querySelectorAll(
            ".params .field > .label",
          ),
        ].map((label: any) => label.textContent.trim()),
      ROOT,
    );

  const field = (label: string, tag = "input") =>
    view.eval(
      (root: string, text: string, name: string) =>
        __field(root, text, name)?.value,
      ROOT,
      label,
      tag,
    );

  const type = (label: string, text: string, tag = "input") =>
    view.eval(
      (root: string, name: string, value: string, of: string) =>
        __type(__field(root, name, of), value),
      ROOT,
      label,
      text,
      tag,
    );

  // A change is posted every time the form moves on, so a test asking what one
  // carries starts from an empty record rather than picking the last of them.
  const forget = () =>
    view.eval(() => {
      __posted.length = 0;
    });

  // Changes are debounced, so the last message of a kind is whatever the form
  // had settled on by the time it was sent.
  const sent = (command: QueryCommand) =>
    view.eval(async (kind: number) => {
      await __until(
        () => __posted.some((message: any) => message.command === kind),
        `the view to post command ${kind}`,
      );
      return __posted.filter((message: any) => message.command === kind).pop();
    }, command);

  const valueOf = (query: UDA | undefined, name: string) =>
    query?.params.find((param) => param.name === name)?.value;

  const withValues = (query: UDA, values: Record<string, unknown>) => {
    for (const name of Object.keys(values)) {
      const param = query.params.find((item) => item.name === name);
      if (param) {
        param.value = values[name];
      }
    }
    return query;
  };

  it("offers the queries the connection reports", async () => {
    await show();

    assert.deepStrictEqual(await options("API"), [
      "Select an API...",
      QSQL,
      SQL,
      GET_DATA,
    ]);
  });

  it("says how many queries the connection has", async () => {
    await show();

    const help = await view.eval(
      (root: string) => __find(`${root}.help`).textContent.trim(),
      VIEW,
    );

    assert.strictEqual(help, "3 APIs available on this connection.");
  });

  it("shows the required parameters of the query chosen", async () => {
    await show();
    await pick("API", GET_DATA);

    assert.deepStrictEqual(await params(), ["table *", "startTS", "endTS"]);
  });

  it("puts the query the file holds back on the form", async () => {
    await show({
      file: {
        version: 1,
        query: withValues(createQsql(), {
          target: `${ASSEMBLY} ${TIER}`,
          query: "select from trade",
        }),
      },
    });

    assert.strictEqual(await picked("API"), QSQL);
    assert.strictEqual(await picked("target"), `${ASSEMBLY} ${TIER}`);
    assert.strictEqual(await field("query", "textarea"), "select from trade");
  });

  it("offers the connection's tables and their columns", async () => {
    await show();
    await pick("API", GET_DATA);

    assert.deepStrictEqual(await options("table *"), [
      "Select a table...",
      "trade",
    ]);

    await pick("table *", "trade");
    await pick("Add parameter", "groupBy");

    assert.deepStrictEqual(await options("column"), [
      "Select a column...",
      "price",
      "size",
      "sym",
      "time",
    ]);
  });

  it("names the assembly on its own as the distributed target", async () => {
    await show();
    await pick("API", QSQL);

    assert.deepStrictEqual(await options("target"), [
      "Select a target...",
      `${ASSEMBLY} distributed`,
      `${ASSEMBLY} ${TIER}`,
      `${ASSEMBLY} ${TIER} ${DAP}`,
    ]);
  });

  it("adds an optional parameter and takes it away again", async () => {
    await show();
    await pick("API", QSQL);

    assert.deepStrictEqual(await params(), ["target", "query"]);

    await pick("Add parameter", "agg");
    assert.deepStrictEqual(await params(), ["target", "query", "agg"]);

    await view.eval(
      (root: string) =>
        __find(`${root}button.remove[title="Remove agg"]`).click(),
      VIEW,
    );
    await settled();

    assert.deepStrictEqual(await params(), ["target", "query"]);
  });

  it("carries what was typed into the query it runs", async () => {
    await show();
    await pick("API", SQL);
    await type("query", "select * from trade", "textarea");

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(run.selectedServer, SERVER);
    assert.strictEqual(run.file.query.name, SQL);
    assert.strictEqual(valueOf(run.file.query, "query"), "select * from trade");
  });

  it("carries the same query into the scratchpad", async () => {
    await show();
    await pick("API", SQL);
    await type("query", "select * from trade", "textarea");

    await tool("Populate Scratchpad");
    const populate = await sent(QueryCommand.Populate);

    assert.strictEqual(populate.selectedServer, SERVER);
    assert.strictEqual(
      valueOf(populate.file.query, "query"),
      "select * from trade",
    );
  });

  it("writes what was typed back to the document as it is typed", async () => {
    await show();
    await pick("API", SQL);
    await forget();
    await type("query", "select * from trade", "textarea");

    const change = await sent(QueryCommand.Change);

    assert.strictEqual(change.file.version, 1);
    assert.strictEqual(
      valueOf(change.file.query, "query"),
      "select * from trade",
    );
  });

  it("asks the extension host for the connection picker", async () => {
    await show();
    await tool("Connection");

    assert.deepStrictEqual(await sent(QueryCommand.Connection), {
      command: QueryCommand.Connection,
    });
  });

  it("asks for the meta of the connection it is on", async () => {
    await show();
    await tool("Refresh");

    assert.deepStrictEqual(await sent(QueryCommand.Refresh), {
      command: QueryCommand.Refresh,
      selectedServer: SERVER,
    });
  });

  it("saves the form as it stands", async () => {
    await show();
    await pick("API", SQL);
    await type("query", "select * from trade", "textarea");

    await tool("Save");
    const save = await sent(QueryCommand.Save);

    assert.strictEqual(
      valueOf(save.file.query, "query"),
      "select * from trade",
    );
  });

  it("brings back what was entered for a query returned to", async () => {
    await show();
    await pick("API", QSQL);
    await type("query", "select from trade", "textarea");

    await pick("API", GET_DATA);
    assert.strictEqual(await field("query", "textarea"), undefined);

    await pick("API", QSQL);
    assert.strictEqual(await field("query", "textarea"), "select from trade");
  });

  it("keeps the API the connection does not list, and says so", async () => {
    const file: QueryFile = {
      version: 1,
      query: withValues(createQsql(), { query: "select from trade" }),
    };

    await show({ file });
    await show({
      file,
      queries: [],
      tables: {},
      targets: [],
      isMetaLoaded: false,
      selectedServer: "",
    });

    assert.strictEqual(await picked("API"), QSQL);

    const help = await view.eval(
      (root: string) => __find(`${root}.help`).textContent.trim(),
      VIEW,
    );

    assert.strictEqual(
      help,
      "This API is not available on the selected connection.",
    );
  });
});
