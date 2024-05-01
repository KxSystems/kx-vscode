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

import {
  CodeLens,
  CodeLensProvider,
  ProviderResult,
  Range,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from "vscode";
import { ext } from "../extensionVariables";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { InsightsNode, KdbNode } from "../services/kdbTreeProvider";
import { runQuery } from "./serverCommand";
import { ExecutionTypes } from "../models/execution";

const connectionService = new ConnectionManagementService();

function setRunScratchpadItemText(text: string) {
  ext.runScratchpadItem.text = `$(run) ${text}`;
}

function getServers() {
  const conf = workspace.getConfiguration("kdb");
  const servers = conf.get<{ [key: string]: { serverAlias: string } }>(
    "servers",
    {},
  );
  const insights = conf.get<{ [key: string]: { alias: string } }>(
    "insightsEnterpriseConnections",
    {},
  );

  return [
    ...Object.keys(servers).map((key) => servers[key].serverAlias),
    ...Object.keys(insights).map((key) => insights[key].alias),
  ];
}

async function setServerForScratchpad(uri: Uri, server: string | undefined) {
  const conf = workspace.getConfiguration("kdb", uri);
  const scratchpads = conf.get<{ [key: string]: string | undefined }>(
    "scratchpads",
    {},
  );
  scratchpads[uri.path] = server;
  await conf.update("scratchpads", scratchpads);
}

async function waitForConnection(name: string) {
  return new Promise<void>((resolve, reject) => {
    let count = 0;
    const retry = () => {
      count++;
      setTimeout(() => {
        if (connectionService.isConnected(name)) {
          resolve();
        } else if (count < 5) {
          retry();
        } else {
          reject(`Can not connect to ${name}`);
        }
      }, 50);
    };
    retry();
  });
}

async function getConnectionForServer(server: string) {
  if (server) {
    const servers = await ext.serverProvider.getChildren();
    return servers.find((item) => {
      if (item instanceof InsightsNode) {
        return item.details.alias === server;
      } else if (item instanceof KdbNode) {
        return item.details.serverAlias === server;
      }
      return false;
    }) as KdbNode | InsightsNode;
  }
}

export function getServerForUri(uri: Uri) {
  const conf = workspace.getConfiguration("kdb", uri);
  const scratchpads = conf.get<{ [key: string]: string | undefined }>(
    "scratchpads",
    {},
  );
  return scratchpads[uri.path];
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

export function workspaceFoldersChanged() {
  ext.dataSourceTreeProvider.reload();
  ext.scratchpadTreeProvider.reload();
}

function setRealActiveTextEditor(editor?: TextEditor | undefined) {
  if (editor) {
    const scheme = editor.document.uri.scheme;
    if (scheme === "file") {
      ext.activeTextEditor = editor;
    }
  } else {
    ext.activeTextEditor = undefined;
  }
}

export function activeEditorChanged(editor?: TextEditor | undefined) {
  setRealActiveTextEditor(editor);
  const item = ext.runScratchpadItem;
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const path = uri.path;
    if (path.endsWith(".kdb.q") || path.endsWith(".kdb.py")) {
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

export async function pickConnection(uri: Uri) {
  const server = getServerForUri(uri);

  let picked = await window.showQuickPick(["(none)", ...getServers()], {
    title: "Choose a connection",
    placeHolder: server,
  });

  if (picked) {
    if (picked === "(none)") {
      picked = undefined;
    }
    await setServerForScratchpad(uri, picked);
    setRunScratchpadItemText(picked || "Run");
  }

  return picked;
}

export async function runScratchpad(uri: Uri) {
  let server = getServerForUri(uri);

  if (!server) {
    server = await pickConnection(uri);
  }

  if (server) {
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
          return;
        }
      }
      connectionService.setActiveConnection(connection);

      runQuery(
        uri.path.endsWith(".py")
          ? ExecutionTypes.PythonQueryFile
          : ExecutionTypes.QueryFile,
      );
    } else {
      window.showErrorMessage(`${server} is not found`);
    }
  }
}

export class ConnectionLensProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
    const server = getServerForUri(document.uri);
    const top = new Range(0, 0, 0, 0);
    const runScratchpad = new CodeLens(top, {
      command: "kdb.runScratchpad",
      title: server ? `Run on ${server}` : "Run",
    });
    const pickConnection = new CodeLens(top, {
      command: "kdb.pickConnection",
      title: "Choose Connection",
    });
    return [runScratchpad, pickConnection];
  }
}
