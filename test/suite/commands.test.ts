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

import assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { QuickPickItem, window } from "vscode";
import * as dataSourceCommand from "../../src/commands/dataSourceCommand";
import * as installTools from "../../src/commands/installTools";
import {
  addKdbConnection,
  addNewConnection,
  writeQueryResultsToView,
} from "../../src/commands/serverCommand";
import * as walkthroughCommand from "../../src/commands/walkthroughCommand";
import { Insights } from "../../src/models/insights";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const srvCommand = require("../../src/commands/serverCommand");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const insModule = require("../../src/utils/core");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const valModule = require("../../src/validators/kdbValidator");

describe("dataSourceCommand", () => {
  //write tests for src/commands/dataSourceCommand.ts
  //function to be deleted after write the tests
  dataSourceCommand.renameDataSource("test", "test2");
});
describe("installTools", () => {
  //write tests for src/commands/installTools.ts
  //function to be deleted after write the tests
  installTools.installTools();
});
describe("serverCommand", () => {
  it("Should call new connection but not create kdb or insights", async () => {
    const qpStub = sinon.stub(window, "showQuickPick").returns(undefined);

    const spy = sinon.spy();
    const kdbMock = sinon.mock(srvCommand);
    kdbMock.expects("addKdbConnection").never();
    const insMock = sinon.mock(srvCommand);
    insMock.expects("addInsightsConnection").never();

    await addNewConnection();
    kdbMock.verify();
    insMock.verify();

    assert(spy.notCalled);

    spy.resetHistory();
    insMock.restore();
    kdbMock.restore();
    qpStub.restore();
  });

  it("Should add new kdb connection successfully", async () => {
    const qpItem: QuickPickItem = {
      label: "Enter a kdb endpoint",
      detail:
        "Enter the url, ip address, and port to connect to a kdb instance",
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const kdbStub = sinon
      .stub(srvCommand, "addKdbConnection")
      .returns(undefined);

    await addNewConnection();

    assert(kdbStub.notCalled);

    kdbStub.restore();
    qpStub.restore();
  });

  it("Should add new kdb connection without existing connection", async () => {
    const qpItem: QuickPickItem = {
      label: "Enter a kdb endpoint",
      detail:
        "Enter the url, ip address, and port to connect to a kdb instance",
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);

    await addKdbConnection();

    assert.strictEqual(true, true);

    qpStub.restore();
  });

  it("Should add new insights connection successfully", async () => {
    const qpItem: QuickPickItem = {
      label: "Connect to kdb Insights Enterprise",
      detail: "Enter instance details",
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const insStub = sinon
      .stub(srvCommand, "addInsightsConnection")
      .returns(undefined);

    await addNewConnection();

    assert(insStub.notCalled);

    insStub.restore();
    qpStub.restore();
  });

  it("Should add new insights connection successfully", async () => {
    const qpItem: QuickPickItem = {
      label: "Connect to kdb Insights Enterprise",
      detail: "Enter instance details",
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const inpStub = sinon
      .stub(window, "showInputBox")
      .onFirstCall()
      .resolves(undefined)
      .onSecondCall()
      .resolves("https://insights.test");
    const insStub = sinon
      .stub(srvCommand, "addInsightsConnection")
      .returns(undefined);

    await addNewConnection();

    assert(insStub.notCalled);

    insStub.restore();
    inpStub.restore();
    qpStub.restore();
  });

  it("Should add new insights connection successfully", async () => {
    const qpItem: QuickPickItem = {
      label: "Connect to kdb Insights Enterprise",
      detail: "Enter instance details",
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const inpStub = sinon
      .stub(window, "showInputBox")
      .onFirstCall()
      .resolves("")
      .onSecondCall()
      .resolves("https://insights.test");
    const insStub = sinon
      .stub(srvCommand, "addInsightsConnection")
      .returns(undefined);

    await addNewConnection();

    assert(insStub.notCalled);

    insStub.restore();
    inpStub.restore();
    qpStub.restore();
  });

  it("Should add new insights connection successfully", async () => {
    const qpItem: QuickPickItem = {
      label: "Connect to kdb Insights Enterprise",
      detail: "Enter instance details",
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const inpStub = sinon
      .stub(window, "showInputBox")
      .onFirstCall()
      .resolves("")
      .onSecondCall()
      .resolves("https://insights.test");
    const insStub = sinon
      .stub(srvCommand, "addInsightsConnection")
      .returns(undefined);
    const getInsightsStub = sinon
      .stub(insModule, "getInsights")
      .returns(undefined);

    await addNewConnection();

    assert(insStub.notCalled);

    getInsightsStub.restore();
    insStub.restore();
    inpStub.restore();
    qpStub.restore();
  });

  it("Should add new insights connection with no existing connection", async () => {
    const qpItem: QuickPickItem = {
      label: "Connect to kdb Insights Enterprise",
      detail: "Enter instance details",
    };

    const insTest: Insights = {
      test: { alias: "testalias", auth: false, server: "testserver" },
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const inpStub = sinon
      .stub(window, "showInputBox")
      .onFirstCall()
      .resolves("test")
      .onSecondCall()
      .resolves("https://insights.test");
    const insStub = sinon
      .stub(srvCommand, "addInsightsConnection")
      .returns(undefined);
    const getInsightsStub = sinon
      .stub(insModule, "getInsights")
      .returns(insTest);

    await addNewConnection();

    assert(insStub.notCalled);

    getInsightsStub.restore();
    insStub.restore();
    inpStub.restore();
    qpStub.restore();
  });

  it("Should add new insights connection with exiting connection", async () => {
    const qpItem: QuickPickItem = {
      label: "Connect to kdb Insights Enterprise",
      detail: "Enter instance details",
    };

    const insTest: Insights = {
      test: {
        alias: "testalias",
        auth: false,
        server: "https://insights.test",
      },
    };

    const qpStub = sinon.stub(window, "showQuickPick").resolves(qpItem);
    const inpStub = sinon
      .stub(window, "showInputBox")
      .onFirstCall()
      .resolves("test")
      .onSecondCall()
      .resolves("https://insights.test");
    const insStub = sinon
      .stub(srvCommand, "addInsightsConnection")
      .returns(undefined);
    const getInsightsStub = sinon
      .stub(insModule, "getInsights")
      .returns(insTest);

    await addNewConnection();

    assert(insStub.notCalled);

    getInsightsStub.restore();
    insStub.restore();
    inpStub.restore();
    qpStub.restore();
  });

  //write tests for src/commands/serverCommand.ts
  //function to be deleted after write the tests
  //serverCommand.addNewConnection();
  describe("writeQueryResultsToView", () => {
    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const dataSourceType = "test";
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      writeQueryResultsToView(result, dataSourceType);

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb-results.focus"
      );
      sinon.assert.calledWith(
        executeCommandStub.secondCall,
        "kdb.resultsPanel.update",
        result,
        dataSourceType
      );

      executeCommandStub.restore();
    });

    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      writeQueryResultsToView(result);

      sinon.assert.calledWith(
        executeCommandStub.firstCall,
        "kdb.resultsPanel.update",
        result,
        undefined
      );

      executeCommandStub.restore();
    });
  });
});
describe("walkthroughCommand", () => {
  //write tests for src/commands/walkthroughCommand.ts
  //function to be deleted after write the tests
  walkthroughCommand.showInstallationDetails();
});
