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

function getServerForScratchpad(uri: Uri) {
  const conf = workspace.getConfiguration("kdb", uri);
  const scratchpads = conf.get<{ [key: string]: string | undefined }>(
    "scratchpads",
    {},
  );
  return scratchpads[uri.path];
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

export function workspaceFoldersChanged() {
  ext.dataSourceTreeProvider.refresh();
  ext.scratchpadTreeProvider.refresh();
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
    if (path.endsWith("kdb.q") || path.endsWith("kdb.py")) {
      const server = getServerForScratchpad(uri);
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
  const server = getServerForScratchpad(uri);

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
  let server = getServerForScratchpad(uri);

  if (!server) {
    server = await pickConnection(uri);
  }

  if (server) {
    const servers = await ext.serverProvider.getChildren();
    // ext.connectionsList is not used, we can hit from workspace
    const connection = servers.find((item) => {
      if (item instanceof InsightsNode) {
        return item.details.alias === server;
      } else if (item instanceof KdbNode) {
        return item.details.serverAlias === server;
      }
      return false;
    }) as KdbNode | InsightsNode;

    if (connection) {
      if (!connectionService.isConnected(connection.label)) {
        const action = await window.showWarningMessage(
          `${connection.label} not connected`,
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

      const isPython = uri.path.endsWith(".py");
      const type = isPython
        ? ExecutionTypes.PythonQueryFile
        : ExecutionTypes.QueryFile;
      await runQuery(type);
    } else {
      window.showErrorMessage(`${server} not found`);
    }
  }
}

export class ConnectionLensProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
    const server = getServerForScratchpad(document.uri);
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
