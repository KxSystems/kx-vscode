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

import { workspace } from "vscode";

import { MessageKind, notify } from "../utils/notifications";

export async function showInstallationDetails(): Promise<void> {
  const QHOME = await workspace
    .getConfiguration()
    .get<string>("kdb.qHomeDirectory");
  notify(`q runtime installed path: ${QHOME}`, MessageKind.INFO);
}
