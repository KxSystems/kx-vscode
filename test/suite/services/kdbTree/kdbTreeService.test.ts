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
  /**
   * The listing a process answers with, filed the way the tree draws it. The
   * fixture is the shape listMem.q reports (see test/q/tests/listMem.quke): an
   * item's fname carries its namespace, and a namespace has a row of its own
   * marked isNs.
   */
  describe("filing a memory listing by category", () => {
    let next = 0;

    const item = (
      name: string,
      typeNum: number,
      namespace = ".",
      isNs = false,
    ): ServerObject => ({
      id: next++,
      pid: 0,
      name,
      fname: namespace === "." ? name : `${namespace}.${name}`,
      typeNum,
      namespace,
      context: {},
      isNs,
    });

    const MEMORY: ServerObject[] = [
      { ...item(".", 99, ".", true), fname: "." },
      { ...item(".e2e", 99, ".", true), fname: ".e2e" },
      item("trade", 98),
      item("settings", 99),
      item("pricer", 100),
      item("applyPx", 104),
      item("pipeline", 105),
      item("px", -9),
      item("syms", 11),
      item("midView", -7),
      item("helper", 100, ".e2e"),
      item("rates", 98, ".e2e"),
    ];

    const named = (objects: ServerObject[]) =>
      objects.map((object) => object.fname);

    beforeEach(() => {
      sinon.stub(localConn, "loadServerObjects").resolves(MEMORY);
      sinon.stub(KdbTreeService, "loadViews").resolves(["midView"]);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should list the namespaces a listing carries", async () => {
      const result = await KdbTreeService.loadNamespaces(localConn);

      assert.deepStrictEqual(named(result), [".", ".e2e"]);
    });

    it("should file a table under Tables", async () => {
      const result = await KdbTreeService.loadTables(localConn, ".");

      assert.ok(
        named(result).includes("trade"),
        `trade is missing from ${named(result)}`,
      );
    });

    it("should file a lambda, a projection and a composition under Functions", async () => {
      const result = await KdbTreeService.loadFunctions(localConn, ".");

      assert.deepStrictEqual(named(result), ["applyPx", "pipeline", "pricer"]);
    });

    it("should file a plain value under Variables", async () => {
      const result = await KdbTreeService.loadVariables(localConn, ".");

      assert.deepStrictEqual(named(result), ["px", "syms"]);
    });

    it("should leave a view out of the variables", async () => {
      const result = await KdbTreeService.loadVariables(localConn, ".");

      assert.ok(
        !named(result).includes("midView"),
        "a view was filed as a variable",
      );
    });

    it("should file only what is in the namespace asked for", async () => {
      assert.deepStrictEqual(
        named(await KdbTreeService.loadFunctions(localConn, ".e2e")),
        [".e2e.helper"],
      );
      assert.deepStrictEqual(
        named(await KdbTreeService.loadTables(localConn, ".e2e")),
        [".e2e.rates"],
      );
    });

    it("should file a namespace itself under no category at all", async () => {
      for (const category of [
        KdbTreeService.loadDictionaries,
        KdbTreeService.loadFunctions,
        KdbTreeService.loadTables,
        KdbTreeService.loadVariables,
      ]) {
        const result = await category(localConn, ".");
        assert.ok(
          !named(result).includes(".e2e"),
          `the namespace .e2e was filed by ${category.name}`,
        );
      }
    });

    /**
     * A dictionary and a keyed table are both type 99, and the listing carries
     * nothing else to tell them apart, so every dictionary is drawn under
     * Tables as well and every keyed table under Dictionaries. Separating them
     * needs listMem.q to report whether a 99 is keyed; until it does, this is
     * what the tree shows.
     */
    it.skip("should file a dictionary under Dictionaries alone", async () => {
      assert.deepStrictEqual(
        named(await KdbTreeService.loadDictionaries(localConn, ".")),
        ["settings"],
      );
      assert.ok(
        !named(await KdbTreeService.loadTables(localConn, ".")).includes(
          "settings",
        ),
        "a dictionary was filed as a table",
      );
    });

    /**
     * Namespaces are listed only one level down from the root, so an item in a
     * nested namespace has no node to sit under — see the commented out
     * loadNestedNamespaces in kdbTreeProvider.
     */
    it.skip("should list a nested namespace", async () => {
      sinon.restore();
      sinon
        .stub(localConn, "loadServerObjects")
        .resolves([...MEMORY, { ...item(".inner", 99, ".e2e", true) }]);

      assert.ok(
        named(await KdbTreeService.loadNamespaces(localConn)).includes(
          ".e2e.inner",
        ),
        "a nested namespace was not listed",
      );
    });
  });
});
