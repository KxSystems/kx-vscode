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

import { ConnectionLabel, Labels } from "../models/labels";
import { workspace } from "vscode";
import { ext } from "../extensionVariables";
import { kdbOutputLog } from "./core";
import { InsightsNode, KdbNode } from "../services/kdbTreeProvider";
import { NewConnectionPannel } from "../panels/newConnection";

export function getWorkspaceLabels() {
  const existingConnLbls = workspace
    .getConfiguration()
    .get<Labels[]>("kdb.connectionLabels");
  ext.connLabelList.length = 0;
  if (existingConnLbls && existingConnLbls.length > 0) {
    existingConnLbls.forEach((label: Labels) => {
      ext.connLabelList.push(label);
    });
  }
}

export function createNewLabel(name: string, colorName: string) {
  getWorkspaceLabels();
  const color = ext.labelColors.find(
    (color) => color.name.toLowerCase() === colorName.toLowerCase(),
  );
  if (name === "") {
    kdbOutputLog("Label name can't be empty", "ERROR");
  }
  if (color && name !== "") {
    const newLbl: Labels = {
      name: name,
      color: color,
    };
    ext.connLabelList.push(newLbl);
    workspace
      .getConfiguration()
      .update("kdb.connectionLabels", ext.connLabelList, true);
  } else {
    kdbOutputLog("No Color selected for the label", "ERROR");
  }
}

export function getWorkspaceLabelsConnMap() {
  const existingLabelConnMaps = workspace
    .getConfiguration()
    .get<ConnectionLabel[]>("kdb.labelsConnectionMap");
  ext.labelConnMapList.length = 0;
  if (existingLabelConnMaps && existingLabelConnMaps.length > 0) {
    existingLabelConnMaps.forEach((labelConnMap: ConnectionLabel) => {
      ext.labelConnMapList.push(labelConnMap);
    });
  }
}

export function addConnToLabel(labelName: string, connName: string) {
  const label = ext.connLabelList.find(
    (lbl) => lbl.name.toLowerCase() === labelName.toLowerCase(),
  );
  if (label) {
    if (ext.labelConnMapList.length > 0) {
      const labelConnMap = ext.labelConnMapList.find(
        (lbl) => lbl.labelName === labelName,
      );
      if (labelConnMap) {
        if (!labelConnMap.connections.includes(connName)) {
          labelConnMap.connections.push(connName);
        }
      } else {
        ext.labelConnMapList.push({
          labelName: labelName,
          connections: [connName],
        });
      }
    } else {
      ext.labelConnMapList.push({
        labelName: labelName,
        connections: [connName],
      });
    }
  }
}

export function removeConnFromLabels(connName: string) {
  ext.labelConnMapList.forEach((labelConnMap) => {
    if (labelConnMap.connections.includes(connName)) {
      labelConnMap.connections = labelConnMap.connections.filter(
        (conn: string) => conn !== connName,
      );
    }
  });
}

export async function handleLabelsConnMap(labels: string[], connName: string) {
  removeConnFromLabels(connName);
  labels.forEach((label) => {
    addConnToLabel(label, connName);
  });
  await workspace
    .getConfiguration()
    .update("kdb.labelsConnectionMap", ext.labelConnMapList, true);
}

export function retrieveConnLabelsNames(
  conn: KdbNode | InsightsNode,
): string[] {
  const connName =
    conn instanceof KdbNode ? conn.details.serverAlias : conn.details.alias;
  const labels: string[] = [];
  ext.labelConnMapList.forEach((labelConnMap) => {
    if (labelConnMap.connections.includes(connName)) {
      labels.push(labelConnMap.labelName);
    }
  });
  return labels;
}

export function renameLabel(name: string, newName: string) {
  getWorkspaceLabels();
  const found = ext.connLabelList.find((item) => item.name === name);
  if (found) {
    found.name = newName;
  }
  getWorkspaceLabelsConnMap();
  const target = ext.labelConnMapList.find((item) => item.labelName === name);
  if (target) {
    target.labelName = newName;
  }
  workspace
    .getConfiguration()
    .update("kdb.labelsConnectionMap", ext.labelConnMapList, true)
    .then(() =>
      workspace
        .getConfiguration()
        .update("kdb.connectionLabels", ext.connLabelList, true),
    );
  NewConnectionPannel.refreshLabels();
}

export function setLabelColor(name: string, color: string) {
  getWorkspaceLabels();
  const found = ext.connLabelList.find((item) => item.name === name);
  if (found) {
    const target = ext.labelColors.find((value) => value.name === color);
    if (target) {
      found.color = target;
    }
  }
  workspace
    .getConfiguration()
    .update("kdb.connectionLabels", ext.connLabelList, true);
  NewConnectionPannel.refreshLabels();
}

export function deleteLabel(name: string) {
  getWorkspaceLabels();
  const found = ext.connLabelList.find((item) => item.name === name);
  if (found) {
    ext.connLabelList.splice(ext.connLabelList.indexOf(found), 1);
  }
  workspace
    .getConfiguration()
    .update("kdb.connectionLabels", ext.connLabelList, true);

  NewConnectionPannel.refreshLabels();
}

export function isLabelEmpty(name: string) {
  const found = ext.labelConnMapList.find((item) => item.labelName === name);
  if (found) {
    return found.connections.length === 0;
  }
  return true;
}

export function isLabelContentChanged(name: string) {
  const found = ext.latestLblsChanged.find((item) => item === name);
  if (found) {
    return true;
  }
  return false;
}
