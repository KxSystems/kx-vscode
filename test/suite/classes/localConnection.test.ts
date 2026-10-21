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

import { LocalConnection } from "../../../src/classes/localConnection";
import { ext } from "../../../src/extensionVariables";
import * as loggers from "../../../src/utils/loggers";
import * as notifications from "../../../src/utils/notifications";

describe("LocalConnection", () => {
  let localConn: LocalConnection;
  let connectStub: sinon.SinonStub;
  let disconnectStub: sinon.SinonStub;
  let getConnectionStub: sinon.SinonStub;

  beforeEach(() => {
    localConn = new LocalConnection("127.0.0.1:5001", "testLabel", []);
    connectStub = sinon.stub(localConn, "connect");
    disconnectStub = sinon.stub(localConn, "disconnect");
    getConnectionStub = sinon.stub(localConn, "getConnection");
  });

  afterEach(() => {
    connectStub.restore();
    disconnectStub.restore();
    getConnectionStub.restore();
  });

  it("Should create a new connection object", () => {
    const conn = new LocalConnection("server:5001", "server1", []);
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
      [],
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
    const conn = new LocalConnection("server:5001", "server1", []);
    conn.disconnect();
    assert.strictEqual(
      conn.connected,
      false,
      "Connection should be created but not connected.",
    );
  });

  it("should have the correct label", () => {
    assert.strictEqual(localConn.connLabel, "testLabel");
  });

  it("should get connection", () => {
    getConnectionStub.callsFake(() => {
      return "fakeConnection";
    });

    const conn = localConn.getConnection();
    assert.strictEqual(conn, "fakeConnection");
  });

  describe("executeQuery", () => {
    beforeEach(() => {
      // executeQuery() also fires off a trailing updateGlobal() call; stub
      // it away so each test only has to answer the query's own callback.
      sinon.stub(localConn, "updateGlobal" as any);
      // Avoids queryWrapper() reading evaluateQ.q/formatQ.q off disk via
      // ext.context.asAbsolutePath, which isn't available in this suite.
      localConn.useAPI = true;
    });

    it("should resolve (not reject) with an 'Error:'-prefixed message on a syntax error (e.g. a missing bracket)", async () => {
      // A missing closing bracket breaks tokenizing itself, before
      // evalInContext ever runs, so it surfaces as a raw IPC-level error
      // with no stacktrace, not a graceful res.error dict.
      localConn["connection"] = <any>{
        k: sinon.stub().callsArgWith(2, new Error("{")),
      };

      const result = await localConn.executeQuery("f:{[x] x+1");

      assert.strictEqual(result, "Error: {");
    });

    it("should prefix a graceful type error (e.g. char + int) with 'Error:'", async () => {
      localConn["connection"] = <any>{
        k: sinon.stub().callsArgWith(2, null, {
          data: null,
          error: true,
          errorMsg: "type",
        }),
      };

      const result = await localConn.executeQuery('1+"a"');

      assert.strictEqual(result, "Error: type");
    });

    it("should prefix a graceful undefined-variable error with 'Error:' and keep its stacktrace", async () => {
      localConn["connection"] = <any>{
        k: sinon.stub().callsArgWith(2, null, {
          data: null,
          error: true,
          errorMsg: "undefinedFn",
          stacktrace: "  [1]  b:undefinedFn[2];\n         ^\n",
        }),
      };

      const result = await localConn.executeQuery("a:1;b:undefinedFn[2];a+b");

      assert.strictEqual(
        result,
        "Error: undefinedFn\n  [1]  b:undefinedFn[2];\n         ^\n",
      );
    });

    describe("row limit", () => {
      let kStub: sinon.SinonStub;

      beforeEach(() => {
        kStub = sinon
          .stub()
          .callsArgWith(2, null, { data: '"ok"', error: false });
        localConn["connection"] = <any>{ k: kStub };
      });

      it("should send the rowLimit for a q query", async () => {
        await localConn.executeQuery("til 10", undefined, false, false, {
          limit: 10,
          from: "last",
        });

        assert.deepStrictEqual(kStub.firstCall.args[1], {
          ctx: ".",
          code: "til 10",
          returnFormat: "structuredText",
          sampleFn: null,
          sampleSize: null,
          rowLimit: { size: 10, from: "last" },
        });
      });

      it("should send the rowLimit for a python query and keep its sample", async () => {
        await localConn.executeQuery("1+1", undefined, false, true, {
          limit: 1000,
          from: "first",
        });

        assert.deepStrictEqual(kStub.firstCall.args[1], {
          code: "1+1",
          returnFormat: "structuredText",
          sample_fn: "first",
          sample_size: 10000,
          rowLimit: { size: 1000, from: "first" },
        });
      });
    });

    // A custom .z.pg, or a gateway that wraps every result, answers with
    // whatever it likes instead of the wrapper's data/error dictionary.
    for (const [shape, response] of [
      ["a string", "wrapped"],
      ["a dictionary without data", { a: 1, b: 2 }],
      ["nothing", null],
      ["an envelope whose data is not text", { data: { a: 1 }, code: 200 }],
      ["an error flag without a message", { error: true, msg: "timeout" }],
      // Envelopes that reuse the wrapper's key names get past the shape check,
      // but their data is not the structured text asked for.
      ["an envelope whose data is not JSON", { data: "OK", error: false }],
      ["an envelope with no data", { data: null, error: false }],
    ] as const) {
      it(`should resolve with an 'Error:'-prefixed message when the process answers with ${shape}`, async () => {
        localConn["connection"] = <any>{
          k: sinon.stub().callsArgWith(2, null, response),
        };

        const result = await localConn.executeQuery("til 10");

        assert.ok(
          typeof result === "string" &&
            result.startsWith("Error: ") &&
            result.includes("could not read"),
          `not the unreadable-response error: ${JSON.stringify(result)}`,
        );
      });
    }
  });

  describe("loadServerObjects", () => {
    /**
     * What a process answers the memory listing with, in the shape listMem.q
     * reports it: a namespace has a row of its own, marked isNs.
     */
    const listing = [
      { name: ".q", fname: ".q", typeNum: 99, namespace: ".", isNs: true },
      { name: ".s", fname: ".s", typeNum: 99, namespace: ".", isNs: true },
      { name: ".e2e", fname: ".e2e", typeNum: 99, namespace: ".", isNs: true },
      {
        name: "trade",
        fname: "trade",
        typeNum: 98,
        namespace: ".",
        isNs: false,
      },
    ];

    it("should leave out the namespaces a process keeps to itself", async () => {
      localConn["connection"] = <any>{};
      // The process has the .vscode namespace loaded, so the listing is asked
      // for by name rather than by sending listMem.q over.
      localConn.useAPI = true;
      sinon.stub(localConn, "executeQueryRaw").resolves(listing);

      const result = await localConn.loadServerObjects();

      assert.deepStrictEqual(
        result.map((object) => object.name),
        [".e2e", "trade"],
        "an internal namespace was listed",
      );
    });

    describe("when the process does not answer with a table", () => {
      let log: sinon.SinonStub;

      beforeEach(() => {
        localConn["connection"] = <any>{};
        localConn.useAPI = true;
        log = sinon.stub(loggers, "kdbOutputLog");
      });

      afterEach(() => {
        log.restore();
        delete (globalThis as any).evaluatedByListing;
      });

      it("should list nothing and log a warning", async () => {
        sinon.stub(localConn, "executeQueryRaw").resolves("wrapped");

        const result = await localConn.loadServerObjects();

        assert.deepStrictEqual(result, []);
        assert.ok(
          log.calledWithMatch(sinon.match("expected a table"), "WARNING"),
          "no warning was logged",
        );
      });

      it("should not run what the process sends back", async () => {
        sinon
          .stub(localConn, "executeQueryRaw")
          .resolves("globalThis.evaluatedByListing = true; []");

        await localConn.loadServerObjects();

        assert.strictEqual(
          (globalThis as any).evaluatedByListing,
          undefined,
          "the response was evaluated as code",
        );
      });
    });
  });

  describe("updateGlobals", () => {
    let notifyStub: sinon.SinonStub;

    beforeEach(() => {
      notifyStub = sinon.stub(notifications, "notify");
    });

    afterEach(() => {
      sinon.restore();
    });

    for (const [shape, globals] of [
      ["a dictionary", { a: 1 }],
      ["a string", "wrapped"],
      ["null", null],
    ] as const) {
      it(`should log at debug level and empty completions when given ${shape}`, () => {
        ext.variables.push("stale");

        localConn["updateGlobals"](globals);

        assert.strictEqual(ext.variables.length, 0, "completions not cleared");
        sinon.assert.calledOnce(notifyStub);
        assert.strictEqual(
          notifyStub.firstCall.args[1],
          notifications.MessageKind.DEBUG,
          "a non-table answer must not raise a popup",
        );
      });
    }
  });
});
