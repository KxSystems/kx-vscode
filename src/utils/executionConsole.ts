/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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
import { ServerType } from "../models/server";
import { KdbNode } from "../services/kdbTreeProvider";
import {
  getHideDetailedConsoleQueryOutput,
  setOutputWordWrapper,
} from "./core";
import {
  addQueryHistory,
  checkIfIsDatasource,
  convertRowsToConsole,
} from "./queryUtils";

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
    query: string,
  ): string | string[] {
    if (!output) {
      return "No results found.";
    }
    if (Array.isArray(output)) {
      return output;
    }
    if (
      output.trim().startsWith("{") &&
      output.trim().endsWith("}") &&
      query.trim().includes(":")
    ) {
      return "No results found.";
    }
    return output;
  }

  public append(
    output: string | string[],
    query = "",
    serverName: string,
    dataSourceType?: string,
    isPhython?: boolean,
    duration?: string,
  ): void {
    getHideDetailedConsoleQueryOutput();
    const hideDetails = ext.hideDetailedConsoleQueryOutput;
    output = this.checkOutput(output, query);
    let dataSourceRes: string[] = [];
    if (dataSourceType === undefined) {
      this._console.show(true);
    } else {
      if (Array.isArray(output)) {
        dataSourceRes = convertRowsToConsole(output);
      }
    }
    const connectionType: ServerType =
      ext.connectionNode instanceof KdbNode
        ? ServerType.KDB
        : ServerType.INSIGHTS;
    if (!checkIfIsDatasource(dataSourceType)) {
      addQueryHistory(
        query,
        serverName,
        connectionType,
        true,
        isPhython,
        undefined,
        undefined,
        duration,
      );
    }

    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    if (!hideDetails) {
      this._console.appendLine(
        `>>> ${serverName}  @ ${date.toLocaleTimeString()} <<<`,
      );
      this.appendQuery(query);
    }
    if (Array.isArray(output) && dataSourceType === undefined) {
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
    isConnected: boolean,
    serverName: string,
    isPython?: boolean,
    isDatasource?: boolean,
    duration?: string,
  ): void {
    getHideDetailedConsoleQueryOutput();
    const hideDetails = ext.hideDetailedConsoleQueryOutput;
    this._console.show(true);
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    if (!hideDetails) {
      this._console.appendLine(
        `<<< ERROR -  ${serverName}  @ ${date.toLocaleTimeString()} >>>`,
      );
    }
    if (isConnected) {
      const connectionType: ServerType =
        ext.connectionNode instanceof KdbNode
          ? ServerType.KDB
          : ServerType.INSIGHTS;
      if (!hideDetails) {
        this._console.appendLine(`ERROR Query executed: ${query}\n`);
        this._console.appendLine(result);
      } else {
        this._console.appendLine(`Error: ${result}`);
      }
      if (!isDatasource) {
        addQueryHistory(
          query,
          serverName,
          connectionType,
          false,
          isPython,
          undefined,
          undefined,
          duration,
        );
      }
    } else {
      window.showErrorMessage(`Please connect to a kdb+ server`);
      this._console.appendLine(`Please connect to a kdb+ server`);
      commands.executeCommand("kdb.disconnect");
      addQueryHistory(
        query,
        "No connection",
        ServerType.undefined,
        false,
        isPython,
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
