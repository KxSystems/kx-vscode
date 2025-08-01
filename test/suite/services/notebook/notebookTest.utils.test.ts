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

import * as vscode from "vscode";

export const result = {
  table: {
    count: 2,
    columns: [
      {
        name: "x",
        type: "longs",
        values: ["0", "1"],
        order: [0, 1],
      },
      {
        name: "y",
        type: "longs",
        values: ["0", "1"],
        order: [0, 1],
      },
    ],
  },

  png: {
    count: 66,
    columns: [
      {
        name: "values",
        type: "bytes",
        values: [
          "0x89",
          "0x50",
          "0x4e",
          "0x47",
          "0x0d",
          "0x0a",
          "0x1a",
          "0x0a",
          ..."0x00,".repeat(58).split(","),
        ],
      },
    ],
  },

  text: "text result",
};

export function createNotebook() {
  return <vscode.NotebookDocument>{ uri: vscode.Uri.file("test.kxnb") };
}

export function createCell(languageId?: string, metadata = {}) {
  return <vscode.NotebookCell>{
    document: {
      languageId,
      getText() {
        return "expressions";
      },
    },
    notebook: { uri: vscode.Uri.file("test.kxnb") },
    metadata,
  };
}
