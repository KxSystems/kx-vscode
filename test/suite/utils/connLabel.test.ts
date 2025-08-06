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

import { ext } from "../../../src/extensionVariables";
import { Labels } from "../../../src/models/labels";
import { KdbNode } from "../../../src/services/kdbTreeProvider";
import * as LabelsUtils from "../../../src/utils/connLabel";
import * as loggers from "../../../src/utils/loggers";
import * as notifications from "../../../src/utils/notifications";

describe("connLabels", () => {
  let getConfigurationStub: sinon.SinonStub;

  beforeEach(() => {
    getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
    ext.connLabelList.length = 0;
    ext.labelConnMapList.length = 0;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should get workspace labels", () => {
    const labels: Labels[] = [
      { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
    ];
    getConfigurationStub.returns({
      get: sinon.stub().returns(labels),
      update: sinon.stub(),
    });

    LabelsUtils.getWorkspaceLabels();

    assert.strictEqual(ext.connLabelList.length, 1);

    assert.deepStrictEqual(ext.connLabelList, labels);
  });

  it("should create a new label", () => {
    getConfigurationStub.returns({
      get: sinon.stub().returns([]),
      update: sinon.stub(),
    });

    LabelsUtils.createNewLabel("label1", "red");

    assert.strictEqual(ext.connLabelList.length, 1);
    assert.strictEqual(ext.connLabelList[0].name, "label1");
    assert.strictEqual(ext.connLabelList[0].color.name, "Red");
  });

  it("should handle empty label name", () => {
    getConfigurationStub.returns({
      get: sinon.stub(),
      update: sinon.stub(),
    });
    const logStub = sinon.stub(loggers, "kdbOutputLog");

    LabelsUtils.createNewLabel("", "red");

    sinon.assert.calledWith(
      logStub,
      "[connLabel] Label name can't be empty.",
      "ERROR",
    );
  });

  it("should handle no color selected", () => {
    getConfigurationStub.returns({
      get: sinon.stub(),
      update: sinon.stub(),
    });
    const logStub = sinon.stub(loggers, "kdbOutputLog");

    LabelsUtils.createNewLabel("label1", "randomColorName");

    sinon.assert.calledWith(
      logStub,
      "[connLabel] No Color selected for the label.",
      "ERROR",
    );
  });

  it("should get workspace labels connection map", () => {
    const connMap = [{ labelName: "label1", connections: ["conn1"] }];
    getConfigurationStub.returns({
      get: sinon.stub().returns(connMap),
      update: sinon.stub(),
    });

    LabelsUtils.getWorkspaceLabelsConnMap();

    assert.deepStrictEqual(ext.labelConnMapList, connMap);
  });

  it("should add connection to label", () => {
    ext.connLabelList.push({
      name: "label1",
      color: { name: "red", colorHex: "#FF0000" },
    });

    LabelsUtils.addConnToLabel("label1", "conn1");

    assert.strictEqual(ext.labelConnMapList.length, 1);
    assert.strictEqual(ext.labelConnMapList[0].labelName, "label1");
    assert.deepStrictEqual(ext.labelConnMapList[0].connections, ["conn1"]);
  });

  it("should remove connection from labels", () => {
    ext.labelConnMapList.push({
      labelName: "label1",
      connections: ["conn1", "conn2"],
    });
    getConfigurationStub.returns({
      get: sinon.stub(),
      update: sinon.stub(),
    });

    LabelsUtils.removeConnFromLabels("conn1");

    assert.deepStrictEqual(ext.labelConnMapList[0].connections, ["conn2"]);
  });

  it("should handle labels connection map", () => {
    ext.connLabelList.push({
      name: "label1",
      color: { name: "Red", colorHex: "#FF0000" },
    });
    ext.labelConnMapList.push({
      labelName: "label1",
      connections: ["conn2"],
    });

    getConfigurationStub.returns({
      get: sinon.stub(),
      update: sinon.stub(),
    });

    LabelsUtils.handleLabelsConnMap(["label1"], "conn2");

    assert.strictEqual(ext.labelConnMapList.length, 1);
    assert.deepStrictEqual(ext.labelConnMapList[0].connections, ["conn2"]);
  });

  it("should retrieve connection labels names", () => {
    ext.labelConnMapList.push({
      labelName: "label1",
      connections: ["conn1"],
    });
    const conn = new KdbNode(
      [],
      "conn1",
      {
        serverName: "kdbservername",
        serverAlias: "conn1",
        serverPort: "5001",
        managed: false,
        auth: false,
        tls: false,
      },
      vscode.TreeItemCollapsibleState.None,
    );

    const labels = LabelsUtils.retrieveConnLabelsNames(conn);

    assert.deepStrictEqual(labels, ["label1"]);
  });

  it("should rename a label", () => {
    const labels: Labels[] = [
      { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
    ];

    const getStub = sinon.stub();
    getStub.withArgs("kdb.connectionLabels").returns(labels);
    getStub.withArgs("kdb.labelsConnectionMap").returns([]);

    getConfigurationStub.returns({
      get: getStub,
      update: sinon.stub().returns(Promise.resolve()),
    });

    LabelsUtils.renameLabel("label1", "label2");

    assert.strictEqual(ext.connLabelList.length, 1);
    assert.strictEqual(ext.connLabelList[0].name, "label2");
  });

  it("should not rename a label if the name is the same of other label", () => {
    getConfigurationStub.returns({
      get: sinon.stub().returns([
        {
          name: "label2",
          color: { name: "red", colorHex: "#FF0000" },
        },
      ]),
      update: sinon.stub().returns(Promise.resolve()),
    });

    const logStub = sinon.stub(loggers, "kdbOutputLog");
    LabelsUtils.renameLabel("label1", "label2");
    sinon.assert.calledWith(
      logStub,
      "[connLabel] Label with this name already exists.",
      "ERROR",
    );
  });

  it("should not rename a label if the name is empty or the same of original label name", () => {
    getConfigurationStub.returns({
      get: sinon.stub(),
      update: sinon.stub().returns(Promise.resolve()),
    });

    LabelsUtils.renameLabel("label1", "");
    sinon.assert.notCalled(getConfigurationStub);

    LabelsUtils.renameLabel("label1", "label1");
    sinon.assert.notCalled(getConfigurationStub);
  });

  it("should set label color", () => {
    const labels: Labels[] = [
      { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
    ];
    getConfigurationStub.returns({
      get: sinon.stub().returns(labels),
      update: sinon.stub().returns(Promise.resolve()),
    });
    LabelsUtils.setLabelColor("label1", "Blue");
    assert.strictEqual(ext.connLabelList.length, 1);
    assert.deepStrictEqual(ext.connLabelList[0].color.name, "Blue");
  });

  it("should delete label", () => {
    const labels: Labels[] = [
      { name: "label1", color: { name: "red", colorHex: "#FF0000" } },
    ];
    getConfigurationStub.returns({
      get: sinon.stub().returns(labels),
      update: sinon.stub().returns(Promise.resolve()),
    });
    LabelsUtils.deleteLabel("label1");
    assert.strictEqual(ext.connLabelList.length, 0);
  });

  it("should get label statistics", () => {
    ext.connLabelList.push(
      { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
      { name: "Label2", color: { name: "Blue", colorHex: "#0000FF" } },
      { name: "Label3", color: { name: "Red", colorHex: "#FF0000" } },
    );

    const stats = LabelsUtils.getLabelStatistics();

    assert.strictEqual(stats.count, 3);
    assert.strictEqual(stats.Red, 2);
    assert.strictEqual(stats.Blue, 1);
    assert.strictEqual(stats.Green, 0);
    assert.strictEqual(stats.Yellow, 0);
    assert.strictEqual(stats.Magenta, 0);
    assert.strictEqual(stats.Cyan, 0);
  });

  it("should get connection label statistics", () => {
    ext.connLabelList.push(
      { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
      { name: "Label2", color: { name: "Blue", colorHex: "#0000FF" } },
      { name: "Label3", color: { name: "Red", colorHex: "#FF0000" } },
    );

    ext.labelConnMapList.push(
      { labelName: "Label1", connections: ["conn1", "conn2"] },
      { labelName: "Label2", connections: ["conn1"] },
      { labelName: "Label3", connections: ["conn3"] },
    );

    const stats = LabelsUtils.getConnectionLabelStatistics("conn1");

    assert.strictEqual(stats.count, 2);
    assert.strictEqual(stats.Red, 1);
    assert.strictEqual(stats.Blue, 1);
    assert.strictEqual(stats.Green, 0);
    assert.strictEqual(stats.Yellow, 0);
    assert.strictEqual(stats.Magenta, 0);
    assert.strictEqual(stats.Cyan, 0);
  });

  it("should return zero statistics for a connection with no labels", () => {
    ext.connLabelList.push(
      { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
      { name: "Label2", color: { name: "Blue", colorHex: "#0000FF" } },
    );

    ext.labelConnMapList.push(
      { labelName: "Label1", connections: ["conn2"] },
      { labelName: "Label2", connections: ["conn3"] },
    );

    const stats = LabelsUtils.getConnectionLabelStatistics("conn1");

    assert.strictEqual(stats.count, 0);
    assert.strictEqual(stats.Red, 0);
    assert.strictEqual(stats.Blue, 0);
    assert.strictEqual(stats.Green, 0);
    assert.strictEqual(stats.Yellow, 0);
    assert.strictEqual(stats.Magenta, 0);
    assert.strictEqual(stats.Cyan, 0);
  });

  describe("clearWorkspaceLabels", () => {
    let notifyStub, updateStub: sinon.SinonStub;

    beforeEach(() => {
      notifyStub = sinon.stub(notifications, "notify");
      updateStub = sinon.stub();
      ext.connLabelList.length = 0;
      ext.labelConnMapList.length = 0;
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should clear all connection mappings when no labels exist", () => {
      const getStub = sinon.stub();
      getStub.withArgs("kdb.connectionLabels").returns([]);
      getStub.withArgs("kdb.labelsConnectionMap").returns([
        { labelName: "nonexistent1", connections: ["conn1"] },
        { labelName: "nonexistent2", connections: ["conn2"] },
      ]);

      getConfigurationStub.returns({
        get: getStub,
        update: updateStub,
      });

      LabelsUtils.clearWorkspaceLabels();

      sinon.assert.calledWith(
        notifyStub,
        "Cleaning connection mappings for nonexistent labels.",
        notifications.MessageKind.DEBUG,
        {
          logger: "connLabel",
          telemetry: "Label.Cleanup.NoLabels",
        },
      );

      sinon.assert.calledWith(updateStub, "kdb.labelsConnectionMap", [], true);
    });

    it("should remove orphaned label connection mappings", () => {
      const validLabels = [
        { name: "label1", color: { name: "Red", colorHex: "#FF0000" } },
        { name: "label2", color: { name: "Blue", colorHex: "#0000FF" } },
      ];

      const connectionMappings = [
        { labelName: "label1", connections: ["conn1", "conn2"] },
        { labelName: "orphaned1", connections: ["conn3"] },
        { labelName: "label2", connections: ["conn4"] },
        { labelName: "orphaned2", connections: ["conn5", "conn6"] },
      ];

      const getStub = sinon.stub();
      getStub.withArgs("kdb.connectionLabels").returns(validLabels);
      getStub.withArgs("kdb.labelsConnectionMap").returns(connectionMappings);

      getConfigurationStub.returns({
        get: getStub,
        update: updateStub,
      });

      LabelsUtils.clearWorkspaceLabels();

      assert.strictEqual(ext.labelConnMapList.length, 2);
      assert.deepStrictEqual(ext.labelConnMapList, [
        { labelName: "label1", connections: ["conn1", "conn2"] },
        { labelName: "label2", connections: ["conn4"] },
      ]);

      sinon.assert.calledWith(
        notifyStub,
        "Removed 2 orphaned label connection mappings.",
        notifications.MessageKind.DEBUG,
        {
          logger: "connLabel",
          telemetry: "Label.Cleanup.OrphanedMappings",
          measurements: { removedMappings: 2 },
        },
      );

      sinon.assert.calledWith(
        updateStub,
        "kdb.labelsConnectionMap",
        ext.labelConnMapList,
        true,
      );
    });

    it("should remove single orphaned label connection mapping", () => {
      const validLabels = [
        { name: "label1", color: { name: "Red", colorHex: "#FF0000" } },
      ];

      const connectionMappings = [
        { labelName: "label1", connections: ["conn1"] },
        { labelName: "orphaned1", connections: ["conn2"] },
      ];

      const getStub = sinon.stub();
      getStub.withArgs("kdb.connectionLabels").returns(validLabels);
      getStub.withArgs("kdb.labelsConnectionMap").returns(connectionMappings);

      getConfigurationStub.returns({
        get: getStub,
        update: updateStub,
      });

      LabelsUtils.clearWorkspaceLabels();

      assert.strictEqual(ext.labelConnMapList.length, 1);
      assert.deepStrictEqual(ext.labelConnMapList, [
        { labelName: "label1", connections: ["conn1"] },
      ]);

      sinon.assert.calledWith(
        notifyStub,
        "Removed 1 orphaned label connection mapping.",
        notifications.MessageKind.DEBUG,
        {
          logger: "connLabel",
          telemetry: "Label.Cleanup.OrphanedMappings",
          measurements: { removedMappings: 1 },
        },
      );
    });

    it("should not remove anything when all mappings are valid", () => {
      const validLabels = [
        { name: "label1", color: { name: "Red", colorHex: "#FF0000" } },
        { name: "label2", color: { name: "Blue", colorHex: "#0000FF" } },
      ];

      const connectionMappings = [
        { labelName: "label1", connections: ["conn1"] },
        { labelName: "label2", connections: ["conn2"] },
      ];

      const getStub = sinon.stub();
      getStub.withArgs("kdb.connectionLabels").returns(validLabels);
      getStub.withArgs("kdb.labelsConnectionMap").returns(connectionMappings);

      getConfigurationStub.returns({
        get: getStub,
        update: updateStub,
      });

      LabelsUtils.clearWorkspaceLabels();

      assert.strictEqual(ext.labelConnMapList.length, 2);
      assert.deepStrictEqual(ext.labelConnMapList, connectionMappings);

      sinon.assert.neverCalledWith(
        notifyStub,
        sinon.match.string,
        notifications.MessageKind.DEBUG,
        sinon.match.has("telemetry", "Label.Cleanup.OrphanedMappings"),
      );

      sinon.assert.neverCalledWith(
        updateStub,
        "kdb.labelsConnectionMap",
        sinon.match.array,
        true,
      );
    });

    it("should handle empty connection mappings", () => {
      const validLabels = [
        { name: "label1", color: { name: "Red", colorHex: "#FF0000" } },
      ];

      const getStub = sinon.stub();
      getStub.withArgs("kdb.connectionLabels").returns(validLabels);
      getStub.withArgs("kdb.labelsConnectionMap").returns([]);

      getConfigurationStub.returns({
        get: getStub,
        update: updateStub,
      });

      LabelsUtils.clearWorkspaceLabels();

      assert.strictEqual(ext.labelConnMapList.length, 0);

      sinon.assert.neverCalledWith(
        notifyStub,
        sinon.match.string,
        notifications.MessageKind.DEBUG,
      );

      sinon.assert.notCalled(updateStub);
    });

    it("should handle case-sensitive label name matching", () => {
      const validLabels = [
        { name: "Label1", color: { name: "Red", colorHex: "#FF0000" } },
      ];

      const connectionMappings = [
        { labelName: "Label1", connections: ["conn1"] },
        { labelName: "label1", connections: ["conn2"] },
        { labelName: "LABEL1", connections: ["conn3"] },
      ];

      const getStub = sinon.stub();
      getStub.withArgs("kdb.connectionLabels").returns(validLabels);
      getStub.withArgs("kdb.labelsConnectionMap").returns(connectionMappings);

      getConfigurationStub.returns({
        get: getStub,
        update: updateStub,
      });

      LabelsUtils.clearWorkspaceLabels();

      assert.strictEqual(ext.labelConnMapList.length, 1);
      assert.strictEqual(ext.labelConnMapList[0].labelName, "Label1");

      sinon.assert.calledWith(
        notifyStub,
        "Removed 2 orphaned label connection mappings.",
        notifications.MessageKind.DEBUG,
        {
          logger: "connLabel",
          telemetry: "Label.Cleanup.OrphanedMappings",
          measurements: { removedMappings: 2 },
        },
      );
    });
  });

  describe("isLabelEmpty", () => {
    beforeEach(() => {
      ext.labelConnMapList.length = 0;
    });

    afterEach(() => {
      ext.labelConnMapList.length = 0;
    });
    it("should return true if label is empty", () => {
      ext.labelConnMapList.push({ labelName: "label1", connections: [] });
      const result = LabelsUtils.isLabelEmpty("label1");
      assert.strictEqual(result, true);
    });

    it("should return false if label is not empty", () => {
      ext.labelConnMapList.push({
        labelName: "label1",
        connections: ["conn1"],
      });
      const result = LabelsUtils.isLabelEmpty("label1");
      assert.strictEqual(result, false);
    });

    it("should return false if label is empty if label not on map list", () => {
      const result = LabelsUtils.isLabelEmpty("label1");
      assert.strictEqual(result, true);
    });
  });

  describe("isLabelContentChanged", () => {
    beforeEach(() => {
      ext.latestLblsChanged.length = 0;
    });

    afterEach(() => {
      ext.latestLblsChanged.length = 0;
    });

    it("should return true if label content is changed", () => {
      ext.latestLblsChanged.push("label1");
      const result = LabelsUtils.isLabelContentChanged("label1");
      assert.strictEqual(result, true);
    });

    it("should return false if label content is not changed", () => {
      const result = LabelsUtils.isLabelContentChanged("label1");
      assert.strictEqual(result, false);
    });
  });
});
