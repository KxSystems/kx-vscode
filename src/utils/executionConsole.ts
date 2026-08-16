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

import { OutputChannel, commands, window } from "vscode";

import {
  setOutputWordWrapper,
  getAutoFocusOutputOnEntrySetting,
  getHideDetailedConsoleQueryOutputSetting,
} from "./core";
import { MessageKind, notify } from "./notifications";
import {
  addQueryHistory,
  checkIfIsDatasource,
  convertRowsToConsole,
} from "./queryUtils";
import { ext } from "../extensionVariables";
import { ServerType } from "../models/connectionsModels";

const logger = "executionConsole";

// A destination for console text: either a connection's own output console
// terminal (when one exists for the connLabel) or the shared fallback channel.
interface ConsoleSink {
  appendLine: (value: string) => void;
  // Result lines, which a terminal sink cuts to its width instead of wrapping.
  appendResult: (lines: string[]) => void;
  reveal: () => void;
}

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

  // Resolves where a connection's output should go: its own console terminal
  // when connected, otherwise the shared fallback channel (e.g. "No connection"
  // and debug writes that carry no live connLabel).
  private resolveSink(connLabel: string): ConsoleSink {
    const console = ext.connectionConsoles.get(connLabel);
    if (console) {
      return {
        appendLine: (value) => console.appendLine(value),
        appendResult: (lines) => console.appendResult(lines),
        reveal: () => console.terminal.show(true),
      };
    }
    return {
      appendLine: (value) => this._console.appendLine(value),
      appendResult: (lines) =>
        lines.forEach((line) => this._console.appendLine(line)),
      reveal: () => this._console.show(true),
    };
  }

  public appendQuery(sink: ConsoleSink, query: string): void {
    if (query.length > 0) {
      sink.appendLine(query);
      sink.appendLine("");
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
    const hideDetails = getHideDetailedConsoleQueryOutputSetting();
    const sink = this.resolveSink(connLabel);
    output = this.checkOutput(output, query);
    let dataSourceRes: string[] = [];
    if (getAutoFocusOutputOnEntrySetting()) {
      sink.reveal();
    }

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
      sink.appendLine(`>>> ${connLabel}  @ ${date.toLocaleTimeString()} <<<`);
      this.appendQuery(sink, query);
    }
    if (Array.isArray(output) && type === undefined) {
      sink.appendResult([output[0], ...output]);
    } else if (dataSourceRes.length > 0) {
      sink.appendResult(dataSourceRes);
    } else {
      output = Array.isArray(output) ? output.join("\n") : output;
      sink.appendResult(output.split("\n"));
    }
    if (!hideDetails) {
      sink.appendLine(`<<<\n`);
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
    const hideDetails = getHideDetailedConsoleQueryOutputSetting();
    const sink = this.resolveSink(connLabel);
    if (getAutoFocusOutputOnEntrySetting()) {
      sink.reveal();
    }
    //TODO: this._console.clear(); Add an option in the future to clear or not the console
    const date = new Date();
    if (!hideDetails) {
      sink.appendLine(
        `<<< ERROR -  ${connLabel}  @ ${date.toLocaleTimeString()} >>>`,
      );
    }
    if (isConnected) {
      if (!hideDetails) {
        sink.appendLine(`ERROR Query executed: ${query}\n`);
        sink.appendLine(result);
      } else {
        sink.appendLine(`Error: ${result}`);
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
      sink.appendLine(`Please connect to a KDB or Insights server`);
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
      sink.appendLine(`<<< >>>`);
    }
  }

  // this to debug in case debug of extension doesn't work
  public appendQueryDebug(msg: string) {
    this._console.appendLine(msg);
  }

  public appendStdErr(message: string, connLabel = ""): void {
    const sink = this.resolveSink(connLabel);
    sink.appendLine("❌");
    sink.appendLine(message);
  }

  public appendStdOut(message: string, connLabel = ""): void {
    const sink = this.resolveSink(connLabel);
    sink.appendLine("ℹ️");
    sink.appendLine(message);
  }
}
