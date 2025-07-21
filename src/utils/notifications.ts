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

import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import { kdbOutputLog } from "./loggers";
import { stripUnprintableChars } from "./shared";
import { Telemetry } from "./telemetryClient";

const logger = "notifications";

export const enum Cancellable {
  NONE = 0,
  EXECUTOR = 1,
  RUNNER = 2,
}

export type Executor<T> = (
  progress: vscode.Progress<{
    message?: string;
    increment?: number;
  }>,
  token: vscode.CancellationToken,
) => Promise<T>;

export class Runner<T> {
  public title = "";
  public location = vscode.ProgressLocation.Window;
  public cancellable = Cancellable.RUNNER;
  protected _cancelled = false;
  private constructor(protected readonly executor: Executor<T>) {}

  public get cancelled(): boolean {
    return this._cancelled;
  }

  public execute(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      vscode.window
        .withProgress(
          {
            title: this.title,
            location: this.location,
            cancellable: this.cancellable !== Cancellable.NONE,
          },
          (progress, token) => {
            return this.cancellable === Cancellable.RUNNER
              ? Promise.race<T>([
                  this.executor(progress, token),
                  new Promise((_, reject) => {
                    const updateCancelled = () => {
                      this._cancelled = token.isCancellationRequested;
                      if (this._cancelled) {
                        notify(`${this.title} cancelled.`, MessageKind.DEBUG, {
                          logger,
                        });
                        reject(new vscode.CancellationError());
                      }
                    };
                    token.onCancellationRequested(updateCancelled);
                    updateCancelled();
                  }),
                ])
              : this.executor(progress, token);
          },
        )
        .then(
          (result: T) => {
            resolve(result);
          },
          (error) => {
            notify(
              `Runner (${this.title || "untitled"}) failed.`,
              MessageKind.DEBUG,
              {
                logger,
                params: error,
              },
            );
            reject(new Error(`${error}`));
          },
        );
    });
  }

  public static create<T>(executor: Executor<T>): Runner<T> {
    return new Runner<T>(executor);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve, _) => setTimeout(() => resolve(), ms));
}

export const enum MessageKind {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
}

export function notify<T extends string>(
  message: string,
  kind: MessageKind,
  options: {
    logger?: string;
    params?: any;
    telemetry?: string | boolean | Error;
    properties?: { [key: string]: string };
    measurements?: { [key: string]: number };
  } = {},
  ...items: T[]
): Thenable<T | undefined> {
  message = stripUnprintableChars(message);

  if (options.logger) {
    const params = getParams(options.params);
    const log = `[${options.logger}] ${message} ${params}`.trim();
    kdbOutputLog(log, kind, true);
  }

  if (options.telemetry) {
    if (typeof options.telemetry === "boolean") {
      Telemetry.sendError(new Error(message));
    } else if (options.telemetry instanceof Error) {
      Telemetry.sendError(options.telemetry);
    } else {
      Telemetry.sendEvent(
        options.telemetry,
        options.properties,
        options.measurements,
      );
    }
  }

  let action: "Details" | "Dismiss" | undefined;

  if (items.length === 0 && kind !== MessageKind.DEBUG) {
    action = options.params ? "Details" : "Dismiss";
    items.push(<T>action);
  }

  const notification =
    kind === MessageKind.ERROR
      ? vscode.window.showErrorMessage<T>(message, ...items)
      : kind === MessageKind.WARNING
        ? vscode.window.showWarningMessage<T>(message, ...items)
        : kind === MessageKind.INFO
          ? vscode.window.showInformationMessage<T>(message, ...items)
          : Promise.resolve(undefined);

  if (action === "Details") {
    notification.then((res) => {
      if (res === "Details") {
        ext.outputChannel.show(true);
      }
    });
  }

  return notification;
}

function getParams(params?: any) {
  if (params) {
    try {
      if (params instanceof Error) {
        return JSON.stringify({ name: params.name, message: params.message });
      }
      return JSON.stringify(params);
    } catch (error) {
      return `Parsing log params failed: ${error}`;
    }
  } else {
    return "";
  }
}
