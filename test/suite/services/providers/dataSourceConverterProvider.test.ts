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

import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { createPanel } from "./provider.utils.test";
import * as queryCommand from "../../../../src/commands/queryCommand";
import { ext } from "../../../../src/extensionVariables";
import { DataSourceConverterProvider } from "../../../../src/services/dataSourceConverterProvider";
import { QueryEditorProvider } from "../../../../src/services/queryEditorProvider";
import * as workspaceUtils from "../../../../src/utils/workspace";

describe("dataSourceConverterProvider", () => {
  const context = <vscode.ExtensionContext>{};
  const source = vscode.Uri.file("/tmp/datasource.kdb.json");
  const target = vscode.Uri.file("/tmp/datasource.kxquery");
  const document = <vscode.TextDocument>{ uri: source };

  let convertDataSource: sinon.SinonStub;
  let openWith: sinon.SinonStub;
  let queryTreeProvider: any;
  let scratchpadTreeProvider: any;

  beforeEach(() => {
    ext.outputChannel = vscode.window.createOutputChannel("kdb", { log: true });
    convertDataSource = sinon.stub(queryCommand, "convertDataSource");
    openWith = sinon.stub(workspaceUtils, "openWith").resolves();
    queryTreeProvider = ext.queryTreeProvider;
    scratchpadTreeProvider = ext.scratchpadTreeProvider;
    ext.queryTreeProvider = <any>{ reload: sinon.stub() };
    ext.scratchpadTreeProvider = <any>{ reload: sinon.stub() };
  });

  afterEach(() => {
    ext.queryTreeProvider = queryTreeProvider;
    ext.scratchpadTreeProvider = scratchpadTreeProvider;
    sinon.restore();
  });

  it("should recognize the files it converts", () => {
    assert.strictEqual(DataSourceConverterProvider.isConvertible(source), true);
    assert.strictEqual(
      DataSourceConverterProvider.isConvertible(target),
      false,
    );
  });

  it("should open what it wrote and close itself", async () => {
    convertDataSource.resolves({ target, written: true });
    const panel = createPanel();

    await new DataSourceConverterProvider(context).resolveCustomTextEditor(
      document,
      panel.panel,
    );

    sinon.assert.calledWith(openWith, target, QueryEditorProvider.viewType);
    assert.strictEqual(panel.disposed, 1);
    sinon.assert.calledOnce(<sinon.SinonStub>ext.queryTreeProvider.reload);
  });

  it("should open the query file a converted datasource already has", async () => {
    convertDataSource.resolves({ target, written: false });
    const panel = createPanel();

    await new DataSourceConverterProvider(context).resolveCustomTextEditor(
      document,
      panel.panel,
    );

    sinon.assert.calledWith(openWith, target, QueryEditorProvider.viewType);
    assert.strictEqual(panel.disposed, 1);
    sinon.assert.notCalled(<sinon.SinonStub>ext.queryTreeProvider.reload);
  });

  it("should stay put when there was nothing to convert", async () => {
    convertDataSource.resolves(undefined);
    const panel = createPanel();

    await new DataSourceConverterProvider(context).resolveCustomTextEditor(
      document,
      panel.panel,
    );

    sinon.assert.notCalled(openWith);
    assert.strictEqual(panel.disposed, 0);
  });
});
