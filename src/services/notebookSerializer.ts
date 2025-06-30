/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";

import { KxNotebook } from "../models/notebook";

export class KxNotebookSerializer implements vscode.NotebookSerializer {
  async deserializeNotebook(
    content: Uint8Array,
    _token: vscode.CancellationToken,
  ): Promise<vscode.NotebookData> {
    if (content.length === 0) {
      return new vscode.NotebookData([]);
    }
    const text = new TextDecoder().decode(content);
    const data = <KxNotebook>JSON.parse(text);
    const encoder = new TextEncoder();
    const notebook = new vscode.NotebookData(
      data.cells.map((cell) => {
        const target = new vscode.NotebookCellData(
          cell.kind,
          cell.value,
          cell.languageId,
        );
        target.metadata = { target: cell.target, variable: cell.variable };
        target.outputs = cell.outputs.map((output) => {
          return new vscode.NotebookCellOutput(
            output.items.map((item) => {
              return new vscode.NotebookCellOutputItem(
                encoder.encode(item.data),
                item.mime,
              );
            }),
          );
        });
        return target;
      }),
    );
    return notebook;
  }

  async serializeNotebook(
    data: vscode.NotebookData,
    _token: vscode.CancellationToken,
  ): Promise<Uint8Array> {
    const decoder = new TextDecoder();
    const notebook: KxNotebook = {
      cells: data.cells.map((cell) => {
        return {
          kind: cell.kind,
          value: cell.value,
          languageId: cell.languageId,
          target: cell.metadata?.target,
          variable: cell.metadata?.variable,
          outputs: (cell.outputs || []).map((output) => {
            return {
              items: output.items.map((item) => {
                return {
                  data: decoder.decode(item.data),
                  mime: item.mime,
                };
              }),
            };
          }),
        };
      }),
    };
    return new TextEncoder().encode(JSON.stringify(notebook));
  }
}
