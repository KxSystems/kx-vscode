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
import { html } from "lit";
import * as sinon from "sinon";

import { ext } from "../../../../src/extensionVariables";
import {
  InsightDetails,
  ServerType,
} from "../../../../src/models/connectionsModels";
import { EditConnectionMessage } from "../../../../src/models/messages";
import { KdbNewConnectionView } from "../../../../src/webview/components/kdbNewConnectionView";

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
      view.serverType = ServerType.KDB;
      assert.strictEqual(view["selectConnection"], "tab-1");
    });
    it("should return tab-2", () => {
      view.serverType = ServerType.INSIGHTS;
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

  describe("field input handlers", () => {
    function fire(template: any, value: unknown) {
      const handler = template.values.find(
        (candidate: unknown) => typeof candidate === "function",
      );
      handler({ target: { value, checked: value } });
    }

    let requestUpdate: sinon.SinonSpy;

    beforeEach(() => {
      requestUpdate = sinon.spy(view, "requestUpdate");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should keep the server name and ask for a render", () => {
      fire(view.renderServerNameField(ServerType.KDB), "server-1");
      assert.strictEqual(view.kdbServer.serverAlias, "server-1");
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should keep the Insights alias and ask for a render", () => {
      fire(view.renderServerNameField(ServerType.INSIGHTS), "insights-1");
      assert.strictEqual(view.insightsServer.alias, "insights-1");
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should keep the port and ask for a render", () => {
      fire(view.renderPortNumber(), "5001");
      assert.strictEqual(view.kdbServer.serverPort, "5001");
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should keep the kdb address and ask for a render", () => {
      fire(view.renderConnAddress(ServerType.KDB), "localhost");
      assert.strictEqual(view.kdbServer.serverName, "localhost");
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should keep the Insights address and ask for a render", () => {
      fire(view.renderConnAddress(ServerType.INSIGHTS), "https://insights");
      assert.strictEqual(view.insightsServer.server, "https://insights");
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should keep the realm and ask for a render", () => {
      fire(view.renderRealm(), "custom");
      assert.strictEqual(view.insightsServer.realm, "custom");
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should keep the insecure flag and ask for a render", () => {
      fire(view.renderInsecureSSL(), true);
      assert.strictEqual(view.insightsServer.insecure, true);
      assert.strictEqual(requestUpdate.called, true);
    });

    it("should ask for a render when TLS is toggled", () => {
      view.changeTLS();
      assert.strictEqual(view.kdbServer.tls, true);
      assert.strictEqual(requestUpdate.called, true);
    });
  });

  describe("renderSection", () => {
    function toggle(section: any, open: boolean) {
      section.values[1]({ target: { open } });
    }

    it("should title the disclosure after the section", () => {
      const result = view.renderSection("Authentication & TLS", html`<i></i>`);
      assert.strictEqual(result.values[2], "Authentication & TLS");
    });

    it("should start closed", () => {
      assert.strictEqual(
        view.renderSection("Authentication & TLS", "").values[0],
        false,
      );
    });

    it("should stay open once turned", () => {
      toggle(view.renderSection("Authentication & TLS", ""), true);
      assert.strictEqual(
        view.renderSection("Authentication & TLS", "").values[0],
        true,
      );
    });

    it("should stay closed once turned back", () => {
      toggle(view.renderSection("Authentication & TLS", ""), true);
      toggle(view.renderSection("Authentication & TLS", ""), false);
      assert.strictEqual(
        view.renderSection("Authentication & TLS", "").values[0],
        false,
      );
    });

    it("should remember each section on its own", () => {
      toggle(view.renderSection("Authentication & TLS", ""), true);
      assert.strictEqual(view.renderSection("Advanced", "").values[0], false);
    });
  });

  describe("renderServerNameField", () => {
    it("should render server name field for KDB", () => {
      const result = view.renderServerNameField(ServerType.KDB);
      assert.strictEqual(result.strings[0].includes("Server-1"), true);
    });

    it("should render server name field for Insights", () => {
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
    it("should render port number desc for KDB server", () => {
      const result = view.renderPortNumberDesc();
      assert.strictEqual(
        JSON.stringify(result).includes("<b>Set port number</b>"),
        true,
      );
    });
  });
  describe("renderPortNumber", () => {
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
        JSON.stringify(result).includes("https://myinsights.example.com"),
        true,
      );
    });

    it("should render label dropdown color options", () => {
      view.lblColorsList = [
        { name: "red", colorHex: "#FF0000" },
        { name: "green", colorHex: "#00FF00" },
      ];

      const result = view.renderLblDropdownColorOptions();

      assert.deepStrictEqual(result, ["red", "green"]);
    });

    it("should offer every label, with its colour, and a way to add one", () => {
      view.lblNamesList = [
        { name: "label1", color: { colorHex: "#FF0000" } },
        { name: "label2", color: { colorHex: "#00FF00" } },
      ];

      assert.deepStrictEqual(view.labelOptions(), [
        { value: "label1", color: "#FF0000" },
        { value: "label2", color: "#00FF00" },
        { value: "\u0000new-label", label: "+ Create new label..." },
      ]);
    });

    it("should render the labels it holds", () => {
      view.lblNamesList = [{ name: "label1", color: { colorHex: "#FF0000" } }];
      view.labels = ["label1"];

      const rendered = JSON.stringify(view.renderLbls());

      assert.strictEqual(rendered.includes("label1"), true);
      assert.strictEqual(rendered.includes("Select labels..."), true);
    });

    it("should take the labels that are picked", () => {
      view.handleLabels(<any>{ target: { values: ["label1", "label2"] } });

      assert.deepStrictEqual(view.labels, ["label1", "label2"]);
    });

    it("should open the modal rather than hold the new label entry", () => {
      view.labels = ["label1"];

      view.handleLabels(<any>{
        target: { values: ["label1", "\u0000new-label"] },
      });

      assert.deepStrictEqual(view.labels, ["label1"]);
      assert.strictEqual((<any>view).isModalOpen, true);
    });

    it("should render New Label Modal", () => {
      const result = view.renderNewLabelModal();

      assert.strictEqual(
        JSON.stringify(result).includes("Add a New Label"),
        true,
      );
    });

    it("should render Connection Label Section", () => {
      const result = view.renderConnectionLabelsSection();

      assert.strictEqual(
        JSON.stringify(result).includes("Connection labels (optional)"),
        true,
      );
    });
  });

  describe("tabClickAction", () => {
    it("should select first tab", () => {
      view.tabClickAction(1);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });

    it("should select second tab", () => {
      view.tabClickAction(2);
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
    });

    it("should select first tab as defaut", () => {
      view.tabClickAction(4);
      assert.strictEqual(view.serverType, ServerType.KDB);
    });
  });

  describe("toggleLabel", () => {
    it("should add a label", () => {
      view.labels = ["label1"];
      view.toggleLabel("label2", true);
      assert.deepStrictEqual(view.labels, ["label1", "label2"]);
    });

    it("should remove a label", () => {
      view.labels = ["label1", "label2"];
      view.toggleLabel("label1", false);
      assert.deepStrictEqual(view.labels, ["label2"]);
    });

    it("should hold a label once however often it is added", () => {
      view.labels = ["label1"];
      view.toggleLabel("label1", true);
      assert.deepStrictEqual(view.labels, ["label1"]);
    });

    it("should leave the rest alone when removing one it does not hold", () => {
      view.labels = ["label1"];
      view.toggleLabel("label2", false);
      assert.deepStrictEqual(view.labels, ["label1"]);
    });
  });

  describe("editing a connection", () => {
    it("should take the labels it is given without blanks or repeats", () => {
      view.handleMessage({
        data: {
          command: "editConnection",
          data: {},
          labels: ["label1", "", "label1", "label2"],
        },
      });
      assert.deepStrictEqual(view.labels, ["label1", "label2"]);
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

    it("should render tab-1", () => {
      view.render();

      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });

    it("should render tab-2", () => {
      view.render();

      assert.equal(renderServerNameStub.called, true);
      assert.equal(renderConnAddressStub.called, true);
      assert.equal(saveStub.called, false);
      assert.equal(changeTLSStub.called, false);
    });

    it("should render tab-3", () => {
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

    it("should set MyQ to false and return correct HTML when connType is 1  and render is filled", () => {
      view.connectionData = { connType: 1, serverName: "testServer" };
      view.oldAlias = "testServer";
      view.renderId = "test";
      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("My q"), true);
    });

    it("should set MyQ to false and return correct HTML when connType is 1", () => {
      view.connectionData = { connType: 1, serverName: "testServer" };
      view.oldAlias = "";
      view.renderId = "";
      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.KDB);
      assert.strictEqual(result.values[1].includes("My q"), true);
    });

    it("should set serverType to INSIGHTS and return correct HTML when connType is 2 and render is filled", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.oldAlias = "testServer";
      view.renderId = "test";

      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
    });

    it("should set serverType to INSIGHTS and return correct HTML when connType is 2", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.oldAlias = "";
      view.renderId = "";

      const result = view.renderEditConnectionForm();

      assert.strictEqual(view.oldAlias, "testServer");
      assert.strictEqual(view.serverType, ServerType.INSIGHTS);
      assert.strictEqual(result.values[1].includes("Insights"), true);
    });

    it("should set serverType to INSIGHTS and open labels modal", () => {
      view.connectionData = { connType: 2, serverName: "testServer" };
      view.openModal();

      const result = view.renderEditConnectionForm();
      const resultsStrings = JSON.stringify(result);

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

  describe("open sections of an edited connection", () => {
    it("should open Authentication & TLS for a connection with TLS on", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
        tls: true,
      };
      view.renderMyQEditForm();
      assert.strictEqual(
        view.renderSection("Authentication & TLS", "").values[0],
        true,
      );
    });

    it("should leave it closed for a connection without TLS", () => {
      view.connectionData = {
        port: "5000",
        serverAddress: "localhost",
        serverName: "local",
      };
      view.renderMyQEditForm();
      assert.strictEqual(
        view.renderSection("Authentication & TLS", "").values[0],
        false,
      );
    });

    it("should open Advanced for a connection that has a realm", () => {
      view.connectionData = {
        serverAddress: "https://localhost",
        serverName: "insights",
        realm: "kx",
      };
      view.renderInsightsEditForm();
      assert.strictEqual(view.renderSection("Advanced", "").values[0], true);
    });

    it("should open Advanced for a connection that skips SSL checks", () => {
      view.connectionData = {
        serverAddress: "https://localhost",
        serverName: "insights",
        insecure: true,
      };
      view.renderInsightsEditForm();
      assert.strictEqual(view.renderSection("Advanced", "").values[0], true);
    });

    it("should leave Advanced closed for a plain connection", () => {
      view.connectionData = {
        serverAddress: "https://localhost",
        serverName: "insights",
      };
      view.renderInsightsEditForm();
      assert.strictEqual(view.renderSection("Advanced", "").values[0], false);
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
          command === "kdb.connections.add.kdb" ||
          command === "kdb.connections.add.insights"
        ) {
          result = data;
        }
      });
      view.save();
      assert.ok(result);
      view.save();
      assert.ok(result);
      view.serverType = ServerType.INSIGHTS;
      view.save();
      assert.ok(result);
      sinon.restore();
    });
  });

  describe("createLabel", () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it("should post a message and update labels after timeout", () => {
      const api = acquireVsCodeApi();
      const postMessageStub = sinon.stub(api, "postMessage");
      const closeModalStub = sinon.stub(view, "closeModal");

      view.newLblName = "Test Label";
      view.newLblColorName = "Test Color";
      view.labels = [];

      view.createLabel();

      sinon.assert.calledOnce(postMessageStub);

      clock.tick(500);

      assert.equal(view.labels[0], "Test Label");
      sinon.assert.calledOnce(closeModalStub);

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
          command === "kdb.connections.edit.kdb" ||
          command === "kdb.connections.edit.insights"
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

  describe("createLabel", () => {});
});
