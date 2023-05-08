import * as crypto from "crypto";
import * as os from "os";
import { OutputChannel, window, workspace } from "vscode";
import TelemetryReporter from "vscode-extension-telemetry";
import { ext } from "../extensionVariables";

class ExtensionTelemetry {
  private readonly output?: OutputChannel;
  private readonly reporter?: TelemetryReporter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly defaultProperties: { [key: string]: any } = {};

  constructor() {
    const isEnableTelemetry =
      workspace.getConfiguration("telemetry").get("enableTelemetry") || true;
    const isTestRun = process.env.CODE_TEST || false;

    if (isEnableTelemetry) {
      if (isTestRun) {
        this.output = window.createOutputChannel("telemetry-client-test");
      } else {
        try {
          this.reporter = new TelemetryReporter(
            ext.extensionName,
            ext.extensionVersion,
            ext.extensionKey
          );
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
    measurements?: { [key: string]: number }
  ): void {
    const props = Object.assign({}, this.defaultProperties, properties);
    if (this.reporter) {
      this.reporter.sendTelemetryEvent(eventName, props, measurements);
    }
    if (this.output) {
      this.output.appendLine(
        `telemetry/${eventName} ${JSON.stringify({ props, measurements })}`
      );
    }
  }

  public sendException(
    exception: Error,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    const props = Object.assign({}, this.defaultProperties, properties);
    const error = new Error(exception.message);
    error.stack = "";

    if (this.reporter) {
      this.reporter.sendTelemetryException(error, props, measurements);
    }

    if (this.output) {
      this.output.appendLine(
        `telemetry/${error}${JSON.stringify({ props, measurements })}`
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
