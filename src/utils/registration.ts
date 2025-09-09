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

import { ConfigurationTarget, workspace } from "vscode";

import { ext } from "../extensionVariables";
import { MessageKind, notify } from "./notifications";
import { openUrl } from "./uriUtils";

export function showRegistrationNotification(): void {
  const setting = workspace
    .getConfiguration()
    .get<boolean>("kdb.hideSubscribeRegistrationNotification", false);
  if (setting === false) {
    notify(
      "Subscribe to updates",
      MessageKind.INFO,
      {},
      "Opt-In",
      "Ignore",
    ).then((result) => {
      if (result === "Opt-In") {
        openUrl(ext.kdbNewsletterUrl);
      } else if (result) {
        workspace
          .getConfiguration()
          .update(
            "kdb.hideSubscribeRegistrationNotification",
            true,
            ConfigurationTarget.Global,
          );
      }
    });
  }
}
