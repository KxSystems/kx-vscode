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

import { LocalConnection } from "../../../../src/classes/localConnection";
import { ext } from "../../../../src/extensionVariables";
import { ServerObject } from "../../../../src/models/serverObject";
import { KdbTreeService } from "../../../../src/services/kdbTreeService";

describe("kdbTreeService", () => {
  const localConn = new LocalConnection("localhost:5001", "server1", []);

  describe("loadNamespaces", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("Should return empty ServerObjects array when none are loaded", async () => {
      sinon.stub(localConn, "loadServerObjects").resolves(undefined);
      const result = await KdbTreeService.loadNamespaces(localConn, "");
      assert.strictEqual(
        result.length,
        0,
        "Namespaces returned should be zero.",
      );
    });

    it("Should return a single server object that ia a namespace", async () => {
      const testObject: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test1",
          typeNum: 1,
          namespace: ".",
          context: {},
          isNs: true,
        },
        {
          id: 2,
          pid: 2,
          name: "test",
          fname: "test2",
          typeNum: 1,
          namespace: ".",
          context: {},
          isNs: true,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject);
      const result = await KdbTreeService.loadNamespaces(localConn);
      assert.strictEqual(
        result[0],
        testObject[0],
        "Single server object that is a namespace should be returned.",
      );
    });

    it("Should return a single server object that ia a namespace (reverse sort)", async () => {
      const testObject0: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test",
          typeNum: 1,
          namespace: ".",
          context: {},
          isNs: true,
        },
        {
          id: 0,
          pid: 0,
          name: "test",
          fname: "test0",
          typeNum: 1,
          namespace: ".",
          context: {},
          isNs: true,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject0);
      const result = await KdbTreeService.loadNamespaces(localConn);
      assert.strictEqual(
        result[0],
        testObject0[0],
        "Single server object that is a namespace should be returned.",
      );
      sinon.restore();
    });

    it("Should return a single server object that ia a namespace", async () => {
      const testObject2: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test",
          typeNum: 1,
          namespace: ".",
          context: {},
          isNs: true,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject2);
      const result = await KdbTreeService.loadNamespaces(localConn, ".");
      assert.strictEqual(
        result[0],
        testObject2[0],
        `Single server object that is a namespace should be returned: ${JSON.stringify(
          result,
        )}`,
      );
      sinon.restore();
    });
  });

  describe("loadDictionaries", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("Should return empty ServerObjects array when none are loaded", async () => {
      sinon.stub(localConn, "loadServerObjects").resolves(undefined);
      const result = await KdbTreeService.loadDictionaries(localConn, "");
      assert.strictEqual(
        result.length,
        0,
        "ServerObjects returned should be zero.",
      );
    });

    it("Should return a single server object that ia a dictionary", async () => {
      const testObject: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test",
          typeNum: 99,
          namespace: ".",
          context: {},
          isNs: false,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject);
      const result = await KdbTreeService.loadDictionaries(localConn, ".");
      assert.strictEqual(
        result[0],
        testObject[0],
        "Single server object that is a namespace should be returned.",
      );
    });
  });

  describe("loadFunctions", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("Should return empty ServerObjects array when none are loaded", async () => {
      sinon.stub(localConn, "loadServerObjects").resolves(undefined);
      const result = await KdbTreeService.loadFunctions(localConn, ".");
      assert.strictEqual(
        result.length,
        0,
        "ServerObjects returned should be zero.",
      );
    });

    it("Should return a single server object that ia a function", async () => {
      const testObject: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test",
          typeNum: 100,
          namespace: ".",
          context: {},
          isNs: false,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject);
      const result = await KdbTreeService.loadFunctions(localConn, ".");
      assert.strictEqual(
        result[0],
        testObject[0],
        "Single server object that is a namespace should be returned.",
      );
    });
  });

  describe("loadTables", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("Should return empty ServerObjects array when none are loaded", async () => {
      sinon.stub(localConn, "loadServerObjects").resolves(undefined);
      const result = await KdbTreeService.loadTables(localConn, ".");
      assert.strictEqual(
        result.length,
        0,
        "ServerObjects returned should be zero.",
      );
    });

    it("Should return a single server object that ia a table", async () => {
      const testObject: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test",
          typeNum: 98,
          namespace: ".",
          context: {},
          isNs: false,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject);
      const result = await KdbTreeService.loadTables(localConn, ".");
      assert.strictEqual(
        result[0],
        testObject[0],
        "Single server object that is a namespace should be returned.",
      );
    });
  });

  describe("loadVariables", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("Should return empty ServerObjects array when none are loaded", async () => {
      sinon.stub(localConn, "loadServerObjects").resolves(undefined);
      sinon.stub(KdbTreeService, "loadViews").resolves([]);
      const result = await KdbTreeService.loadVariables(localConn, ".");
      assert.strictEqual(
        result.length,
        0,
        "ServerObjects returned should be zero.",
      );
    });

    it("Should return a single server object that ia a variable", async () => {
      const testObject: ServerObject[] = [
        {
          id: 1,
          pid: 1,
          name: "test",
          fname: "test",
          typeNum: -7,
          namespace: ".",
          context: {},
          isNs: false,
        },
      ];
      sinon.stub(localConn, "loadServerObjects").resolves(testObject);
      sinon.stub(KdbTreeService, "loadViews").resolves([]);
      const result = await KdbTreeService.loadVariables(localConn, ".");
      assert.strictEqual(
        result[0],
        testObject[0],
        "Single server object that is a namespace should be returned.",
      );
    });
  });

  describe("loadViews", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("Should return sorted views", async () => {
      ext.activeConnection = new LocalConnection(
        "localhost:5001",
        "server1",
        [],
      );
      sinon.stub(localConn, "executeQueryRaw").resolves(["vw1", "vw2"]);
      const result = await KdbTreeService.loadViews(localConn);
      assert.strictEqual(result[0], "vw1", "Should return the first view");
    });

    it("Should return sorted views (reverse order)", async () => {
      ext.activeConnection = new LocalConnection(
        "localhost:5001",
        "server1",
        [],
      );
      sinon.stub(localConn, "executeQueryRaw").resolves(["vw1", "vw2"]);
      const result = await KdbTreeService.loadViews(localConn);
      assert.strictEqual(result[0], "vw1", "Should return the first view");
    });
  });
});
