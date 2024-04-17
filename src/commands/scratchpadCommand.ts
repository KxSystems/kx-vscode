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

function setRunScratchpadItemText(text: string) {
  ext.runScratchpadItem.text = `$(notebook-execute) ${text}`;
}

function getServers() {
  const conf = workspace.getConfiguration("kdb");
  const servers = conf.get<{ [key: string]: { serverName: string } }>(
    "servers",
    {},
  );
  return Object.keys(servers).map((key) => servers[key].serverName);
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

export function workspaceFoldersChanged() {
  ext.dataSourceTreeProvider.refresh();
  ext.scratchpadTreeProvider.refresh();
}

export function activeEditorChanged(editor?: TextEditor | undefined) {
  const item = ext.runScratchpadItem;
  if (editor) {
    const uri = editor.document.uri;
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
    window.showInformationMessage(`Running scratchpad on ${server}`);
  }
}

export class ConnectionLensProvider implements CodeLensProvider {
  provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
    const uri = document.uri;
    const server = getServerForScratchpad(uri);
    const top = new Range(0, 0, 0, 0);
    const runScratchpad = new CodeLens(top, {
      command: "kdb.runScratchpad",
      title: server ? `Run on ${server}` : "Run",
      arguments: [uri],
    });
    const pickConnection = new CodeLens(top, {
      command: "kdb.pickConnection",
      title: "Choose Connection",
      arguments: [uri],
    });
    return [runScratchpad, pickConnection];
  }
}
