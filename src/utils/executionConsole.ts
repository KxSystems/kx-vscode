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
  // Error output. The connection's terminal renders this in red; the
  // fallback output channel has no ANSI support, so it writes plain text.
  appendError: (value: string) => void;
  // One line of plain and red parts, so an echoed query can sit in an error.
  appendParts: (parts: { text: string; error?: boolean }[]) => void;
  // The lines of a result, kept apart from the banner lines around them.
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
        appendError: (value) => console.appendError(value),
        appendParts: (parts) => console.appendParts(parts),
        appendResult: (lines) => console.appendResult(lines),
        reveal: () => console.terminal.show(true),
      };
    }
    return {
      appendLine: (value) => this._console.appendLine(value),
      appendError: (value) => this._console.appendLine(value),
      appendParts: (parts) =>
        this._console.appendLine(parts.map((part) => part.text).join("")),
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

  // Writes an error reason in red, then the source excerpt q appends to it
  // ("[0] til 10`" and its caret) as plain text so the reason stands out.
  private appendErrorReason(sink: ConsoleSink, result: string): void {
    const excerpt = result.search(/^[ \t]*\[\d+\]/m);
    const reason = excerpt < 0 ? result : result.slice(0, excerpt);
    const source = excerpt < 0 ? "" : result.slice(excerpt).replace(/\n+$/, "");
    sink.appendParts([{ text: reason.replace(/\n+$/, ""), error: true }]);
    if (source) {
      sink.appendLine(source);
    }
  }

  // Closes a query block: the footer (when details are shown) and a blank line
  // so the next block's header does not print right under it.
  private endBlock(
    sink: ConsoleSink,
    hideDetails: boolean,
    footer: string,
    write: (value: string) => void,
  ): void {
    if (!hideDetails) {
      write(footer);
    }
    sink.appendLine("");
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
    isError?: boolean,
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
      const banner = `>>> ${connLabel}  @ ${date.toLocaleTimeString()} <<<`;
      // An error block is red around the plain query: banner, reason, footer.
      (isError ? sink.appendError : sink.appendLine)(banner);
      this.appendQuery(sink, query);
    }
    if (isError) {
      this.appendErrorReason(
        sink,
        Array.isArray(output) ? output.join("\n") : output,
      );
    } else if (Array.isArray(output) && type === undefined) {
      sink.appendResult([output[0], ...output]);
    } else if (dataSourceRes.length > 0) {
      sink.appendResult(dataSourceRes);
    } else {
      output = Array.isArray(output) ? output.join("\n") : output;
      sink.appendResult(output.split("\n"));
    }
    this.endBlock(
      sink,
      hideDetails,
      "<<<",
      isError ? sink.appendError : sink.appendLine,
    );
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
      sink.appendError(
        `<<< ERROR -  ${connLabel}  @ ${date.toLocaleTimeString()} >>>`,
      );
    }
    if (isConnected) {
      if (!hideDetails) {
        // The echoed query and the source excerpt q appends to the reason
        // ("[0] til 10`" and its caret) are plain so the red reason stands out.
        sink.appendParts([
          { text: "ERROR Query executed: ", error: true },
          { text: `${query}\n` },
        ]);
        this.appendErrorReason(sink, result);
      } else {
        this.appendErrorReason(sink, `Error: ${result}`);
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
      sink.appendError(`Please connect to a KDB or Insights server`);
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
    this.endBlock(sink, hideDetails, "<<< >>>", sink.appendError);
  }

  // this to debug in case debug of extension doesn't work
  public appendQueryDebug(msg: string) {
    this._console.appendLine(msg);
  }

  public appendStdErr(message: string, connLabel = ""): void {
    const sink = this.resolveSink(connLabel);
    sink.appendLine("❌");
    sink.appendError(message);
  }

  public appendStdOut(message: string, connLabel = ""): void {
    const sink = this.resolveSink(connLabel);
    sink.appendLine("ℹ️");
    sink.appendLine(message);
  }
}
