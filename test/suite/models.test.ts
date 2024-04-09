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

import assert from "assert";
import sinon from "sinon";
import { ext } from "../../src/extensionVariables";
import {
  ServerObject,
  loadDictionaries,
  loadFunctions,
  loadNamespaces,
  loadTables,
  loadVariables,
  loadViews,
} from "../../src/models/serverObject";
import { LocalConnection } from "../../src/classes/localConnection";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const so = require("../../src/commands/serverCommand");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const vw = require("../../src/models/serverObject");

describe("Models", () => {
  it("Should return empty ServerObjects array when none are loaded", async () => {
    sinon.stub(so, "loadServerObjects").resolves(undefined);
    const result = await loadNamespaces("");
    assert.strictEqual(result.length, 0, "Namespaces returned should be zero.");
    sinon.restore();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject);
    const result = await loadNamespaces();
    assert.strictEqual(
      result[0],
      testObject[0],
      "Single server object that is a namespace should be returned.",
    );
    sinon.restore();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject0);
    const result = await loadNamespaces();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject2);
    const result = await loadNamespaces(".");
    assert.strictEqual(
      result[0],
      testObject2[0],
      `Single server object that is a namespace should be returned: ${JSON.stringify(
        result,
      )}`,
    );
    sinon.restore();
  });

  it("Should return empty ServerObjects array when none are loaded", async () => {
    sinon.stub(so, "loadServerObjects").resolves(undefined);
    const result = await loadDictionaries("");
    assert.strictEqual(
      result.length,
      0,
      "ServerObjects returned should be zero.",
    );
    sinon.restore();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject);
    const result = await loadDictionaries(".");
    assert.strictEqual(
      result[0],
      testObject[0],
      "Single server object that is a namespace should be returned.",
    );
    sinon.restore();
  });

  it("Should return empty ServerObjects array when none are loaded", async () => {
    sinon.stub(so, "loadServerObjects").resolves(undefined);
    const result = await loadFunctions(".");
    assert.strictEqual(
      result.length,
      0,
      "ServerObjects returned should be zero.",
    );
    sinon.restore();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject);
    const result = await loadFunctions(".");
    assert.strictEqual(
      result[0],
      testObject[0],
      "Single server object that is a namespace should be returned.",
    );
    sinon.restore();
  });

  it("Should return empty ServerObjects array when none are loaded", async () => {
    sinon.stub(so, "loadServerObjects").resolves(undefined);
    const result = await loadTables(".");
    assert.strictEqual(
      result.length,
      0,
      "ServerObjects returned should be zero.",
    );
    sinon.restore();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject);
    const result = await loadTables(".");
    assert.strictEqual(
      result[0],
      testObject[0],
      "Single server object that is a namespace should be returned.",
    );
    sinon.restore();
  });

  it("Should return empty ServerObjects array when none are loaded", async () => {
    sinon.stub(so, "loadServerObjects").resolves(undefined);
    const result = await loadVariables(".");
    assert.strictEqual(
      result.length,
      0,
      "ServerObjects returned should be zero.",
    );
    sinon.restore();
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
    sinon.stub(so, "loadServerObjects").resolves(testObject);
    sinon.stub(vw, "loadViews").resolves([]);
    const result = await loadVariables(".");
    assert.strictEqual(
      result[0],
      testObject[0],
      "Single server object that is a namespace should be returned.",
    );
    sinon.restore();
  });

  it("Should return sorted views", async () => {
    ext.connection = new LocalConnection("localhost:5001", "server1");
    sinon.stub(ext.connection, "executeQuery").resolves(["vw1", "vw2"]);
    const result = await loadViews();
    assert.strictEqual(result[0], "vw1", "Should return the first view");
    sinon.restore();
  });

  it("Should return sorted views (reverse order)", async () => {
    ext.connection = new LocalConnection("localhost:5001", "server1");
    sinon.stub(ext.connection, "executeQuery").resolves(["vw1", "vw2"]);
    const result = await loadViews();
    assert.strictEqual(result[0], "vw1", "Should return the first view");
    sinon.restore();
  });

  it("Should create a new connection object", () => {
    const conn = new LocalConnection("server:5001", "server1");
    assert.strictEqual(
      conn.connected,
      false,
      "Connection should be created but not connected.",
    );
  });

  it("Should create a new connection object (full options)", () => {
    const conn = new LocalConnection(
      "server:5001",
      "server1",
      ["username", "password"],
      true,
    );
    assert.strictEqual(
      conn.connected,
      false,
      "Connection should be created but not connected.",
    );
  });

  it("Should create a new connection object", () => {
    const conn = new LocalConnection("server:5001", "server1");
    conn.disconnect();
    assert.strictEqual(
      conn.connected,
      false,
      "Connection should be created but not connected.",
    );
  });
});
