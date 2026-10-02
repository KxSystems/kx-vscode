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

import * as assert from "node:assert";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { findQBinary } from "../../../src/commands/setupCommand";
import * as coreUtils from "../../../src/utils/core";

describe("setupCommand", () => {
  describe("findQBinary", () => {
    const folder = (name: string, index: number) =>
      <vscode.WorkspaceFolder>{
        name,
        index,
        uri: vscode.Uri.file(`/ws/${name}`),
      };
    const a = folder("a", 0);
    const b = folder("b", 1);
    const c = folder("c", 2);

    let folders: vscode.WorkspaceFolder[] | undefined;
    let qBins: Map<vscode.WorkspaceFolder | undefined, string>;
    let active: vscode.WorkspaceFolder | undefined;

    beforeEach(() => {
      folders = [a, b, c];
      qBins = new Map();
      active = undefined;
      sinon.stub(vscode.workspace, "workspaceFolders").get(() => folders);
      sinon
        .stub(coreUtils, "getEnvironment")
        .callsFake((folder) => ({ qBinPath: qBins.get(folder) ?? "" }));
      sinon
        .stub(vscode.window, "activeTextEditor")
        .get(() =>
          active
            ? { document: { uri: vscode.Uri.joinPath(active.uri, "x.q") } }
            : undefined,
        );
      sinon
        .stub(vscode.workspace, "getWorkspaceFolder")
        .callsFake(() => active);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should use the global q with no workspace folder", () => {
      folders = undefined;
      qBins.set(undefined, "/global/q");
      assert.strictEqual(findQBinary(), "/global/q");
    });

    it("should use the folder the welcome page was opened for", () => {
      qBins.set(a, "/a/q");
      assert.strictEqual(findQBinary(b), "");
    });

    it("should ignore a welcome folder no longer in the workspace", () => {
      qBins.set(a, "/a/q");
      assert.strictEqual(findQBinary(folder("gone", 3)), "/a/q");
    });

    it("should prefer the folder of the active editor", () => {
      qBins.set(a, "/a/q");
      qBins.set(c, "/c/q");
      active = c;
      assert.strictEqual(findQBinary(), "/c/q");
    });

    it("should fall back to the first folder that has a q", () => {
      qBins.set(b, "/b/q");
      qBins.set(c, "/c/q");
      active = a;
      assert.strictEqual(findQBinary(), "/b/q");
    });

    it("should find no q when no folder has one", () => {
      assert.strictEqual(findQBinary(), "");
    });
  });
});
