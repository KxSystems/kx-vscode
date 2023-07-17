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

import * as nodeq from "node-q";
import { EventEmitter, Pseudoterminal } from "vscode";
import { ext } from "../extensionVariables";
import { delay } from "../utils/core";
import { Telemetry } from "./telemetryClient";

function storeConnection(
  err: Error | undefined,
  con: nodeq.Connection | undefined
) {
  if (err) {
    throw err;
  }

  if (con !== undefined) {
    ext.qConnection = con;
  }
}

export async function qConnect(): Promise<void> {
  Telemetry.sendEvent("QTerminal.Connect");
  nodeq.connect({ host: "localhost", port: 5001 }, storeConnection);
}

export async function execute(command: string): Promise<string | undefined> {
  let result;

  while (ext.qConnection === undefined) {
    await delay(500);
  }

  ext.qConnection.k(command, function (err: Error, res: string) {
    if (err) throw err;
    result = res;
  });

  // wait for result (lack of await using callbacks)
  while (result === undefined || result === null) {
    await delay(500);
  }

  return result;
}

export async function createTerminalInstance(): Promise<Pseudoterminal> {
  const emitter = new EventEmitter<string>();

  let line = "";
  return {
    onDidWrite: emitter.event,
    open: () => emitter.fire("q)"),
    close: () => {
      /* noop */
    },
    handleInput: async (data: string) => {
      if (data === "\r") {
        await qConnect();
        const result = await execute(line);
        emitter.fire(`\r\n${result}\r\n\r\nq)`);
        line = "";
        return;
      }
      if (data === "\x7f") {
        if (line.length === 0) {
          return;
        }
        line = line.substr(0, line.length - 1);
        emitter.fire("\x1b[D");
        emitter.fire("\x1b[P");
        return;
      }
      line += data;
      emitter.fire(data);
    },
  };
}
