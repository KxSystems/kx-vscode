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
  let renderPlotStub: sinon.SinonStub;

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

    renderPlotStub = sinon.stub().resolves();

    ScratchpadLoggerClass = proxyquire(
      "../../../src/classes/scratchpadLogger",
      {
        ws: { WebSocket: wsStub },
        "../services/kdbInsights/codeFlowLogin": { getCurrentToken: tokenStub },
        "../utils/notifications": { notify: notifyStub },
        "../utils/executionConsole": {
          ExecutionConsole: { start: consoleStartStub },
        },
        "../utils/plotUtils": { renderPlot: renderPlotStub },
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

  describe("png capture on stdout", () => {
    const png = "0x89504e470d0a1a0a0000000d49484452";
    let fakeConsole: {
      appendStdOut: sinon.SinonSpy;
      appendStdErr: sinon.SinonSpy;
    };

    const send = async (...values: string[]) => {
      const onMessage = fakeWs.on.withArgs("message").getCall(0).args[1];
      for (const value of values) {
        onMessage(
          Buffer.from(JSON.stringify({ data: [{ handle: "STDOUT", value }] })),
        );
      }
      await (logger as any).rendering;
    };

    beforeEach(async () => {
      fakeConsole = {
        appendStdOut: sinon.spy(),
        appendStdErr: sinon.spy(),
      };
      consoleStartStub.returns(fakeConsole);

      logger = new ScratchpadLoggerClass(mockConnection, "conn");
      await logger.connect();
    });

    it("should render a png arriving in one chunk", async () => {
      await send(`${png}\n`);

      sinon.assert.calledOnce(renderPlotStub);
      sinon.assert.calledWith(
        renderPlotStub,
        sinon.match((data: string) =>
          data.startsWith("data:image/png;base64,"),
        ),
        "conn",
      );
      sinon.assert.notCalled(fakeConsole.appendStdOut);
    });

    it("should render a png split across chunks", async () => {
      await send(png.slice(0, 22), png.slice(22), "\n");

      sinon.assert.calledOnce(renderPlotStub);
      sinon.assert.notCalled(fakeConsole.appendStdOut);
    });

    it("should render a png with the signature split across chunks", async () => {
      await send(png.slice(0, 6), png.slice(6), "\n");

      sinon.assert.calledOnce(renderPlotStub);
      sinon.assert.notCalled(fakeConsole.appendStdOut);
    });

    it("should hold back text that could start a signature", async () => {
      await send("log 0x89");

      sinon.assert.calledWith(fakeConsole.appendStdOut, "log ", "conn");
      assert.strictEqual((logger as any).pending, "0x89");
    });

    it("should release held back text that does not continue", async () => {
      await send("log 0x89", "ff\n");

      sinon.assert.notCalled(renderPlotStub);
      sinon.assert.calledWith(fakeConsole.appendStdOut, "0x89ff\n", "conn");
    });

    it("should keep text around the png on the console", async () => {
      await send(`before\n${png}\nafter`);

      sinon.assert.calledOnce(renderPlotStub);
      sinon.assert.calledWith(fakeConsole.appendStdOut, "before\n", "conn");
      sinon.assert.calledWith(fakeConsole.appendStdOut, "after", "conn");
    });

    it("should render two pngs from one chunk", async () => {
      await send(`${png}\n${png}\n`);

      sinon.assert.calledTwice(renderPlotStub);
    });

    it("should render a png that ends without a newline", async () => {
      await send(`${png}0000000049454e44ae426082`);

      sinon.assert.calledOnce(renderPlotStub);
      sinon.assert.notCalled(fakeConsole.appendStdOut);
    });

    it("should keep text after an unterminated png on the console", async () => {
      await send(`${png}0000000049454e44ae426082`, "next log line");

      sinon.assert.calledOnce(renderPlotStub);
      sinon.assert.calledWith(
        fakeConsole.appendStdOut,
        "next log line",
        "conn",
      );
    });

    it("should not capture hex without the png signature", async () => {
      await send("0xdeadbeef\n");

      sinon.assert.notCalled(renderPlotStub);
      sinon.assert.calledWith(fakeConsole.appendStdOut, "0xdeadbeef\n", "conn");
    });

    it("should put an odd length run back on the console", async () => {
      await send(`${png}a\n`);

      sinon.assert.notCalled(renderPlotStub);
      sinon.assert.calledWith(fakeConsole.appendStdOut, `${png}a`, "conn");
    });

    it("should give up on a run past the size limit", async () => {
      (logger as any).MAX_CAPTURE = 8;
      await send(`${png}\n`);

      sinon.assert.notCalled(renderPlotStub);
      sinon.assert.calledWith(fakeConsole.appendStdOut, png, "conn");
    });

    it("should drop a partial capture on close", async () => {
      await send(png.slice(0, 22));
      assert.strictEqual((logger as any).capturing, true);

      const onClose = fakeWs.on.withArgs("close").getCall(0).args[1];
      onClose(1006, "Abnormal Closure");

      assert.strictEqual((logger as any).capturing, false);
      assert.strictEqual((logger as any).capture, "");
    });
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
});
