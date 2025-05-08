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

import Path from "path";
import {
  CodeLens,
  CodeLensProvider,
  Command,
  ProgressLocation,
  ProviderResult,
  Range,
  StatusBarAlignment,
  TextDocument,
  TextEditor,
  ThemeColor,
  Uri,
  window,
  workspace,
} from "vscode";

import { ext } from "../extensionVariables";
import { resetScratchpad, runQuery } from "./serverCommand";
import { ExecutionTypes } from "../models/execution";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { InsightsNode, KdbNode, LabelNode } from "../services/kdbTreeProvider";
import { kdbOutputLog, offerConnectAction } from "../utils/core";
import { importOldDsFiles, oldFilesExists } from "../utils/dataSource";

const connectionService = new ConnectionManagementService();

/* istanbul ignore next */
function setRealActiveTextEditor(editor?: TextEditor | undefined) {
  if (editor) {
    const scheme = editor.document.uri.scheme;
    if (scheme !== "output") {
      ext.activeTextEditor = editor;
    }
  } else {
    ext.activeTextEditor = undefined;
  }
}

/* istanbul ignore next */
function activeEditorChanged(editor?: TextEditor | undefined) {
  setRealActiveTextEditor(editor);
  const item = ext.runScratchpadItem;
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    if (isScratchpad(uri)) {
      const server = getServerForUri(uri);
      setRunScratchpadItemText(server || "Run");
      item.show();
    } else {
      item.hide();
    }
  } else {
    item.hide();
  }
}

/* istanbul ignore next */
function setRunScratchpadItemText(text: string) {
  ext.runScratchpadItem.text = `$(run) ${text}`;
}

export function getInsightsServers() {
  const conf = workspace.getConfiguration("kdb");
  const servers = conf.get<{ [key: string]: { alias: string } }>(
    "insightsEnterpriseConnections",
    {},
  );

  return Object.keys(servers).map((key) => servers[key].alias);
}

function getServers() {
  const conf = workspace.getConfiguration("kdb");
  const servers = conf.get<{ [key: string]: { serverAlias: string } }>(
    "servers",
    {},
  );

  return [
    ...Object.keys(servers).map((key) => servers[key].serverAlias),
    ...getInsightsServers(),
  ];
}

/* istanbul ignore next */
export async function getConnectionForServer(
  server: string,
): Promise<InsightsNode | KdbNode | undefined> {
  if (server) {
    const nodes = await ext.serverProvider.getChildren();
    const orphan = nodes.find((node) => {
      if (node instanceof InsightsNode) {
        return node.details.alias === server;
      } else if (node instanceof KdbNode) {
        return node.details.serverAlias === server;
      }
      return false;
    }) as InsightsNode | KdbNode;
    if (orphan) {
      return orphan;
    }
    const labels = nodes.filter((server) => server instanceof LabelNode);
    for (const label of labels) {
      const item = (label as LabelNode).children.find((node) => {
        const name =
          node instanceof InsightsNode
            ? node.details.alias
            : node instanceof KdbNode
              ? node.details.serverAlias
              : "";
        return name === server;
      }) as InsightsNode | KdbNode;
      if (item) {
        return item;
      }
    }
  }
}

/* istanbul ignore next */
async function waitForConnection(label: string) {
  return new Promise<void>((resolve, reject) => {
    let count = 0;
    const retry = () => {
      count++;
      setTimeout(() => {
        if (connectionService.isConnected(label)) {
          resolve();
        } else if (count < 5) {
          retry();
        } else {
          reject(new Error(`Can not connect to ${label}`));
        }
      }, 50);
    };
    retry();
  });
}

/* istanbul ignore next */
function relativePath(uri: Uri) {
  return workspace.asRelativePath(uri, false);
}

export async function setServerForUri(uri: Uri, server: string | undefined) {
  uri = Uri.file(uri.path);
  const conf = workspace.getConfiguration("kdb", uri);
  const map = conf.get<{ [key: string]: string | undefined }>(
    "connectionMap",
    {},
  );
  map[relativePath(uri)] = server;
  await conf.update("connectionMap", map);
}

export function getServerForUri(uri: Uri) {
  uri = Uri.file(uri.path);
  const conf = workspace.getConfiguration("kdb", uri);
  const map = conf.get<{ [key: string]: string | undefined }>(
    "connectionMap",
    {},
  );
  const server = map[relativePath(uri)];
  const servers = getServers();

  return server && servers.includes(server) ? server : undefined;
}

/* istanbul ignore next */
export function getConnectionForUri(uri: Uri) {
  const server = getServerForUri(uri);
  if (server) {
    return ext.connectionsList.find((item) => {
      if (item instanceof InsightsNode) {
        return item.details.alias === server;
      } else if (item instanceof KdbNode) {
        return item.details.serverAlias === server;
      }
      return false;
    }) as KdbNode | InsightsNode;
  }
}

export async function pickConnection(uri: Uri) {
  const server = getServerForUri(uri);
  const servers = isPython(uri) ? getInsightsServers() : getServers();

  let picked = await window.showQuickPick(["(none)", ...servers], {
    title: "Choose a connection",
    placeHolder: server,
  });

  if (picked) {
    if (picked === "(none)") {
      picked = undefined;
    }
    await setServerForUri(uri, picked);
    setRunScratchpadItemText(picked || "Run");
  }

  return picked;
}

/* istanbul ignore next */
function isPython(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".py");
}

function isScratchpad(uri: Uri | undefined) {
  return uri && (uri.path.endsWith(".kdb.q") || uri.path.endsWith(".kdb.py"));
}

function isDataSource(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".kdb.json");
}

/* istanbul ignore next */
function isKxFolder(uri: Uri | undefined) {
  return uri && Path.basename(uri.path) === ".kx";
}

/* istanbul ignore next */
export async function activateConnectionForServer(server: string) {
  const connection = await getConnectionForServer(server);
  if (connection) {
    if (!connectionService.isConnected(connection.label)) {
      const action = await window.showWarningMessage(
        `${connection.label} is not connected`,
        "Connect",
      );
      if (action === "Connect") {
        await connectionService.connect(connection.label);
        await waitForConnection(connection.label);
      } else {
        throw new Error(`${connection.label} is not connected`);
      }
    }
    connectionService.setActiveConnection(connection);
  } else {
    throw new Error(`${server} is not found`);
  }
}

/* istanbul ignore next */
export async function runActiveEditor(type?: ExecutionTypes) {
  if (ext.activeTextEditor) {
    const connMngService = new ConnectionManagementService();
    const uri = ext.activeTextEditor.document.uri;
    const isWorkbook = uri.path.endsWith(".kdb.q");

    let server = getServerForUri(uri);
    if (!server && isWorkbook) {
      server = await pickConnection(uri);
    }
    if (!server) {
      server = "";
    }
    const connection = await getConnectionForServer(server);
    server = connection?.label || "";
    if (!connMngService.isConnected(server) && isScratchpad(uri)) {
      offerConnectAction(server);
      return;
    }
    const executorName = ext.activeTextEditor.document.fileName
      .split("/")
      .pop();

    runQuery(
      type === undefined
        ? isPython(uri)
          ? ExecutionTypes.PythonQueryFile
          : ExecutionTypes.QueryFile
        : type,
      server,
      executorName ? executorName : "",
      isWorkbook,
    );
  }
}

export async function resetScratchpadFromEditor(): Promise<void> {
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const isWorkbook = uri.path.endsWith(".kdb.q");
    let server = getServerForUri(uri);
    if (!server && isWorkbook) {
      server = await pickConnection(uri);
    }
    if (!server) {
      server = "";
    }
    const connection = await getConnectionForServer(server);
    server = connection?.label || "";
    resetScratchpad(server);
  }
}

function update(uri: Uri) {
  if (isDataSource(uri)) {
    ext.dataSourceTreeProvider.reload();
  } else if (isScratchpad(uri)) {
    ext.scratchpadTreeProvider.reload();
  }
}

export class ConnectionLensProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
    const server = getServerForUri(document.uri);
    const top = new Range(0, 0, 0, 0);
    const runScratchpad = new CodeLens(top, {
      command: isPython(document.uri)
        ? "kdb.scratchpad.python.run.file"
        : "kdb.execute.fileQuery",
      title: server ? `Run on ${server}` : "Run",
    });
    const pickConnection = new CodeLens(top, {
      command: "kdb.file.pickConnection",
      title: "Choose Connection",
    });
    return [runScratchpad, pickConnection];
  }
}

export function connectWorkspaceCommands() {
  ext.runScratchpadItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    10000,
  );
  ext.runScratchpadItem.backgroundColor = new ThemeColor(
    "statusBarItem.warningBackground",
  );
  ext.runScratchpadItem.command = <Command>{
    title: "",
    command: "kdb.scratchpad.run",
    arguments: [],
  };

  const watcher = workspace.createFileSystemWatcher("**/*.kdb.{json,q,py}");
  watcher.onDidCreate(update);
  watcher.onDidDelete(update);
  /* istanbul ignore next */
  workspace.onDidDeleteFiles((event) => {
    for (const uri of event.files) {
      if (isKxFolder(uri)) {
        ext.dataSourceTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
        break;
      }
    }
  });
  /* istanbul ignore next */
  workspace.onDidRenameFiles(async (event) => {
    for (const { oldUri, newUri } of event.files) {
      await setServerForUri(newUri, getServerForUri(oldUri));
      await setServerForUri(oldUri, undefined);
    }
  });
  /* istanbul ignore next */
  workspace.onDidChangeWorkspaceFolders(() => {
    ext.dataSourceTreeProvider.reload();
    ext.scratchpadTreeProvider.reload();
  });
  window.onDidChangeActiveTextEditor(activeEditorChanged);
  activeEditorChanged(window.activeTextEditor);
}

export function checkOldDatasourceFiles() {
  ext.oldDSformatExists = oldFilesExists();
}

export async function importOldDSFiles() {
  if (ext.oldDSformatExists) {
    const folders = workspace.workspaceFolders;
    if (!folders) {
      window.showErrorMessage(
        "No workspace folder found. Please open a workspace folder.",
      );
      return;
    }
    return await window.withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: false,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          kdbOutputLog(
            "[DATASOURCE] User cancelled the old DS files import.",
            "INFO",
          );
          return false;
        });

        progress.report({ message: "Importing old DS files..." });
        await importOldDsFiles();
        return;
      },
    );
  } else {
    window.showInformationMessage(
      "No old Datasource files found on your VSCODE.",
    );
    kdbOutputLog(
      "[DATASOURCE] No old Datasource files found on your VSCODE.",
      "INFO",
    );
  }
}
