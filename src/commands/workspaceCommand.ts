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

import Path from "path";
import {
  CodeLens,
  CodeLensProvider,
  Command,
  NotebookCell,
  QuickPickItem,
  QuickPickItemKind,
  Range,
  StatusBarAlignment,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from "vscode";

import { ext } from "../extensionVariables";
import { resetScratchpad, runQuery } from "./serverCommand";
import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import { ReplConnection } from "../classes/replConnection";
import { ExecutionTypes } from "../models/execution";
import { MetaDap } from "../models/meta";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { InsightsNode, KdbNode, LabelNode } from "../services/kdbTreeProvider";
import { updateCellMetadata } from "../services/notebookProviders";
import { getBasename, offerConnectAction } from "../utils/core";
import { importOldDsFiles, oldFilesExists } from "../utils/dataSource";
import {
  Cancellable,
  MessageKind,
  notify,
  Runner,
} from "../utils/notifications";
import {
  cleanAssemblyName,
  cleanDapName,
  errorMessage,
  normalizeAssemblyTarget,
} from "../utils/shared";
import { getQuerySelectedText } from "../utils/workspace";

const logger = "workspaceCommand";

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

/* c8 ignore next */
function activeEditorChanged(editor?: TextEditor | undefined) {
  setRealActiveTextEditor(editor);
  const item = ext.runScratchpadItem;
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const server = getServerForUri(uri);
    if (server) {
      setRunScratchpadItemText(uri, server);
      item.show();
    } else {
      item.hide();
    }
  } else {
    item.hide();
  }
}

/* c8 ignore next */
function setRunScratchpadItemText(uri: Uri, text: string) {
  ext.runScratchpadItem.text = `$(cloud) ${text}`;
  ext.runScratchpadItem.tooltip = `KX: Choose connection for '${getBasename(uri)}'`;
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

/* c8 ignore next */
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
  const relative = relativePath(uri);
  if (relative.startsWith("/")) {
    notify(`Document (${uri.path}) is not in workspace.`, MessageKind.ERROR, {
      logger,
    });
  } else {
    map[relative] = server;
    await conf.update("connectionMap", map);
  }
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

  return server && (server === ext.REPL || servers.includes(server))
    ? server
    : undefined;
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
      }
      return item.details.serverAlias === server;
    }) as KdbNode | InsightsNode;
  }
}

/* c8 ignore next */
export async function pickConnection(uri: Uri) {
  const server = getServerForUri(uri);
  const servers = getServers();

  const items = ["(none)"];
  if (isQ(uri) || isNotebook(uri)) {
    items.push(ext.REPL);
  }
  items.push(...servers);

  let picked = await window.showQuickPick(items, {
    title: `Choose Connection (${getBasename(uri)})`,
    placeHolder: server,
  });

  if (picked) {
    if (picked === "(none)") {
      picked = undefined;
      await setTargetForUri(uri, undefined);
    }
    if (picked) {
      setRunScratchpadItemText(uri, picked);
      ext.runScratchpadItem.show();
    } else {
      ext.runScratchpadItem.hide();
    }
    await setServerForUri(uri, picked);
  }
  return picked;
}

/* c8 ignore next */
export async function pickTarget(uri: Uri, cell?: NotebookCell) {
  const conn = await findConnection(uri);
  const isInsights = conn instanceof InsightsConnection;

  let daps: MetaDap[] = [];

  if (isInsights) {
    const connMngService = new ConnectionManagementService();
    daps = JSON.parse(
      connMngService.retrieveMetaContent(conn.connLabel, "DAP"),
    );
  }

  const target = cell?.metadata.target || getTargetForUri(uri);

  if (target && !targetExists(target, daps) && !conn) {
    daps.unshift(createMetaDapFromTarget(target));
  }

  const tierItems = buildTierOptionsWithSeparators(daps);
  const defaultOption = isInsights ? "scratchpad" : "default";

  const items: QuickPickItem[] = [{ label: defaultOption }];

  if (tierItems.length > 0) {
    items.push(...tierItems);
  }

  const picked = await window.showQuickPick(items, {
    title: `Choose Execution Target (${conn?.connLabel ?? "Not Connected"})`,
    placeHolder: target || defaultOption,
  });

  let selectedValue = picked?.label;

  if (selectedValue) {
    if (selectedValue === "scratchpad" || selectedValue === "default") {
      selectedValue = undefined;
    }

    if (cell) {
      await updateCellMetadata(cell, {
        target: selectedValue,
        variable: selectedValue && cell.metadata.variable,
      });
    } else {
      await setTargetForUri(uri, selectedValue);
    }
  }

  return selectedValue;
}

function createTierKey(dap: MetaDap): string {
  const cleanedAssembly = cleanAssemblyName(dap.assembly);
  return `${cleanedAssembly} ${dap.instance}`;
}

function targetExists(target: string, daps: MetaDap[]): boolean {
  return daps.some((dap) => {
    const tierKey = createTierKey(dap);
    const processKey = createProcessKey(dap);
    return tierKey === target || processKey === target;
  });
}

function createMetaDapFromTarget(target: string): MetaDap {
  const parts = target.split(/\s+/);
  const [assembly, instance, ...dapParts] = parts;

  return dapParts.length > 0
    ? ({ assembly, instance, dap: dapParts.join(" ") } as MetaDap)
    : ({ assembly, instance } as MetaDap);
}

// TODO: Remove it if this don't going to be used from 1.14
// Options separated by ties and DAP processes
// function buildTierOptionsWithSeparators(daps: MetaDap[]): QuickPickItem[] {
//   const items: QuickPickItem[] = [];

//   const tierSet = new Set<string>();
//   const processItems: QuickPickItem[] = [];

//   daps.forEach((dap) => {
//     const cleanedAssembly = cleanAssemblyName(dap.assembly);
//     const tierKey = `${cleanedAssembly} ${dap.instance}`;
//     tierSet.add(tierKey);

//     if (dap.dap) {
//       const cleanedDapName = cleanDapName(dap.dap);
//       processItems.push({ label: `${tierKey} ${cleanedDapName}` });
//     }
//   });

//   if (tierSet.size > 0) {
//     items.push({
//       kind: QuickPickItemKind.Separator,
//       label: "Tiers",
//     });

//     const sortedTiers = Array.from(tierSet).sort((a, b) => a.localeCompare(b));
//     sortedTiers.forEach((tier) => {
//       items.push({ label: tier });
//     });
//   }

//   if (processItems.length > 0) {
//     items.push({
//       kind: QuickPickItemKind.Separator,
//       label: "DAP Processes",
//     });

//     const sortedProcessItems = processItems
//       .slice()
//       .sort((a, b) => a.label.localeCompare(b.label));
//     sortedProcessItems.forEach((item) => {
//       items.push(item);
//     });
//   }

//   return items;
// }

// Options separated by Assembly
function buildTierOptionsWithSeparators(daps: MetaDap[]): QuickPickItem[] {
  const assemblyMap = new Map<string, Map<string, MetaDap[]>>();

  daps.forEach((dap) => {
    if (!assemblyMap.has(dap.assembly)) {
      assemblyMap.set(dap.assembly, new Map<string, MetaDap[]>());
    }

    const tierKey = `${cleanAssemblyName(dap.assembly)} ${dap.instance}`;
    const tierMap = assemblyMap.get(dap.assembly)!;
    const cleanedDap = { ...dap };

    if (!tierMap.has(tierKey)) {
      tierMap.set(tierKey, []);
    }
    if (cleanedDap.dap) {
      cleanedDap.dap = cleanDapName(cleanedDap.dap);
    }

    tierMap.get(tierKey)!.push(cleanedDap);
  });

  const items: QuickPickItem[] = [];
  const sortedAssemblies = Array.from(assemblyMap.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  sortedAssemblies.forEach((assembly) => {
    items.push({
      kind: QuickPickItemKind.Separator,
      label: `${assembly}`,
    });

    const tierMap = assemblyMap.get(assembly)!;
    const sortedTierKeys = Array.from(tierMap.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    sortedTierKeys.forEach((tierKey) => {
      const processes = tierMap.get(tierKey)!;

      items.push({ label: tierKey });

      const sortedProcesses = processes
        .filter((process) => process.dap)
        .sort((a, b) => a.dap!.localeCompare(b.dap!));

      sortedProcesses.forEach((process) => {
        items.push({ label: `${tierKey} ${process.dap}` });
      });
    });
  });

  return items;
}

/* c8 ignore next */
function createProcessKey(dap: MetaDap): string | null {
  if (!dap.dap) return null;

  const cleanedDapName = cleanDapName(dap.dap);
  return `${createTierKey(dap)} ${cleanedDapName}`;
}

function isSql(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".sql");
}

function isQ(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".q");
}

function isNotebook(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".kxnb");
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

export async function startRepl() {
  try {
    ReplConnection.getOrCreateInstance().start();
  } catch (error) {
    notify(errorMessage(error), MessageKind.ERROR, {
      logger,
      params: error,
    });
  }
}

export async function runOnRepl(editor: TextEditor, type?: ExecutionTypes) {
  const basename = getBasename(editor.document.uri);

  let text: string;

  if (type === ExecutionTypes.QueryFile) {
    text = editor.document.getText();
  } else if (type === ExecutionTypes.QuerySelection) {
    text = await getQuerySelectedText(editor);
  } else {
    notify(
      `Executing ${basename} on ${ext.REPL} is not supported.`,
      MessageKind.ERROR,
      { logger },
    );
    return;
  }

  try {
    const runner = Runner.create((_, token) => {
      const repl = ReplConnection.getOrCreateInstance();
      repl.show();
      return repl.executeQuery(text, token);
    });
    runner.cancellable = Cancellable.EXECUTOR;
    runner.title = `Executing ${basename} on ${ext.REPL}.`;
    await runner.execute();
  } catch (error) {
    notify(errorMessage(error), MessageKind.ERROR, {
      logger,
      params: error,
    });
  }
}

export async function runActiveEditor(type?: ExecutionTypes) {
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    if (getServerForUri(uri) === ext.REPL) {
      runOnRepl(ext.activeTextEditor, type);
      return;
    }
    const conn = await findConnection(uri);
    if (!conn) {
      return;
    }

    const isInsights = conn instanceof InsightsConnection;
    const executorName = getBasename(ext.activeTextEditor.document.uri);
    const target = isInsights ? getTargetForUri(uri) : undefined;
    const isSql = executorName.endsWith(".sql");

    if (isSql && !isInsights) {
      notify(
        `SQL execution is not supported on ${conn.connLabel}.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
    }

    if (type === ExecutionTypes.PopulateScratchpad && !isInsights) {
      notify(
        `Populating scratchpad is not supported on ${conn.connLabel}.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
    }

    try {
      await runQuery(
        type === undefined
          ? isPython(uri)
            ? ExecutionTypes.PythonQueryFile
            : ExecutionTypes.QueryFile
          : type,
        conn.connLabel,
        executorName,
        !isPython(uri),
        undefined,
        target,
        isSql,
        conn instanceof InsightsConnection,
      );
    } catch (error) {
      notify(
        `Executing ${executorName} on ${conn.connLabel} failed.`,
        MessageKind.ERROR,
        {
          logger,
          params: error,
        },
      );
    }
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
      if (!isSql(document.uri) && conn instanceof InsightsNode) {
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
  ext.runScratchpadItem.command = <Command>{
    title: "Choose Connection",
    command: "kdb.file.pickConnection",
    arguments: [],
  };

  const watcher = workspace.createFileSystemWatcher("**/*.{kdb.json,q,py,sql}");
  watcher.onDidCreate(update);
  watcher.onDidDelete(update);

  /* c8 ignore next */
  workspace.onDidDeleteFiles((event) => {
    for (const uri of event.files) {
      if (isKxFolder(uri)) {
        ext.dataSourceTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
        break;
      }
    }
  });

  /* c8 ignore next */
  workspace.onDidRenameFiles(async (event) => {
    for (const { oldUri, newUri } of event.files) {
      await setServerForUri(newUri, getServerForUri(oldUri));
      await setServerForUri(oldUri, undefined);
      await setTargetForUri(newUri, getTargetForUri(oldUri));
      await setTargetForUri(oldUri, undefined);
    }
  });

  /* c8 ignore next */
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
      notify("No workspace folder found.", MessageKind.ERROR, { logger });
      return;
    }
    const runner = Runner.create(async (_, token) => {
      token.onCancellationRequested(() => {
        notify("User cancelled the old DS files import.", MessageKind.DEBUG, {
          logger,
        });
        return false;
      });

      await importOldDsFiles();
    });
    runner.title = "Importing old DS files.";
    return await runner.execute();
  } else {
    notify("No old Datasource files found on your VSCODE.", MessageKind.INFO, {
      logger,
    });
  }
}

export async function findConnection(uri: Uri) {
  const connMngService = new ConnectionManagementService();

  let conn: InsightsConnection | LocalConnection | undefined;
  let server = getServerForUri(uri) ?? "";

  if (server) {
    const node = await getConnectionForServer(server);
    if (node) {
      server = node.label;
      conn = connMngService.retrieveConnectedConnection(server);
      if (conn === undefined) {
        offerConnectAction(server);
        return;
      }
    } else {
      notify(`Connection ${server} not found.`, MessageKind.ERROR, {
        logger,
      });
      return;
    }
  } else if (ext.activeConnection) {
    conn = ext.activeConnection;
  } else {
    offerConnectAction();
    return;
  }
  return conn;
}
