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
import { ChartEditorProvider } from "../../../../src/services/chartEditorProvider";
import * as utils from "../../../../src/utils/uriUtils";

describe("ChartEditorProvider", () => {
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
      ChartEditorProvider.register(context);
      assert.ok(result);
    });
  });

  describe("resolveCustomTextEditor", () => {
    it("should resolve", async () => {
      const provider = new ChartEditorProvider(context);
      const document = await vscode.workspace.openTextDocument({
        language: "kdbplot",
        content: "{}",
      });
      sinon.stub(utils, "getUri").value(() => "");
      const panel = createPanel();
      await assert.doesNotReject(
        provider.resolveCustomTextEditor(document, panel.panel),
      );
      panel.listeners.onDidReceiveMessage({});
      panel.listeners.onDidChangeViewState();
      panel.listeners.onDidDispose();
    });
  });
});
