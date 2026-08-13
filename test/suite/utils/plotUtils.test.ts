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
import { NotebookEdit, Uri, workspace } from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as plotUtils from "../../../src/utils/plotUtils";
import * as workspaceUtils from "../../../src/utils/workspace";

describe("plotUtils", () => {
  const data = "data:image/png;base64,iVBORw0KGgo=";

  afterEach(() => {
    sinon.restore();
    ext.activeCellExecutions.clear();
    ext.activeTextEditor = undefined;
  });

  describe("renderPlot", () => {
    const fakeCell = (outputs: any[] = []) =>
      <any>{
        index: 2,
        kind: 2,
        outputs,
        metadata: { target: "dap" },
        executionSummary: { executionOrder: 7 },
        document: {
          getText: () => "display()",
          languageId: "python",
        },
        notebook: { uri: Uri.file("/tmp/a.kxnb") },
      };

    const expectFileFallback = () => {
      ext.activeTextEditor = <any>{
        document: { uri: Uri.file("/tmp/a.kdb.q") },
      };
      sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      return sinon.stub(workspaceUtils, "setUriContent");
    };

    it("should append inline while the cell is running", async () => {
      const appendOutput = sinon.spy();
      const running = {
        execution: <any>{ appendOutput },
        cell: fakeCell(),
        plotted: false,
      };
      ext.activeCellExecutions.set("conn", running);

      await plotUtils.renderPlot(data, "conn");

      sinon.assert.calledOnce(appendOutput);
      assert.strictEqual(running.plotted, true);
    });

    it("should edit the cell when its execution has ended", async () => {
      const appendOutput = sinon.spy();
      const applyEdit = sinon.stub(workspace, "applyEdit").resolves(true);
      ext.activeCellExecutions.set("conn", {
        execution: <any>{ appendOutput },
        cell: fakeCell(),
        plotted: false,
        endedAt: Date.now(),
      });

      await plotUtils.renderPlot(data, "conn");

      // The finished execution must not be touched.
      sinon.assert.notCalled(appendOutput);
      sinon.assert.calledOnce(applyEdit);
    });

    it("should keep the cell's outputs, source and metadata", async () => {
      const existing = { id: "result" };
      const applyEdit = sinon.stub(workspace, "applyEdit").resolves(true);
      ext.activeCellExecutions.set("conn", {
        execution: <any>{ appendOutput: sinon.spy() },
        cell: fakeCell([existing]),
        plotted: false,
        endedAt: Date.now(),
      });

      // Notebook edits are not readable back off a WorkspaceEdit, so the
      // replacement is captured where it is built.
      const replaceCells = sinon.spy(NotebookEdit, "replaceCells");

      await plotUtils.renderPlot(data, "conn");

      sinon.assert.calledOnce(applyEdit);
      const [range, cells] = replaceCells.getCall(0).args;
      assert.deepStrictEqual([range.start, range.end], [2, 3]);

      const [replacement] = cells;
      assert.strictEqual(replacement.value, "display()");
      assert.strictEqual(replacement.languageId, "python");
      assert.deepStrictEqual(replacement.metadata, { target: "dap" });
      assert.deepStrictEqual(replacement.executionSummary, {
        executionOrder: 7,
      });
      assert.strictEqual(replacement.outputs.length, 2);
      assert.strictEqual(replacement.outputs[0], existing);
    });

    it("should fall back to a file for output long after the cell ended", async () => {
      const applyEdit = sinon.stub(workspace, "applyEdit").resolves(true);
      ext.activeCellExecutions.set("conn", {
        execution: <any>{ appendOutput: sinon.spy() },
        cell: fakeCell(),
        plotted: false,
        endedAt: Date.now() - 60000,
      });
      const setUriContent = expectFileFallback();

      await plotUtils.renderPlot(data, "conn");

      sinon.assert.notCalled(applyEdit);
      sinon.assert.calledOnce(setUriContent);
    });

    it("should not append to a cell running on another connection", async () => {
      const appendOutput = sinon.spy();
      ext.activeCellExecutions.set("other", {
        execution: <any>{ appendOutput },
        cell: fakeCell(),
        plotted: false,
      });
      sinon
        .stub(workspaceUtils, "addWorkspaceFile")
        .resolves(Uri.file("/tmp/plot-1.plot"));
      sinon.stub(workspaceUtils, "workspaceHas").returns(true);
      const setUriContent = sinon.stub(workspaceUtils, "setUriContent");

      await plotUtils.renderPlot(data, "conn");

      sinon.assert.notCalled(appendOutput);
      // Written to a file rather than into another connection's cell.
      sinon.assert.calledOnce(setUriContent);
    });

    it("should fall back to a file when appending throws", async () => {
      const appendOutput = sinon.stub().throws(new Error("execution ended"));
      ext.activeCellExecutions.set("conn", {
        execution: <any>{ appendOutput },
        cell: fakeCell(),
        plotted: false,
      });
      const setUriContent = expectFileFallback();

      await plotUtils.renderPlot(data, "conn");

      sinon.assert.calledOnce(appendOutput);
      sinon.assert.calledOnce(setUriContent);
    });
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
