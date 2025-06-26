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

import * as path from "path";
import * as vscode from "vscode";

export function getIconPath(iconFileName: string): vscode.IconPath {
  const iconPath = {
    light: vscode.Uri.file(
      path.join(__dirname, "..", "resources", "light", iconFileName),
    ),
    dark: vscode.Uri.file(
      path.join(__dirname, "..", "resources", "dark", iconFileName),
    ),
  };
  return iconPath;
}
