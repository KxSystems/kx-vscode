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

/* eslint @typescript-eslint/no-explicit-any: 0 */

import "../../../fixtures";
import * as assert from "assert";
import * as sinon from "sinon";

import { QueryCommand, QueryMessage } from "../../../../src/models/messages";
import {
  createGetData,
  createQsql,
  createSql,
} from "../../../../src/models/query";
import { ParamFieldType, UDA, UDAParam } from "../../../../src/models/uda";
import { KdbQueryView } from "../../../../src/webview/components/kdbQueryView";

describe("KdbQueryView", () => {
  let view: KdbQueryView;

  function createParam(param: Partial<UDAParam> = {}): UDAParam {
    return {
      name: "param",
      description: "A parameter.",
      isReq: false,
      type: [-11],
      typeStrings: ["Symbol"],
      fieldType: ParamFieldType.Text,
      isVisible: true,
      ...param,
    };
  }

  function createUDA(uda: Partial<UDA> = {}): UDA {
    return {
      name: "test.uda",
      description: "A UDA.",
      params: [createParam()],
      return: { type: ["Table"], description: "The result." },
      ...uda,
    };
  }

  function createUpdate(msg: Partial<QueryMessage> = {}) {
    return <MessageEvent<QueryMessage>>(<unknown>{
      data: <QueryMessage>{
        command: QueryCommand.Update,
        file: { version: 1 },
        queries: [],
        isMetaLoaded: true,
        selectedServer: "server",
        ...msg,
      },
    });
  }

  function markup(template: any): string {
    if (!template || typeof template !== "object") {
      return String(template ?? "");
    }
    if (Array.isArray(template)) {
      return template.map(markup).join("");
    }
    const strings = (template.strings || []).join(" ");
    return strings + (template.values || []).map(markup).join("");
  }

  function createValueEvent(value: string) {
    return <Event>(<unknown>{ target: { value } });
  }

  beforeEach(() => {
    view = new KdbQueryView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("message", () => {
    it("should update from the extension host", () => {
      const uda = createUDA();
      view.message(
        createUpdate({ queries: [uda], file: { version: 1, query: uda } }),
      );
      assert.strictEqual(view.query?.name, "test.uda");
      assert.strictEqual(view.queries.length, 1);
      assert.strictEqual(view.selectedServer, "server");
    });

    it("should ignore other commands", () => {
      const event = createUpdate();
      event.data.command = QueryCommand.Change;
      view.message(event);
      assert.strictEqual(view.selectedServer, "");
    });
  });

  describe("file", () => {
    it("should return a versioned UDA file", () => {
      const uda = createUDA();
      view.query = uda;
      assert.deepStrictEqual(view.file, { version: 1, query: uda });
    });
  });

  describe("handleQueryChange", () => {
    beforeEach(() => {
      view.queries = [createUDA()];
    });

    it("should select a UDA by name and add the distinguished params", () => {
      view.handleQueryChange(createValueEvent("test.uda"));
      assert.strictEqual(view.query?.name, "test.uda");
      assert.ok(view.query?.params.some((param) => param.name === "startTS"));
    });

    it("should not mutate the UDA in the connection list", () => {
      view.handleQueryChange(createValueEvent("test.uda"));
      assert.strictEqual(view.queries[0].params.length, 1);
    });

    it("should ignore a name that matches no UDA", () => {
      view.handleQueryChange(createValueEvent("test.u"));
      assert.strictEqual(view.query, undefined);
    });

    it("should clear the selection when emptied", () => {
      view.handleQueryChange(createValueEvent("test.uda"));
      view.handleQueryChange(createValueEvent(""));
      assert.strictEqual(view.query, undefined);
    });
  });

  describe("drafts", () => {
    function named(name: string) {
      return view.query!.params.find((param) => param.name === name)!;
    }

    function select(name: string) {
      view.handleQueryChange(createValueEvent(name));
    }

    beforeEach(() => {
      view.queries = [createGetData(), createQsql(), createSql()];
    });

    it("should bring back what was entered for an API returned to", () => {
      select(".kxi.getData");
      view.setParam(named("table"), "trades");
      view.setRows(named("filter"), [["price", ">", "100"]]);

      select("SQL");
      assert.strictEqual(view.query?.name, "SQL");

      select(".kxi.getData");
      assert.strictEqual(named("table").value, "trades");
      assert.strictEqual(named("filter").isVisible, true);
      assert.deepStrictEqual(view.rowsOf(named("filter")), [
        ["price", ">", "100"],
      ]);
    });

    it("should carry the APIs not selected in the file", () => {
      select(".kxi.getData");
      view.setParam(named("table"), "trades");
      select("SQL");

      assert.deepStrictEqual(view.file.drafts, [
        {
          name: ".kxi.getData",
          params: [
            { name: "table", value: "trades" },
            { name: "startTS" },
            { name: "endTS" },
          ],
        },
      ]);
    });

    it("should hold the selected API in one place only", () => {
      select(".kxi.getData");
      view.setParam(named("table"), "trades");
      select("SQL");
      select(".kxi.getData");

      assert.strictEqual(view.file.drafts, undefined);
    });

    it("should not add a key to a file that never switched API", () => {
      select("SQL");
      view.setParam(named("query"), "select from trades");

      assert.strictEqual(view.file.drafts, undefined);
    });

    it("should keep what was entered when the API is cleared", () => {
      select("SQL");
      view.setParam(named("query"), "select from trades");
      select("");

      assert.strictEqual(view.query, undefined);
      assert.deepStrictEqual(view.file.drafts, [
        {
          name: "SQL",
          params: [{ name: "query", value: "select from trades" }],
        },
      ]);
    });

    it("should take the drafts an opened file holds", () => {
      view.message(
        createUpdate({
          file: {
            version: 1,
            query: createSql(),
            drafts: [
              { name: "qSQL", params: [{ name: "query", value: "trades" }] },
            ],
          },
          queries: [createGetData(), createQsql(), createSql()],
        }),
      );

      select("qSQL");
      assert.strictEqual(named("query").value, "trades");
    });

    it("should not read the rows of the API left as the arriving one's", () => {
      select(".kxi.getData");
      view.setRows(named("labels"), [["region", "emea"]]);

      select("qSQL");
      assert.deepStrictEqual(view.rowsOf(named("labels")), [["", ""]]);
    });
  });

  describe("params", () => {
    beforeEach(() => {
      view.query = createUDA({
        params: [
          createParam({ name: "required", isReq: true }),
          createParam({ name: "optional", isVisible: false }),
          createParam({
            name: "scope",
            isVisible: false,
            isDistinguised: true,
            fieldType: ParamFieldType.JSON,
          }),
        ],
      });
    });

    it("should only list the visible params", () => {
      assert.deepStrictEqual(
        view.visibleParams().map((param) => param.name),
        ["required"],
      );
    });

    it("should split the hidden params by kind", () => {
      assert.deepStrictEqual(
        view.hiddenParams(false).map((param) => param.name),
        ["optional"],
      );
      assert.deepStrictEqual(
        view.hiddenParams(true).map((param) => param.name),
        ["scope"],
      );
    });

    it("should show a param picked from the add list", () => {
      const target = { value: "optional" };
      view.handleAddParam(<Event>(<unknown>{ target }));
      assert.strictEqual(view.query?.params[1].isVisible, true);
      assert.strictEqual(target.value, "");
    });

    it("should hide and clear a deleted param", () => {
      const param = view.query!.params[1];
      param.isVisible = true;
      param.value = "value";
      param.selectedMultiTypeString = "Symbol";
      view.handleDeleteParam(param);
      assert.strictEqual(param.isVisible, false);
      assert.strictEqual(param.value, undefined);
      assert.strictEqual(param.selectedMultiTypeString, undefined);
    });

    it("should store a param value", () => {
      const param = view.query!.params[0];
      view.setParam(param, "value");
      assert.strictEqual(param.value, "value");
    });

    it("should join the halves of a timestamp", () => {
      const param = view.query!.params[0];
      view.setTimestamp(param, "2024-01-01T10:20:30", "123");
      assert.strictEqual(param.value, "2024-01-01T10:20:30.123000000");
    });
  });

  describe("isRequired", () => {
    it("should not mark an optional param", () => {
      assert.strictEqual(view.isRequired(createParam()), false);
    });

    it("should not mark a required param of a type that may be empty", () => {
      assert.strictEqual(
        view.isRequired(createParam({ isReq: true, type: [-11] })),
        false,
      );
    });

    it("should mark a required table param", () => {
      assert.strictEqual(
        view.isRequired(createParam({ name: "table", isReq: true })),
        true,
      );
    });

    it("should mark a required param of a type that may not be empty", () => {
      assert.strictEqual(
        view.isRequired(createParam({ isReq: true, type: [-9] })),
        true,
      );
    });

    it("should follow the selected type of a multitype param", () => {
      const param = createParam({
        isReq: true,
        fieldType: ParamFieldType.MultiType,
        selectedMultiTypeString: "Float",
      });
      assert.strictEqual(view.isRequired(param), true);
      param.selectedMultiTypeString = "Symbol";
      assert.strictEqual(view.isRequired(param), false);
    });
  });

  describe("paramHelp", () => {
    it("should join the parts it has", () => {
      assert.strictEqual(
        view.paramHelp(createParam({ isDistinguised: true })),
        "Distinguished | Type: Symbol | A parameter.",
      );
    });

    it("should take the type it is given", () => {
      assert.strictEqual(
        view.paramHelp(createParam({ description: "" }), "Float"),
        "Type: Float",
      );
    });
  });

  describe("messages", () => {
    let postMessage: sinon.SinonStub;

    beforeEach(() => {
      postMessage = sinon.stub(view, "postMessage");
      view.selectedServer = "server";
    });

    it("should flush a pending change before running", () => {
      view.query = createUDA();
      view.requestChange();
      view.run();
      assert.strictEqual(
        postMessage.firstCall.args[0].command,
        QueryCommand.Change,
      );
      assert.strictEqual(
        postMessage.secondCall.args[0].command,
        QueryCommand.Run,
      );
    });

    it("should ask the extension host for the connection picker", () => {
      view.pickConnection();
      assert.deepStrictEqual(postMessage.firstCall.args[0], {
        command: QueryCommand.Connection,
      });
    });

    it("should post refresh without the file", () => {
      view.refresh();
      assert.deepStrictEqual(postMessage.firstCall.args[0], {
        command: QueryCommand.Refresh,
        selectedServer: "server",
      });
    });
  });

  describe("getData", () => {
    beforeEach(() => {
      view.query = createGetData();
    });

    it("should show the required parameters and hide the rest", () => {
      assert.deepStrictEqual(
        view.visibleParams().map((param) => param.name),
        ["table", "startTS", "endTS"],
      );
    });

    it("should render a select for every column field of a row builder", () => {
      view.tables = { trades: ["time", "price"] };
      for (const name of ["filter", "groupBy", "sortCols"]) {
        const param = view.query!.params.find((item) => item.name === name)!;
        const rendered = markup(view.renderParam(param));
        assert.ok(
          rendered.includes("<kdb-select"),
          `${name} should offer its columns as a searchable select`,
        );
      }
    });

    it("should name what each row field selects", () => {
      view.tables = { trades: ["time", "price"] };
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      const rendered = markup(view.renderParam(filter));
      assert.ok(rendered.includes("Select a column..."));
      assert.ok(rendered.includes("Select an operator..."));
    });

    it("should render a select for the table parameter", () => {
      view.tables = { trades: ["time"] };
      const table = view.query!.params.find((param) => param.name === "table")!;
      assert.ok(markup(view.renderParam(table)).includes("<kdb-select"));
    });

    it("should offer column dropdowns inside a row builder", () => {
      view.tables = { trades: ["time", "price"] };
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      const column = filter.rows!.find((field) => field.name === "column")!;
      assert.strictEqual(column.source, "columns");
      assert.deepStrictEqual(view.suggestions(column.source!), [
        "price",
        "time",
      ]);
      assert.ok(view.renderParam(filter));
    });

    it("should render a row builder for a list parameter", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      assert.ok(filter.rows);
      assert.ok(view.renderParam(filter));
    });

    it("should render a dropdown for a parameter with choices", () => {
      const fill = view.query!.params.find((param) => param.name === "fill")!;
      assert.deepStrictEqual(fill.choices, ["zero", "forward"]);
      assert.ok(view.renderParam(fill));
    });

    it("should offer the connection's tables for the table parameter", () => {
      view.tables = { trades: ["time", "price"], quotes: ["time", "bid"] };
      assert.deepStrictEqual(view.suggestions("tables"), ["quotes", "trades"]);
    });

    it("should offer the columns of the table the query names", () => {
      view.tables = { trades: ["time", "price"], quotes: ["bid"] };
      const table = view.query!.params.find((param) => param.name === "table")!;
      table.value = "trades";
      assert.deepStrictEqual(view.suggestions("columns"), ["price", "time"]);
    });

    it("should offer every column until a table is chosen", () => {
      view.tables = { trades: ["time", "price"], quotes: ["bid", "time"] };
      assert.deepStrictEqual(view.suggestions("columns"), [
        "bid",
        "price",
        "time",
      ]);
    });

    it("should render a dropdown for a parameter with a source", () => {
      const table = view.query!.params.find((param) => param.name === "table")!;
      assert.strictEqual(table.source, "tables");
      assert.ok(view.renderParam(table));
    });

    it("should keep a value the connection does not list", () => {
      view.tables = { trades: [] };
      assert.ok(view.renderSelect("gone", ["trades"], () => {}));
    });

    it("should store rows as the value the request wants", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      view.setRows(filter, [["price", ">", "100"]]);
      assert.strictEqual(filter.value, '[[">","price",100]]');
    });

    it("should add a row each time the parameter is chosen again", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      const choose = () =>
        view.handleAddParam(<Event>(<unknown>{ target: { value: "filter" } }));

      choose();
      assert.strictEqual(filter.isVisible, true);
      assert.strictEqual(view.rowsOf(filter).length, 1);

      choose();
      assert.strictEqual(view.rowsOf(filter).length, 2);
    });

    it("should keep offering a list parameter that is already shown", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      filter.isVisible = true;
      assert.ok(
        view.hiddenParams(false).some((param) => param.name === "filter"),
      );
    });

    it("should drop the parameter when its last row goes", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      view.setRows(filter, [["price", ">", "100"]]);
      filter.isVisible = true;

      view.removeRow(filter, 0);

      assert.strictEqual(filter.isVisible, false);
      assert.strictEqual(filter.value, undefined);
    });

    it("should keep the other rows when one goes", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      filter.isVisible = true;
      view.setRows(filter, [
        ["price", ">", "100"],
        ["sym", "in", "AAPL"],
      ]);

      view.removeRow(filter, 0);

      assert.deepStrictEqual(view.rowsOf(filter), [["sym", "in", "AAPL"]]);
    });

    it("should clear the value when the last row is emptied", () => {
      const filter = view.query!.params.find(
        (param) => param.name === "filter",
      )!;
      view.setRows(filter, [["price", ">", "100"]]);
      view.setRows(filter, [["", ">", ""]]);
      assert.strictEqual(filter.value, "");
    });
  });

  describe("text queries", () => {
    function named(name: string) {
      return view.query!.params.find((param) => param.name === name)!;
    }

    it("should select qSQL without adding the distinguished params", () => {
      view.queries = [createQsql()];
      view.handleQueryChange(createValueEvent("qSQL"));
      assert.deepStrictEqual(
        view.query?.params.map((param) => param.name),
        ["target", "query", "agg", "labels"],
      );
    });

    it("should show the target and the query straight away", () => {
      view.query = createQsql();
      assert.deepStrictEqual(
        view.visibleParams().map((param) => param.name),
        ["target", "query"],
      );
    });

    it("should size the query box for a query and the agg for a function", () => {
      const textareaRows = (template: any) =>
        (template.values || []).find(
          (value: unknown) => typeof value === "number",
        );

      view.query = createQsql();
      assert.strictEqual(textareaRows(view.renderParam(named("query"))), 10);
      assert.strictEqual(textareaRows(view.renderParam(named("agg"))), 4);
    });

    it("should not mark either field required or removable", () => {
      view.query = createQsql();
      for (const name of ["target", "query"]) {
        assert.strictEqual(view.isRequired(named(name)), false);
        assert.strictEqual(markup(view.renderRemove(named(name))).trim(), "");
      }
    });

    it("should offer the connection's targets for the target", () => {
      view.query = createQsql();
      view.targets = ["assembly rdb", "assembly rdb rdb-1"];
      assert.strictEqual(named("target").source, "targets");
      assert.deepStrictEqual(view.suggestions("targets"), [
        "assembly rdb",
        "assembly rdb rdb-1",
      ]);
      assert.ok(
        markup(view.renderParam(named("target"))).includes("<kdb-select"),
      );
    });

    it("should keep a target the connection does not list", () => {
      view.query = createQsql();
      view.targets = ["assembly rdb"];
      named("target").value = "gone rdb";
      assert.ok(markup(view.renderParam(named("target"))).includes("gone rdb"));
    });

    it("should render the query as a code field", () => {
      view.query = createSql();
      const rendered = markup(view.renderParam(named("query")));
      assert.ok(rendered.includes("<textarea"));
      assert.ok(rendered.includes("code"));
    });

    it("should store what is typed into the query", () => {
      view.query = createSql();
      view.setParam(named("query"), "select * from trade");
      assert.strictEqual(
        view.file.query?.params[0].value,
        "select * from trade",
      );
    });

    it("should not offer to add a parameter", () => {
      view.query = createSql();
      assert.strictEqual(markup(view.renderAddParam()).trim(), "");
      assert.ok(view.renderParams());
    });
  });

  describe("render", () => {
    it("should render without a UDA", () => {
      view.message(createUpdate());
      assert.ok(view.render());
    });

    it("should render every param field type", () => {
      const types = [
        ParamFieldType.Text,
        ParamFieldType.Number,
        ParamFieldType.Boolean,
        ParamFieldType.JSON,
        ParamFieldType.Timestamp,
        ParamFieldType.MultiType,
      ];
      view.query = createUDA({
        params: types.map((fieldType, index) =>
          createParam({
            name: `param${index}`,
            fieldType,
            typeStrings: ["Symbol", "Float"],
            multiFieldTypes: [
              { Symbol: ParamFieldType.Text },
              { Float: ParamFieldType.Number },
            ],
          }),
        ),
      });
      assert.ok(view.render());
    });

    it("should render the incompatible UDA notice", () => {
      view.query = createUDA({ incompatibleError: "badField" });
      assert.ok(view.renderParams());
    });
  });
});
