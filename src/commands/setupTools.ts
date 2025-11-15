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
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
import { getUri } from "../utils/uriUtils";

const logger = "setupTools";

let panel: vscode.WebviewPanel | undefined;

export function hideWelcome() {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}

export function showWelcome() {
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
        localResourceRoots: [
          vscode.Uri.joinPath(ext.context.extensionUri, "out"),
        ],
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
            msg,
            vscode.ConfigurationTarget.Global,
          );
      }
    });
    panel.onDidDispose(() => (panel = undefined));
  }
}

function getWebviewContent(webview: vscode.Webview) {
  const getResource = (resource: string) =>
    getUri(webview, ext.context.extensionUri, ["out", ...resource.split("/")]);

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
          <link rel="stylesheet" href="${getResource("light.css")}" />
          <link rel="stylesheet" href="${getResource("style.css")}" />
          <script type="module" nonce="${getNonce()}" src="${getResource("webview.js")}"></script>
          <title>Welcome to KDB-X</title>
        </head>
        <body>
          <kdb-welcome-view checked="${getHide()}" dark="${getTheme() === "sl-theme-dark" ? "dark" : ""}"></kdb-welcome-view>
        </body>
        </html>
      `;
}

export async function installKdbX() {
  if (process.platform === "win32") {
    notify(
      "KDB-X on Windows requires Windows Subsystem for Linux (WSL).",
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

      if (res.status !== 200) {
        throw new Error(res.statusText);
      }

      const path = resolve(
        ext.context.globalStorageUri.fsPath,
        "install_kdb.sh",
      );
      await writeFile(path, res.data);
      progress.report({ message: "Preparing to run KDB-X script." });
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
}

function executeInTerminal(
  name: string,
  signal: AbortSignal,
  cmd: string,
  ...params: string[]
) {
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
                  init.dispose();
                  if (signal.aborted) {
                    done.dispose();
                    event.terminal.dispose();
                  } else term.show();
                  resolve();
                }
              },
            );
            const done = vscode.window.onDidEndTerminalShellExecution(
              (event) => {
                if (event.execution === execution) {
                  done.dispose();
                  event.terminal.dispose();
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
}

async function parseOutput(execution: vscode.TerminalShellExecution) {
  let home;
  const stream = execution.read();
  for await (const data of stream) {
    const matches =
      /KDB-X has been installed to ([\P{Cc}]+?) with the following structure:/gsu.exec(
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
        await setHome(home, folder);
        return;
      }
    }
    process.env.qHomeDirTemp = home;
  }
}

async function setHome(home: string, folder: vscode.ConfigurationScope) {
  await vscode.workspace
    .getConfiguration("kdb", folder)
    .update("qHomeDirectory", home);
}

function getHide() {
  return vscode.workspace
    .getConfiguration()
    .get<boolean>("kdb.neverShowQInstallAgain", false);
}
