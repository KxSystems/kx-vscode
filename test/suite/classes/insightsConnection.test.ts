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
import * as sinon from "sinon";

import {
  extractInsightsRequestError,
  InsightsConnection,
} from "../../../src/classes/insightsConnection";
import { ext } from "../../../src/extensionVariables";

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
});
