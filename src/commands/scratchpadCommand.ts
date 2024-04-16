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

import { TextEditor, window, workspace } from "vscode";
import { ext } from "../extensionVariables";

function setRunScratchpadItemText(text: string) {
  ext.runScratchpadItem.text = `$(notebook-execute) ${text}`;
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
      const conf = workspace.getConfiguration("kdb", uri);
      const map = conf.get<{ [key: string]: string }>("scratchpads", {});

      if (path in map) {
        const servers = conf.get<{ [key: string]: { serverName: string } }>(
          "servers",
          {},
        );
        setRunScratchpadItemText(servers[map[path]].serverName);
      } else {
        setRunScratchpadItemText("Run");
      }
      item.show();
    } else {
      item.hide();
    }
  } else {
    item.hide();
  }
}

export async function runScratchpad(editor?: TextEditor) {
  if (!editor) {
    return;
  }

  const uri = editor.document.uri;
  const path = uri.path;

  if (!path.endsWith("kdb.q") && !path.endsWith("kdb.py")) {
    return;
  }

  const conf = workspace.getConfiguration("kdb", uri);
  const map = conf.get<{ [key: string]: string }>("scratchpads", {});

  let server = "";

  if (path in map) {
    server = map[path];
  } else {
    const servers = conf.get<{ [key: string]: { serverName: string } }>(
      "servers",
      {},
    );

    const picked = await window.showQuickPick(
      Object.keys(servers).map((key) => servers[key].serverName),
      {
        title: "Choose a connection",
      },
    );

    if (picked) {
      const key = Object.keys(servers).find(
        (key) => servers[key].serverName === picked,
      );

      if (key) {
        setRunScratchpadItemText(picked);
        server = key;
        map[path] = server;
        await conf.update("scratchpads", map);
      }
    }
  }

  if (server) {
    // TODO
    window.showInformationMessage(
      `Scratchpad is sent for running on associated connection (${server})`,
    );
  }
}
