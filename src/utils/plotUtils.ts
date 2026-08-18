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

import { ViewColumn, workspace } from "vscode";

import {
  addWorkspaceFile,
  openWith,
  setUriContent,
  workspaceHas,
} from "./workspace";
import { ext } from "../extensionVariables";
import { Plot } from "../models/plot";
import { ChartEditorProvider } from "../services/chartEditorProvider";

/**
 * Writes a plot to its own .plot file and opens it in the chart editor, so a
 * process emitting several images produces one chart view apiece.
 * @param data The image as a data URI
 */
export async function writePlotToFile(data: string): Promise<void> {
  // Deliberately not gated on there being an active editor: a notebook only
  // session has none, and bailing here dropped the image with no trace.
  // addWorkspaceFile falls back to the first workspace folder without a uri.
  const uri = await addWorkspaceFile(
    ext.activeTextEditor?.document.uri,
    "plot",
    ".plot",
  );
  if (!workspaceHas(uri)) {
    await workspace.openTextDocument(uri);
    await openWith(uri, ChartEditorProvider.viewType, ViewColumn.Beside);
  }
  await setUriContent(uri, JSON.stringify(<Plot>{ charts: [{ data }] }));
}
