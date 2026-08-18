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

import assert from "assert";
import * as sinon from "sinon";
import { Uri } from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as plotUtils from "../../../src/utils/plotUtils";
import * as workspaceUtils from "../../../src/utils/workspace";

describe("plotUtils", () => {
  const data = "data:image/png;base64,iVBORw0KGgo=";

  beforeEach(() => {
    ext.activeTextEditor = undefined;
  });

  afterEach(() => {
    sinon.restore();
    ext.activeTextEditor = undefined;
  });

  describe("writePlotToFile", () => {
    it("should write without an active editor", async () => {
      const addWorkspaceFile = sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      await plotUtils.writePlotToFile(data);

      // A notebook only session has no active editor; the image must not be
      // dropped on the floor because of it.
      sinon.assert.calledOnceWithExactly(
        addWorkspaceFile,
        undefined,
        "plot",
        ".plot",
      );
      sinon.assert.calledOnce(setUriContent);
    });

    it("should give each image its own chart document", async () => {
      const addWorkspaceFile = sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .onFirstCall()
        .resolves(Uri.file("/tmp/plot-1.plot"))
        .onSecondCall()
        .resolves(Uri.file("/tmp/plot-2.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      // A process emitting three images in one call must not collapse them
      // into a single chart view.
      await plotUtils.writePlotToFile(data);
      await plotUtils.writePlotToFile(data);

      sinon.assert.calledTwice(addWorkspaceFile);
      sinon.assert.calledTwice(setUriContent);
      assert.notStrictEqual(
        setUriContent.getCall(0).args[0].toString(),
        setUriContent.getCall(1).args[0].toString(),
      );
    });

    it("should write the plot as a chart document", async () => {
      ext.activeTextEditor = <any>{
        document: { uri: Uri.file("/tmp/a.kdb.q") },
      };
      sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      await plotUtils.writePlotToFile(data);

      sinon.assert.calledOnce(setUriContent);
      assert.deepStrictEqual(JSON.parse(setUriContent.getCall(0).args[1]), {
        charts: [{ data }],
      });
    });
  });
});
