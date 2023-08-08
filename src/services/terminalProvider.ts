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

import { EventEmitter, Pseudoterminal, window } from "vscode";
import { ext } from "../extensionVariables";

export function getPty(): Pseudoterminal {
  let line = "";
  const emt: EventEmitter<string> = new EventEmitter<string>();

  const pty = {
    onDidWrite: emt.event,
    open: () => emt.fire("q)"),
    close: () => {
      /* noop */
    },
    handleInput: async (data: string) => {
      if (data === "\r") {
        if (!ext.connection?.connected) {
          window.showErrorMessage(
            "No active connection, please register/connect to a kdb server"
          );
          close();
        }

        const result = await ext.connection?.execute(line);
        emt.fire(`\r\n${result}\r\n\r\nq)`);
        line = "";
        return;
      }

      if (data === "\x7f") {
        if (line.length === 0) {
          return;
        }
        line = line.substr(0, line.length - 1);
        emt.fire("\x1b[D");
        emt.fire("\x1b[P");
        return;
      }

      line += data;
      emt.fire(data);
    },
  };
  return pty;
}
