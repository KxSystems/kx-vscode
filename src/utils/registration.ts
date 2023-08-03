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

import { ConfigurationTarget, window, workspace } from "vscode";
import { openUrl } from "./openUrl";

export function showRegistrationNotification(): void {
  const setting = workspace
    .getConfiguration()
    .get<boolean | undefined>("kdb.hideSubscribeRegistrationNotification");
  if (setting !== undefined && setting === false) {
    window
      .showInformationMessage("Subscribe to updates", "Opt-In", "Ignore")
      .then((result) => {
        if (result === "Opt-In") {
          openUrl("https://www.bing.com");
        }
      });
  }

  // hide notification for future extension use
  workspace
    .getConfiguration()
    .update(
      "kdb.hideSubscribeRegistrationNotification",
      true,
      ConfigurationTarget.Global
    );
}
