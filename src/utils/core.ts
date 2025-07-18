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

import { ChildProcess } from "child_process";
import { createHash } from "crypto";
import { writeFile } from "fs/promises";
import { pathExists } from "fs-extra";
import path from "node:path";
import { env } from "node:process";
import { tmpdir } from "os";
import { join } from "path";
import * as semver from "semver";
import { commands, ConfigurationTarget, Uri, workspace } from "vscode";

import { installTools } from "../commands/installTools";
import { ext } from "../extensionVariables";
import { tryExecuteCommand } from "./cpUtils";
import { MessageKind, notify } from "./notifications";
import { showRegistrationNotification } from "./registration";
import { errorMessage } from "./shared";
import { stat, which } from "./shell";
import {
  InsightDetails,
  Insights,
  Server,
  ServerDetails,
} from "../models/connectionsModels";
import { QueryResult } from "../models/queryResult";

const logger = "core";

export function log(childProcess: ChildProcess): void {
  notify(`Process ${childProcess.pid} started`, MessageKind.DEBUG, {
    logger,
  });
}

export async function checkOpenSslInstalled(): Promise<string | null> {
  try {
    const result = await tryExecuteCommand(
      undefined,
      "openssl",
      log,
      "version",
    );
    if (result.code === 0) {
      const matcher = /(\d+.\d+.\d+)/;
      const installedVersion = result.cmdOutput.match(matcher);

      notify(
        `Detected version ${installedVersion} of OpenSSL installed.`,
        MessageKind.DEBUG,
        { logger },
      );

      return semver.clean(installedVersion ? installedVersion[1] : "");
    }
  } catch (err) {
    // Disabled the error, as it is not critical
    // kdbOutputLog(`Error in checking OpenSSL version: ${err}`, "ERROR");
    notify("OpenSSL not found.", MessageKind.DEBUG, {
      logger,
      telemetry: err as Error,
    });
  }
  return null;
}

export function getHash(input: string): string {
  return createHash("sha256").update(input).digest("base64");
}

export function getKeyForServerName(name: string) {
  const conf = workspace.getConfiguration("kdb");
  const servers = conf.get<{ [key: string]: { serverAlias: string } }>(
    "servers",
    {},
  );
  let result = Object.keys(servers).find(
    (key) => servers[key].serverAlias === name,
  );
  if (result) {
    return result;
  }
  const insgihts = conf.get<{ [key: string]: { alias: string } }>(
    "insightsEnterpriseConnections",
    {},
  );
  result = Object.keys(insgihts).find((key) => insgihts[key].alias === name);
  return result || "";
}

export function initializeLocalServers(servers: Server): void {
  Object.keys(servers!).forEach((server) => {
    if (servers![server].managed === true) {
      addLocalConnectionContexts(getServerName(servers![server]));
    }
  });
}

export async function addLocalConnectionStatus(
  serverName: string,
): Promise<void> {
  ext.localConnectionStatus.push(serverName);
  await commands.executeCommand(
    "setContext",
    "kdb.running",
    ext.localConnectionStatus,
  );
}

export async function removeLocalConnectionStatus(
  serverName: string,
): Promise<void> {
  const result = ext.localConnectionStatus.filter(
    (connection) => connection !== serverName,
  );
  ext.localConnectionStatus = result;
  await commands.executeCommand(
    "setContext",
    "kdb.running",
    ext.localConnectionStatus,
  );
}

export async function addLocalConnectionContexts(
  serverName: string,
): Promise<void> {
  ext.localConnectionContexts.push(serverName);
  await commands.executeCommand(
    "setContext",
    "kdb.local",
    ext.localConnectionContexts,
  );
}

export async function removeLocalConnectionContext(
  serverName: string,
): Promise<void> {
  const result = ext.localConnectionContexts.filter(
    (connection) => connection !== serverName,
  );
  ext.localConnectionContexts = result;
  await commands.executeCommand(
    "setContext",
    "kdb.local",
    ext.localConnectionContexts,
  );
}

export function saveLocalProcessObj(
  childProcess: ChildProcess,
  args: string[],
): void {
  notify(
    `Child process id ${childProcess.pid} saved in cache.`,
    MessageKind.DEBUG,
    { logger },
  );
  ext.localProcessObjects[args[2]] = childProcess;
}

export function getOsFile(): string | undefined {
  if (process.platform === "win32") {
    return "w64.zip";
  } else if (process.platform === "darwin") {
    return "m64.zip";
  } else if (process.platform === "linux") {
    return "l64.zip";
  } else {
    return undefined;
  }
}

export function getPlatformFolder(
  platform: string,
  arch?: string,
): string | undefined {
  if (platform === "win32") {
    return "w64";
  } else if (platform === "darwin") {
    return "m64";
  } else if (platform === "linux") {
    return arch === "arm64" ? "l64arm" : "l64";
  }
  return undefined;
}

export function getQExecutablePath() {
  const folder = getPlatformFolder(process.platform, process.arch);

  if (!folder) {
    throw new Error(
      `Unsupported platform (${process.platform}) or architecture (${process.arch}).`,
    );
  }

  if (ext.REAL_QHOME) {
    const q = path.join(ext.REAL_QHOME, "bin", "q");
    return stat(q) ? q : path.join(ext.REAL_QHOME, folder, "q");
  } else {
    try {
      for (const target of which("q")) {
        if (target.endsWith("/bin/q")) return target;
      }
    } catch (error) {
      notify(errorMessage(error), MessageKind.DEBUG, { logger });
    }
  }

  const qHomeDirectory = workspace
    .getConfiguration("kdb")
    .get<string>("qHomeDirectory", "");

  if (qHomeDirectory) {
    return path.join(qHomeDirectory, folder, "q");
  }

  throw new Error(
    `Neither QHOME environment variable nor qHomeDirectory is set.`,
  );
}

export async function getWorkspaceFolder(
  corePath: string,
): Promise<string | undefined> {
  if (await pathExists(join(corePath, "q"))) {
    return corePath;
  } else if (
    await pathExists(join(corePath, getPlatformFolder(process.platform)!))
  ) {
    return join(corePath, getPlatformFolder(process.platform)!);
  }
  return undefined;
}

export function getServers(): Server | undefined {
  const servers = workspace.getConfiguration().get<Server>("kdb.servers");

  return servers
    ? Object.fromEntries(
        Object.entries(servers).sort(([, a], [, b]) =>
          a.serverAlias.localeCompare(b.serverAlias),
        ),
      )
    : servers;
}

// TODO: Remove this on 1.9.0 release
/* istanbul ignore next */
export function fixUnnamedAlias(): void {
  const servers = getServers();
  const insights = getInsights();
  let counter = 1;

  if (servers) {
    const updatedServers: Server = {};
    for (const key in servers) {
      if (Object.prototype.hasOwnProperty.call(servers, key)) {
        const server = servers[key];
        if (server.serverAlias === "") {
          server.serverAlias = `unnamedServer-${counter}`;
          counter++;
        }
        updatedServers[server.serverAlias] = server;
      }
    }
    updateServers(updatedServers);
    ext.serverProvider.refresh(servers);
  }

  if (insights) {
    const updatedInsights: Insights = {};
    for (const key in insights) {
      if (Object.prototype.hasOwnProperty.call(insights, key)) {
        const insight = insights[key];
        if (insight.alias === "") {
          insight.alias = `unnamedServer-${counter}`;
          counter++;
        }
        updatedInsights[insight.alias] = insight;
      }
    }
    updateInsights(updatedInsights);
    ext.serverProvider.refreshInsights(insights);
  }
}

export function getAutoFocusOutputOnEntrySetting(): boolean {
  return workspace
    .getConfiguration("kdb")
    .get<boolean>("autoFocusOutputOnEntry", true);
}

export function getHideDetailedConsoleQueryOutputSetting(): boolean {
  return workspace
    .getConfiguration("kdb")
    .get<boolean>("hideDetailedConsoleQueryOutput", true);
}

export function setOutputWordWrapper(): void {
  let existWrap = false;
  const logConfig = workspace.getConfiguration("[Log]");
  if (logConfig) {
    const wordWrap = logConfig["editor.wordWrap"];
    if (wordWrap) {
      existWrap = true;
    }
  }
  if (!existWrap) {
    workspace
      .getConfiguration()
      .update(
        "[Log]",
        { "editor.wordWrap": "off" },
        ConfigurationTarget.Global,
      );
  }
}

export function getInsights(): Insights | undefined {
  const configuration = workspace.getConfiguration();
  const insights = configuration.get<Insights>(
    "kdb.insightsEnterpriseConnections",
  );

  const insightsList: Insights | undefined =
    insights && Object.keys(insights).length > 0
      ? insights
      : configuration.get("kdb.insights");

  if (!insightsList || Object.keys(insightsList).length === 0) {
    return undefined;
  }

  return insightsList
    ? Object.fromEntries(
        Object.entries(insightsList).sort(([, a], [, b]) =>
          a.alias.localeCompare(b.alias),
        ),
      )
    : insightsList;
}

export async function updateServers(servers: Server): Promise<void> {
  await workspace
    .getConfiguration()
    .update("kdb.servers", servers, ConfigurationTarget.Global);
}

export async function updateInsights(insights: Insights): Promise<void> {
  await workspace
    .getConfiguration()
    .update(
      "kdb.insightsEnterpriseConnections",
      insights,
      ConfigurationTarget.Global,
    );
}

export function getServerName(server: ServerDetails): string {
  return server.serverAlias != ""
    ? `${server.serverAlias} [${server.serverName}:${server.serverPort}]`
    : `[${server.serverName}:${server.serverPort}]`;
}

export function getServerAlias(serverList: ServerDetails[]): void {
  serverList.forEach(({ serverAlias }) => {
    if (serverAlias) {
      ext.kdbConnectionAliasList.push(serverAlias);
    }
  });
}

export function tokenUndefinedError(connLabel: string): void {
  notify(
    `Error retrieving access token for Insights connection named: ${connLabel}`,
    MessageKind.ERROR,
    { logger },
  );
}

export function invalidUsernameJWT(connLabel: string): void {
  notify(
    `JWT did not contain a valid preferred username for Insights connection: ${connLabel}`,
    MessageKind.ERROR,
    { logger },
  );
}

/* istanbul ignore next */
export function offerConnectAction(connLabel?: string): void {
  if (connLabel) {
    notify(
      `You aren't connected to ${connLabel}, would you like to connect? Once connected please try again.`,
      MessageKind.WARNING,
      {},
      "Connect",
      "Cancel",
    ).then(async (result) => {
      if (result === "Connect") {
        await commands.executeCommand(
          "kdb.connections.connect.via.dialog",
          connLabel,
        );
      }
    });
  } else {
    notify(
      "You aren't connected to any connection. Once connected please try again.",
      MessageKind.WARNING,
      { logger },
    );
  }
}

export function noSelectedConnectionAction(): void {
  notify(
    `You didn't selected any existing connection to execute this action, please select a connection and try again.`,
    MessageKind.INFO,
  );
}

/* istanbul ignore next */
export function offerReconnectionAfterEdit(connLabel: string): void {
  notify(
    `You are no longer connected to ${connLabel}, would you like to connect?`,
    MessageKind.INFO,
    {},
    "Connect",
    "Cancel",
  ).then(async (result) => {
    if (result === "Connect") {
      await commands.executeCommand(
        "kdb.connections.connect.via.dialog",
        connLabel,
      );
    }
  });
}

export function getInsightsAlias(insightsList: InsightDetails[]): void {
  insightsList.forEach((x) => {
    ext.kdbConnectionAliasList.push(x.alias);
  });
}

export function getServerIconState(connLabel: string): string {
  if (ext.activeConnection?.connLabel === connLabel) {
    return "-active";
  } else if (
    ext.connectedConnectionList?.some((conn) => conn.connLabel === connLabel)
  ) {
    return "-connected";
  }
  return "";
}

export function getWorkspaceIconsState(connLabel: string): string {
  if (
    ext.connectedConnectionList?.some((conn) => conn.connLabel === connLabel)
  ) {
    return "-active";
  }
  return "";
}

export function getStatus(label: string): string {
  if (ext.activeConnection?.connLabel === label) {
    return "- active";
  } else if (
    ext.connectedConnectionList?.some((conn) => conn.connLabel === label)
  ) {
    return "- connected";
  }
  return "- disconnected";
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkLocalInstall(
  isExtensionStartCheck?: boolean,
): Promise<void> {
  const QHOME = workspace.getConfiguration().get<string>("kdb.qHomeDirectory");
  if (isExtensionStartCheck) {
    const notShow = workspace
      .getConfiguration()
      .get<boolean>("kdb.neverShowQInstallAgain");
    if (notShow) {
      return;
    }
  }
  if (QHOME || env.QHOME) {
    // TODO 1: This is wrong, env vars should be read only.
    env.QHOME = QHOME || env.QHOME;
    if (!pathExists(env.QHOME!)) {
      notify("QHOME path stored is empty.", MessageKind.ERROR, { logger });
    }
    await writeFile(
      join(__dirname, "qinstall.md"),
      `# q runtime installed location: \n### ${env.QHOME}`,
    );

    // persist the QHOME to global settings
    await workspace
      .getConfiguration()
      .update("kdb.qHomeDirectory", env.QHOME, ConfigurationTarget.Global);

    notify(`Installation of q found here: ${env.QHOME}`, MessageKind.DEBUG, {
      logger,
    });

    showRegistrationNotification();

    const hideNotification = await workspace
      .getConfiguration()
      .get<boolean>("kdb.hideInstallationNotification");
    if (!hideNotification) {
      notify(`Installation of q found here: ${env.QHOME}`, MessageKind.INFO, {
        logger,
      });
    }

    // persist the notification seen option
    await workspace
      .getConfiguration()
      .update(
        "kdb.hideInstallationNotification",
        true,
        ConfigurationTarget.Global,
      );

    return;
  }

  // set custom context that QHOME is not setup to control walkthrough visibility
  commands.executeCommand("setContext", "kdb.showInstallWalkthrough", true);

  notify(
    "Local q installation not found!",
    MessageKind.INFO,
    { logger },
    "Install new instance",
    "No",
    "Never show again",
  ).then(async (installResult) => {
    if (installResult === "Install new instance") {
      await installTools();
    } else if (installResult === "Never show again") {
      await workspace
        .getConfiguration()
        .update("kdb.neverShowQInstallAgain", true, ConfigurationTarget.Global);
    } else {
      showRegistrationNotification();
    }
  });
}

export async function convertBase64License(
  encodedLicense: string,
  tempDir: string = tmpdir(),
): Promise<Uri> {
  const decodedLicense = Buffer.from(encodedLicense, "base64");
  await writeFile(join(tempDir, "kc.lic"), decodedLicense);
  return Uri.parse(join(tmpdir(), "kc.lic"));
}

export function isTable(result: QueryResult): boolean {
  if (!result.result || !result.meta || result.meta.length === 0) {
    return false;
  }
  return true;
}

export function formatTable(headers_: any, rows_: any, opts: any) {
  if (!opts) {
    opts = {};
  }

  const data = new Array(rows_.length);
  for (let i = 0; i < rows_.lenth; ++i) {
    data[i] = typeof rows_[i] === "object" ? Object.values(rows_[i]) : rows_[i];
  }

  const hsep = opts.hsep === undefined ? " " : opts.hsep;
  const align = opts.align || [];
  const keys = opts.keys || [];
  const stringLength =
    opts.stringLength ||
    function (s: any) {
      return String(s).length;
    };

  const dotsizes = reduce(
    data,

    function (acc: any, row: any) {
      forEach(row, function (c: any, ix: any) {
        const [left, right] = dotoffsets(c);

        if (!acc[ix]) {
          acc[ix] = [left, right];
        } else {
          if (left > acc[ix][0]) {
            acc[ix][0] = left;
          }
          if (right > acc[ix][1]) {
            acc[ix][1] = right;
          }
        }
      });
      return acc;
    },
    [],
  );

  const rows = map(data, function (row: any) {
    return map(row, function (c_: any, ix: any) {
      const c = String(c_);
      if (align[ix] === ".") {
        const [left, right] = dotoffsets(c);
        const test = /\./.test(c);
        const [maxLeft, maxRight] = dotsizes[ix];
        const leftSize = maxLeft - left;
        const rightSize = (maxRight === 0 || test ? 0 : 1) + maxRight - right;
        return " ".repeat(leftSize) + c + " ".repeat(rightSize);
      } else {
        return c;
      }
    });
  });

  const sizes = reduce(
    rows,

    function (acc: any, row: any) {
      forEach(row, function (c: any, ix: any) {
        const n = stringLength(c);
        if (!acc[ix] || n > acc[ix]) {
          acc[ix] = n;
        }
      });
      return acc;
    },

    headers_.map((x: any) => x.length),
  );

  let result = map(rows, function (row: any) {
    return map(row, function (c: any, ix: any) {
      const n = sizes[ix] - stringLength(c) || 0;
      const s = Array(Math.max(n + 1, 1)).join(" ");
      if (align[ix] === "r" /* || align[ix] === '.'*/) {
        return s + c;
      }

      if (align[ix] === "c") {
        return (
          Array(Math.ceil(n / 2 + 1)).join(" ") +
          c +
          Array(Math.floor(n / 2 + 1)).join(" ")
        );
      }

      return c + s;
    }).join(hsep);
  });

  const headers = map(headers_, function (c: any, ix: any) {
    return c + " ".repeat(Math.max(0, sizes[ix] - c.length));
  });

  let columnSeparatorIndex = 0;
  for (let i = 0; i < keys.length; ++i) {
    columnSeparatorIndex += headers[i].length;
  }

  const header = headers.join(hsep);
  const separator = "-".repeat(header.length);

  result.unshift(separator);
  result.unshift(header);

  if (columnSeparatorIndex > 0) {
    const insertAt = (str: any, sub: any, pos: any) =>
      `${str.slice(0, pos)}${sub}${str.slice(pos)}`;

    result = result.map((x: any) => insertAt(x, "|", columnSeparatorIndex + 1));
  }

  return result.join("\n");
}

export function hasWorkspaceOrShowOption(action: string) {
  if (workspace.workspaceFolders && workspace.workspaceFolders.length > 0) {
    return true;
  }
  notify(
    `No workspace folder is open. Please open a folder to enable ${action}.`,
    MessageKind.WARNING,
    {},
    "Open",
  ).then((res) => {
    if (res === "Open") {
      commands.executeCommand("workbench.action.files.openFolder");
    }
  });
  return false;
}

function reduce(xs: any, f: any, init: any) {
  if (xs.reduce) {
    return xs.reduce(f, init);
  }

  let i = 0;
  const acc = arguments.length >= 3 ? init : xs[i++];
  for (; i < xs.length; i++) {
    f(acc, xs[i], i);
  }

  return acc;
}

function forEach(xs: any, f: any) {
  if (xs.forEach) {
    return xs.forEach(f);
  }

  for (let i = 0; i < xs.length; i++) {
    f.call(xs, xs[i], i);
  }
}

function dotoffsets(c: string) {
  const m = /\.[^.]*$/.exec(c);
  return m ? [m.index, c.length - m.length - 1] : [c.length, 0];
}

function map(xs: any, f: any) {
  if (xs.map) {
    return xs.map(f);
  }

  const res = [];
  for (let i = 0; i < xs.length; i++) {
    res.push(f.call(xs, xs[i], i));
  }
}

export function isBaseVersionGreaterOrEqual(
  baseVersion: number,
  targetVersion: number,
): boolean {
  return semver.gte(`${baseVersion}.0`, `${targetVersion}.0`);
}

export function getBasename(uri: Uri): string {
  return path.basename(uri.path);
}
