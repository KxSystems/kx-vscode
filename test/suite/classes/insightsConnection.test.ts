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

import assert from "assert";
import axios from "axios";
import * as sinon from "sinon";
import { window } from "vscode";

import {
  extractInsightsRequestError,
  InsightsConnection,
} from "../../../src/classes/insightsConnection";
import { ext } from "../../../src/extensionVariables";
import { DataSourceTypes } from "../../../src/models/dataSource";

describe("insightsConnection", () => {
  describe("scratchpad logger lifecycle", () => {
    const withLogger = () => {
      const conn = new InsightsConnection("conn", <any>{
        details: { alias: "conn" },
        label: "conn",
      });
      const logger = { connect: sinon.spy(), disconnect: sinon.spy() };
      (<any>conn).scratchpadLogger = logger;
      return { conn, logger };
    };

    afterEach(() => {
      sinon.restore();
    });

    it("should keep streaming when another connection becomes active", () => {
      const { conn, logger } = withLogger();

      conn.setInactive();

      // Notebooks and workbooks run against the connection they are mapped to,
      // not the active one, so their output must keep arriving.
      sinon.assert.notCalled(logger.disconnect);
    });

    it("should start the logger when the connection becomes active", async () => {
      const { conn, logger } = withLogger();
      conn.insightsVersion = "1.18";

      await conn.setActive();

      sinon.assert.calledOnce(logger.connect);
    });

    it("should stop streaming on disconnect", () => {
      const { conn, logger } = withLogger();
      const context = ext.context;
      ext.context = <any>{ secrets: { delete: sinon.stub() } };

      try {
        conn.disconnect();
      } finally {
        ext.context = context;
      }

      sinon.assert.calledOnce(logger.disconnect);
      assert.strictEqual((<any>conn).scratchpadLogger, undefined);
    });
  });

  describe("extractInsightsRequestError", () => {
    it("should surface a plain-text 500 body (coordinator killed)", () => {
      const error = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: "Coordinator connection has closed",
        },
      };
      assert.strictEqual(
        extractInsightsRequestError(error),
        "Request failed with status 500: Coordinator connection has closed",
      );
    });

    it("should fall back to statusText for an HTML 502 body (gateway killed)", () => {
      const error = {
        response: {
          status: 502,
          statusText: "Bad Gateway",
          data: "<html><head><title>502 Bad Gateway</title></head></html>",
        },
      };
      assert.strictEqual(
        extractInsightsRequestError(error),
        "Request failed with status 502: Bad Gateway",
      );
    });

    it("should use the error message when there is no response (dropped socket)", () => {
      const error = { message: "socket hang up" };
      assert.strictEqual(extractInsightsRequestError(error), "socket hang up");
    });

    it("should stringify an unknown error with no message or response", () => {
      assert.strictEqual(extractInsightsRequestError("boom"), "boom");
    });
  });

  describe("getScratchpadQuery", () => {
    const withConnection = (requestID?: string) => {
      const conn = new InsightsConnection("conn", <any>{
        details: { alias: "conn", server: "https://test.kx.com" },
        label: "conn",
      });
      conn.connected = true;
      (<any>conn).connEndpoints = {
        scratchpad: { scratchpad: "scratchpadmanager/scratchpad/display" },
      };
      const getOptions = sinon
        .stub(<any>conn, "getOptions")
        .resolves(undefined);

      return conn
        .getScratchpadQuery("1+1", ".", false, false, undefined, requestID)
        .then(() => getOptions.getCall(0).args[4] as any);
    };

    afterEach(() => sinon.restore());

    it("should send the caller's requestID", async () => {
      const body = await withConnection("req-1");

      assert.strictEqual(body.requestID, "req-1");
    });

    it("should send a requestID even when the caller has none", async () => {
      const body = await withConnection();

      assert.ok(body.requestID);
    });

    it("should send a different requestID on each query", async () => {
      const first = await withConnection();
      sinon.restore();
      const second = await withConnection();

      assert.notStrictEqual(first.requestID, second.requestID);
    });
  });

  describe("getScratchpadQuery results", () => {
    const encoded =
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAJCAYAAAALpr0TAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABISURBVChTzczBCQAwCAPAbOcsjuJczuEsKfEhfbR9NyAKnoIkAag90+IGM5Nm1vMT7hkYEd1V7t7L40fBuQZYVWe4R0uhT+ACr2QebHdL0JYAAAAASUVORK5CYII=";

    let adapter: any;

    const respondWith = (data: unknown) => {
      axios.defaults.adapter = async (config: any) =>
        <any>{
          data,
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
    };

    const withConnection = () => {
      const conn = new InsightsConnection("conn", <any>{
        details: { alias: "conn", server: "https://test.kx.com" },
        label: "conn",
      });
      conn.connected = true;
      conn.insightsVersion = "1.12";
      (<any>conn).connEndpoints = {
        scratchpad: { scratchpad: "scratchpadmanager/scratchpad/display" },
      };
      sinon
        .stub(<any>conn, "getOptions")
        .resolves({ url: "https://test.kx.com/scratchpad", method: "POST" });
      return conn;
    };

    beforeEach(() => {
      ext.outputChannel = window.createOutputChannel("kdb", { log: true });
      adapter = axios.defaults.adapter;
    });

    afterEach(() => {
      axios.defaults.adapter = adapter;
      sinon.restore();
    });

    it("should parse a structured text payload", async () => {
      const payload = {
        count: 1,
        columns: [
          {
            name: "values",
            type: "long",
            values: [["2"]],
            order: [0],
          },
        ],
        warnings: [],
      };

      respondWith({
        error: false,
        errorMsg: "",
        data: JSON.stringify(payload),
      });

      const result = await withConnection().getScratchpadQuery(
        "1+1",
        ".",
        false,
        true,
      );

      assert.deepStrictEqual(result, payload);
    });

    it("should keep an encoded png payload as it arrived", async () => {
      respondWith({ error: false, errorMsg: "", data: encoded });

      const result = await withConnection().getScratchpadQuery(
        "image",
        ".",
        false,
        true,
      );

      assert.strictEqual(result.error, false);
      assert.strictEqual(result.data, encoded);
    });
  });

  describe("getDatasourceQuery for a UDA", () => {
    const withConnection = (body: any, timeout?: number) => {
      const conn = new InsightsConnection("conn", <any>{
        details: { alias: "conn", server: "https://test.kx.com" },
        label: "conn",
      });
      conn.connected = true;
      (<any>conn).connEndpoints = {
        serviceGateway: { udaBase: "servicegateway/" },
      };
      const getOptions = sinon
        .stub(<any>conn, "getOptions")
        .resolves(undefined);

      return conn
        .getDatasourceQuery(DataSourceTypes.UDA, body, timeout)
        .then(() => getOptions.getCall(0).args);
    };

    const request = () => ({
      language: "q",
      name: ".insightsUda.singleMultiplierAPI",
      params: { column: "price", multiplier: "3" },
      parameterTypes: { column: -11, multiplier: -7 },
      returnFormat: "text",
      sampleFn: "first",
      sampleSize: 10000,
    });

    afterEach(() => sinon.restore());

    it("names the UDA in the path, dots as slashes and the namespace dropped", async () => {
      const args = await withConnection(request());

      assert.strictEqual(
        args[3],
        "https://test.kx.com/servicegateway/insightsUda/singleMultiplierAPI",
      );
    });

    it("sends the parameters as the whole body", async () => {
      const args = await withConnection(request());

      assert.deepStrictEqual(args[4], {
        column: "price",
        multiplier: "3",
      });
    });

    it("drops the parameter types on the way to the gateway", async () => {
      const args = await withConnection(request());

      // Deliberate for now: getDatasourceQuery does `body = body.params`, so
      // Run Query sends no parameterTypes while Populate Scratchpad does. The
      // TODO beside it waits on the endpoint accepting the key — until then a
      // multi-typed parameter is read by the gateway as its first type.
      assert.strictEqual(args[4].parameterTypes, undefined);
    });

    it("adds the timeout the caller asked for, in milliseconds", async () => {
      const args = await withConnection(request(), 30);

      assert.deepStrictEqual(args[4].opts, { timeout: 30000 });
    });
  });

  describe("importScratchpad for a UDA", () => {
    const uda = {
      name: ".insightsUda.multiplierAPI",
      description: "",
      params: [
        {
          name: "value",
          description: "",
          isReq: true,
          type: [-11, -7],
          selectedMultiTypeString: "Long",
          isVisible: true,
          value: 44,
        },
      ],
    };

    const withConnection = () => {
      const conn = new InsightsConnection("conn", <any>{
        details: { alias: "conn", server: "https://test.kx.com" },
        label: "conn",
      });
      conn.connected = true;
      (<any>conn).connEndpoints = {
        scratchpad: { importUDA: "scratchpadmanager/scratchpad/importUDA" },
      };
      sinon.stub(conn, "isUDAAvailable").resolves(true);
      const getOptions = sinon
        .stub(<any>conn, "getOptions")
        .resolves(undefined);

      return conn
        .importScratchpad("out", <any>{
          dataSource: { selectedType: DataSourceTypes.UDA, uda },
        })
        .then(() => getOptions.getCall(0)?.args[4] as any);
    };

    beforeEach(() => {
      sinon.stub(ext.constants, "allowedEmptyRequiredTypes").value([10, -11]);
      sinon.stub(ext.constants, "reverseDataTypes").value(
        new Map([
          ["Symbol", -11],
          ["Long", -7],
        ]),
      );
    });

    afterEach(() => sinon.restore());

    it("carries the parameter types the scratchpad needs", async () => {
      const body = await withConnection();

      // The key KXI-65951 asks for, with the type picked on the form rather
      // than the first one registered.
      assert.deepStrictEqual(body.parameterTypes, { value: -7 });
      assert.deepStrictEqual(body.params, { value: 44 });
    });

    it("names the UDA and the variable it lands in", async () => {
      const body = await withConnection();

      assert.strictEqual(body.name, ".insightsUda.multiplierAPI");
      assert.strictEqual(body.output, "out");
      assert.strictEqual(body.language, "q");
    });
  });

  describe("generateQSqlBody", () => {
    const withMeta = (version: string) => {
      const conn = new InsightsConnection("conn", <any>{
        details: { alias: "conn", server: "https://example.com" },
        label: "conn",
      });
      conn.insightsVersion = version;
      (<any>conn).meta = {
        payload: { dap: [{ assembly: "assembly-qe", instance: "rdb" }] },
      };
      return conn;
    };

    it("should leave the body alone when neither is given", () => {
      const body = <any>(
        withMeta("1.20").generateQSqlBody("q", "assembly rdb", "1.20")
      );

      assert.strictEqual("agg" in body, false);
      assert.strictEqual("labels" in body, false);
    });

    it("should send the agg and the labels beside the scope", () => {
      const body = <any>withMeta("1.20").generateQSqlBody(
        "q",
        "assembly rdb",
        "1.20",
        {
          agg: "distinct",
          labels: { kxname: "db" },
        },
      );

      assert.strictEqual(body.agg, "distinct");
      assert.deepStrictEqual(body.labels, { kxname: "db" });
      assert.strictEqual(body.scope.assembly, "assembly-qe");
    });

    it("should leave the instance out of a distributed scope", () => {
      const body = <any>(
        withMeta("1.20").generateQSqlBody("q", "assembly", "1.20")
      );

      assert.strictEqual(body.scope.assembly, "assembly-qe");
      assert.strictEqual(body.scope.tier, undefined);
      assert.strictEqual(body.scope.dap, undefined);
    });

    it("should send them on the older body shape too", () => {
      const body = <any>withMeta("1.12").generateQSqlBody(
        "q",
        "assembly rdb",
        "1.12",
        {
          agg: "distinct",
        },
      );

      assert.strictEqual(body.agg, "distinct");
      assert.strictEqual(body.assembly, "assembly-qe");
      assert.strictEqual("scope" in body, false);
    });
  });
});
