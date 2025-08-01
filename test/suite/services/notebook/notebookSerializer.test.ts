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
import * as vscode from "vscode";

import * as serializer from "../../../../src/services/notebookSerializer";

describe("Serializer", () => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let instance: serializer.KxNotebookSerializer;

  beforeEach(() => {
    instance = new serializer.KxNotebookSerializer();
  });

  afterEach(() => {
    instance = undefined;
  });

  it("should deserialize empty notebook", async () => {
    const deserialized = await instance.deserializeNotebook(
      encoder.encode(""),
      <vscode.CancellationToken>{},
    );
    assert.strictEqual(deserialized.cells.length, 0);
  });

  it("should serialize and deserialize notebook", async () => {
    const data: vscode.NotebookData = {
      cells: [
        {
          kind: vscode.NotebookCellKind.Code,
          value: "a:1",
          languageId: "q",
          outputs: [
            {
              items: [{ data: encoder.encode("Results"), mime: "text/plain" }],
            },
          ],
        },
      ],
    };
    const serialized = await instance.serializeNotebook(
      data,
      <vscode.CancellationToken>{},
    );
    const deserialized = await instance.deserializeNotebook(
      serialized,
      <vscode.CancellationToken>{},
    );

    for (let i = 0; i < deserialized.cells.length; i++) {
      assert.strictEqual(deserialized.cells[i].kind, data.cells[i].kind);
      assert.strictEqual(deserialized.cells[i].value, data.cells[i].value);
      assert.strictEqual(
        deserialized.cells[i].languageId,
        data.cells[i].languageId,
      );
      for (let j = 0; j < deserialized.cells[i].outputs.length; j++) {
        for (
          let k = 0;
          k < deserialized.cells[i].outputs[j].items.length;
          k++
        ) {
          assert.strictEqual(
            decoder.decode(deserialized.cells[i].outputs[j].items[k].data),
            decoder.decode(data.cells[i].outputs[j].items[k].data),
          );
        }
      }
    }
  });
});
