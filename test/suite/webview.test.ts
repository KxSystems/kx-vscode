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
import { KdbDataSourceView } from "../../src/webview/components/kdbDataSourceView";
import { KdbNewConnectionView } from "../../src/webview/components/kdbNewConnectionView";

import {
  DataSourceCommand,
  DataSourceMessage2,
  EditConnectionMessage,
} from "../../src/models/messages";
import {
  DataSourceTypes,
  createAgg,
  createFilter,
  createGroup,
  createLabel,
  createSort,
} from "../../src/models/dataSource";
import { MetaObjectPayload } from "../../src/models/meta";
import { html, TemplateResult } from "lit";
import { ext } from "../../src/extensionVariables";
import { InsightDetails, ServerType } from "../../src/models/connectionsModels";

describe("KdbDataSourceView", () => {
  let view: KdbDataSourceView;

  function createValueEvent(value?: string): Event {
    return (<unknown>{
      target: <HTMLInputElement>{
        value,
      },
    }) as Event;
  }

  function createMessageEvent(isInsights: boolean) {
    return <MessageEvent<DataSourceMessage2>>{
      data: {
        command: DataSourceCommand.Update,
        servers: ["server"],
        selectedServer: "server",
        isInsights,
        insightsMeta: <MetaObjectPayload>{
          dap: [{}],
          api: [{ api: "getData" }],
          assembly: [{ assembly: "assembly", tbls: ["table1"] }],
          schema: [
            {
              table: "table1",
              columns: [{ column: "column1" }],
              assembly: "assembly",
              type: "type",
            },
          ],
        },
        dataSourceFile: {
          dataSource: {
            selectedType: DataSourceTypes.API,
            api: {
              selectedApi: "getData",
              table: "table1",
              startTS: "",
              endTS: "",
              fill: "zero",
              temporality: "snapshot",
              filter: [],
              groupBy: [],
              agg: [],
              sortCols: [],
              slice: [],
              labels: [],
              optional: {
                filled: false,
                temporal: false,
                rowLimit: false,
                filters: [createFilter()],
                labels: [createLabel()],
                sorts: [createSort()],
                aggs: [createAgg()],
                groups: [createGroup()],
              },
            },
            qsql: {
              query: "",
              selectedTarget: "",
            },
            sql: {
              query: "",
            },
          },
        },
      },
    };
  }

  function testEventHandlers(result: TemplateResult) {
    for (const value of result.values) {
      if (value instanceof Function) {
        value.bind(view)(createValueEvent(""));
      }
    }
  }

  beforeEach(async () => {
    view = new KdbDataSourceView();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("connectedCallback", () => {
    it("should add an event listener", () => {
      let result = undefined;
      sinon.stub(window, "addEventListener").value(() => (result = true));
      view.connectedCallback();
      assert.ok(result);
    });
  });

  describe("disconnectedCallback", () => {
    it("should remove an event listener", () => {
      let result = undefined;
      sinon.stub(window, "removeEventListener").value(() => (result = true));
      view.disconnectedCallback();
      assert.ok(result);
    });
  });

  describe("render", () => {
    it("should update from message", () => {
      view.message(createMessageEvent(true));
      assert.ok(view.data);
      const result = view.render();
      assert.ok(result);
    });
    it("should update from offline message", () => {
      view.message(createMessageEvent(false));
      assert.ok(view.data);
      const result = view.render();
      assert.ok(result);
    });
    it("should call event handlers", () => {
      testEventHandlers(view.render());
      testEventHandlers(view.renderFilter(createFilter()));
      testEventHandlers(view.renderLabel(createLabel()));
      testEventHandlers(view.renderSort(createSort()));
      testEventHandlers(view.renderAgg(createAgg()));
      testEventHandlers(view.renderGroup(createGroup()));
    });
  });

  describe("save", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.save();
      assert.ok(result);
    });
  });

  describe("refresh", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.refresh();
      assert.ok(result);
    });
  });

  describe("run", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.run();
      assert.ok(result);
    });
  });

  describe("populateScratchpad", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.populateScratchpad();
      assert.ok(result);
    });
  });

  describe("requestChange", () => {
    it("should send a message after 200 ms", (done) => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.requestChange();
      setTimeout(() => {
        assert.ok(result);
        done();
      }, 250);
    });
  });

  describe("requestServerChange", () => {
    it("should send a message", () => {
      let result = undefined;
      sinon.stub(view, "postMessage").value(() => (result = true));
      view.requestServerChange(createValueEvent("server"));
      assert.ok(result);
    });
  });

  describe("renderRowCountOptions", () => {
    it("should render row count options", () => {
      view.selectedServerVersion = 1.11;
      const result = view.renderRowCountOptions();
      assert.ok(result);
    });

    it("should not render row count options for older server version", () => {
      view.selectedServerVersion = 1.1;
      const result = view.renderRowCountOptions();
      assert.ok(!result);
    });
  });
});

describe("KdbNewConnectionView", () => {
  let view;

  beforeEach(() => {
    view = new KdbNewConnectionView();
  });

  describe("handleMessage", () => {
    it('should update connectionData when command is "editConnection"', () => {
      const event = {
        data: {
          command: "editConnection",
          data: {
            serverName: "test",
            connType: 1,
            serverAddress: "localhost",
          },
        },
      };

      view.handleMessage(event);

      assert.equal(view.connectionData, event.data.data);
    });

    it('should update connectionData when command is "refreshLabels"', () => {
      const event = {
        data: {
          command: "refreshLabels",
          data: ["test"],
          colors: ext.labelColors,
        },
      };

      view.handleMessage(event);

      assert.equal(view.lblNamesList, event.data.data);
    });

    it('should not update connectionData when command is not "editConnection"', () => {
      const event = {
        data: {
          command: "otherCommand",
          data: { serverName: "testServer" },
        },
      };

      view.handleMessage(event);

      assert.equal(view.connectionData, undefined);
    });
  });

  describe("editAuthOfConn", () => {
    it("should toggle editAuth", () => {
      view.editAuth = false;

      view.editAuthOfConn();
      assert.equal(view.editAuth, true);

      view.editAuthOfConn();
      assert.equal(view.editAuth, false);
    });
  });

  describe("selectConnection", () => {
    it("should return tab-1", () => {
      view.isBundledQ = true;
      view.serverType = ServerType.KDB;
      assert.strictEqual(view["selectConnection"], "tab-1");
    });
    it("should return tab-3", () => {
      view.isBundledQ = false;
      view.serverType = ServerType.INSIGHTS;
      assert.strictEqual(view["selectConnection"], "tab-3");
    });

    it("should return tab-2", () => {
      view.isBundledQ = false;
      view.serverType = ServerType.KDB;
      assert.strictEqual(view["selectConnection"], "tab-2");
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
      assert.strictEqual(result.strings[0].includes("<b>Bundled q.</b>"), true);
    });

    it("should render normal server name desc", () => {
      view.isBundledQ = false;
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
      assert.strictEqual(result.strings[0].includes("Server-1"), false);
    });

    it("should render server name field for KDB", () => {
      view.isBundledQ = false;
      const result = view.renderServerNameField(ServerType.KDB);
      assert.strictEqual(result.strings[0].includes("Server-1"), true);
    });

    it("should render server name field for Insights", () => {
      view.isBundledQ = false;
      const result = view.renderServerNameField(ServerType.INSIGHTS, false);
      assert.strictEqual(result.strings[0].includes("Insights-1"), true);
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

  describe("renderPortNumberDesc", () => {
    it("should render port number desc for bundled q", () => {
      view.isBundledQ = true;
      const result = view.renderPortNumberDesc(ServerType.KDB);
      assert.strictEqual(
        JSON.stringify(result).includes(
          "Ensure the port number you use does not conflict with another",
        ),
        true,
      );
    });

    it("should render port number desc for KDB server", () => {
      const result = view.renderPortNumberDesc();
      assert.strictEqual(
        JSON.stringify(result).includes("<b>Set port number</b>"),
        true,
      );
    });
  });
  describe("renderPortNumber", () => {
    it("should render port number for bundled q", () => {
      const result = view.renderPortNumber(ServerType.KDB);
      assert.strictEqual(
        JSON.stringify(result).includes(
          "Ensure the port number you use does not conflict with another",
        ),
        true,
      );
    });

    it("should render port number for KDB server", () => {
      const result = view.renderPortNumber();
      assert.strictEqual(
        JSON.stringify(result).includes("<b>Set port number</b>"),
        true,
      );
    });
  });

  describe("renderConnAddDesc", () => {
    it("should render connection address for KDB", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddDesc(ServerType.KDB);
      assert.strictEqual(
        result.strings[0].includes(
          "Set the IP of your kdb+ database connection.",
        ),
        true,
      );
    });

    it("should render connection address for Insights", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddDesc(ServerType.INSIGHTS);
      assert.strictEqual(result.strings[0].includes("your Insights"), true);
    });

    it("should render connection address for Bundled q", () => {
      const result = view.renderConnAddDesc(ServerType.KDB, true);
      assert.strictEqual(
        result.strings[0].includes("already set up for you"),
        true,
      );
    });
  });

  describe("renderConnAddress", () => {
    it("should render connection address", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddress(ServerType.KDB);
      assert.strictEqual(
        JSON.stringify(result).includes("127.0.0.1 or localhost"),
        true,
      );
    });

    it("should render connection address for Bundled q", () => {
      const result = view.renderConnAddress(ServerType.KDB, true);
      assert.strictEqual(
        JSON.stringify(result).includes("127.0.0.1 or localhost"),
        false,
      );
    });

    it("should render connection address for Insights", () => {
      view.isBundledQ = false;
      const result = view.renderConnAddress(ServerType.INSIGHTS);
      assert.strictEqual(
        JSON.stringify(result).includes("myinsights.clouddeploy.com"),
        true,
      );
    });

    it("should render label dropdown color options", () => {
      view.lblColorsList = [
        { name: "red", colorHex: "#FF0000" },
        { name: "green", colorHex: "#00FF00" },
      ];

      const result = view.renderLblDropdownColorOptions();

      assert.strictEqual(
        JSON.stringify(result).includes("No Color Selected"),
        true,
      );
    });

    it("should render label dropdown options", () => {
      view.lblNamesList = [
        { name: "label1", color: { colorHex: "#FF0000" } },
        { name: "label2", color: { colorHex: "#00FF00" } },
      ];
      view.labels = ["label1"];

      const result = view.renderLblDropdownOptions();

      assert.strictEqual(
        JSON.stringify(result).includes("No Label Selected"),
        true,
      );
    });

    it("should render label dropdown", () => {
      view.lblNamesList = [
        { name: "label1", color: { colorHex: "#FF0000" } },
        { name: "label2", color: { colorHex: "#00FF00" } },
      ];
      view.labels = ["label1"];

      const result = view.renderLblsDropdown(0);

      assert.strictEqual(
        JSON.stringify(result).includes("No Label Selected"),
        true,
      );
    });

    it("should render New Label Modal", () => {
      const result = view.renderNewLabelModal();

      assert.strictEqual(
        JSON.stringify(result).includes("Add a New Label"),
        true,
      );
    });

    it("should render New Label Btn", () => {
      const result = view.renderNewLblBtn();

      assert.strictEqual(
        JSON.stringify(result).includes("Create New Label"),
        true,
      );
    });

    it("should render Connection Label Section", () => {
      const result = view.renderConnectionLabelsSection();

      assert.strictEqual(
        JSON.stringify(result).includes("Connection label (optional)"),
        true,
      );
    });
  });

  describe("tabClickAction", () => {
    it("should select first tab", () => {
      view.tabClickAction(1);
      assert.strictEqual(view.isBundledQ, true);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });

    it("should select second tab", () => {
      view.tabClickAction(2);
      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });

    it("should select third tab", () => {
      view.tabClickAction(3);
      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
    });

    it("should select first tab as defaut", () => {
      view.tabClickAction(4);
      assert.strictEqual(view.isBundledQ, true);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });
  });

  describe("removeBlankLabels", () => {
    it("should remove blank labels", () => {
      view.labels = ["label1", ""];
      view.removeBlankLabels();
      assert.strictEqual(view.labels.length, 1);
    });

    it("should not remove blank labels", () => {
      view.labels = ["label1"];
      view.removeBlankLabels();
      assert.strictEqual(view.labels.length, 1);
    });

    it("should remove duplicate labels", () => {
      view.labels = ["label1", "label1", "label1"];
      view.removeBlankLabels();
      assert.strictEqual(view.labels.length, 1);
    });
  });

  it("should add label", () => {
    view.labels = ["label1"];
    view.addLabel();
    assert.strictEqual(view.labels.length, 2);
  });

  it("should remove label", () => {
    view.labels = ["label1"];
    view.removeLabel(0);
    assert.strictEqual(view.labels.length, 0);
  });

  it("should update label", () => {
    view.labels = ["label1"];
    const event: Event = new Event("label2");
    Object.defineProperty(event, "target", {
      value: { value: "label2" },
      writable: false,
    });
    view.updateLabelValue(0, event);
    assert.strictEqual(view.labels[0], "label2");
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

    it("should render tab-1", () => {
      view.render();

      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });

    it("should render tab-2", () => {
      view.isBundledQ = false;
      view.render();

      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });

    it("should render tab-3", () => {
      view.isBundledQ = false;
      view.serverType = ServerType.INSIGHTS;
      view.render();
      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });
  });

  describe("renderCreateConnectionBtn", () => {
    it("should render create connection button", () => {
      const result = view.renderCreateConnectionBtn();

      assert.strictEqual(
        JSON.stringify(result).includes("Create Connection"),
        true,
      );
    });
  });

  describe("renderEditConnectionForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;

      const result = view.renderEditConnectionForm();

      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should set isBundledQ to true and return correct HTML when connType is 0", () => {
      view.connectionData = { connType: 0, serverName: "testServer" };

      const result = view.renderEditConnectionForm();
      assert.strictEqual(view.isBundledQ, true);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("Bundled q"), true);
    });

    it("should set isBundledQ to false and return correct HTML when connType is 1", () => {
      view.connectionData = { connType: 1, serverName: "testServer" };

      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("My q"), true);
    });

    it("should set serverType to INSIGHTS and return correct HTML when connType is 2", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };

      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
    });

    it("should set serverType to INSIGHTS and open labels modal", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.openModal();

      const result = view.renderEditConnectionForm();
      const resultsStrings = JSON.stringify(result);

      assert.strictEqual(view.isBundledQ, false);
      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
      assert.strictEqual(resultsStrings.includes("Add a New Label"), true);
    });
  });

  describe("renderEditConnFields", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderEditConnFields();
      assert.equal(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should call renderBundleQEditForm when connectionData.connType is 0", () => {
      view.connectionData = { connType: 0 };
      const renderBundleQEditFormStub = sinon
        .stub(view, "renderBundleQEditForm")
        .returns(html``);
      view.renderEditConnFields();
      assert.ok(renderBundleQEditFormStub.calledOnce);
      renderBundleQEditFormStub.restore();
    });

    it("should call renderMyQEditForm when connectionData.connType is 1", () => {
      view.connectionData = { connType: 1 };
      const renderMyQEditFormStub = sinon
        .stub(view, "renderMyQEditForm")
        .returns(html``);
      view.renderEditConnFields();
      assert.ok(renderMyQEditFormStub.calledOnce);
      renderMyQEditFormStub.restore();
    });

    it("should call renderInsightsEditForm when connectionData.connType is any other value", () => {
      view.connectionData = { connType: 2 };
      const renderInsightsEditFormStub = sinon
        .stub(view, "renderInsightsEditForm")
        .returns(html``);
      view.renderEditConnFields();
      assert.ok(renderInsightsEditFormStub.calledOnce);
      renderInsightsEditFormStub.restore();
    });
  });

  describe("renderBundleQEditForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderBundleQEditForm();
      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should return the correct HTML structure when connectionData is provided", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      const result = view.renderBundleQEditForm();
      assert.ok(result.strings[0].includes('<div class="col gap-0">'));
      assert.ok(result.strings[1].includes('<div class="col gap-0">'));
      assert.ok(result.strings[2].includes('<div class="col gap-0">'));
      assert.ok(!result.strings[3].includes('<div class="col gap-0">'));
    });
  });

  describe("renderMyQEditForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderMyQEditForm();
      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should return the correct HTML structure when connectionData is provided", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      const result = view.renderMyQEditForm();
      assert.ok(result.strings[0].includes('<div class="col gap-0">'));
      assert.ok(result.strings[1].includes('<div class="col gap-0">'));
      assert.ok(result.strings[2].includes('<div class="col gap-0">'));
      assert.ok(result.strings[3].includes('<div class="col gap-0">'));
    });
  });

  describe("renderInsightsEditForm", () => {
    it('should return "No connection found to be edited" when connectionData is null', () => {
      view.connectionData = null;
      const result = view.renderInsightsEditForm();
      assert.strictEqual(
        result.strings[0],
        "<div>No connection found to be edited</div>",
      );
    });

    it("should return the correct HTML structure when connectionData is provided", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      const result = view.renderInsightsEditForm();
      assert.ok(result.strings[0].includes('<div class="col gap-0">'));
      assert.ok(result.strings[1].includes('<div class="col gap-0">'));
      assert.ok(result.strings[2].includes('<div class="col gap-0">'));
      assert.ok(!result.strings[3].includes('<div class="col gap-0">'));
    });
  });

  describe("get data", () => {
    it("should return Insights data", () => {
      view.serverType = ServerType.INSIGHTS;
      const expectedData: InsightDetails = {
        alias: "",
        server: "",
        auth: true,
        realm: "",
        insecure: false,
      };
      const data = view["data"];
      assert.deepEqual(data, expectedData);
    });

    it("should return KDB data", () => {
      view.serverType = ServerType.KDB;
      const expectedData = {
        serverName: "",
        serverPort: "",
        auth: false,
        serverAlias: "",
        managed: false,
        tls: false,
        username: "",
        password: "",
      };
      const data = view["data"];
      assert.deepEqual(data, expectedData);
    });
  });

  describe("save", () => {
    it("should post a message", () => {
      let result: any;
      const api = acquireVsCodeApi();
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (
          command === "kdb.newConnection.createNewConnection" ||
          command === "kdb.newConnection.createNewInsightConnection" ||
          command === "kdb.newConnection.createNewBundledConnection"
        ) {
          result = data;
        }
      });
      view.save();
      assert.ok(result);
      view.isBundledQ = false;
      view.save();
      assert.ok(result);
      view.serverType = ServerType.INSIGHTS;
      view.save();
      assert.ok(result);
      sinon.restore();
    });
  });

  describe("edit", () => {
    const editConn: EditConnectionMessage = {
      connType: 0,
      serverName: "test",
      serverAddress: "127.0.0.1",
    };

    it("should post a message", () => {
      const api = acquireVsCodeApi();
      let result: any;
      sinon.stub(api, "postMessage").value(({ command, data }) => {
        if (
          command === "kdb.newConnection.editMyQConnection" ||
          command === "kdb.newConnection.editInsightsConnection" ||
          command === "kdb.newConnection.editBundledConnection"
        ) {
          result = data;
        }
      });
      view.editConnection();
      assert.ok(!result);
      view.connectionData = editConn;
      view.editConnection();
      assert.ok(result);
      editConn.connType = 1;
      view.connectionData = editConn;
      view.editConnection();
      assert.ok(result);
      editConn.connType = 2;
      view.connectionData = editConn;
      view.editConnection();
      assert.ok(result);
      sinon.restore();
    });
  });
});
