/*
 * Copyright (c) 1998-2025 KX Systems Inc.
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

export function kdbOutputLog(
  message: string,
  type: string,
  supressDialog?: boolean,
): void {
  switch (type) {
    case "DEBUG":
      ext.outputChannel.debug(message);
      break;
    case "INFO":
      ext.outputChannel.info(message);
      break;
    case "WARNING":
      ext.outputChannel.warn(message);
      break;
    case "ERROR":
      ext.outputChannel.error(message);
      break;
    default:
      ext.outputChannel.trace(message);
      break;
  }
  if (type === "ERROR" && !supressDialog) {
    vscode.window
      .showErrorMessage(
        `Error occured, check kdb output log for details.`,
        "Check",
      )
      .then((res) => {
        if (res === "Check") {
          ext.outputChannel.show(true);
        }
      });
  }
}
