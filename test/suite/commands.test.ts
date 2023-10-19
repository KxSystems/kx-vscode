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

import * as sinon from "sinon";
import * as vscode from "vscode";
import * as dataSourceCommand from "../../src/commands/dataSourceCommand";
import * as installTools from "../../src/commands/installTools";
import * as serverCommand from "../../src/commands/serverCommand";
import * as walkthroughCommand from "../../src/commands/walkthroughCommand";

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
  //write tests for src/commands/serverCommand.ts
  //function to be deleted after write the tests
  serverCommand.addNewConnection();
  describe("writeQueryResultsToView", () => {
    it("should call executeCommand with correct arguments", () => {
      const result = { data: [1, 2, 3] };
      const dataSourceType = "test";
      const executeCommandStub = sinon.stub(vscode.commands, "executeCommand");

      serverCommand.writeQueryResultsToView(result, dataSourceType);

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
  });
});
describe("walkthroughCommand", () => {
  //write tests for src/commands/walkthroughCommand.ts
  //function to be deleted after write the tests
  walkthroughCommand.showInstallationDetails();
});
