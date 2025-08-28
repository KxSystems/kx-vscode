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
import * as vscode from "vscode";

import { ext } from "../../../src/extensionVariables";
import * as loggers from "../../../src/utils/loggers";

describe("loggers", () => {
  let appendLineStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;

  ext.outputChannel = vscode.window.createOutputChannel("kdb");

  beforeEach(() => {
    appendLineStub = sinon.stub(ext.outputChannel, "appendLine");

    showErrorMessageStub = sinon.stub(vscode.window, "showErrorMessage");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("kdbOutputLog", () => {
    it("should log message with INFO type and not show error dialog", () => {
      const message = "Test info message";
      const type = "INFO";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[INFO] Test info message"),
        "appendLine should include type and message",
      );

      assert.ok(
        showErrorMessageStub.notCalled,
        "showErrorMessage should not be called for INFO type",
      );
    });

    it("should log message with WARNING type and not show error dialog", () => {
      const message = "Test warning message";
      const type = "WARNING";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[WARNING] Test warning message"),
        "appendLine should include type and message",
      );

      assert.ok(
        showErrorMessageStub.notCalled,
        "showErrorMessage should not be called for WARNING type",
      );
    });

    it("should log message with ERROR type and show error dialog", () => {
      const message = "Test error message";
      const type = "ERROR";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[ERROR] Test error message"),
        "appendLine should include type and message",
      );

      assert.ok(
        showErrorMessageStub.calledOnce,
        "showErrorMessage should be called once for ERROR type",
      );
      assert.ok(
        showErrorMessageStub.calledWith(
          "Error occured, check kdb output channel for details.",
        ),
        "showErrorMessage should be called with correct message",
      );
    });

    it("should log ERROR message but suppress dialog when supressDialog is true", () => {
      const message = "Test error message";
      const type = "ERROR";
      const supressDialog = true;

      loggers.kdbOutputLog(message, type, supressDialog);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[ERROR] Test error message"),
        "appendLine should include type and message",
      );

      assert.ok(
        showErrorMessageStub.notCalled,
        "showErrorMessage should not be called when supressDialog is true",
      );
    });

    it("should log ERROR message and show dialog when supressDialog is false", () => {
      const message = "Test error message";
      const type = "ERROR";
      const supressDialog = false;

      loggers.kdbOutputLog(message, type, supressDialog);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[ERROR] Test error message"),
        "appendLine should include type and message",
      );

      assert.ok(
        showErrorMessageStub.calledOnce,
        "showErrorMessage should be called when supressDialog is false",
      );
    });

    it("should handle empty message", () => {
      const message = "";
      const type = "INFO";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[INFO] "),
        "appendLine should include type even with empty message",
      );

      assert.ok(
        showErrorMessageStub.notCalled,
        "showErrorMessage should not be called for INFO type",
      );
    });

    it("should handle custom type", () => {
      const message = "Test custom message";
      const type = "CUSTOM";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[CUSTOM] Test custom message"),
        "appendLine should include custom type and message",
      );

      assert.ok(
        showErrorMessageStub.notCalled,
        "showErrorMessage should not be called for custom type",
      );
    });

    it("should handle multiline message", () => {
      const message = "Line 1\nLine 2\nLine 3";
      const type = "INFO";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[INFO] Line 1\nLine 2\nLine 3"),
        "appendLine should include multiline message",
      );
    });

    it("should handle special characters in message", () => {
      const message = "Message with special chars: !@#$%^&*()[]{}";
      const type = "INFO";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes(
          "[INFO] Message with special chars: !@#$%^&*()[]{}",
        ),
        "appendLine should include message with special characters",
      );
    });

    it("should handle ERROR type case insensitive", () => {
      const message = "Test error message";
      const type = "error";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.includes("[error] Test error message"),
        "appendLine should include lowercase error type",
      );

      assert.ok(
        showErrorMessageStub.notCalled,
        "showErrorMessage should not be called for lowercase 'error'",
      );
    });

    it("should include timestamp in log format", () => {
      const message = "Test message";
      const type = "INFO";

      loggers.kdbOutputLog(message, type);

      assert.ok(appendLineStub.calledOnce, "appendLine should be called once");

      const loggedMessage = appendLineStub.getCall(0).args[0];

      assert.ok(
        loggedMessage.match(/\[.*\] \[INFO\] Test message/),
        "appendLine should include timestamp, type, and message in correct format",
      );
    });
  });
});
