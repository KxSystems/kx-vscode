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

import { Labels } from "../models/labels";
import { workspace } from "vscode";
import { ext } from "../extensionVariables";
import { kdbOutputLog } from "./core";

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
  const color = ext.labelColors.find((color) => color.name === colorName);
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
