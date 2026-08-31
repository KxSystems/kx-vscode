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
import { ASSEMBLY, DAP, TIER, meta } from "./utils/fixtures";
import { Webview, webview } from "./utils/webview";
import { QueryCommand, QueryMessage } from "../../src/models/messages";
import {
  GET_DATA,
  QSQL,
  QueryFile,
  SQL,
  createQsql,
} from "../../src/models/query";
import { UDA } from "../../src/models/uda";
import { parseQueryList } from "../../src/utils/query";

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

  // What the host sends, built the way the host builds it: parseQueryList puts
  // the three builtins ahead of the connection's UDAs, and parseTables/
  // parseTargets read the rest out of the meta the stand-in Insights instance
  // answers with. Going through the real parse rather than a hand-written list
  // is what puts parseUDAList's reading of the meta under test as well.
  const QUERIES = parseQueryList(meta.payload);
  const TABLES = { trade: ["time", "sym", "price", "size"] };

  // The UDAs the stand-in reports, in the order the meta lists them. The seven
  // .insightsUda ones are the insights-uda-e2e-pkg signatures; the .e2eUda ones
  // cover what that package has no example of — a multi-typed parameter, a
  // required type the form cannot render, a boolean, and a missing return.
  const TABLE_UDA = ".insightsUda.tableAPI";
  const NO_PARAM_UDA = ".insightsUda.noParamAPI";
  const START_END_UDA = ".insightsUda.startEndAPI";
  const MULTIPLIER_UDA = ".insightsUda.singleMultiplierAPI";
  const FULL_UDA = ".insightsUda.fullMultiplierAPI";
  const EVAL_UDA = ".insightsUda.evalAPI";
  const UNQUALIFIED_UDA = "unqualifiedTableAPI";
  const MULTITYPE_UDA = ".e2eUda.multiTypeAPI";
  const BAD_FIELD_UDA = ".e2eUda.badFieldAPI";
  const IDENTITY_UDA = ".e2eUda.identityAPI";
  const FLAG_UDA = ".e2eUda.flagAPI";
  const NO_RETURN_UDA = ".e2eUda.noReturnAPI";

  const UDA_NAMES = [
    TABLE_UDA,
    NO_PARAM_UDA,
    START_END_UDA,
    MULTIPLIER_UDA,
    FULL_UDA,
    EVAL_UDA,
    UNQUALIFIED_UDA,
    MULTITYPE_UDA,
    BAD_FIELD_UDA,
    IDENTITY_UDA,
    FLAG_UDA,
    NO_RETURN_UDA,
  ];
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

  // What stands in place of the parameters when there are none to show, or none
  // that can be shown. Wrapping is collapsed so the assertion reads as a
  // sentence rather than as the markup it came from.
  const notice = () =>
    view.eval(
      (root: string) =>
        __find(root)
          .shadowRoot.querySelector(".notice")
          ?.textContent.replace(/\s+/g, " ")
          .trim(),
      ROOT,
    );

  // The description and return of the query chosen, a line each.
  const details = () =>
    view.eval(
      (root: string) =>
        [...__find(root).shadowRoot.querySelectorAll(".details > div")].map(
          (line: any) => line.textContent.trim(),
        ),
      ROOT,
    );

  // A timestamp parameter, both halves of it. __type goes through execCommand,
  // which a datetime-local input does not take, so the date is set on the
  // element and the event raised by hand. Both are found and driven inside the
  // one eval, because a DOM node cannot cross postMessage.
  const typeTimestamp = (label: string, when: string, ns: string) =>
    view.eval(
      (root: string, name: string, local: string, nanos: string) => {
        const field = [
          ...__find(root).shadowRoot.querySelectorAll("label.field"),
        ].find(
          (candidate: any) =>
            candidate.querySelector(".label")?.textContent.trim() === name,
        );
        if (!field) {
          throw new Error(`no ${name} field on the form`);
        }
        const date = field.querySelector('input[type="datetime-local"]');
        date.value = local;
        date.dispatchEvent(new Event("input", { bubbles: true }));
        __type(field.querySelector("input.nanos"), nanos);
      },
      ROOT,
      label,
      when,
      ns,
    );

  // A row parameter's plain text fields are placeholdered with the field name
  // and sit in a div rather than a label, so __field cannot reach them either.
  const typeRow = (name: string, text: string) =>
    view.eval(
      (root: string, placeholder: string, value: string) => {
        const input = __find(root).shadowRoot.querySelector(
          `input.row-field[placeholder="${placeholder}"]`,
        );
        if (!input) {
          throw new Error(`no ${placeholder} row field on the form`);
        }
        __type(input, value);
      },
      ROOT,
      name,
      text,
    );

  const check = (label: string) =>
    view.eval(
      (root: string, text: string) => {
        const box = [
          ...__find(root).shadowRoot.querySelectorAll(
            '.params input[type="checkbox"]',
          ),
        ].find((candidate: any) =>
          candidate.closest(".label")?.textContent.includes(text),
        );
        if (!box) {
          throw new Error(`no ${text} checkbox on the form`);
        }
        box.click();
      },
      ROOT,
      label,
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
      ...UDA_NAMES,
    ]);
  });

  it("says how many queries the connection has", async () => {
    await show();

    const help = await view.eval(
      (root: string) => __find(`${root}.help`).textContent.trim(),
      VIEW,
    );

    assert.strictEqual(
      help,
      `${QUERIES.length} APIs available on this connection.`,
    );
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

  it("shows only the required parameters of a UDA", async () => {
    await show();
    await pick("API", START_END_UDA);

    assert.deepStrictEqual(await params(), ["startTS *", "endTS *"]);
  });

  it("says a UDA has nothing that has to be filled in", async () => {
    await show();
    await pick("API", NO_PARAM_UDA);

    assert.deepStrictEqual(await params(), []);
    assert.strictEqual(
      await notice(),
      "No parameters There are no required parameters in this UDA.",
    );
  });

  it("offers the connection's tables for a UDA table parameter", async () => {
    await show();
    await pick("API", TABLE_UDA);

    assert.deepStrictEqual(await options("table *"), [
      "Select a table...",
      "trade",
    ]);
  });

  it("offers no columns to a UDA until it is pointed at a table", async () => {
    await show();
    await pick("API", MULTIPLIER_UDA);

    // The UDA names no table of its own, so until the distinguished one is
    // added and set there is nothing to choose a column from, and the field
    // says as much in place of the usual placeholder.
    assert.deepStrictEqual(await options("column"), [
      "Select a table first...",
    ]);

    await pick("Add parameter", "table");
    await pick("table", "trade");

    assert.deepStrictEqual(await options("column"), [
      "Select a column...",
      "price",
      "size",
      "sym",
      "time",
    ]);
  });

  it("narrows the columns to the table a UDA was pointed at", async () => {
    await show({ tables: { ...TABLES, quote: ["time", "bid", "ask"] } });
    await pick("API", FULL_UDA);
    await pick("table *", "quote");

    assert.deepStrictEqual(await options("column"), [
      "Select a column...",
      "ask",
      "bid",
      "time",
    ]);
  });

  it("describes the UDA and what it returns", async () => {
    await show();
    await pick("API", TABLE_UDA);

    assert.deepStrictEqual(await details(), [
      "Example UDA for using just a table parameter",
      "Return description: Specified table",
      "Return type: Table",
    ]);
  });

  it("offers the optional parameters a UDA declares and the distinguished ones", async () => {
    await show();
    await pick("API", TABLE_UDA);

    assert.deepStrictEqual(await options("Add parameter"), [
      "scope",
      "labels",
      "startTS",
      "endTS",
      "inputTZ",
      "outputTZ",
    ]);
  });

  it("keeps the parameter a UDA declares itself over the distinguished one", async () => {
    await show();
    await pick("API", START_END_UDA);

    // startTS and endTS are required here, so they are on the form rather than
    // waiting behind Add parameter as the distinguished pair would be. table is
    // offered even though this UDA declares no such parameter, being one every
    // UDA takes.
    assert.deepStrictEqual(await options("Add parameter"), [
      "scope",
      "table",
      "labels",
      "inputTZ",
      "outputTZ",
    ]);
  });

  it("gives a multi-typed parameter a type to be read as", async () => {
    await show();
    await pick("API", MULTITYPE_UDA);

    assert.deepStrictEqual(await params(), ["value type", "value"]);
    assert.deepStrictEqual(await options("value type"), ["Symbol", "Long"]);
    assert.strictEqual(await picked("value type"), "Symbol");
  });

  it("says a chosen type will not survive Run Query, but only when it will not", async () => {
    await show();
    await pick("API", MULTITYPE_UDA);

    const caveat = () =>
      view.eval(
        (root: string) =>
          __find(root)
            .shadowRoot.querySelector(".multitype .help.warn")
            ?.textContent.replace(/\s+/g, " ")
            .trim(),
        ROOT,
      );

    // Symbol is the first type the UDA registers, so it is what the gateway
    // would cast to anyway; nothing to say.
    assert.strictEqual(await caveat(), undefined);

    await pick("value type", "Long");

    assert.strictEqual(
      await caveat(),
      "Run Query reads this as Symbol: the service gateway casts to the first " +
        "type a UDA registers. Populate Scratchpad reads it as Long.",
    );

    // Long is not a type an empty required value is allowed for, so choosing it
    // stars the label that was bare a moment ago.
    await pick("value * type", "Symbol");
    assert.strictEqual(await caveat(), undefined);
  });

  it("carries what a multi-typed parameter holds into the query it runs", async () => {
    await show();
    await pick("API", MULTITYPE_UDA);
    await type("value", "AAPL");

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(valueOf(run.file.query, "value"), "AAPL");
  });

  it("clears what a multi-typed parameter held when its type changes", async () => {
    await show();
    await pick("API", MULTITYPE_UDA);
    await type("value", "AAPL");

    await pick("value type", "Long");

    // The field takes the star with the type: an empty Long is not one of the
    // types a required parameter may be left empty for, the way Symbol is.
    assert.strictEqual(await field("value *"), "");
  });

  it("refuses a UDA requiring a parameter it cannot render", async () => {
    await show();
    await pick("API", BAD_FIELD_UDA);

    assert.deepStrictEqual(await params(), []);
    assert.strictEqual(
      await notice(),
      "Invalid parameters The UDA you have selected cannot be queried because " +
        "it has required fields with types that are not supported.",
    );
  });

  it("carries the UDA parameters into the query it runs", async () => {
    await show();
    await pick("API", MULTIPLIER_UDA);
    // The column comes from the table, so the table is chosen first.
    await pick("Add parameter", "table");
    await pick("table", "trade");
    await pick("column", "price");
    await type("multiplier *", "3");

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(run.selectedServer, SERVER);
    assert.strictEqual(run.file.query.name, MULTIPLIER_UDA);
    assert.strictEqual(valueOf(run.file.query, "table"), "trade");
    assert.strictEqual(valueOf(run.file.query, "column"), "price");
    assert.strictEqual(valueOf(run.file.query, "multiplier"), "3");
  });

  it("takes a UDA whose name is not in a namespace", async () => {
    await show();
    await pick("API", UNQUALIFIED_UDA);
    await pick("table *", "trade");

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(run.file.query.name, UNQUALIFIED_UDA);
    assert.strictEqual(valueOf(run.file.query, "table"), "trade");
  });

  it("offers every renderable type for a parameter registered as any type", async () => {
    await show();
    await pick("API", IDENTITY_UDA);

    // List is not one of the types an empty required value is allowed for, so
    // unlike the Symbol-first multitype above this one is starred.
    const types = await options("x * type");

    assert.strictEqual(await picked("x * type"), "List");
    assert.ok(!types.includes("Lambda"), `Lambda is offered: ${types}`);
    assert.strictEqual(types.length, 22, `offered ${types}`);
  });

  it("renders a boolean UDA parameter as a checkbox", async () => {
    await show();
    await pick("API", FLAG_UDA);

    assert.deepStrictEqual(await params(), []);
    const box = await view.eval(
      (root: string) =>
        !!__find(root).shadowRoot.querySelector(
          '.params input[type="checkbox"]',
        ),
      ROOT,
    );

    assert.ok(box, "the boolean parameter is not a checkbox");
  });

  it("takes a UDA registered without a return, and the rest with it", async () => {
    await show();
    await pick("API", NO_RETURN_UDA);

    assert.deepStrictEqual(await params(), ["table *"]);
    assert.deepStrictEqual(await details(), [
      "UDA registered without a metaReturn",
    ]);
  });

  it("brings back what was entered for a UDA returned to", async () => {
    await show();
    await pick("API", EVAL_UDA);
    await type("x", "select from trade");

    await pick("API", TABLE_UDA);
    assert.deepStrictEqual(await params(), ["table *"]);

    await pick("API", EVAL_UDA);
    assert.strictEqual(await field("x"), "select from trade");
  });
  it("carries a boolean UDA parameter both ways round", async () => {
    await show();
    await pick("API", FLAG_UDA);

    await check("flag");
    await settled();
    await tool("Run");
    assert.strictEqual(
      valueOf((await sent(QueryCommand.Run)).file.query, "flag"),
      true,
    );

    await forget();
    await check("flag");
    await settled();
    await tool("Run");
    // The reason processUDAParams tests for undefined rather than falsiness: an
    // unticked box is an answer, not a blank.
    assert.strictEqual(
      valueOf((await sent(QueryCommand.Run)).file.query, "flag"),
      false,
    );
  });

  it("joins the two halves of a timestamp parameter into one value", async () => {
    await show();
    await pick("API", START_END_UDA);

    await typeTimestamp("startTS *", "2026-07-03T09:30:00", "123456789");
    await settled();

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(
      valueOf(run.file.query, "startTS"),
      "2026-07-03T09:30:00.123456789",
    );
  });

  it("keeps an optional choice parameter when its dropdown is opened", async () => {
    await show();
    await pick("API", START_END_UDA);
    await pick("Add parameter", "table");

    assert.deepStrictEqual(await params(), ["startTS *", "endTS *", "table"]);

    // A label forwards its click to its first labelable descendant, and a
    // kdb-select is not one — so opening the dropdown used to reach the remove
    // button beside it and delete the parameter.
    await options("table");
    await settled();

    assert.deepStrictEqual(await params(), ["startTS *", "endTS *", "table"]);
  });

  it("returns only the columns chosen, held as a list", async () => {
    await show();
    await pick("API", GET_DATA);
    await pick("table *", "trade");
    await pick("Add parameter", "columns");

    // A multi-select keeps the dropdown open and shows a badge per pick.
    await pick("columns", "price");
    await pick("columns", "sym");

    assert.deepStrictEqual(
      await view.eval(
        (root: string) =>
          [
            ...__find(
              `${root}kdb-select[label="columns"]`,
            ).shadowRoot.querySelectorAll(".badge"),
          ].map((badge: any) => badge.getAttribute("title")),
        VIEW,
      ),
      ["price", "sym"],
    );

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(valueOf(run.file.query, "columns"), '["price","sym"]');
  });

  it("carries a UDA label with several values for one key", async () => {
    await show();
    await pick("API", TABLE_UDA);
    await pick("Add parameter", "labels");

    await typeRow("key", "exchange");
    await typeRow("value", "TSX TSXV");
    await settled();

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(
      valueOf(run.file.query, "labels"),
      '{"exchange":["TSX","TSXV"]}',
    );
  });

  it("carries what was typed into a key-value row", async () => {
    await show();
    await pick("API", GET_DATA);
    await pick("Add parameter", "labels");

    await typeRow("key", "region");
    await typeRow("value", "canada");
    await settled();

    await tool("Run");
    const run = await sent(QueryCommand.Run);

    assert.strictEqual(
      valueOf(run.file.query, "labels"),
      '{"region":"canada"}',
    );
  });

  it("takes a query file whose stored query lists no parameters", async () => {
    // A .kxquery is user-editable JSON, so `params` can simply be absent. The
    // distinguished parameters still have to be offered.
    await show({
      file: {
        version: 1,
        query: { name: TABLE_UDA, description: "" } as unknown as UDA,
      },
    });

    assert.strictEqual(await picked("API"), TABLE_UDA);
    assert.deepStrictEqual(await params(), []);
    assert.deepStrictEqual(await options("Add parameter"), [
      "table",
      "labels",
      "scope",
      "startTS",
      "endTS",
      "inputTZ",
      "outputTZ",
    ]);
  });
});
