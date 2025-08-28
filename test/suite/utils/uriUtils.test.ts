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

import * as uriUtils from "../../../src/utils/uriUtils";

describe("uriUtils", () => {
  describe("getUri", () => {
    it("should return a Uri object", () => {
      const panel = vscode.window.createWebviewPanel(
        "testPanel",
        "Test Panel",
        vscode.ViewColumn.One,
        {},
      );
      const webview = panel.webview;
      const extensionUri = vscode.Uri.parse("file:///path/to/extension");
      const pathList = ["path", "to", "file.txt"];
      const uri = uriUtils.getUri(webview, extensionUri, pathList);

      assert.ok(uri instanceof vscode.Uri);
    });

    it("should return a Uri object with the correct path", () => {
      const panel = vscode.window.createWebviewPanel(
        "testPanel",
        "Test Panel",
        vscode.ViewColumn.One,
        {},
      );
      const webview = panel.webview;
      const extensionUri = vscode.Uri.parse("file:///path/to/extension");
      const pathList = ["path", "to", "file.txt"];
      const uri = uriUtils.getUri(webview, extensionUri, pathList);

      assert.strictEqual(uri.path, "/path/to/extension/path/to/file.txt");
    });
  });

  describe("openUrl", () => {
    let envOpenExternalStub: sinon.SinonStub;

    beforeEach(() => {
      envOpenExternalStub = sinon.stub(vscode.env, "openExternal");
    });

    afterEach(() => {
      envOpenExternalStub.restore();
    });

    it("should call env.openExternal for a valid url", async () => {
      const validUrl = "https://example.com";

      await uriUtils.openUrl(validUrl);
      assert.ok(envOpenExternalStub.calledOnceWith(vscode.Uri.parse(validUrl)));
    });
  });
});
