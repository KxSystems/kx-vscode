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

import { LocalConnection } from "../../../src/classes/localConnection";

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

  it("should connect", async () => {
    connectStub.callsFake((callback) => {
      callback(null, "fakeConnection");
    });

    await localConn.connect((err, conn) => {
      assert.ok(!err);
      assert.strictEqual(conn, "fakeConnection");
    });
  });
});
