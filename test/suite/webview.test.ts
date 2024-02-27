/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import "../fixtures";
import * as assert from "assert";
import * as sinon from "sinon";
import { DataSourceMessage } from "../../src/models/messages";
import { MetaObjectPayload } from "../../src/models/meta";
import {
  createAgg,
  createDefaultDataSourceFile,
  createFilter,
  createGroup,
  createLabel,
  createSort,
} from "../../src/models/dataSource";
import { KdbDataSourceView } from "../../src/webview/components/kdbDataSourceView";
import { KdbNewConnectionView } from "../../src/webview/components/kdbNewConnectionView";
import { ServerType } from "../../src/models/server";

describe("KdbDataSourceView", () => {
  let view: KdbDataSourceView;

  beforeEach(async () => {
    view = new KdbDataSourceView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectedCallback", () => {
    it("should add message event listener", () => {
      let cb: any;
      sinon
        .stub(global.window, "addEventListener")
        .value((event: string, listener: any) => {
          if (event === "message") {
            cb = listener;
          }
        });
      view.connectedCallback();
      const dataSourceFile = createDefaultDataSourceFile();
      dataSourceFile.dataSource.api.optional = {
        filled: false,
        temporal: false,
        startTS: "",
        endTS: "",
        filters: [],
        labels: [],
        sorts: [],
        aggs: [],
        groups: [],
      };
      const message: DataSourceMessage = {
        isInsights: true,
        insightsMeta: <MetaObjectPayload>{
          dap: {},
        },
        dataSourceName: "test",
        dataSourceFile,
      };
      const event = {
        data: message,
      };
      cb(event);
      const data = view["data"];
      assert.deepEqual(data, {
        ...dataSourceFile,
        name: "test",
        originalName: "test",
      });
    });
  });

  describe("disconnectedCallback", () => {
    it("should remove message event listener", () => {
      let result = false;
      sinon
        .stub(global.window, "removeEventListener")
        .value((event: string) => {
          if (event === "message") {
            result = true;
          }
        });
      view.disconnectedCallback();
      assert.strictEqual(result, true);
    });
  });

  describe("message", () => {
    it("should update status", () => {
      view["message"](<MessageEvent<DataSourceMessage>>{
        data: { running: true },
      });
      assert.strictEqual(view.running, true);
    });
  });

  describe("selectTab", () => {
    it("should return the selected tab", () => {
      sinon.stub(view, "selectedType").value("DEFAULT");
      assert.strictEqual(view["selectedTab"], "tab-1");
      sinon.stub(view, "selectedType").value("API");
      assert.strictEqual(view["selectedTab"], "tab-1");
      sinon.stub(view, "selectedType").value("QSQL");
      assert.strictEqual(view["selectedTab"], "tab-2");
      sinon.stub(view, "selectedType").value("SQL");
      assert.strictEqual(view["selectedTab"], "tab-3");
    });
  });

  describe("save", () => {
    it("should post a message", () => {
      let result: any;
      const api = acquireVsCodeApi();
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (command === "kdb.dataSource.saveDataSource") {
          result = data;
        }
      });
      view["save"]();
      assert.ok(result);
    });
  });

  describe("run", () => {
    it("should post a message", () => {
      let result: any;
      const api = acquireVsCodeApi();
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (command === "kdb.dataSource.runDataSource") {
          result = data;
        }
      });
      view["run"]();
      assert.ok(result);
    });
  });

  describe("populateScratchpad", () => {
    it("should post a message", () => {
      let result: any;
      const api = acquireVsCodeApi();
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (command === "kdb.dataSource.populateScratchpad") {
          result = data;
        }
      });
      view["populateScratchpad"]();
      assert.ok(result);
    });
  });

  describe("renderApiOptions", () => {
    it("should render empty array", () => {
      const result = view["renderApiOptions"]("");
      assert.deepEqual(result, []);
    });

    it("should render getData api", () => {
      sinon.stub(view, "isInsights").value(true);
      sinon.stub(view, "isMetaLoaded").value(true);
      sinon
        .stub(view, "insightsMeta")
        .value({ api: [{ api: ".kxi.getData" }] });
      const result = view["renderApiOptions"]("getData");
      assert.deepEqual(result[0].values, ["getData", true, "getData"]);
    });

    it.skip("should render other api", () => {
      sinon.stub(view, "isInsights").value(true);
      sinon.stub(view, "isMetaLoaded").value(true);
      sinon.stub(view, "insightsMeta").value({ api: [{ api: "other" }] });
      const result = view["renderApiOptions"]("other");
      assert.deepEqual(result[0].values, ["other", true, "other"]);
    });
  });

  describe("renderTableOptions", () => {
    it("should render empty array", () => {
      const result = view["renderTableOptions"]("");
      assert.deepEqual(result, []);
    });

    it("should render table", () => {
      sinon.stub(view, "isInsights").value(true);
      sinon.stub(view, "isMetaLoaded").value(true);
      sinon
        .stub(view, "insightsMeta")
        .value({ assembly: [{ tbls: ["table"] }] });
      const result = view["renderTableOptions"]("table");
      assert.deepEqual(result[0].values, ["table", true, "table"]);
    });
  });

  describe("renderColumnOptions", () => {
    it("should render empty array", () => {
      const result = view["renderColumnOptions"]({ column: "" });
      assert.deepEqual(result, []);
    });

    it("should render columns for selected table", () => {
      const provider = { column: "" };
      sinon.stub(view, "isInsights").value(true);
      sinon.stub(view, "isMetaLoaded").value(true);
      sinon.stub(view, "selectedTable").value("table");
      sinon
        .stub(view, "insightsMeta")
        .value({ schema: [{ table: "table", columns: [{ column: "id" }] }] });
      const result = view["renderColumnOptions"](provider);
      assert.strictEqual(provider.column, "id");
      assert.deepEqual(result[0].values, ["id", true, "id"]);
    });
  });

  describe("renderTargetOptions", () => {
    it("should render empty array", () => {
      const result = view["renderTargetOptions"]("");
      assert.deepEqual(result, []);
    });

    it("should render targets", () => {
      sinon.stub(view, "isInsights").value(true);
      sinon.stub(view, "isMetaLoaded").value(true);
      sinon
        .stub(view, "insightsMeta")
        .value({ dap: [{ assembly: "assembly", instance: "instance" }] });
      const result = view["renderTargetOptions"]("assembly-qe instance");
      assert.deepEqual(result[0].values, [
        "assembly-qe instance",
        true,
        "assembly-qe instance",
      ]);
    });
  });

  describe("renderFilter", () => {
    it("should render filter", () => {
      const filter = createFilter();
      const render = view["renderFilter"](filter);
      (render.values[1] as any)({ target: { checked: true } });
      assert.strictEqual(filter.active, true);
      (render.values[3] as any)({ target: { value: "test" } });
      assert.strictEqual(filter.column, "test");
      (render.values[6] as any)({ target: { value: "test" } });
      assert.strictEqual(filter.column, "test");
      (render.values[9] as any)({ target: { value: "test" } });
      assert.strictEqual(filter.column, "test");
      let result = false;
      sinon.stub(view, "requestUpdate").value(() => (result = true));
      (render.values[11] as any)();
      assert.strictEqual(result, true);
      result = false;
      view.filters = [filter];
      (render.values[12] as any)();
      assert.strictEqual(result, true);
    });
  });

  describe("renderLabel", () => {
    it("should render label", () => {
      const label = createLabel();
      const render = view["renderLabel"](label);
      (render.values[1] as any)({ target: { checked: true } });
      assert.strictEqual(label.active, true);
      (render.values[3] as any)({ target: { value: "test" } });
      assert.strictEqual(label.key, "test");
      (render.values[6] as any)({ target: { value: "test" } });
      assert.strictEqual(label.key, "test");
      let result = false;
      sinon.stub(view, "requestUpdate").value(() => (result = true));
      (render.values[8] as any)();
      assert.strictEqual(result, true);
      view.labels = [label];
      (render.values[9] as any)();
      assert.strictEqual(result, true);
    });
  });

  describe("renderSort", () => {
    it("should render sort", () => {
      const sort = createSort();
      const render = view["renderSort"](sort);
      (render.values[1] as any)({ target: { checked: true } });
      assert.strictEqual(sort.active, true);
      (render.values[3] as any)({ target: { value: "test" } });
      assert.strictEqual(sort.column, "test");
      let result = false;
      sinon.stub(view, "requestUpdate").value(() => (result = true));
      (render.values[5] as any)();
      assert.strictEqual(result, true);
      view.sorts = [sort];
      (render.values[6] as any)();
      assert.strictEqual(result, true);
    });
  });

  describe("renderAgg", () => {
    it("should render agg", () => {
      const agg = createAgg();
      const render = view["renderAgg"](agg);
      (render.values[1] as any)({ target: { checked: true } });
      assert.strictEqual(agg.active, true);
      (render.values[3] as any)({ target: { value: "test" } });
      assert.strictEqual(agg.key, "test");
      (render.values[6] as any)({ target: { value: "test" } });
      assert.strictEqual(agg.operator, "test");
      (render.values[9] as any)({ target: { value: "test" } });
      assert.strictEqual(agg.column, "test");
      let result = false;
      sinon.stub(view, "requestUpdate").value(() => (result = true));
      (render.values[11] as any)();
      assert.strictEqual(result, true);
      view.aggs = [agg];
      (render.values[12] as any)();
      assert.strictEqual(result, true);
    });
  });

  describe("renderGroup", () => {
    it("should render group", () => {
      const group = createGroup();
      const render = view["renderGroup"](group);
      (render.values[1] as any)({ target: { checked: true } });
      assert.strictEqual(group.active, true);
      (render.values[3] as any)({ target: { value: "test" } });
      assert.strictEqual(group.column, "test");
      let result = false;
      sinon.stub(view, "requestUpdate").value(() => (result = true));
      (render.values[5] as any)();
      assert.strictEqual(result, true);
      view.groups = [group];
      (render.values[6] as any)();
      assert.strictEqual(result, true);
    });
  });

  describe("render", () => {
    it("should update state for name input", () => {
      const result = view["render"]();
      (result.values[1] as any)({ target: { value: "datatsource-test" } });
      assert.strictEqual(view.name, "datatsource-test");
    });

    it("should update state for tab selection", () => {
      const result = view["render"]();
      (result.values[3] as any)();
      assert.strictEqual(view.selectedType, "API");
      (result.values[4] as any)();
      assert.strictEqual(view.selectedType, "QSQL");
      (result.values[5] as any)();
      assert.strictEqual(view.selectedType, "SQL");
    });
  });

  describe("KdbNewConnectionView", () => {
    let view;

    beforeEach(() => {
      view = new KdbNewConnectionView();
    });

    describe("selectConnection", () => {
      it("should return tab-2", () => {
        view.serverType = ServerType.INSIGHTS;
        assert.strictEqual(view["selectConnection"], "tab-2");
      });

      it("should return tab-1", () => {
        view.serverType = ServerType.KDB;
        assert.strictEqual(view["selectConnection"], "tab-1");
      });
    });

    describe("changeTLS", () => {
      it("should update state", () => {
        view.changeTLS();
        assert.strictEqual(view.kdbServer.tls, true);
        view.changeTLS();
        assert.strictEqual(view.kdbServer.tls, false);
      });
    });

    describe("renderServerNameDesc", () => {
      it("should render bundled server name desc", () => {
        const result = view.renderServerNameDesc(true);
        assert.strictEqual(
          result.strings[0].includes("<b>Bundled q.</b>"),
          true,
        );
      });

      it("should render normal server name desc", () => {
        const result = view.renderServerNameDesc(false);
        assert.strictEqual(
          result.strings[0].includes("<b>Bundled q.</b>"),
          false,
        );
      });
    });

    describe("renderServerNameField", () => {
      it("should render server name field for bundled q", () => {
        const result = view.renderServerNameField(ServerType.KDB, true);
        assert.strictEqual(result.strings[0].includes("Server 1"), false);
      });

      it("should render server name field for KDB", () => {
        const result = view.renderServerNameField(ServerType.KDB, false);
        assert.strictEqual(result.strings[0].includes("Server 1"), true);
      });

      it("should render server name field for Insights", () => {
        const result = view.renderServerNameField(ServerType.INSIGHTS, false);
        assert.strictEqual(result.strings[0].includes("Insights 1"), true);
      });
    });

    describe("renderServerName", () => {
      it("should render server name", () => {
        const result = view.renderServerName(ServerType.INSIGHTS, false);
        assert.strictEqual(
          result.strings[1].includes("row option-description  option-help"),
          true,
        );
      });
    });

    describe("renderConnAddDesc", () => {
      it("should render connection address for KDB", () => {
        const result = view.renderConnAddDesc(ServerType.KDB);
        assert.strictEqual(
          result.strings[0].includes(
            "Set the IP of your kdb+ database connection.",
          ),
          true,
        );
      });

      it("should render connection address for Insights", () => {
        const result = view.renderConnAddDesc(ServerType.INSIGHTS);
        assert.strictEqual(result.strings[0].includes("your Insights"), true);
      });
    });

    describe("renderConnAddress", () => {
      it("should render connection address", () => {
        const result = view.renderConnAddress(ServerType.KDB);
        assert.strictEqual(
          JSON.stringify(result).includes("127.0.0.1 or localhost"),
          true,
        );
      });

      it("should render connection address for Insights", () => {
        const result = view.renderConnAddress(ServerType.INSIGHTS);
        assert.strictEqual(
          JSON.stringify(result).includes("myinsights.clouddeploy.com"),
          true,
        );
      });
    });

    describe("render()", () => {
      let renderServerNameStub,
        renderConnAddressStub,
        saveStub,
        changeTLSStub: sinon.SinonStub;

      beforeEach(() => {
        renderServerNameStub = sinon.stub(view, "renderServerName");
        renderConnAddressStub = sinon.stub(view, "renderConnAddress");
        saveStub = sinon.stub(view, "save");
        changeTLSStub = sinon.stub(view, "changeTLS");
      });

      afterEach(() => {
        sinon.restore();
      });

      it("should render correctly", () => {
        view.render();

        assert.equal(renderServerNameStub.calledTwice, true);
        assert.equal(renderConnAddressStub.calledTwice, true);
        assert.equal(saveStub.called, false);
        assert.equal(changeTLSStub.called, false);
      });

      it("should render tab-2", () => {
        view.serverType = ServerType.INSIGHTS;
        view.render();
        assert.equal(renderServerNameStub.calledTwice, true);
        assert.equal(renderConnAddressStub.calledTwice, true);
        assert.equal(saveStub.called, false);
        assert.equal(changeTLSStub.called, false);
      });
    });
  });
});
