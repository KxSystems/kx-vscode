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

import { html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { LabelColors, Labels } from "../models/labels";
import { workspace } from "vscode";
import { ext } from "../extensionVariables";
import { kdbOutputLog } from "./core";

export const labelColors: LabelColors[] = [
  {
    name: "White",
    colorHex: "#FFFFFF",
  },
  {
    name: "Red",
    colorHex: "#CD3131",
  },
  {
    name: "Green",
    colorHex: "#10BC7A",
  },
  {
    name: "Yellow",
    colorHex: "#E5E50E",
  },
  {
    name: "Blue",
    colorHex: "#2371C8",
  },
  {
    name: "Magenta",
    colorHex: "#BC3FBC",
  },
  {
    name: "Cyan",
    colorHex: "#15A7CD",
  },
];

export function getDropdownColorOptions() {
  return html`
    <vscode-option .value="${undefined}"> No Color Selected </vscode-option>
    ${repeat(
      labelColors,
      (color) => color,
      (color) =>
        html` <vscode-option .value="${color.name}">
          <span
            ><div
              style="width: 10px; height: 10px; background: ${color.colorHex}; border-radius: 50%; float: left;
    margin-right: 10px; margin-top: 3px;"></div>
            ${color.name}</span
          >
        </vscode-option>`,
    )}
  `;
}

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
  const color = labelColors.find((color) => color.name === colorName);
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

export function getDropdownLblOptions() {
  getWorkspaceLabels();
  return html`
    <vscode-option .value="${undefined}"> No Label Selected </vscode-option>

    ${repeat(
      ext.connLabelList,
      (lbl) => lbl,
      (lbl) =>
        html` <vscode-option .value="${lbl.name}">
          <span
            ><div
              style="width: 10px; height: 10px; background: ${lbl.color
                .colorHex}; border-radius: 50%; float: left;
    margin-right: 10px; margin-top: 3px;"></div>
            ${lbl.name}</span
          >
        </vscode-option>`,
    )}
  `;
}

export function generateLabels(): Labels {
  return {
    name: "",
    color: {
      name: "",
      colorHex: "",
    },
  };
}
