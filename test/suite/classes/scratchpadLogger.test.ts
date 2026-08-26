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
import proxyquire from "proxyquire";
import * as sinon from "sinon";

import { ScratchpadLogger } from "../../../src/classes/scratchpadLogger";
import * as authService from "../../../src/services/kdbInsights/codeFlowLogin";
import { ExecutionConsole } from "../../../src/utils/executionConsole";
import * as notifications from "../../../src/utils/notifications";

describe("ScratchpadLogger", () => {
  let ScratchpadLoggerClass: any;
  let logger: ScratchpadLogger;
  let wsStub: sinon.SinonStub;
  let fakeWs: any;
  let clock: sinon.SinonFakeTimers;
  let consoleStartStub: sinon.SinonStub;
  let notifyStub: sinon.SinonStub;
  let tokenStub: sinon.SinonStub;
  let renderImageStub: sinon.SinonStub;

  const mockConnection: any = {
    alias: "test-insight",
    server: "https://test.kx.com",
    realm: "insights",
    insecure: false,
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    tokenStub = sinon
      .stub(authService, "getCurrentToken")
      .resolves({ accessToken: "mock-token" } as any);
    notifyStub = sinon.stub(notifications, "notify");
    consoleStartStub = sinon.stub(ExecutionConsole, "start");

    fakeWs = {
      on: sinon.stub(),
      ping: sinon.stub(),
      close: sinon.stub(),
      readyState: 1, // WebSocket.OPEN
    };

    wsStub = Object.assign(sinon.stub().returns(fakeWs), {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    tokenStub = sinon.stub().resolves({ accessToken: "mock-token" });
    notifyStub = sinon.stub();
    consoleStartStub = sinon.stub().returns({
      appendStdOut: sinon.spy(),
      appendStdErr: sinon.spy(),
    });

    renderImageStub = sinon.stub().resolves();

    ScratchpadLoggerClass = proxyquire(
      "../../../src/classes/scratchpadLogger",
      {
        ws: { WebSocket: wsStub },
        "../services/kdbInsights/codeFlowLogin": { getCurrentToken: tokenStub },
        "../utils/notifications": { notify: notifyStub },
        "../utils/executionConsole": {
          ExecutionConsole: { start: consoleStartStub },
        },
        "../utils/plotUtils": { renderImage: renderImageStub },
      },
    ).ScratchpadLogger;
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  it("should initialize with the correct wss:// URL", () => {
    logger = new ScratchpadLoggerClass(mockConnection);
    assert.strictEqual(
      (logger as any).url,
      "wss://test.kx.com/scratchpadmanager/websocket",
    );
  });

  it("should not open a second socket when connect is called again", async () => {
    logger = new ScratchpadLoggerClass(mockConnection);

    // Started on connect and again when the connection becomes active; a
    // second socket would duplicate every log line and leak the first.
    await logger.connect();
    await logger.connect();

    sinon.assert.calledOnce(wsStub);
  });

  it("should open a new socket after the previous one closed", async () => {
    logger = new ScratchpadLoggerClass(mockConnection);
    await logger.connect();

    const onClose = fakeWs.on.withArgs("close").getCall(0).args[1];
    logger.disconnect();
    onClose(1000, Buffer.from("done"));

    await logger.connect();

    sinon.assert.calledTwice(wsStub);
  });

  it("should send pings every 30s after opening", async () => {
    logger = new ScratchpadLoggerClass(mockConnection);
    await logger.connect();

    fakeWs.readyState = 1;

    const onOpen = fakeWs.on.withArgs("open").getCall(0).args[1];
    onOpen();

    sinon.assert.calledWith(
      notifyStub,
      sinon.match(`${mockConnection.alias} websocket start heartbeat`),
    );

    clock.tick(30000);
    sinon.assert.calledOnce(fakeWs.ping);
    sinon.assert.calledWith(
      notifyStub,
      sinon.match(`${mockConnection.alias} websocket ping`),
    );
  });

  it("should correctly handle log data routing", async () => {
    const fakeConsole = {
      appendStdOut: sinon.spy(),
      appendStdErr: sinon.spy(),
    };
    consoleStartStub.returns(fakeConsole);

    logger = new ScratchpadLoggerClass(mockConnection);
    await logger.connect();

    const onMessage = fakeWs.on.withArgs("message").getCall(0).args[1];
    const payload = JSON.stringify({
      channel: "logging",
      data: [
        { handle: "STDOUT", value: "Log A" },
        { handle: "STDERR", value: "Error B" },
      ],
    });

    onMessage(Buffer.from(payload));

    sinon.assert.calledWith(fakeConsole.appendStdOut, "Log A");
    sinon.assert.calledWith(fakeConsole.appendStdErr, "Error B");
  });

  it("should reconnect on unexpected close using backoff", async () => {
    logger = new ScratchpadLoggerClass(mockConnection);
    await logger.connect();

    const onClose = fakeWs.on.withArgs("close").getCall(0).args[1];
    onClose(1006, "Abnormal Closure");

    assert.ok(notifyStub.calledWith(sinon.match("closed unexpectedly")));

    clock.tick(2000);

    sinon.assert.calledTwice(tokenStub);
  });

  it("should set TCP keep-alive when upgrade occurs", async () => {
    logger = new ScratchpadLoggerClass(mockConnection);
    await logger.connect();

    const onUpgrade = fakeWs.on.withArgs("upgrade").getCall(0).args[1];
    const mockSocket = { setKeepAlive: sinon.spy() };

    onUpgrade({ socket: mockSocket });

    assert.ok(mockSocket.setKeepAlive.calledWith(true, 15000));
  });

  it("should suppress reconnection on manual disconnect", async () => {
    logger = new ScratchpadLoggerClass(mockConnection);
    await logger.connect();

    logger.disconnect();
    assert.ok(fakeWs.close.calledOnce);

    const onClose = fakeWs.on.withArgs("close").getCall(0).args[1];
    onClose(1000, "Normal Closure");

    clock.tick(10000);
    // Should still only be 1 total call to get token
    sinon.assert.calledOnce(tokenStub);
  });

  describe("image channel", () => {
    const png = "iVBORw0KGgo=";

    async function send(frame: any) {
      logger = new ScratchpadLoggerClass(mockConnection);
      await logger.connect();
      const onMessage = fakeWs.on.withArgs("message").getCall(0).args[1];
      onMessage(Buffer.from(JSON.stringify(frame)));
      await (logger as any).rendering;
    }

    it("should render an image frame as a data URI", async () => {
      await send({
        channel: "image",
        data: {
          format: "PNG",
          encoding: "base64",
          requestID: "req-1",
          data: png,
        },
      });

      sinon.assert.calledOnceWithExactly(
        renderImageStub,
        "req-1",
        `data:image/png;base64,${png}`,
      );
    });

    it("should not route an image frame to the console", async () => {
      const fakeConsole = {
        appendStdOut: sinon.spy(),
        appendStdErr: sinon.spy(),
      };
      consoleStartStub.returns(fakeConsole);

      await send({
        channel: "image",
        data: {
          format: "PNG",
          encoding: "base64",
          requestID: "",
          data: png,
        },
      });

      sinon.assert.notCalled(fakeConsole.appendStdOut);
      sinon.assert.notCalled(fakeConsole.appendStdErr);
    });

    it("should ignore a frame that is not a base64 PNG", async () => {
      await send({
        channel: "image",
        data: {
          format: "SVG",
          encoding: "base64",
          requestID: "req-1",
          data: png,
        },
      });

      sinon.assert.notCalled(renderImageStub);
    });

    it("should ignore an image frame carrying no data", async () => {
      await send({
        channel: "image",
        data: {
          format: "PNG",
          encoding: "base64",
          requestID: "req-1",
          data: "",
        },
      });

      sinon.assert.notCalled(renderImageStub);
    });

    it("should not treat a frame on another channel as console output", async () => {
      consoleStartStub.resetHistory();

      await send({ channel: "status", data: { state: "ready" } });

      sinon.assert.notCalled(consoleStartStub);
      sinon.assert.notCalled(renderImageStub);
    });

    it("should keep rendering after one image fails", async () => {
      renderImageStub.onFirstCall().rejects(new Error("no workspace"));

      logger = new ScratchpadLoggerClass(mockConnection);
      await logger.connect();
      const onMessage = fakeWs.on.withArgs("message").getCall(0).args[1];
      const frame = JSON.stringify({
        channel: "image",
        data: {
          format: "PNG",
          encoding: "base64",
          requestID: "req-1",
          data: png,
        },
      });

      onMessage(Buffer.from(frame));
      onMessage(Buffer.from(frame));
      await (logger as any).rendering;

      sinon.assert.calledTwice(renderImageStub);
    });
  });
});
