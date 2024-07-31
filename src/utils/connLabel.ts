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
import { LabelColors } from "../models/labels";

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

export function getDropdownOptions() {
  let colorsOptions = `<vscode-option .value="${undefined}">
    No Label Selected
  </vscode-option>`;

  labelColors.forEach((color) => {
    colorsOptions += `<vscode-option .value="${color}">
      ${color.name}
    </vscode-option>`;
  });

  return colorsOptions;
}
