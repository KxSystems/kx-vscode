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

import * as assert from "assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as storage from "../../../src/utils/storage";

describe("storage", () => {
  let root: string;

  const storageAt = (fsPath: string) =>
    sinon.stub(ext, "context").value(<vscode.ExtensionContext>(<unknown>{
      globalStorageUri: { fsPath },
    }));

  beforeEach(() => {
    ext.outputChannel = vscode.window.createOutputChannel("kdb", { log: true });
    root = mkdtempSync(join(tmpdir(), "kdb-storage-"));
    storageAt(root);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("writeLocalFile", () => {
    it("should write the content and return where it landed", async () => {
      const target = await storage.writeLocalFile("out.txt", "content");

      assert.strictEqual(target, resolve(root, "out.txt"));
      assert.strictEqual(readFileSync(target, "utf8"), "content");
    });

    it("should create the storage directory it is given", async () => {
      storageAt(join(root, "nested", "deeper"));

      const target = await storage.writeLocalFile("out.txt", "content");

      assert.strictEqual(readFileSync(target, "utf8"), "content");
    });

    it("should return nothing when the write fails", async () => {
      writeFileSync(join(root, "file"), "");
      storageAt(join(root, "file", "impossible"));

      assert.strictEqual(await storage.writeLocalFile("out.txt", "c"), "");
    });
  });

  describe("readLocalFile", () => {
    it("should read a file it wrote", async () => {
      await storage.writeLocalFile("out.txt", "content");

      assert.strictEqual(storage.readLocalFile("out.txt"), "content");
    });

    it("should return nothing for a file that is not there", () => {
      assert.strictEqual(storage.readLocalFile("missing.txt"), "");
    });
  });

  describe("settings", () => {
    it("should fall back to the value it is given", () => {
      assert.strictEqual(
        storage.getLocalSetting("absent", "default"),
        "default",
      );
      assert.strictEqual(storage.getLocalSetting("absent"), undefined);
    });

    it("should keep a setting it is given", async () => {
      await storage.setLocalSetting("kept", 42);

      assert.strictEqual(storage.getLocalSetting("kept"), 42);
      assert.deepStrictEqual(
        JSON.parse(storage.readLocalFile("settings.json")),
        { kept: 42 },
      );
    });
  });
});
