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

import * as vscode from "vscode";

import { setActiveTarget } from "./activeTarget";
import { ReplConnection } from "./replConnection";
import { ext } from "../extensionVariables";
import { ConnectionManagementService } from "../services/connectionManagerService";

/**
 * Wires focus-driven activation: the last-focused KX target terminal (a REPL
 * terminal or a connection output console) becomes the single active target
 * that unassigned files run on. Focusing the editor or a non-KX terminal keeps
 * the current active target. The tree's green icon (`ext.activeConnection`) is
 * kept in sync — a focused connection console activates that connection; a
 * focused REPL clears the active connection so none shows as active.
 */
export function initActiveTargetTracking(): vscode.Disposable {
  const connMngService = new ConnectionManagementService();

  return vscode.window.onDidChangeActiveTerminal((terminal) => {
    if (!terminal) {
      return;
    }

    for (const [connLabel, console] of ext.connectionConsoles) {
      if (console.terminal === terminal && !console.exited) {
        setActiveTarget({ kind: "connection", connLabel });
        if (ext.activeConnection?.connLabel !== connLabel) {
          const node = connMngService.retrieveConnection(connLabel);
          if (node) {
            connMngService.setActiveConnection(node);
          }
        }
        return;
      }
    }

    if (ReplConnection.isReplTerminal(terminal)) {
      setActiveTarget({ kind: "repl" });
      connMngService.clearActiveConnection();
      return;
    }
    // A non-KX terminal (or the editor) was focused; keep the current target.
  });
}
