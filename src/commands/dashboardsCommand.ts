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

import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { pickPort } from "pick-port";
import * as vscode from "vscode";

import { showSetupError } from "./setupCommand";
import { getEnvironment } from "../utils/core";
import { MessageKind, notify } from "../utils/notifications";
import { pickWorkspace } from "../utils/workspace";

/* c8 ignore start */

const logger = "dashboardsCommand";

let dash: ChildProcessWithoutNullStreams | undefined;
let demo: ChildProcessWithoutNullStreams | undefined;
let port = 0;

export async function startDashboards() {
  if (port) {
    openDashboards();
    return;
  }
  const workspace = await pickWorkspace();
  const env = getEnvironment(workspace);
  if (!env.QHOME || !env.qBinKdbX) {
    showSetupError(workspace);
    return;
  }
  const cwd = resolve(env.QHOME, "dashboards");

  port = await pickPort({
    ip: "127.0.0.1",
    type: "tcp",
    minPort: 10000,
    maxPort: 11000,
  });

  demo = createDemo(env, cwd);
  demo.on("spawn", () => {
    dash = createDash(env, cwd);
    dash.on("spawn", () => openDashboards());
  });
}

export function stopDashboards() {
  demo?.kill();
  dash?.kill();
  demo = undefined;
  dash = undefined;
  port = 0;
}

function createDash(env: { [key: string]: string }, cwd: string) {
  const child = spawn(
    env.qBinPath,
    [join(cwd, "dash.q"), "-p", `${port}`, "-u", "1"],
    { env, cwd },
  );
  child.on("error", showError);
  return child;
}

function createDemo(env: { [key: string]: string }, cwd: string) {
  const child = spawn(
    env.qBinPath,
    [join(cwd, "sample", "demo.q"), "-u", "1"],
    { env, cwd },
  );
  child.on("error", showError);
  return child;
}

function openDashboards() {
  vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}/edit`));
}

function showError(error: unknown) {
  notify("Unable to start KX Dashboards.", MessageKind.ERROR, {
    logger,
    params: error,
  });
  stopDashboards();
}

/* c8 ignore stop */
