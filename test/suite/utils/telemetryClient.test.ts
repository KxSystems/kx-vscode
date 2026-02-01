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

import * as telemetryModule from "@vscode/extension-telemetry";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { ExtensionTelemetry } from "../../../src/utils/telemetryClient";

describe("ExtensionTelemetry", () => {
  let telemetryReporterMock: sinon.SinonStubbedInstance<telemetryModule.TelemetryReporter>;
  let outputChannelMock: any;

  beforeEach(() => {
    telemetryReporterMock = sinon.createStubInstance(
      telemetryModule.TelemetryReporter,
    );
    sinon
      .stub(telemetryModule, "TelemetryReporter")
      .returns(telemetryReporterMock as any);

    outputChannelMock = {
      appendLine: sinon.spy(),
      dispose: sinon.stub().resolves(),
    };
    sinon.stub(vscode.window, "createOutputChannel").returns(outputChannelMock);
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.CODE_TEST;
  });

  it("should verify sendTelemetryEvent was called correctly", () => {
    process.env.CODE_TEST = ""; // Production mode
    const ext = new ExtensionTelemetry("conn-string", true);
    const props = { category: "testing" };
    const measurements = { duration: 100 };

    ext.sendEvent("testEvent", props, measurements);

    sinon.assert.calledOnce(telemetryReporterMock.sendTelemetryEvent);
    sinon.assert.calledWith(
      telemetryReporterMock.sendTelemetryEvent,
      "testEvent",
      sinon.match(props),
      sinon.match(measurements),
    );
  });

  it("should verify sendTelemetryErrorEvent was called correctly", () => {
    process.env.CODE_TEST = "";
    const ext = new ExtensionTelemetry("conn-string", true);
    const testError = new Error("critical failure");
    testError.name = "DatabaseError";

    ext.sendError(testError, { userRole: "admin" });

    sinon.assert.calledOnce(telemetryReporterMock.sendTelemetryErrorEvent);
    sinon.assert.calledWith(
      telemetryReporterMock.sendTelemetryErrorEvent,
      "DatabaseError",
      sinon.match({
        name: "DatabaseError",
        message: "critical failure",
        userRole: "admin",
      }),
    );
  });

  it("should verify output channel logging in test mode", () => {
    process.env.CODE_TEST = "true"; // Test mode
    const ext = new ExtensionTelemetry("conn-string", true);

    ext.sendEvent("clickAction", { button: "left" });

    sinon.assert.calledOnce(outputChannelMock.appendLine);
    sinon.assert.calledWithMatch(
      outputChannelMock.appendLine,
      /telemetry\/clickAction/,
    );
  });

  it("should verify nothing is called when telemetry is disabled", () => {
    const ext = new ExtensionTelemetry("conn-string", false);

    ext.sendEvent("unusedEvent");

    sinon.assert.notCalled(telemetryReporterMock.sendTelemetryEvent);
    sinon.assert.notCalled(outputChannelMock.appendLine);
  });
});
