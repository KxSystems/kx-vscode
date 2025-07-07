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

import { OutputChannel, commands, window } from "vscode";

import { ext } from "../extensionVariables";
import { updateTheWorkspaceSettings, setOutputWordWrapper } from "./core";
import { MessageKind, notify } from "./notifications";
import {
  addQueryHistory,
  checkIfIsDatasource,
  convertRowsToConsole,
} from "./queryUtils";
import { ServerType } from "../models/connectionsModels";

const logger = "executionConsole";

export class ExecutionConsole {
  public static current: ExecutionConsole | undefined;
  private _console: OutputChannel;

  constructor(private console: OutputChannel) {
    this._console = console;
  }

  public static start(): ExecutionConsole {
    setOutputWordWrapper();
    if (!ExecutionConsole.current) {
      const _console = window.createOutputChannel("q Console Output");
      ExecutionConsole.current = new ExecutionConsole(_console);
    }
    return ExecutionConsole.current;
  }

  public dispose(): void {
    ExecutionConsole.current = undefined;
    this._console.dispose();
  }

  public appendQuery(query: string): void {
    if (query.length > 0) {
      this._console.appendLine(query);
      this._console.appendLine("");
    }
  }

  public checkOutput(
    output: string | string[],
    _query: string,
  ): string | string[] {
    if (output.length === 0) {
      return "No results found.";
    }
    if (Array.isArray(output)) {
      return output;
    }
    // TODO: understand why that was necessary and if it is still necessary
    // if (
    //   output.trim().startsWith("{") &&
    //   output.trim().endsWith("}") &&
    //   query.trim().includes(":")
    // ) {
    //   return "No results found.";
    // }
    return output;
  }

  public append(
    output: string | string[],
    query = "",
    executorName: string,
    connLabel: string,
    isInsights?: boolean,
    type?: string,
    isPhython?: boolean,
    duration?: string,
    isFromConnTree?: boolean,
  ): void {
    updateTheWorkspaceSettings();
    const hideDetails = ext.hideDetailedConsoleQueryOutput;
    output = this.checkOutput(output, query);
    let dataSourceRes: string[] = [];
    this._console.show(ext.autoFocusOutputOnEntry);

    if (Array.isArray(output)) {
      dataSourceRes = convertRowsToConsole(output);
    }

    if (!checkIfIsDatasource(type)) {
      addQueryHistory(
        query,
        executorName,
        connLabel,
        isInsights ? ServerType.INSIGHTS : ServerType.KDB,
        true,
        isPhython,
        type === "WORKBOOK",
        undefined,
        undefined,
        duration,
        isFromConnTree,
      );
    }

    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    if (!hideDetails) {
      this._console.appendLine(
        `>>> ${connLabel}  @ ${date.toLocaleTimeString()} <<<`,
      );
      this.appendQuery(query);
    }
    if (Array.isArray(output) && type === undefined) {
      this._console.appendLine(output[0]);
      output.forEach((o) => this._console.appendLine(o));
    } else if (dataSourceRes.length > 0) {
      dataSourceRes.forEach((o) => this._console.appendLine(o));
    } else {
      output = Array.isArray(output) ? output.join("\n") : output;
      this._console.appendLine(output);
    }
    if (!hideDetails) {
      this._console.appendLine(`<<<\n`);
    }
  }

  public appendQueryError(
    query: string,
    result: string,
    connLabel: string,
    executorName: string,
    isConnected: boolean,
    isInsights?: boolean,
    type?: string,
    isPython?: boolean,
    isDatasource?: boolean,
    duration?: string,
    isFromConnTree?: boolean,
  ): void {
    updateTheWorkspaceSettings();
    const hideDetails = ext.hideDetailedConsoleQueryOutput;
    this._console.show(ext.autoFocusOutputOnEntry);
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    if (!hideDetails) {
      this._console.appendLine(
        `<<< ERROR -  ${connLabel}  @ ${date.toLocaleTimeString()} >>>`,
      );
    }
    if (isConnected) {
      if (!hideDetails) {
        this._console.appendLine(`ERROR Query executed: ${query}\n`);
        this._console.appendLine(result);
      } else {
        this._console.appendLine(`Error: ${result}`);
      }
      if (!isDatasource) {
        addQueryHistory(
          query,
          executorName,
          connLabel,
          isInsights ? ServerType.INSIGHTS : ServerType.KDB,
          false,
          isPython,
          type === "WORKBOOK",
          undefined,
          undefined,
          duration,
          isFromConnTree,
        );
      }
    } else {
      notify(`Please connect to a KDB or Insights server`, MessageKind.ERROR, {
        logger,
      });
      this._console.appendLine(`Please connect to a KDB or Insights server`);
      commands.executeCommand("kdb.connections.disconnect");
      addQueryHistory(
        query,
        executorName,
        "No connection",
        ServerType.undefined,
        false,
        isPython,
        type === "WORKBOOK",
      );
    }
    if (!hideDetails) {
      this._console.appendLine(`<<< >>>`);
    }
  }

  // this to debug in case debug of extension doesn't work
  public appendQueryDebug(msg: string) {
    this._console.appendLine(msg);
  }
}
