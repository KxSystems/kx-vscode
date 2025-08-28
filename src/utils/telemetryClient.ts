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

import { TelemetryReporter } from "@vscode/extension-telemetry";
import * as crypto from "crypto";
import * as os from "os";
import { OutputChannel, window, workspace } from "vscode";

import { ext } from "../extensionVariables";

class ExtensionTelemetry {
  private readonly output?: OutputChannel;
  private readonly reporter?: TelemetryReporter;

  private readonly defaultProperties: { [key: string]: any } = {};

  constructor() {
    const isEnableTelemetry = ext.isRCExtension
      ? false
      : (workspace.getConfiguration("telemetry").get("enableTelemetry") ??
        true);
    const isTestRun = process.env.CODE_TEST || false;

    if (isEnableTelemetry) {
      if (isTestRun) {
        this.output = window.createOutputChannel("telemetry-client-test");
      } else {
        try {
          this.reporter = new TelemetryReporter(ext.extAIConnString);
          this.defaultProperties["common.vscodemachineid"] =
            generateMachineId();
          this.defaultProperties["common.vscodesessionid"] =
            generateSessionId();
        } catch (error) {
          console.log(error);
        }
      }
    }
  }

  public sendEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ): void {
    const props = Object.assign({}, this.defaultProperties, properties);

    if (this.reporter) {
      this.reporter.sendTelemetryEvent(eventName, props, measurements);
    }
    if (this.output) {
      this.output.appendLine(
        `telemetry/${eventName} ${JSON.stringify({ props, measurements })}`,
      );
    }
  }

  public sendError(
    error: Error,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number },
  ): void {
    const props = {
      ...this.defaultProperties,
      ...properties,
      message: error.message,
      name: error.name,
      stack: error.stack ?? "",
    };

    if (this.reporter) {
      this.reporter.sendTelemetryErrorEvent(error.name, props, measurements);
    }

    if (this.output) {
      this.output.appendLine(
        `telemetry/exception ${JSON.stringify({ props, measurements })}`,
      );
    }
  }

  public obfuscate(data: string): string {
    return crypto.createHash("sha256").update(data).digest("base64");
  }

  public async dispose(): Promise<void> {
    if (this.reporter) {
      await this.reporter.dispose();
    }

    if (this.output) {
      await this.output.dispose();
    }
  }
}

function generateMachineId(): string {
  return crypto.createHash("sha256").update(os.hostname()).digest("base64");
}

function generateSessionId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export const Telemetry = new ExtensionTelemetry();
