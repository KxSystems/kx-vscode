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

import axios from "axios";
import * as vscode from "vscode";

import { ext } from "../extensionVariables";
import { getNonce } from "../utils/getNonce";
import { getIconPath } from "../utils/iconsUtils";
import {
  Cancellable,
  MessageKind,
  notify,
  Runner,
} from "../utils/notifications";
import { errorMessage } from "../utils/shared";
import { writeLocalFile } from "../utils/storage";
import { getUri } from "../utils/uriUtils";

const logger = "setupTools";

let panel: vscode.WebviewPanel | undefined;

export async function showSetupError(workspace?: vscode.WorkspaceFolder) {
  /* c8 ignore start */
  const res = await notify(
    `KDB intallation not found${workspace ? " for workspace " + workspace.name : ""}.`,
    MessageKind.WARNING,
    { logger, params: workspace?.name },
    "Install KDB-X",
    "Dismiss",
  );
  if (res === "Install KDB-X") showWelcome();
  /* c8 ignore stop */
}

export function showWelcome() {
  /* c8 ignore start */
  if (panel) {
    panel.reveal();
  } else {
    panel = vscode.window.createWebviewPanel(
      "kdbWelcomeView",
      "Welcome to KDB-X",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(ext.context.extensionUri)],
      },
    );
    panel.iconPath = <any>getIconPath("kx_logo.png");
    panel.webview.html = getWebviewContent(panel.webview);
    panel.webview.onDidReceiveMessage((msg) => {
      if (msg === "install") installKdbX();
      if (msg === true || msg === false) {
        vscode.workspace
          .getConfiguration()
          .update(
            "kdb.neverShowQInstallAgain",
            !msg,
            vscode.ConfigurationTarget.Global,
          );
      }
    });
    ext.context.subscriptions.push(panel);
    panel.onDidDispose(() => (panel = undefined));
  }
  /* c8 ignore stop */
}

function getWebviewContent(webview: vscode.Webview) {
  /* c8 ignore start */
  const getResource = (resource: string) =>
    getUri(webview, ext.context.extensionUri, resource.split("/"));

  const getTheme = () =>
    vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ||
    vscode.window.activeColorTheme.kind ===
      vscode.ColorThemeKind.HighContrastLight
      ? "sl-theme-light"
      : "sl-theme-dark";

  return /* html */ `
        <!DOCTYPE html>
        <html lang="en" class="${getTheme()}">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="${getResource("out/light.css")}" />
          <link rel="stylesheet" href="${getResource("out/style.css")}" />
          <script type="module" nonce="${getNonce()}" src="${getResource("out/webview.js")}"></script>
          <title>Welcome to KDB-X</title>
        </head>
        <body>
          <kdb-welcome-view image="${getResource("resources/images/kx_welcome.png")}" checked="${getShowWelcome()}" dark="${getTheme() === "sl-theme-dark" ? "dark" : ""}"></kdb-welcome-view>
        </body>
        </html>
      `;
  /* c8 ignore stop */
}

export async function installKdbX() {
  /* c8 ignore start */
  if (process.platform === "win32") {
    notify(
      "KDB-X on Windows requires Windows Subsystem for Linux (WSL). Connect to a WSL instance and try again.",
      MessageKind.WARNING,
      { logger },
    );
    return;
  }
  const license = await vscode.window.showInputBox({
    prompt: "Paste the base64 encoded license string",
    placeHolder: "encoded license",
    ignoreFocusOut: true,
  });

  if (!license) return;

  const runner = Runner.create(async (progress, token) => {
    progress.report({ message: "Downloading KDB-X installation script." });

    const controller = new AbortController();
    token.onCancellationRequested(() => controller.abort());
    if (token.isCancellationRequested) controller.abort();

    try {
      const res = await axios.get(
        "https://portal.dl.kx.com/assets/raw/kdb-x/install_kdb/~latest~/install_kdb.sh",
        { signal: controller.signal },
      );

      if (res.status !== 200) throw new Error(res.statusText);

      const path = await writeLocalFile("install_kdb.sh", res.data);

      progress.report({
        message: "Preparing to run KDB-X installation script.",
      });

      await executeInTerminal(
        "Install KDB-X",
        controller.signal,
        "source",
        path,
        "--b64lic",
        license,
      );
    } catch (error) {
      notify("Failed to instal KDB-X.", MessageKind.ERROR, {
        logger,
        params: errorMessage(error),
      });
    }
  });

  runner.cancellable = Cancellable.EXECUTOR;
  runner.location = vscode.ProgressLocation.Notification;
  await runner.execute();
  /* c8 ignore stop */
}

function executeInTerminal(
  name: string,
  signal: AbortSignal,
  cmd: string,
  ...params: string[]
) {
  /* c8 ignore start */
  return new Promise<void>((resolve, reject) => {
    let pending = true;

    const term = vscode.window.createTerminal({
      name,
      hideFromUser: true,
      shellPath: "bash",
      env: { ...process.env },
      strictEnv: true,
      isTransient: true,
    });

    const changed = vscode.window.onDidChangeTerminalShellIntegration(
      ({ terminal, shellIntegration }) => {
        if (terminal === term && pending) {
          pending = false;
          changed.dispose();
          if (shellIntegration) {
            const init = vscode.window.onDidStartTerminalShellExecution(
              (event) => {
                if (event.execution === execution) {
                  if (signal.aborted) {
                    event.terminal.dispose();
                  } else term.show();
                  init.dispose();
                  resolve();
                }
              },
            );
            const done = vscode.window.onDidEndTerminalShellExecution(
              (event) => {
                if (event.execution === execution) {
                  event.terminal.dispose();
                  done.dispose();
                }
              },
            );
            const execution = shellIntegration.executeCommand(cmd, params);
            parseOutput(execution);
          } else reject(new Error("Shell integration failed."));
        }
      },
    );
  });
  /* c8 ignore stop */
}

async function parseOutput(execution: vscode.TerminalShellExecution) {
  /* c8 ignore start */
  let home;
  const stream = execution.read();
  for await (const data of stream) {
    const matches =
      /KDB-X has been installed to (.+?) with the following structure:/gs.exec(
        data,
      );
    if (matches) {
      home = matches[1];
      break;
    }
  }
  if (home) {
    for (const folder of vscode.workspace.workspaceFolders || []) {
      if (home.startsWith(folder.uri.fsPath)) {
        await setHome(vscode.workspace.asRelativePath(home), folder);
        return;
      }
    }
    await setHome(home);
  }
  /* c8 ignore stop */
}

async function setHome(home: string, folder?: vscode.WorkspaceFolder) {
  /* c8 ignore start */
  const config = vscode.workspace.getConfiguration("kdb", folder);
  await config.update(
    folder ? "qHomeDirectoryWorkspace" : "qHomeDirectory",
    home,
    folder
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : vscode.ConfigurationTarget.Global,
  );
  /* c8 ignore stop */
}

function getShowWelcome() {
  /* c8 ignore start */
  return !vscode.workspace
    .getConfiguration()
    .get<boolean>("kdb.neverShowQInstallAgain", false);
  /* c8 ignore stop */
}
