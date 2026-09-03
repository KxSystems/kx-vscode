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

import * as assert from "assert";

import { DataSourceTypes } from "../../../src/models/dataSource";
import { MetaObjectPayload } from "../../../src/models/meta";
import {
  applyDraft,
  createGetData,
  createQsql,
  createRow,
  createSql,
  parseRows,
  serializeRows,
  toDraft,
} from "../../../src/models/query";
import {
  UDA,
  UDAParam,
  UDA_DISTINGUISHED_PARAMS,
} from "../../../src/models/uda";
import {
  buildGetDataPayload,
  parseQueryList,
  parseTables,
  parseTargets,
  toDataSourceFile,
} from "../../../src/utils/query";

describe("query", () => {
  function getData(values: { [name: string]: unknown } = {}) {
    const query = createGetData();
    for (const [name, value] of Object.entries(values)) {
      const param = query.params.find((item) => item.name === name);
      if (param) {
        param.value = value;
        param.isVisible = true;
      }
    }
    return query;
  }

  function param(query: UDA, name: string) {
    return query.params.find((item) => item.name === name) as UDAParam;
  }

  describe("parseTables", () => {
    it("should map each table to its columns", () => {
      const tables = parseTables(<MetaObjectPayload>{
        schema: [
          {
            table: "trades",
            assembly: "a",
            type: "partitioned",
            columns: [{ column: "time" }, { column: "price" }],
          },
        ],
      });
      assert.deepStrictEqual(tables, { trades: ["time", "price"] });
    });

    it("should union a table defined by more than one assembly", () => {
      const tables = parseTables(<MetaObjectPayload>{
        schema: [
          {
            table: "trades",
            assembly: "a",
            type: "partitioned",
            columns: [{ column: "time" }, { column: "price" }],
          },
          {
            table: "trades",
            assembly: "b",
            type: "partitioned",
            columns: [{ column: "price" }, { column: "size" }],
          },
        ],
      });
      assert.deepStrictEqual(tables, { trades: ["time", "price", "size"] });
    });

    it("should read nothing out of an empty meta", () => {
      assert.deepStrictEqual(parseTables(<MetaObjectPayload>{}), {});
    });
  });

  describe("parseQueryList", () => {
    it("should offer the built in queries even with no meta", () => {
      const queries = parseQueryList(<MetaObjectPayload>{});
      assert.deepStrictEqual(
        queries.map((query) => query.name),
        ["qSQL", "SQL", ".kxi.getData"],
      );
    });

    it("should offer qSQL first and the UDAs last", () => {
      const queries = parseQueryList(<MetaObjectPayload>{
        api: [
          { api: ".kxi.myUda", uda: true, params: [], return: { type: [] } },
        ],
      });
      assert.strictEqual(queries[0].name, "qSQL");
      assert.strictEqual(queries[3].name, ".kxi.myUda");
      assert.strictEqual(queries.length, 4);
    });

    it("should offer preview where the connection has it, beside getData", () => {
      const queries = parseQueryList(<MetaObjectPayload>{
        api: [
          { api: ".kxi.preview", uda: false, params: [], return: { type: 98 } },
          { api: ".kxi.myUda", uda: true, params: [], return: { type: [] } },
        ],
      });

      assert.deepStrictEqual(
        queries.map((query) => query.name),
        ["qSQL", "SQL", ".kxi.getData", ".kxi.preview", ".kxi.myUda"],
      );
    });

    it("should leave preview out of a connection that does not answer it", () => {
      const queries = parseQueryList(<MetaObjectPayload>{
        api: [{ api: ".kxi.qsql", uda: false, params: [] }],
      });

      assert.ok(!queries.some((query) => query.name === ".kxi.preview"));
    });
  });

  describe("parseTargets", () => {
    it("should offer a tier and its DAP processes", () => {
      const targets = parseTargets(<MetaObjectPayload>{
        dap: [
          { assembly: "assembly-qe", instance: "rdb", dap: "rdb-1:1234" },
          { assembly: "assembly-qe", instance: "hdb", dap: "hdb-1:1234" },
        ],
      });
      assert.deepStrictEqual(targets, [
        "assembly hdb",
        "assembly hdb hdb-1",
        "assembly rdb",
        "assembly rdb rdb-1",
      ]);
    });

    it("should offer a tier only once", () => {
      const targets = parseTargets(<MetaObjectPayload>{
        dap: [
          { assembly: "assembly-qe", instance: "rdb", dap: "rdb-1:1234" },
          { assembly: "assembly-qe", instance: "rdb", dap: "rdb-2:1234" },
        ],
      });
      assert.deepStrictEqual(targets, [
        "assembly rdb",
        "assembly rdb rdb-1",
        "assembly rdb rdb-2",
      ]);
    });

    it("should offer the assembly on its own from 1.13", () => {
      const targets = parseTargets(
        <MetaObjectPayload>{
          dap: [
            { assembly: "assembly-qe", instance: "rdb", dap: "rdb-1:1234" },
          ],
        },
        "1.13",
      );
      assert.deepStrictEqual(targets, [
        "assembly",
        "assembly rdb",
        "assembly rdb rdb-1",
      ]);
    });

    it("should leave the assembly out before 1.13", () => {
      const targets = parseTargets(
        <MetaObjectPayload>{
          dap: [{ assembly: "assembly-qe", instance: "rdb" }],
        },
        "1.12",
      );
      assert.deepStrictEqual(targets, ["assembly rdb"]);
    });

    it("should read nothing out of an empty meta", () => {
      assert.deepStrictEqual(parseTargets(<MetaObjectPayload>{}, "1.13"), []);
    });
  });

  describe("buildGetDataPayload", () => {
    it("should send only the parameters that are filled in", () => {
      const payload = buildGetDataPayload(getData({ table: "trades" }));
      assert.deepStrictEqual(payload, { table: "trades" });
    });

    it("should skip a parameter that was never added", () => {
      const query = getData({ table: "trades" });
      param(query, "fill").value = "zero";
      param(query, "fill").isVisible = false;
      assert.deepStrictEqual(buildGetDataPayload(query), { table: "trades" });
    });

    it("should send a nanosecond timestamp as it stands", () => {
      const payload = buildGetDataPayload(
        getData({ startTS: "2024-01-01T10:20:30.123456789" }),
      );
      assert.strictEqual(payload.startTS, "2024-01-01T10:20:30.123456789");
    });

    it("should fill out a timestamp that stops short", () => {
      const payload = buildGetDataPayload(getData({ endTS: "2024-01-01" }));
      assert.match(payload.endTS || "", /^\d{4}-\d{2}-\d{2}T[\d:]{8}\.\d{9}$/);
    });

    it("should send the structured parameters as JSON values", () => {
      const payload = buildGetDataPayload(
        getData({
          filter: '[[">","price",100]]',
          groupBy: '["sym"]',
          labels: '{"region":"emea"}',
        }),
      );
      assert.deepStrictEqual(payload.filter, [[">", "price", 100]]);
      assert.deepStrictEqual(payload.groupBy, ["sym"]);
      assert.deepStrictEqual(payload.labels, { region: "emea" });
    });

    it("should send the timezone parameters", () => {
      const payload = buildGetDataPayload(
        getData({ inputTZ: "America/New_York", outputTZ: "UTC" }),
      );
      assert.strictEqual((payload as any).inputTZ, "America/New_York");
      assert.strictEqual((payload as any).outputTZ, "UTC");
    });

    it("should send the limit as a number", () => {
      const payload = buildGetDataPayload(getData({ limit: "-500" }));
      assert.strictEqual(payload.limit, -500);
    });

    it("should refuse a structured parameter that is not JSON", () => {
      assert.throws(
        () => buildGetDataPayload(getData({ filter: "price > 100" })),
        /filter parameter is not valid JSON/,
      );
    });
  });

  describe("toDataSourceFile", () => {
    it("should adapt getData into an API datasource", () => {
      const file = toDataSourceFile({
        version: 1,
        query: getData({ table: "trades" }),
      });
      assert.strictEqual(file.dataSource.selectedType, DataSourceTypes.API);
      assert.deepStrictEqual(file.dataSource.api.payload, { table: "trades" });
    });

    it("should adapt a UDA into a UDA datasource", () => {
      const uda = <UDA>{ name: "test.uda", description: "", params: [] };
      const file = toDataSourceFile({ version: 1, query: uda });
      assert.strictEqual(file.dataSource.selectedType, DataSourceTypes.UDA);
      assert.strictEqual(file.dataSource.uda, uda);
    });

    it("should adapt qSQL into a QSQL datasource", () => {
      const query = createQsql();
      param(query, "query").value = "select from trade";
      param(query, "target").value = "assembly rdb";
      const file = toDataSourceFile({ version: 1, query });
      assert.strictEqual(file.dataSource.selectedType, DataSourceTypes.QSQL);
      assert.deepStrictEqual(file.dataSource.qsql, {
        query: "select from trade",
        selectedTarget: "assembly rdb",
      });
    });

    it("should adapt SQL into a SQL datasource", () => {
      const query = createSql();
      param(query, "query").value = "select * from trade";
      const file = toDataSourceFile({ version: 1, query });
      assert.strictEqual(file.dataSource.selectedType, DataSourceTypes.SQL);
      assert.deepStrictEqual(file.dataSource.sql, {
        query: "select * from trade",
      });
    });

    it("should carry the qSQL agg and labels once they are added", () => {
      const query = createQsql();
      param(query, "query").value = "select from trade";
      param(query, "target").value = "assembly rdb";
      const agg = param(query, "agg");
      agg.value = "distinct";
      agg.isVisible = true;
      const labels = param(query, "labels");
      labels.value = '{"kxname":"db"}';
      labels.isVisible = true;
      const file = toDataSourceFile({ version: 1, query });
      assert.deepStrictEqual(file.dataSource.qsql, {
        query: "select from trade",
        selectedTarget: "assembly rdb",
        agg: "distinct",
        labels: { kxname: "db" },
      });
    });

    it("should leave out a qSQL agg that was added and left empty", () => {
      const query = createQsql();
      param(query, "agg").isVisible = true;
      const file = toDataSourceFile({ version: 1, query });
      assert.deepStrictEqual(file.dataSource.qsql, {
        query: "",
        selectedTarget: "",
      });
    });

    it("should reject qSQL labels that are not valid JSON", () => {
      const query = createQsql();
      const labels = param(query, "labels");
      labels.value = "not json";
      labels.isVisible = true;
      assert.throws(
        () => toDataSourceFile({ version: 1, query }),
        /labels parameter is not valid JSON/,
      );
    });

    it("should adapt a text query that was left empty", () => {
      const file = toDataSourceFile({ version: 1, query: createQsql() });
      assert.deepStrictEqual(file.dataSource.qsql, {
        query: "",
        selectedTarget: "",
      });
    });
  });

  describe("rows", () => {
    it("should start a row with the first choice of each field", () => {
      const query = getData();
      assert.deepStrictEqual(createRow(param(query, "filter")), ["", "in", ""]);
      assert.deepStrictEqual(createRow(param(query, "groupBy")), [""]);
    });

    it("should read filter rows back out of the value", () => {
      const query = getData({ filter: '[[">","price",100]]' });
      assert.deepStrictEqual(parseRows(param(query, "filter")), [
        ["price", ">", "100"],
      ]);
    });

    it("should join a list of filter values into one field", () => {
      const query = getData({ filter: '[["in","sym",["AAPL","MSFT"]]]' });
      assert.deepStrictEqual(parseRows(param(query, "filter")), [
        ["sym", "in", "AAPL MSFT"],
      ]);
    });

    it("should read a single column parameter as one field per row", () => {
      const query = getData({ groupBy: '["sym","date"]' });
      assert.deepStrictEqual(parseRows(param(query, "groupBy")), [
        ["sym"],
        ["date"],
      ]);
    });

    it("should read labels as key and value", () => {
      const query = getData({ labels: '{"region":"emea"}' });
      assert.deepStrictEqual(parseRows(param(query, "labels")), [
        ["region", "emea"],
      ]);
    });

    it("should read nothing out of an empty or broken value", () => {
      const query = getData();
      assert.deepStrictEqual(parseRows(param(query, "filter")), []);
      param(query, "filter").value = "not json";
      assert.deepStrictEqual(parseRows(param(query, "filter")), []);
    });

    it("should write filter rows back, numbers where they parse", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["price", ">", "100"]]),
        '[[">","price",100]]',
      );
    });

    it("should send chosen columns under the agg key", () => {
      // getData has no column projection of its own; agg takes "column(s) to
      // select" as a plain symbol list.
      const query = getData({ columns: '["price","size"]' });

      assert.deepStrictEqual(buildGetDataPayload(query).agg, ["price", "size"]);
    });

    it("should refuse columns and agg together", () => {
      const query = getData({
        columns: '["price"]',
        agg: '[["avgPx","avg","price"]]',
      });

      assert.throws(() => buildGetDataPayload(query), /not both/);
    });

    it("should still send agg on its own", () => {
      const query = getData({ agg: '[["avgPx","avg","price"]]' });

      assert.deepStrictEqual(buildGetDataPayload(query).agg, [
        ["avgPx", "avg", "price"],
      ]);
    });

    it("should keep a single in value as a list", () => {
      const query = getData();
      // "When using in or within this should be a list that matches the data
      // type of column name being referenced" — so one value is still a list.
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["sym", "in", "AAPL"]]),
        '[["in","sym",["AAPL"]]]',
      );
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["price", "in", "1"]]),
        '[["in","price",[1]]]',
      );
    });

    it("should keep a single within value as a list", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["price", "within", "10"]]),
        '[["within","price",[10]]]',
      );
    });

    it("should leave a comparison operator its scalar", () => {
      const query = getData();
      for (const operator of ["<", ">", "<=", ">=", "=", "<>"]) {
        assert.strictEqual(
          serializeRows(param(query, "filter"), [["price", operator, "100"]]),
          `[["${operator}","price",100]]`,
          operator,
        );
      }
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["sym", "like", "AAP*"]]),
        '[["like","sym","AAP*"]]',
      );
    });

    it("should read a single in value back into the field", () => {
      const query = getData({ filter: '[["in","sym",["AAPL"]]]' });
      assert.deepStrictEqual(parseRows(param(query, "filter")), [
        ["sym", "in", "AAPL"],
      ]);
    });

    it("should send an aggregation over one column as that column", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "agg"), [["avgPx", "avg", "price", ""]]),
        '[["avgPx","avg","price"]]',
      );
    });

    it("should send an aggregation over two columns as a list", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "agg"), [["vwap", "wavg", "size", "price"]]),
        '[["vwap","wavg",["size","price"]]]',
      );
    });

    it("should read a two column aggregation back into both fields", () => {
      const query = getData({ agg: '[["vwap","wavg",["size","price"]]]' });
      assert.deepStrictEqual(parseRows(param(query, "agg")), [
        ["vwap", "wavg", "size", "price"],
      ]);
    });

    it("should read a one column aggregation back", () => {
      const query = getData({ agg: '[["avgPx","avg","price"]]' });
      assert.deepStrictEqual(parseRows(param(query, "agg")), [
        ["avgPx", "avg", "price", ""],
      ]);
    });

    it("should split a multi valued filter on spaces", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["sym", "in", "AAPL MSFT"]]),
        '[["in","sym",["AAPL","MSFT"]]]',
      );
    });

    it("should write labels back as a dictionary", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "labels"), [["region", "emea"]]),
        '{"region":"emea"}',
      );
    });

    it("should write an empty value when every row is blank", () => {
      const query = getData();
      assert.strictEqual(
        serializeRows(param(query, "filter"), [["", "in", ""]]),
        "",
      );
    });

    it("should survive a round trip", () => {
      const query = getData();
      const filter = param(query, "filter");
      const rows = [
        ["price", ">", "100"],
        ["sym", "in", "AAPL MSFT"],
      ];
      filter.value = serializeRows(filter, rows);
      assert.deepStrictEqual(parseRows(filter), rows);
    });
  });

  describe("drafts", () => {
    it("should keep the visible parameters and the values entered", () => {
      const query = getData({ table: "trades", fill: "zero" });
      assert.deepStrictEqual(toDraft(query), {
        name: ".kxi.getData",
        params: [
          { name: "table", value: "trades" },
          { name: "startTS" },
          { name: "endTS" },
          { name: "fill", value: "zero" },
        ],
      });
    });

    it("should keep the type chosen for a multi type parameter", () => {
      const query = getData({ table: "trades" });
      param(query, "table").selectedMultiTypeString = "Symbol";
      assert.deepStrictEqual(toDraft(query)?.params[0], {
        name: "table",
        value: "trades",
        selectedMultiTypeString: "Symbol",
      });
    });

    it("should keep nothing for a form with no values entered", () => {
      assert.strictEqual(toDraft(getData()), undefined);
      assert.strictEqual(toDraft(undefined), undefined);
    });

    it("should keep nothing for a list parameter with no filled rows", () => {
      const query = getData();
      param(query, "filter").isVisible = true;
      param(query, "filter").value = serializeRows(param(query, "filter"), [
        ["", "in", ""],
      ]);
      assert.strictEqual(toDraft(query), undefined);
    });

    it("should put the values back on a query taken from the meta", () => {
      const draft = toDraft(
        getData({ table: "trades", filter: '[[">","price",100]]' }),
      )!;
      const query = applyDraft(getData(), draft);

      assert.strictEqual(param(query, "table").value, "trades");
      assert.deepStrictEqual(parseRows(param(query, "filter")), [
        ["price", ">", "100"],
      ]);
      assert.strictEqual(param(query, "filter").isVisible, true);
    });

    it("should hide the optional parameters the draft does not name", () => {
      const draft = toDraft(getData({ table: "trades" }))!;
      draft.params = draft.params.filter((item) => item.name !== "startTS");
      const query = applyDraft(getData(), draft);

      assert.strictEqual(param(query, "startTS").isVisible, false);
      assert.strictEqual(param(query, "endTS").isVisible, true);
      assert.strictEqual(param(query, "table").isVisible, true);
    });

    it("should ignore a parameter the deployment no longer has", () => {
      const draft = toDraft(getData({ table: "trades", fill: "zero" }))!;
      const query = applyDraft(createQsql(), draft);

      assert.deepStrictEqual(
        query.params.map((item) => item.name),
        ["target", "query", "agg", "labels"],
      );
      assert.strictEqual(param(query, "target").value, undefined);
    });
  });
  describe("UDA labels rows", () => {
    const labels = () => {
      const param = UDA_DISTINGUISHED_PARAMS.find(
        (item) => item.name === "labels",
      )!;
      return { ...param, rows: param.rows?.map((field) => ({ ...field })) };
    };

    it("should send one value as a list", () => {
      // The ticket's ask: a key maps to a list of candidates, even a list of one.
      assert.strictEqual(
        serializeRows(labels(), [["region", "canada"]]),
        '{"region":["canada"]}',
      );
    });

    it("should split several values onto one key", () => {
      assert.strictEqual(
        serializeRows(labels(), [["exchange", "TSX TSXV"]]),
        '{"exchange":["TSX","TSXV"]}',
      );
      assert.strictEqual(
        serializeRows(labels(), [["exchange", "TSX;TSXV"]]),
        '{"exchange":["TSX","TSXV"]}',
      );
    });

    it("should keep a numeric looking label a symbol", () => {
      assert.strictEqual(
        serializeRows(labels(), [["code", "600519"]]),
        '{"code":["600519"]}',
      );
    });

    it("should hold a key per row", () => {
      assert.strictEqual(
        serializeRows(labels(), [
          ["region", "canada"],
          ["exchange", "TSX TSXV"],
        ]),
        '{"region":["canada"],"exchange":["TSX","TSXV"]}',
      );
    });

    it("should read the values back space separated", () => {
      const param = labels();
      param.value = '{"exchange":["TSX","TSXV"]}';

      assert.deepStrictEqual(parseRows(param), [["exchange", "TSX TSXV"]]);
    });

    it("should read a value that was stored as a scalar", () => {
      // What an older file, or a hand edit, may hold.
      const param = labels();
      param.value = '{"region":"canada"}';

      assert.deepStrictEqual(parseRows(param), [["region", "canada"]]);
    });

    it("should leave the getData labels filter single valued", () => {
      const query = getData();

      assert.strictEqual(
        serializeRows(param(query, "labels"), [["region", "canada"]]),
        '{"region":"canada"}',
      );
    });
  });
});
