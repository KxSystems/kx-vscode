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

import * as assert from "assert";
import * as sinon from "sinon";
import Path from "path";
import mock from "mock-fs";
import { Uri, workspace } from "vscode";
import * as tools from "../../src/commands/buildToolsCommand";

describe("buildTools", () => {
  function setQHome(path?: string) {
    sinon
      .stub(workspace, "getConfiguration")
      .value(() => ({ get: () => path }));
  }

  function setAxHome(path?: string) {
    sinon.stub(process.env, "AXLIBRARIES_HOME").value(path);
  }

  function openTextDocument(path: string) {
    return workspace.openTextDocument(
      Uri.file(Path.resolve("/workspace", path)).with({
        scheme: "untitled",
      }),
    );
  }

  beforeEach(() => {
    mock({
      "/workspace": {
        "lint.q": "a;a:1",
      },
    });
  });

  afterEach(() => {
    mock.restore();
    sinon.restore();
  });

  describe("connectBuildTools", () => {
    it("should connect build tools", async () => {
      await assert.doesNotReject(() => tools.connectBuildTools());
    });
  });

  describe("lintCommand", () => {
    it("should reject if q home directory is not set", async () => {
      setQHome();
      setAxHome("/ax");
      const document = await openTextDocument("lint.q");
      await assert.rejects(() => tools.lintCommand(document));
    });
    it("should reject if ax home directory is not set", async () => {
      setAxHome();
      setQHome("/q");
      const document = await openTextDocument("lint.q");
      await assert.rejects(() => tools.lintCommand(document));
    });
  });
});
