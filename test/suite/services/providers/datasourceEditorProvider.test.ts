/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { createPanel } from "./provider.utils.test";
import { InsightsConnection } from "../../../../src/classes/insightsConnection";
import { LocalConnection } from "../../../../src/classes/localConnection";
import { ext } from "../../../../src/extensionVariables";
import { MetaObject } from "../../../../src/models/meta";
import { ConnectionManagementService } from "../../../../src/services/connectionManagerService";
import { DataSourceEditorProvider } from "../../../../src/services/dataSourceEditorProvider";
import { InsightsNode } from "../../../../src/services/kdbTreeProvider";
import * as utils from "../../../../src/utils/uriUtils";

describe("dataSourceEditorProvider", () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = <vscode.ExtensionContext>{};
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("register", () => {
    it("should register the provider", () => {
      let result = undefined;
      sinon
        .stub(vscode.window, "registerCustomEditorProvider")
        .value(() => (result = true));
      DataSourceEditorProvider.register(context);
      assert.ok(result);
    });
  });

  describe("resolveCustomTextEditor", () => {
    it("should resolve ", async () => {
      const provider = new DataSourceEditorProvider(context);
      const document = await vscode.workspace.openTextDocument({
        language: "q",
        content: "{}",
      });
      sinon.stub(utils, "getUri").value(() => "");
      const panel = createPanel();
      await assert.doesNotReject(() =>
        provider.resolveCustomTextEditor(document, panel.panel),
      );
      panel.listeners.onDidReceiveMessage({});
      panel.listeners.onDidChangeViewState();
      panel.listeners.onDidDispose();
    });

    describe("getMeta", () => {
      const dummyMeta: MetaObject = {
        header: {
          ac: "0",
          agg: ":127.0.0.1:5070",
          ai: "",
          api: ".kxi.getMeta",
          client: ":127.0.0.1:5050",
          corr: "CorrHash",
          http: "json",
          logCorr: "logCorrHash",
          protocol: "gw",
          rc: "0",
          rcvTS: "2099-05-22T11:06:33.650000000",
          retryCount: "0",
          to: "2099-05-22T11:07:33.650000000",
          userID: "dummyID",
          userName: "testUser",
        },
        payload: {
          rc: [
            {
              api: 3,
              agg: 1,
              assembly: 1,
              schema: 1,
              rc: "dummy-rc",
              labels: [{ kxname: "dummy-assembly" }],
              started: "2023-10-04T17:20:57.659088747",
            },
          ],
          dap: [],
          api: [],
          agg: [
            {
              aggFn: ".sgagg.aggFnDflt",
              custom: false,
              full: true,
              metadata: {
                description: "dummy desc.",
                params: [{ description: "dummy desc." }],
                return: { description: "dummy desc." },
                misc: {},
              },
              procs: [],
            },
          ],
          assembly: [
            {
              assembly: "dummy-assembly",
              kxname: "dummy-assembly",
              tbls: ["dummyTbl"],
            },
          ],
          schema: [],
        },
      };

      const dummyMetaNoAssembly: MetaObject = {
        header: {
          ac: "0",
          agg: ":127.0.0.1:5070",
          ai: "",
          api: ".kxi.getMeta",
          client: ":127.0.0.1:5050",
          corr: "CorrHash",
          http: "json",
          logCorr: "logCorrHash",
          protocol: "gw",
          rc: "0",
          rcvTS: "2099-05-22T11:06:33.650000000",
          retryCount: "0",
          to: "2099-05-22T11:07:33.650000000",
          userID: "dummyID",
          userName: "testUser",
        },
        payload: {
          rc: [
            {
              api: 3,
              agg: 1,
              assembly: 1,
              schema: 1,
              rc: "dummy-rc",
              labels: [{ kxname: "dummy-assembly" }],
              started: "2023-10-04T17:20:57.659088747",
            },
          ],
          dap: [],
          api: [],
          agg: [
            {
              aggFn: ".sgagg.aggFnDflt",
              custom: false,
              full: true,
              metadata: {
                description: "dummy desc.",
                params: [{ description: "dummy desc." }],
                return: { description: "dummy desc." },
                misc: {},
              },
              procs: [],
            },
          ],
          assembly: [],
          schema: [],
        },
      };
      const insightsNode = new InsightsNode(
        [],
        "insightsnode1",
        {
          server: "https://insightsservername.com/",
          alias: "insightsserveralias",
          auth: true,
        },
        vscode.TreeItemCollapsibleState.None,
      );
      const insightsConn = new InsightsConnection(
        insightsNode.label,
        insightsNode,
      );
      const localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);
      const connMngService = new ConnectionManagementService();
      let isConnetedStub, _retrieveConnectedConnectionStub: sinon.SinonStub;
      beforeEach(() => {
        isConnetedStub = sinon.stub(connMngService, "isConnected");
        _retrieveConnectedConnectionStub = sinon.stub(
          connMngService,
          "retrieveConnectedConnection",
        );
      });
      afterEach(() => {
        ext.connectedConnectionList.length = 0;
        ext.connectedContextStrings.length = 0;
      });

      it("Should return empty object if the connection selected is not connected", async () => {
        isConnetedStub.returns(false);
        const provider = new DataSourceEditorProvider(context);
        const result = await provider.getMeta(insightsConn.connLabel);
        assert.deepStrictEqual(result, {});
      });

      it("Should return empty object if the connection selected is undefined", async () => {
        ext.connectedContextStrings.push(insightsConn.connLabel);
        isConnetedStub.resolves(true);
        const provider = new DataSourceEditorProvider(context);
        const result = await provider.getMeta(insightsConn.connLabel);
        assert.deepStrictEqual(result, {});
      });

      it("Should return empty object if the connection selected is a LocalConnection", async () => {
        ext.connectedContextStrings.push(localConn.connLabel);
        ext.connectedConnectionList.push(localConn);
        isConnetedStub.resolves(true);
        const provider = new DataSourceEditorProvider(context);
        const result = await provider.getMeta(localConn.connLabel);
        assert.deepStrictEqual(result, {});
      });
      it("Should return empty object if the meta is undefined", async () => {
        ext.connectedContextStrings.push(insightsConn.connLabel);
        ext.connectedConnectionList.push(insightsConn);
        isConnetedStub.resolves(true);
        const provider = new DataSourceEditorProvider(context);
        const result = await provider.getMeta(insightsConn.connLabel);
        assert.deepStrictEqual(result, {});
      });
      it("Should return empty object if the meta has no assembly", async () => {
        ext.connectedContextStrings.push(insightsConn.connLabel);
        ext.connectedConnectionList.push(insightsConn);
        isConnetedStub.resolves(true);
        insightsConn.meta = dummyMetaNoAssembly;
        const provider = new DataSourceEditorProvider(context);
        const result = await provider.getMeta(insightsConn.connLabel);
        assert.deepStrictEqual(result, {});
      });
      it("Should return empty object if the meta has no assembly", async () => {
        ext.connectedContextStrings.push(insightsConn.connLabel);
        ext.connectedConnectionList.push(insightsConn);
        isConnetedStub.resolves(true);
        insightsConn.meta = dummyMeta;
        const provider = new DataSourceEditorProvider(context);
        const result = await provider.getMeta(insightsConn.connLabel);
        assert.deepStrictEqual(result, dummyMeta.payload);
      });
    });
  });
});
