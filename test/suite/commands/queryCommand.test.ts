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
import * as sinon from "sinon";
import * as vscode from "vscode";

import {
  convertDataSource,
  convertDataSources,
  toGetDataQuery,
  toQsqlQuery,
  toSqlQuery,
} from "../../../src/commands/queryCommand";
import * as workspaceCommand from "../../../src/commands/workspaceCommand";
import { ext } from "../../../src/extensionVariables";
import {
  DataSourceFiles,
  DataSourceTypes,
} from "../../../src/models/dataSource";

describe("queryCommand", () => {
  const uri = vscode.Uri.file("/tmp/datasource.kdb.json");

  function createDataSource(
    selectedType: DataSourceTypes,
    dataSource: any = {},
  ): DataSourceFiles {
    return <DataSourceFiles>{
      dataSource: {
        selectedType,
        api: {},
        qsql: { query: "", selectedTarget: "" },
        sql: { query: "" },
        ...dataSource,
      },
    };
  }

  function stubDocument(content: unknown) {
    sinon.stub(vscode.workspace, "openTextDocument").resolves(<any>{
      getText: () =>
        typeof content === "string" ? content : JSON.stringify(content),
    });
  }

  function written() {
    return {
      uri: writeFile.firstCall.args[0] as vscode.Uri,
      content: writeFile.firstCall.args[1].toString() as string,
    };
  }

  let writeFile: sinon.SinonStub;
  let stat: sinon.SinonStub;

  beforeEach(() => {
    ext.outputChannel = vscode.window.createOutputChannel("kdb", { log: true });
    ext.queryTreeProvider = <any>{ reload() {} };
    ext.scratchpadTreeProvider = <any>{ reload() {} };
    writeFile = sinon.stub().resolves();
    stat = sinon.stub().rejects();
    sinon.stub(vscode.workspace, "fs").value(<any>{ writeFile, stat });
    sinon.stub(workspaceCommand, "getServerForUri").returns("server");
    sinon.stub(workspaceCommand, "getTargetForUri").returns("");
    sinon.stub(workspaceCommand, "setServerForUri").resolves();
    sinon.stub(workspaceCommand, "setTargetForUri").resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("toGetDataQuery", () => {
    it("should carry the table and time range over", () => {
      const query = toGetDataQuery(
        createDataSource(DataSourceTypes.API, {
          api: {
            table: "trades",
            startTS: "2024-01-01T00:00:00.000000000",
            endTS: "2024-01-02T00:00:00.000000000",
          },
        }),
      );
      const values = Object.fromEntries(
        query.params.map((param) => [param.name, param.value]),
      );
      assert.strictEqual(values.table, "trades");
      assert.strictEqual(values.startTS, "2024-01-01T00:00:00.000000000");
    });

    it("should fold the filter model into a JSON parameter", () => {
      const query = toGetDataQuery(
        createDataSource(DataSourceTypes.API, {
          api: {
            table: "trades",
            startTS: "",
            endTS: "",
            optional: {
              filters: [
                {
                  active: true,
                  column: "price",
                  operator: ">",
                  values: "100",
                },
              ],
              labels: [],
              sorts: [],
              aggs: [],
              groups: [],
            },
          },
        }),
      );
      const filter = query.params.find((param) => param.name === "filter");
      assert.strictEqual(filter?.value, '[[">","price",100]]');
      assert.strictEqual(filter?.isVisible, true);
    });

    it("should leave an untouched parameter hidden", () => {
      const query = toGetDataQuery(
        createDataSource(DataSourceTypes.API, {
          api: { table: "trades", startTS: "", endTS: "" },
        }),
      );
      const agg = query.params.find((param) => param.name === "agg");
      assert.strictEqual(agg?.isVisible, false);
      assert.strictEqual(agg?.value, undefined);
    });

    it("should carry the row limit over as a negative limit when last", () => {
      const query = toGetDataQuery(
        createDataSource(DataSourceTypes.API, {
          api: {
            table: "trades",
            startTS: "",
            endTS: "",
            rowCountLimit: "500",
            isRowLimitLast: true,
            optional: {
              rowLimit: true,
              filters: [],
              labels: [],
              sorts: [],
              aggs: [],
              groups: [],
            },
          },
        }),
      );
      const limit = query.params.find((param) => param.name === "limit");
      assert.strictEqual(limit?.value, -500);
    });
  });

  describe("toQsqlQuery", () => {
    it("should carry the aggregation and the labels over", () => {
      const query = toQsqlQuery(
        createDataSource(DataSourceTypes.QSQL, {
          qsql: {
            query: "select from trades",
            selectedTarget: "assembly qe",
            agg: "raze",
            labels: { region: "emea" },
          },
        }),
      );
      const agg = query.params.find((param) => param.name === "agg");
      const labels = query.params.find((param) => param.name === "labels");
      assert.strictEqual(agg?.value, "raze");
      assert.strictEqual(agg?.isVisible, true);
      assert.strictEqual(labels?.value, '{"region":"emea"}');
      assert.strictEqual(labels?.isVisible, true);
    });

    it("should leave the aggregation and the labels out when unset", () => {
      const query = toQsqlQuery(
        createDataSource(DataSourceTypes.QSQL, {
          qsql: {
            query: "select from trades",
            selectedTarget: "assembly qe",
            labels: {},
          },
        }),
      );
      const agg = query.params.find((param) => param.name === "agg");
      const labels = query.params.find((param) => param.name === "labels");
      assert.strictEqual(agg?.value, undefined);
      assert.strictEqual(agg?.isVisible, false);
      assert.strictEqual(labels?.value, undefined);
      assert.strictEqual(labels?.isVisible, false);
    });

    it("should survive a datasource with no qsql section", () => {
      const query = toQsqlQuery(<DataSourceFiles>{
        dataSource: { selectedType: DataSourceTypes.QSQL },
      });
      assert.strictEqual(query.name, "qSQL");
      assert.strictEqual(
        query.params.find((param) => param.name === "query")?.value,
        undefined,
      );
    });
  });

  describe("toSqlQuery", () => {
    it("should survive a datasource with no sql section", () => {
      const query = toSqlQuery(<DataSourceFiles>{
        dataSource: { selectedType: DataSourceTypes.SQL },
      });
      assert.strictEqual(query.name, "SQL");
      assert.strictEqual(
        query.params.find((param) => param.name === "query")?.value,
        undefined,
      );
    });
  });

  describe("convertDataSource", () => {
    it("should write a query file for a UDA datasource", async () => {
      stubDocument(
        createDataSource(DataSourceTypes.UDA, {
          uda: { name: "test.uda", params: [] },
        }),
      );
      const target = await convertDataSource(uri);
      assert.ok(target?.path.endsWith("/datasource.kxquery"));
      assert.strictEqual(JSON.parse(written().content).query.name, "test.uda");
    });

    it("should write a query file for an API datasource", async () => {
      stubDocument(
        createDataSource(DataSourceTypes.API, {
          api: { table: "trades", startTS: "", endTS: "" },
        }),
      );
      const target = await convertDataSource(uri);
      assert.ok(target?.path.endsWith("/datasource.kxquery"));
      assert.strictEqual(
        JSON.parse(written().content).query.name,
        ".kxi.getData",
      );
    });

    it("should write a query file for a QSQL datasource", async () => {
      stubDocument(
        createDataSource(DataSourceTypes.QSQL, {
          qsql: { query: "select from trades", selectedTarget: "assembly qe" },
        }),
      );
      const target = await convertDataSource(uri);
      assert.ok(target?.path.endsWith("/datasource.kxquery"));
      const query = JSON.parse(written().content).query;
      assert.strictEqual(query.name, "qSQL");
      assert.strictEqual(
        query.params.find((param: any) => param.name === "query").value,
        "select from trades",
      );
      assert.strictEqual(
        query.params.find((param: any) => param.name === "target").value,
        "assembly qe",
      );
    });

    it("should write a query file for a SQL datasource", async () => {
      stubDocument(
        createDataSource(DataSourceTypes.SQL, {
          sql: { query: "select * from trades" },
        }),
      );
      const target = await convertDataSource(uri);
      assert.ok(target?.path.endsWith("/datasource.kxquery"));
      const query = JSON.parse(written().content).query;
      assert.strictEqual(query.name, "SQL");
      assert.strictEqual(
        query.params.find((param: any) => param.name === "query").value,
        "select * from trades",
      );
    });

    it("should carry the connection over", async () => {
      stubDocument(
        createDataSource(DataSourceTypes.API, {
          api: { table: "trades", startTS: "", endTS: "" },
        }),
      );
      await convertDataSource(uri);
      assert.strictEqual(
        (workspaceCommand.setServerForUri as sinon.SinonStub).calledOnce,
        true,
      );
    });

    it("should skip a file that was already converted", async () => {
      stubDocument(createDataSource(DataSourceTypes.UDA));
      stat.resolves(<any>{});
      assert.strictEqual(await convertDataSource(uri), undefined);
      assert.strictEqual(writeFile.called, false);
    });

    it("should skip a file that is not valid JSON", async () => {
      stubDocument("not json");
      assert.strictEqual(await convertDataSource(uri), undefined);
      assert.strictEqual(writeFile.called, false);
    });
  });

  describe("convertDataSources", () => {
    it("should convert every datasource in the workspace", async () => {
      sinon.stub(vscode.workspace, "findFiles").resolves([uri]);
      stubDocument(
        createDataSource(DataSourceTypes.UDA, {
          uda: { name: "test.uda", params: [] },
        }),
      );
      const converted = await convertDataSources();
      assert.strictEqual(converted.length, 1);
    });

    it("should report when there is nothing left to convert", async () => {
      sinon.stub(vscode.workspace, "findFiles").resolves([]);
      const converted = await convertDataSources();
      assert.strictEqual(converted.length, 0);
    });
  });
});
