/*
 * Copyright (c) 1998-2026 KX Systems Inc.
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
  EventEmitter,
  FileType,
  NotebookCell,
  QuickPickItem,
  QuickPickItemKind,
  Range,
  StatusBarAlignment,
  TabInputNotebook,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from "vscode";

import { ext } from "../extensionVariables";
import {
  ensureQuickConnection,
  resetScratchpad,
  runQuery,
  setQuickPassword,
} from "./serverCommand";
import { getActiveTarget } from "../classes/activeTarget";
import { InsightsConnection } from "../classes/insightsConnection";
import { LocalConnection } from "../classes/localConnection";
import { ReplConnection } from "../classes/replConnection";
import { ExecutionTypes } from "../models/execution";
import { MetaDap } from "../models/meta";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { InsightsNode, KdbNode, LabelNode } from "../services/kdbTreeProvider";
import { updateCellMetadata } from "../services/notebookProviders";
import {
  calculateSeconds,
  formatSeconds,
  getBasename,
  isQuick,
  isQuickAlias,
  offerConnectAction,
} from "../utils/core";
import { importOldDsFiles } from "../utils/dataSource";
import { MessageKind, notify, Runner } from "../utils/notifications";
import {
  RunFlag,
  getPythonWrapper,
  getSQLWrapper,
  notifyExecution,
} from "../utils/queryUtils";
import {
  cleanAssemblyName,
  cleanDapName,
  errorMessage,
  normalizeAssemblyTarget,
} from "../utils/shared";
import { showInputPicker } from "../utils/widgets";

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

// What the notebook toolbar hands its commands.
type NotebookToolbarContext = { notebookEditor?: { notebookUri?: Uri } };

/**
 * The file the connection, target and timeout pickers act on. A notebook has
 * no active text editor until one of its cells is focused, so the toolbar
 * context it passes comes first, then the frontmost tab, and only then the
 * active text editor.
 */
export function getActiveFileUri(context?: unknown): Uri | undefined {
  const fromToolbar = (context as NotebookToolbarContext)?.notebookEditor
    ?.notebookUri;
  if (fromToolbar) {
    return fromToolbar;
  }

  const tab = window.tabGroups.activeTabGroup.activeTab?.input;
  if (tab instanceof TabInputNotebook) {
    return tab.uri;
  }

  return ext.activeTextEditor?.document.uri;
}

function activeEditorChanged(editor?: TextEditor | undefined) {
  /* c8 ignore start */
  setRealActiveTextEditor(editor);
  const runItem = ext.runScratchpadItem;

  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const server = getServerForUri(uri);
    if (server || isConnectableFile(uri)) {
      setRunScratchpadItemText(uri, server || "(active)");
      runItem.show();
    } else {
      runItem.hide();
    }

    setTimeoutItem(uri);
  } else {
    runItem.hide();
    ext.pickTimeoutItem.hide();
  }
  /* c8 ignore stop */
}

function setRunScratchpadItemText(uri: Uri, text: string) {
  /* c8 ignore start */
  ext.runScratchpadItem.text = `$(cloud) ${text}`;
  ext.runScratchpadItem.tooltip = `KX: Choose connection for '${getBasename(uri)}'`;
  /* c8 ignore stop */
}

export async function setTimeoutItem(uri: Uri) {
  const server = getServerForUri(uri);
  const timeoutItem = ext.pickTimeoutItem;

  if (server) {
    const conn = await getConnectionForServer(server);

    if (conn instanceof InsightsNode) {
      const timeout = getTimeoutForUri(uri);
      setTimeouttemText(uri, timeout);
      timeoutItem.show();
    } else {
      timeoutItem.hide();
    }
  } else {
    timeoutItem.hide();
  }
}

function setTimeouttemText(
  uri: Uri,
  { source, value }: { source: string; value?: number },
) {
  let text = "default";

  if (value) {
    if (source === "uri") {
      text = formatSeconds(value);
    } else if (source === "workspace") {
      text = `Default (${formatSeconds(value)})`;
    }
  }

  ext.pickTimeoutItem.text = `$(watch) ${text}`;
  ext.pickTimeoutItem.tooltip = `KX: Choose timeout for '${getBasename(uri)}'`;
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

const quickServers: string[] = [];

function getQuickServers(uri: Uri) {
  const conf = workspace.getConfiguration("kdb", uri);
  const connections = conf.get<{ [key: string]: string }>("connectionMap", {});
  const size = quickServers.length;
  const targets = [
    ...Object.values(connections),
    ...sessionConnectionMap.values(),
  ];
  targets.forEach((target) => {
    if (target.includes(":") && !quickServers.includes(target)) {
      quickServers.push(target);
    }
  });
  return size !== quickServers.length ? quickServers.sort() : quickServers;
}

export async function getConnectionForServer(
  server: string,
): Promise<InsightsNode | KdbNode | undefined> {
  /* c8 ignore start */
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
  /* c8 ignore stop */
}

function relativePath(uri: Uri) {
  return workspace.asRelativePath(uri, false);
}

// Assignments for files outside the workspace cannot be persisted in the
// kdb.connectionMap/targetMap/timeoutMap settings, which are keyed by
// workspace relative path. They are kept in memory for the session instead.
const sessionConnectionMap = new Map<string, string>();
const sessionTargetMap = new Map<string, string>();
const sessionTimeoutMap = new Map<string, number>();

const sessionMapChangedEmitter = new EventEmitter<void>();

// Session assignments don't change the configuration, so consumers relying on
// kdb.connectionMap changes need this event to know when to refresh.
export const onDidChangeSessionMaps = sessionMapChangedEmitter.event;

function isOutsideWorkspace(uri: Uri) {
  return !workspace.getWorkspaceFolder(uri);
}

function sessionKey(uri: Uri) {
  return uri.toString();
}

function setSessionValue<T>(
  map: Map<string, T>,
  uri: Uri,
  value: T | undefined,
) {
  if (value === undefined) {
    map.delete(sessionKey(uri));
  } else {
    map.set(sessionKey(uri), value);
  }
  sessionMapChangedEmitter.fire();
}

export async function setServerForUri(uri: Uri, server: string | undefined) {
  uri = Uri.file(uri.path);
  if (isOutsideWorkspace(uri)) {
    setSessionValue(sessionConnectionMap, uri, server);
    return;
  }
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
  let server: string | undefined;

  if (isOutsideWorkspace(uri)) {
    server = sessionConnectionMap.get(sessionKey(uri));
  } else {
    const conf = workspace.getConfiguration("kdb", uri);
    const map = conf.get<{ [key: string]: string | undefined }>(
      "connectionMap",
      {},
    );
    server = map[relativePath(uri)];
  }

  const servers = getServers();

  return isQuick(server) ||
    (server && (server === ext.REPL || servers.includes(server)))
    ? server
    : undefined;
}

export async function setTargetForUri(uri: Uri, target: string | undefined) {
  uri = Uri.file(uri.path);
  if (isOutsideWorkspace(uri)) {
    setSessionValue(sessionTargetMap, uri, target);
    return;
  }
  const conf = workspace.getConfiguration("kdb", uri);
  const map = conf.get<{ [key: string]: string | undefined }>("targetMap", {});
  map[relativePath(uri)] = target;
  await conf.update("targetMap", map);
}

export function getTargetForUri(uri: Uri) {
  uri = Uri.file(uri.path);
  let target: string | undefined;

  if (isOutsideWorkspace(uri)) {
    target = sessionTargetMap.get(sessionKey(uri));
  } else {
    const conf = workspace.getConfiguration("kdb", uri);
    const map = conf.get<{ [key: string]: string | undefined }>(
      "targetMap",
      {},
    );
    target = map[relativePath(uri)];
  }

  return target ? normalizeAssemblyTarget(target) : undefined;
}

export async function setTimeoutForUri(uri: Uri, timeout: number | undefined) {
  let apply = true;
  let explainer = "";

  if (timeout) {
    // info message for unsupported timeout (>7hrs)
    if (timeout > 25200) {
      explainer = "the maximum allowed";
      timeout = 25200;
    }

    const formatted = formatSeconds(timeout);

    // warning for high timeouts (>20min)
    if (timeout > 1200) {
      const highTimeoutPrompt = await notify(
        `High timeout warning: You have set an execution timeout of ${formatted}${explainer ? " (" + explainer + ")" : ""}. Note that database queries will continue to run on the Data Access Process until completion or timeout, even if a Scratchpad query is cancelled. The DAP will be unavailable for all users while a query is running.`,
        MessageKind.WARNING,
        {},
        "Keep Timeout",
        "Cancel",
      );

      if (highTimeoutPrompt === "Cancel") {
        apply = false;
      }
    }
  }

  if (apply) {
    uri = Uri.file(uri.path);
    if (isOutsideWorkspace(uri)) {
      setSessionValue(sessionTimeoutMap, uri, timeout);
    } else {
      const conf = workspace.getConfiguration("kdb", uri);
      const map = conf.get<{ [key: string]: number | undefined }>(
        "timeoutMap",
        {},
      );
      map[relativePath(uri)] = timeout;
      await conf.update("timeoutMap", map);
    }
    setTimeouttemText(uri, { source: "uri", value: timeout });
  }
}

export function getTimeoutForUri(uri: Uri) {
  uri = Uri.file(uri.path);
  const conf = workspace.getConfiguration("kdb", uri);
  let uriTimeout: number | undefined;

  if (isOutsideWorkspace(uri)) {
    uriTimeout = sessionTimeoutMap.get(sessionKey(uri));
  } else {
    const map = conf.get<{ [key: string]: number | undefined }>(
      "timeoutMap",
      {},
    );
    uriTimeout = map[relativePath(uri)];
  }

  if (uriTimeout) {
    return {
      source: "uri",
      value: uriTimeout,
    };
  }

  const workspaceTimeout = conf.get<number | undefined>("defaultTimeout");

  if (workspaceTimeout) {
    return {
      source: "workspace",
      value: workspaceTimeout,
    };
  }

  return {
    source: "none",
    value: 30,
  };
}

export function getConnectionForUri(uri: Uri) {
  const server = getServerForUri(uri);
  if (server) {
    if (isQuick(server)) {
      const [host, port, user] = server.split(":");
      return ext.connectionsList.find(
        (item) =>
          item instanceof KdbNode &&
          host === item.details.serverName &&
          port === item.details.serverPort &&
          user === item.details.username,
      );
    }
    return ext.connectionsList.find((item) =>
      item instanceof InsightsNode
        ? item.details.alias === server
        : item.details.serverAlias === server,
    );
  }
}

export async function pickConnection(uri: Uri) {
  /* c8 ignore start */
  const server = getServerForUri(uri);
  const items = [
    "(active)",
    ext.REPL,
    ...getServers(),
    ...getQuickServers(uri),
  ];

  let picked = await showInputPicker(items, {
    title: `Choose a connection or enter a quick connection string for ${getBasename(uri)}`,
    placeHolder: server,
  });

  if (picked === undefined) return undefined;

  if (isQuick(picked)) {
    const [host, port, user, pass] = picked.split(":");
    if (host && port && /^\d+$/s.test(port)) {
      if (user) {
        picked = `${host}:${port}:${user}`;
        if (pass !== undefined) await setQuickPassword(host, port, user, pass);
      } else {
        picked = `${host}:${port}`;
      }
    } else {
      notify(`Connection string (${picked}) is not valid.`, MessageKind.ERROR, {
        logger,
      });
      return undefined;
    }
  } else if (picked === "(active)") {
    picked = undefined;
    await setTargetForUri(uri, undefined);
  } else if (picked === ext.REPL) {
    // The REPL has no execution targets, drop any stale assignment.
    await setTargetForUri(uri, undefined);
  } else if (!items.includes(picked)) {
    notify(`Connection "${picked}" is not found.`, MessageKind.ERROR, {
      logger,
    });
    return undefined;
  }

  if (picked || isConnectableFile(uri)) {
    setRunScratchpadItemText(uri, picked || "(active)");
    ext.runScratchpadItem.show();
  } else {
    ext.runScratchpadItem.hide();
  }
  await setServerForUri(uri, picked);

  if (server) {
    setTimeoutItem(uri);
  } else {
    ext.pickTimeoutItem.hide();
  }

  return picked;
  /* c8 ignore stop */
}

export async function pickTarget(uri: Uri, cell?: NotebookCell) {
  /* c8 ignore start */
  let server = getServerForUri(uri);
  if (!server) server = await pickConnection(uri);
  if (!server || server === ext.REPL) return;

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
  /* c8 ignore stop */
}

export async function pickTimeout(uri: Uri) {
  // prompt for unit
  const unitItems: QuickPickItem[] = [
    { label: "Seconds", description: "s" },
    { label: "Minutes", description: "min" },
    { label: "Hours", description: "hr" },
    { label: "", kind: QuickPickItemKind.Separator },
    { label: "Clear", description: "Use default timeout" },
  ];
  const selectedUnit = await window.showQuickPick(unitItems, {
    placeHolder: "Select the timeout unit",
    canPickMany: false,
  });

  const timeoutUnit = selectedUnit?.label;

  if (timeoutUnit === "Clear") {
    await setTimeoutForUri(uri, undefined);
    const timeout = await getTimeoutForUri(uri);
    setTimeouttemText(uri, timeout);
  } else if (timeoutUnit) {
    // prompt for value
    const timeoutValue = await window.showInputBox({
      prompt: `Enter timeout value in ${timeoutUnit.toLowerCase()}`,
      placeHolder: "e.g. 30",
      validateInput: (text) => {
        if (text !== "" && (isNaN(Number(text)) || Number(text) <= 0)) {
          return "Please enter a positive number";
        }

        const timeout = calculateSeconds(Number(text), timeoutUnit);
        if (timeout > 60 * 60 * 7) {
          return "Please enter a maximum of 7 hours";
        }

        return null;
      },
    });

    if (timeoutValue) {
      // convert to seconds
      const timeout = calculateSeconds(Number(timeoutValue), timeoutUnit);

      if (timeout) {
        await setTimeoutForUri(uri, timeout);
      }
    }
  }
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

function createProcessKey(dap: MetaDap): string | null {
  /* c8 ignore start */
  if (!dap.dap) return null;

  const cleanedDapName = cleanDapName(dap.dap);
  return `${createTierKey(dap)} ${cleanedDapName}`;
  /* c8 ignore stop */
}

function isQuke(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".quke");
}

function isSql(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".sql");
}

function isPython(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".py");
}

function isWorkbook(uri: Uri | undefined) {
  /* c8 ignore start */
  return (
    uri &&
    (uri.path.endsWith(".kdb.q") ||
      uri.path.endsWith(".kdb.py") ||
      uri.path.endsWith(".kdb.sql"))
  );
  /* c8 ignore stop */
}

function isDataSource(uri: Uri | undefined) {
  return uri && uri.path.endsWith(".kdb.json");
}

// A file that can be run against a connection (q/quke/Python/SQL, including
// workbooks). Used to decide whether to offer the status-bar connection
// selector, even when the file is not yet assigned to a connection.
function isConnectableFile(uri: Uri | undefined) {
  return (
    !!uri &&
    (uri.path.endsWith(".q") ||
      uri.path.endsWith(".quke") ||
      uri.path.endsWith(".py") ||
      uri.path.endsWith(".sql"))
  );
}

function isKxFolder(uri: Uri | undefined) {
  return uri && Path.basename(uri.path) === ".kx";
}

export async function startRepl() {
  const instance = await ReplConnection.getOrCreateInstance();
  instance.start();
  notify("REPL started.", MessageKind.DEBUG, {
    logger,
    telemetry: "Repl.Start",
  });
}

export async function startReplInFolder(uri?: Uri) {
  if (!uri) {
    return startRepl();
  }
  let base = uri;
  try {
    const stat = await workspace.fs.stat(uri);
    if (!(stat.type & FileType.Directory)) {
      base = Uri.file(Path.dirname(uri.fsPath));
    }
  } catch {
    // Unable to stat the resource; fall back to using it as the base directory.
  }
  const instance = await ReplConnection.openInFolder(base);
  instance.start();
  notify("REPL started.", MessageKind.DEBUG, {
    logger,
    telemetry: "Repl.StartFolder",
  });
}

export async function runOnRepl(editor: TextEditor, type?: ExecutionTypes) {
  const uri = editor.document.uri;
  const basename = getBasename(uri);

  let text: string;

  switch (type) {
    case ExecutionTypes.QueryFile:
    case ExecutionTypes.PythonQueryFile:
      text = editor.document.getText();
      break;
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection:
      text = editor.selection.isEmpty
        ? editor.document.lineAt(editor.selection.active.line).text
        : editor.document.getText(editor.selection);
      break;
    default:
      notify(
        `Executing ${basename} on ${ext.REPL} is not supported.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
  }

  // Nothing to run. Checked before wrapping, because the SQL and Python
  // wrappers turn empty text into a non-empty statement the REPL would send.
  if (!text.trim()) {
    return;
  }

  try {
    const repl = await ReplConnection.getOrCreateInstance(uri);
    repl.show();
    await repl.executeQuery(
      isPython(uri)
        ? getPythonWrapper(text, "serialized")
        : isSql(uri)
          ? getSQLWrapper(text)
          : text,
    );
  } catch (error) {
    notify(errorMessage(error), MessageKind.ERROR, {
      logger,
      params: error,
    });
  }
}

export type RunTarget =
  | { kind: "repl" }
  | { kind: "connection"; conn: InsightsConnection | LocalConnection };

/**
 * Decides where a q/Python/SQL file runs. Precedence:
 *   1. persisted assignment (kdb.connectionMap): an explicit REPL assignment is
 *      sticky; an explicit connection is resolved (offering to connect);
 *   2. otherwise the active target — the last-focused KX terminal (REPL or a
 *      connection console);
 *   3. otherwise the REPL (getOrCreateInstance picks the active REPL or spawns
 *      one for the workspace).
 */
export async function resolveRunTarget(
  uri: Uri,
): Promise<RunTarget | undefined> {
  const server = getServerForUri(uri);

  if (server === ext.REPL) {
    return { kind: "repl" };
  }

  if (server !== undefined) {
    const conn = await findConnection(uri);
    return conn ? { kind: "connection", conn } : undefined;
  }

  const active = getActiveTarget();
  if (active?.kind === "connection") {
    const conn = new ConnectionManagementService().retrieveConnectedConnection(
      active.connLabel,
    );
    if (conn) {
      return { kind: "connection", conn };
    }
  }

  return { kind: "repl" };
}

export async function runActiveEditor(type?: ExecutionTypes) {
  /* c8 ignore start */
  if (ext.activeTextEditor) {
    const uri = ext.activeTextEditor.document.uri;
    const runTarget = await resolveRunTarget(uri);
    if (!runTarget) {
      return;
    }
    if (runTarget.kind === "repl") {
      await runOnRepl(ext.activeTextEditor, type);
      notifyExecution(
        RunFlag.Run |
          RunFlag.Repl |
          (isWorkbook(uri) ? RunFlag.Workbook : 0) |
          (isPython(uri) ? RunFlag.Python : 0) |
          (isSql(uri) ? RunFlag.Sql : 0) |
          (isQuke(uri) ? RunFlag.Quke : 0),
      );
      return;
    }
    const conn = runTarget.conn;

    const isInsights = conn instanceof InsightsConnection;
    const executorName = getBasename(ext.activeTextEditor.document.uri);
    const target = isInsights ? getTargetForUri(uri) : undefined;
    const timeout = isInsights ? getTimeoutForUri(uri).value : undefined;

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
        !!isWorkbook(uri),
        undefined,
        target,
        !!isSql(uri),
        isInsights,
        timeout,
        () => {
          if (isInsights) {
            if (target) {
              notify(
                `Cancel request sent for ${conn.connLabel}, however, the query will continue running on the database until it finishes or times out`,
                MessageKind.INFO,
                { logger },
              );
            } else {
              conn.cancelScratchpad(isPython(uri));
            }
          }
        },
      );
      notifyExecution(
        (type === ExecutionTypes.PopulateScratchpad ? 0 : RunFlag.Run) |
          (isInsights ? RunFlag.Insights : 0) |
          (target ? RunFlag.Dap : 0) |
          (isQuickAlias(conn.connLabel) ? RunFlag.Quick : 0) |
          (isWorkbook(uri) ? RunFlag.Workbook : 0) |
          (isPython(uri) ? RunFlag.Python : 0) |
          (isSql(uri) ? RunFlag.Sql : 0) |
          (isQuke(uri) ? RunFlag.Quke : 0),
      );
    } catch (error) {
      // don't show message if execution was cancelled
      if (error instanceof Error && error.message.startsWith("Canceled")) {
        return;
      }

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
  /* c8 ignore stop */
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
  readonly onDidChangeCodeLenses = onDidChangeSessionMaps;

  async provideCodeLenses(document: TextDocument) {
    const server = getServerForUri(document.uri);
    const top = new Range(0, 0, 0, 0);

    const lenses: CodeLens[] = [];

    lenses.push(
      new CodeLens(top, {
        command: "kdb.file.pickConnection",
        title: server ? `Run on ${server}` : "Run on active",
      }),
    );

    if (server) {
      const conn = await getConnectionForServer(server);
      if (!isSql(document.uri) && conn instanceof InsightsNode) {
        lenses.push(
          new CodeLens(top, {
            command: "kdb.file.pickTarget",
            title: getTargetForUri(document.uri) || "scratchpad",
          }),
        );
      }
    }

    return lenses;
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

  ext.pickTimeoutItem = window.createStatusBarItem(
    StatusBarAlignment.Right,
    10000,
  );
  ext.pickTimeoutItem.command = <Command>{
    title: "Choose Timeout",
    command: "kdb.file.pickTimeout",
    arguments: [],
  };

  const watcher = workspace.createFileSystemWatcher("**/*.{kdb.json,q,py,sql}");
  watcher.onDidCreate(update);
  watcher.onDidDelete(update);

  workspace.onDidDeleteFiles((event) => {
    /* c8 ignore start */
    for (const uri of event.files) {
      if (isKxFolder(uri)) {
        ext.dataSourceTreeProvider.reload();
        ext.scratchpadTreeProvider.reload();
        break;
      }
    }
    /* c8 ignore stop */
  });

  workspace.onDidRenameFiles(async (event) => {
    /* c8 ignore start */
    for (const { oldUri, newUri } of event.files) {
      await setServerForUri(newUri, getServerForUri(oldUri));
      await setServerForUri(oldUri, undefined);
      await setTargetForUri(newUri, getTargetForUri(oldUri));
      await setTargetForUri(oldUri, undefined);

      const timeout = getTimeoutForUri(oldUri);
      if (timeout.source === "uri") {
        await setTimeoutForUri(newUri, timeout.value);
        await setTimeoutForUri(oldUri, undefined);
      }
    }
    /* c8 ignore stop */
  });

  workspace.onDidChangeWorkspaceFolders(() => {
    /* c8 ignore start */
    ext.dataSourceTreeProvider.reload();
    ext.scratchpadTreeProvider.reload();
    /* c8 ignore stop */
  });
  window.onDidChangeActiveTextEditor(activeEditorChanged);
  activeEditorChanged(window.activeTextEditor);
}

export async function importOldDSFiles() {
  /* c8 ignore start */
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
  /* c8 ignore stop */
}

export async function findConnection(uri: Uri) {
  /* c8 ignore start */
  let conn: InsightsConnection | LocalConnection | undefined;
  let server = getServerForUri(uri) ?? "";

  if (server) {
    if (isQuick(server)) server = await ensureQuickConnection(server);
    const node = await getConnectionForServer(server);
    if (node) {
      const connMngService = new ConnectionManagementService();
      server = node.label;
      conn = connMngService.retrieveConnectedConnection(server);
      if (conn === undefined) {
        const res = await offerConnectAction(server);
        if (res) {
          conn = connMngService.retrieveConnectedConnection(server);
        }
      }
    } else {
      notify(`Connection ${server} not found.`, MessageKind.ERROR, {
        logger,
      });
    }
  } else {
    await offerConnectAction();
  }
  return conn;
  /* c8 ignore stop */
}
