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
import { Uri, window, workspace } from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as plotUtils from "../../../src/utils/plotUtils";
import * as workspaceUtils from "../../../src/utils/workspace";

describe("plotUtils", () => {
  const data = "data:image/png;base64,iVBORw0KGgo=";

  beforeEach(() => {
    ext.outputChannel = window.createOutputChannel("kdb", { log: true });
    ext.activeTextEditor = undefined;
    ext.pendingImageTargets.clear();
  });

  afterEach(() => {
    sinon.restore();
    ext.activeTextEditor = undefined;
    ext.pendingImageTargets.clear();
  });

  function makeCell(): any {
    return {
      kind: 2,
      index: 0,
      metadata: {},
      executionSummary: undefined,
      outputs: [],
      document: { getText: () => "1+1", languageId: "q" },
      notebook: { uri: Uri.file("/tmp/a.kxnb") },
    };
  }

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

  describe("registerImageTarget", () => {
    it("should retire an entry once it can no longer receive an image", () => {
      const clock = sinon.useFakeTimers();
      try {
        const stale = plotUtils.registerImageTarget("old", <any>{}, makeCell());
        stale.endedAt = Date.now();

        clock.tick(30000);
        plotUtils.registerImageTarget("new", <any>{}, makeCell());

        assert.ok(!ext.pendingImageTargets.has("old"));
        assert.ok(ext.pendingImageTargets.has("new"));
      } finally {
        clock.restore();
      }
    });

    it("should keep an entry whose cell can still receive an image", () => {
      const clock = sinon.useFakeTimers();
      try {
        const recent = plotUtils.registerImageTarget(
          "old",
          <any>{},
          makeCell(),
        );
        recent.endedAt = Date.now();

        clock.tick(1000);
        plotUtils.registerImageTarget("new", <any>{}, makeCell());

        assert.ok(ext.pendingImageTargets.has("old"));
      } finally {
        clock.restore();
      }
    });

    it("should bound how many entries are held at once", () => {
      for (let i = 0; i < 120; i++) {
        plotUtils.registerImageTarget(`req-${i}`, <any>{}, makeCell());
      }

      assert.ok(ext.pendingImageTargets.size <= 100);
      assert.ok(ext.pendingImageTargets.has("req-119"));
      assert.ok(!ext.pendingImageTargets.has("req-0"));
    });
  });

  describe("renderImage", () => {
    it("should append to the cell that is still executing", async () => {
      const appendOutput = sinon.spy();
      const target = plotUtils.registerImageTarget(
        "req-1",
        <any>{ appendOutput },
        makeCell(),
      );
      const addWorkspaceFile = sinon.stub(workspaceUtils, "addWorkspaceFile");

      await plotUtils.renderImage("req-1", data);

      sinon.assert.calledOnce(appendOutput);
      assert.strictEqual(
        appendOutput.getCall(0).args[0].items[0].mime,
        "text/html",
      );
      assert.strictEqual(target.outputs.length, 1);
      sinon.assert.notCalled(addWorkspaceFile);
    });

    it("should edit the document when the cell has already ended", async () => {
      const cell = makeCell();
      const target = plotUtils.registerImageTarget("req-1", <any>{}, cell);
      target.endedAt = Date.now();
      const applyEdit = sinon.stub(workspace, "applyEdit").resolves(true);
      const addWorkspaceFile = sinon.stub(workspaceUtils, "addWorkspaceFile");

      await plotUtils.renderImage("req-1", data);

      sinon.assert.calledOnce(applyEdit);
      sinon.assert.notCalled(addWorkspaceFile);
    });

    it("should fall back to a file for an unknown requestID", async () => {
      sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      await plotUtils.renderImage("no-such-request", data);

      sinon.assert.calledOnce(setUriContent);
    });

    it("should fall back to a file when the process echoed no id", async () => {
      plotUtils.registerImageTarget(
        "req-1",
        <any>{ appendOutput: sinon.spy() },
        makeCell(),
      );
      sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      await plotUtils.renderImage("", data);

      sinon.assert.calledOnce(setUriContent);
    });

    it("should fall back to a file when appending to the cell throws", async () => {
      plotUtils.registerImageTarget(
        "req-1",
        <any>{
          appendOutput: () => {
            throw new Error("execution ended");
          },
        },
        makeCell(),
      );
      sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      await plotUtils.renderImage("req-1", data);

      sinon.assert.calledOnce(setUriContent);
    });
  });
});
