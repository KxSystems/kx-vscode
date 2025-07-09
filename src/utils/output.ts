/*
 * Copyright (c) 1998-2025 Kx Systems Inc.
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

import { OutputChannel, window } from "vscode";

import { ext } from "../extensionVariables";
import { updateTheWorkspaceSettings } from "./core";

export class Output {
  public static output(label: string, message: string): void {
    this._outputChannel.append(this.formatMessage(label, message));
  }

  public static outputLine(label: string, message: string): void {
    this._outputChannel.appendLine(this.formatMessage(label, message));
  }

  public static show(): void {
    updateTheWorkspaceSettings();
    if (ext.autoFocusOutputOnEntry) {
      this._outputChannel.show();
    }
  }

  public static hide(): void {
    this._outputChannel.hide();
  }

  public static dispose(): void {
    this._outputChannel.dispose();
  }

  public static _outputChannel: OutputChannel =
    window.createOutputChannel("kdb-telemetry");

  private static formatMessage(label = "", message = ""): string {
    return `${label ? `[${label}] ` : ""}${message}`;
  }
}
