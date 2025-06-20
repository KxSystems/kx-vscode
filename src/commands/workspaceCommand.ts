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
import { MetaDap } from "../models/meta";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { InsightsNode, KdbNode, LabelNode } from "../services/kdbTreeProvider";
import { kdbOutputLog, offerConnectAction } from "../utils/core";
import { importOldDsFiles, oldFilesExists } from "../utils/dataSource";
import { normalizeAssemblyTarget } from "../utils/shared";

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

export async function setTargetForUri(uri: Uri, target: string | undefined) {
  uri = Uri.file(uri.path);
  const conf = workspace.getConfiguration("kdb", uri);
  const map = conf.get<{ [key: string]: string | undefined }>("targetMap", {});
  map[relativePath(uri)] = target;
  await conf.update("targetMap", map);
}

export function getTargetForUri(uri: Uri) {
  uri = Uri.file(uri.path);
  const conf = workspace.getConfiguration("kdb", uri);
  const map = conf.get<{ [key: string]: string | undefined }>("targetMap", {});
  const target = map[relativePath(uri)];
  return target ? normalizeAssemblyTarget(target) : undefined;
}

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
  const servers = getServers();

  let picked = await window.showQuickPick(["(none)", ...servers], {
    title: "Choose a connection",
    placeHolder: server,
  });

  if (picked) {
    if (picked === "(none)") {
      picked = undefined;
      await setTargetForUri(uri, undefined);
    }
    await setServerForUri(uri, picked);
  }

  return picked;
}

export async function pickTarget(uri: Uri) {
  const server = getServerForUri(uri);
  if (!server) {
    return;
  }

  const conn = await getConnectionForServer(server);
  const isInsights = conn instanceof InsightsNode;
  if (!isInsights) {
    return;
  }

  let daps: MetaDap[] = [];

  if (!isPython(uri)) {
    const connMngService = new ConnectionManagementService();
    const connected = connMngService.isConnected(conn.label);
    if (connected) {
      daps = JSON.parse(connMngService.retrieveMetaContent(conn.label, "DAP"));
    } else {
      offerConnectAction(server);
    }
  }

  const target = getTargetForUri(uri);
  if (target) {
    const exists = daps.some(
      (value) => `${value.assembly} ${value.instance}` === target,
    );
    if (!exists) {
      const [assembly, instance] = target.split(/\s+/);
      daps.push({ assembly, instance } as MetaDap);
    }
  }

  let picked = await window.showQuickPick(
    [
      "scratchpad",
      ...daps.map((value) => `${value.assembly} ${value.instance}`),
    ],
    {
      title: `Choose a target on ${server}`,
      placeHolder: target,
    },
  );

  if (picked) {
    if (picked === "scratchpad") {
      picked = undefined;
    }
    await setTargetForUri(uri, picked);
  }

  return picked;
}

function isPython(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".py");
}

function isWorkbook(uri: Uri | undefined) {
  return uri && (uri.path.endsWith(".kdb.q") || uri.path.endsWith(".kdb.py"));
}

function isDataSource(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".kdb.json");
}

function isKxFolder(uri: Uri | undefined) {
  return uri && Path.basename(uri.path) === ".kx";
}

export async function runActiveEditor(type?: ExecutionTypes) {
  if (ext.activeTextEditor) {
    const connMngService = new ConnectionManagementService();
    const uri = ext.activeTextEditor.document.uri;

    let isInsights = false;
    let server = getServerForUri(uri) || "";

    if (server) {
      const conn = await getConnectionForServer(server);
      if (conn) {
        isInsights = conn instanceof InsightsNode;
        server = conn.label;
        if (!connMngService.isConnected(server)) {
          offerConnectAction(server);
          return;
        }
      } else {
        throw new Error("Connection for  not found");
      }
    }

    const executorName =
      ext.activeTextEditor.document.fileName.split("/").pop() || "";

    const target = isInsights ? getTargetForUri(uri) : undefined;

    runQuery(
      type === undefined
        ? isPython(uri)
          ? ExecutionTypes.PythonQueryFile
          : ExecutionTypes.QueryFile
        : type,
      server,
      executorName,
      !isPython(uri),
      undefined,
      target,
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
  } else if (isWorkbook(uri)) {
    ext.scratchpadTreeProvider.reload();
  }
}

export class ConnectionLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument) {
    const server = getServerForUri(document.uri);
    const top = new Range(0, 0, 0, 0);

    const pickConnection = new CodeLens(top, {
      command: "kdb.file.pickConnection",
      title: server ? `Run on ${server}` : "Choose Connection",
    });

    const target = getTargetForUri(document.uri);

    if (server) {
      const conn = await getConnectionForServer(server);
      if (conn instanceof InsightsNode) {
        const pickTarget = new CodeLens(top, {
          command: "kdb.file.pickTarget",
          title: target || "scratchpad",
        });
        return [pickConnection, pickTarget];
      }
    }

    return [pickConnection];
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

  const watcher = workspace.createFileSystemWatcher("**/*.{kdb.json,q,py}");
  watcher.onDidCreate(update);
  watcher.onDidDelete(update);

  workspace.onDidDeleteFiles((event) => {
    for (const uri of event.files) {
      if (isKxFolder(uri)) {
        ext.dataSourceTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
        break;
      }
    }
  });

  workspace.onDidRenameFiles(async (event) => {
    for (const { oldUri, newUri } of event.files) {
      await setServerForUri(newUri, getServerForUri(oldUri));
      await setServerForUri(oldUri, undefined);
      await setTargetForUri(newUri, getTargetForUri(oldUri));
      await setTargetForUri(oldUri, undefined);
    }
  });

  workspace.onDidChangeWorkspaceFolders(() => {
    ext.dataSourceTreeProvider.reload();
    ext.scratchpadTreeProvider.reload();
  });
  window.onDidChangeActiveTextEditor(setRealActiveTextEditor);
  setRealActiveTextEditor(window.activeTextEditor);
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
