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
import { LanguageClient } from "vscode-languageclient/node";

import * as clientCommand from "../../../src/commands/clientCommand";
import * as dataSourceCommand from "../../../src/commands/dataSourceCommand";
import * as executionCommand from "../../../src/commands/executionCommand";
import { ext } from "../../../src/extensionVariables";

describe("clientCommands", () => {
  const client = sinon.createStubInstance(LanguageClient);
  let executeBlock;
  let toggleParameterCache;

  beforeEach(() => {
    const context = <vscode.ExtensionContext>{ subscriptions: [] };
    sinon.stub(vscode.commands, "registerCommand").value((a, b) => b);
    clientCommand.connectClientCommands(context, client);
    executeBlock = context.subscriptions[0];
    toggleParameterCache = context.subscriptions[1];
    ext.activeTextEditor = <vscode.TextEditor>{
      options: { insertSpaces: true, indentSize: 4 },
      selection: { active: new vscode.Position(0, 0) },
      document: {
        uri: vscode.Uri.file("/tmp/some.q"),
        getText: () => "",
      },
    };
  });
  afterEach(() => {
    sinon.restore();
    ext.activeTextEditor = undefined;
  });
  describe("executeBlock", () => {
    it("should execute current block", async () => {
      sinon
        .stub(client, "sendRequest")
        .value(async () => new vscode.Range(0, 0, 1, 1));
      sinon.stub(executionCommand, "executeActiveEditorQuery").value(() => {});
      await executeBlock(client);
      assert.deepEqual(
        ext.activeTextEditor.selection,
        new vscode.Selection(0, 0, 1, 1),
      );
    });
  });
  describe("kdb.toggleParameterCache", () => {
    it("should add parameter cache for single line functions", async () => {
      let edit: vscode.WorkspaceEdit;
      sinon.stub(client, "sendRequest").value(async () => ({
        params: ["a"],
        start: new vscode.Position(0, 0),
        end: new vscode.Position(0, 10),
      }));
      sinon.stub(vscode.workspace, "applyEdit").value(async (a) => (edit = a));
      await toggleParameterCache(client);
      assert.strictEqual(edit.size, 1);
    });
    it("should add parameter cache for multi line functions", async () => {
      let edit: vscode.WorkspaceEdit;
      sinon.stub(client, "sendRequest").value(async () => ({
        params: ["a"],
        start: new vscode.Position(0, 0),
        end: new vscode.Position(1, 10),
      }));
      sinon.stub(vscode.workspace, "applyEdit").value(async (a) => (edit = a));
      await toggleParameterCache(client);
      assert.strictEqual(edit.size, 1);
    });
  });

  describe("getPartialDatasourceFile", () => {
    it("should return qsql datatsource", () => {
      const res = dataSourceCommand.getPartialDatasourceFile("query");
      assert.strictEqual(res.dataSource.selectedType, "QSQL");
    });
    it("should return sql datatsource", () => {
      const res = dataSourceCommand.getPartialDatasourceFile(
        "query",
        "dap",
        true,
      );
      assert.strictEqual(res.dataSource.selectedType, "SQL");
    });
  });
});
