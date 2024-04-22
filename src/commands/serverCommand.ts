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

import axios, { AxiosRequestConfig } from "axios";
import { readFileSync } from "fs-extra";
import { jwtDecode } from "jwt-decode";
import { join } from "path";
import * as url from "url";
import { Position, ProgressLocation, Range, commands, window } from "vscode";
import { ext } from "../extensionVariables";
import { isCompressed, uncompress } from "../ipc/c";
import { GetDataObjectPayload } from "../models/data";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { InsightDetails, Insights } from "../models/insights";
import { JwtUser } from "../models/jwt_user";
import { MetaObject, MetaObjectPayload } from "../models/meta";
import { queryConstants } from "../models/queryResult";
import { ScratchpadResult } from "../models/scratchpadResult";
import { Server, ServerDetails, ServerType } from "../models/server";
import { ServerObject } from "../models/serverObject";
import { DataSourcesPanel } from "../panels/datasource";
import { getCurrentToken } from "../services/kdbInsights/codeFlowLogin";
import { InsightsNode, KdbNode } from "../services/kdbTreeProvider";
import {
  addLocalConnectionContexts,
  checkOpenSslInstalled,
  getHash,
  getInsights,
  getServerName,
  getServers,
  updateInsights,
  updateServers,
} from "../utils/core";
import { refreshDataSourcesPanel } from "../utils/dataSource";
import { decodeQUTF } from "../utils/decode";
import { ExecutionConsole } from "../utils/executionConsole";
import { openUrl } from "../utils/openUrl";
import {
  handleScratchpadTableRes,
  handleWSResults,
  checkIfIsDatasource,
  addQueryHistory,
} from "../utils/queryUtils";
import {
  validateServerAlias,
  validateServerName,
  validateServerPort,
  validateServerUsername,
} from "../validators/kdbValidator";
import { QueryHistory } from "../models/queryHistory";
import { runDataSource } from "./dataSourceCommand";
import { NewConnectionPannel } from "../panels/newConnection";
import { Telemetry } from "../utils/telemetryClient";
import { ConnectionManagementService } from "../services/connectionManagerService";
import { InsightsConnection } from "../classes/insightsConnection";

export async function addNewConnection(): Promise<void> {
  NewConnectionPannel.render(ext.context.extensionUri);
}

export async function addInsightsConnection(insightsData: InsightDetails) {
  const aliasValidation = validateServerAlias(insightsData.alias, false);
  if (aliasValidation) {
    window.showErrorMessage(aliasValidation);
    return;
  }
  if (insightsData.alias === undefined || insightsData.alias === "") {
    const host = new url.URL(insightsData.server!);
    insightsData.alias = host.host;
  }

  let insights: Insights | undefined = getInsights();
  if (insights != undefined && insights[getHash(insightsData.server!)]) {
    await window.showErrorMessage(
      `Insights instance named ${insightsData.alias} already exists.`,
    );
    return;
  } else {
    const key = getHash(insightsData.server!);
    if (insights === undefined) {
      insights = {
        key: {
          auth: true,
          alias: insightsData.alias,
          server: insightsData.server!,
        },
      };
    } else {
      insights[key] = {
        auth: true,
        alias: insightsData.alias,
        server: insightsData.server!,
      };
    }

    await updateInsights(insights);
    const newInsights = getInsights();
    if (newInsights != undefined) {
      ext.serverProvider.refreshInsights(newInsights);
      Telemetry.sendEvent("Connection.Created.Insights");
    }
    window.showInformationMessage(
      `Added Insights connection: ${insightsData.alias}`,
    );
    NewConnectionPannel.close();
  }
}

// Not possible to test secrets
/* istanbul ignore next */
export async function addAuthConnection(
  serverKey: string,
  username: string,
  password: string,
): Promise<void> {
  const validUsername = validateServerUsername(username);
  if (validUsername) {
    window.showErrorMessage(validUsername);
    return;
  }
  if (password === undefined || password === "") {
    window.showErrorMessage("Password cannot be empty");
    return;
  }
  if (password?.trim()?.length) {
    const servers: Server | undefined = getServers();
    // store secrets
    if (
      (username != undefined || username != "") &&
      (password != undefined || password != "") &&
      servers &&
      servers[serverKey]
    ) {
      servers[serverKey].auth = true;
      ext.secretSettings.storeAuthData(serverKey, `${username}:${password}`);
      await updateServers(servers);
      const newServers = getServers();
      if (newServers != undefined) {
        ext.serverProvider.refresh(newServers);
      }
    }
  }
}

export async function enableTLS(serverKey: string): Promise<void> {
  const servers: Server | undefined = getServers();

  // validate if TLS is possible
  if (ext.openSslVersion === null) {
    window
      .showErrorMessage(
        "OpenSSL not found, please ensure this is installed",
        "More Info",
        "Cancel",
      )
      .then(async (result) => {
        if (result === "More Info") {
          await openUrl("https://code.kx.com/q/kb/ssl/");
        }
      });
    return;
  }
  if (servers && servers[serverKey]) {
    servers[serverKey].tls = true;
    await updateServers(servers);
    const newServers = getServers();
    if (newServers != undefined) {
      ext.serverProvider.refresh(newServers);
    }
    return;
  }
  window.showErrorMessage(
    "Server not found, please ensure this is a correct server",
    "Cancel",
  );
}

export async function addKdbConnection(
  kdbData: ServerDetails,
  isLocal?: boolean,
): Promise<void> {
  const aliasValidation = validateServerAlias(kdbData.serverAlias, isLocal!);
  const hostnameValidation = validateServerName(kdbData.serverName);
  const portValidation = validateServerPort(kdbData.serverPort);
  if (aliasValidation) {
    window.showErrorMessage(aliasValidation);
    return;
  }
  if (hostnameValidation) {
    window.showErrorMessage(hostnameValidation);
    return;
  }
  if (portValidation) {
    window.showErrorMessage(portValidation);
    return;
  }
  let servers: Server | undefined = getServers();

  if (
    servers != undefined &&
    servers[getHash(`${kdbData.serverName}:${kdbData.serverPort}`)]
  ) {
    await window.showErrorMessage(
      `Server ${kdbData.serverName}:${kdbData.serverPort} already exists.`,
    );
  } else {
    const key =
      kdbData.serverAlias != undefined
        ? getHash(
            `${kdbData.serverName}${kdbData.serverPort}${kdbData.serverAlias}`,
          )
        : getHash(`${kdbData.serverName}${kdbData.serverPort}`);
    if (servers === undefined) {
      servers = {
        key: {
          auth: kdbData.auth,
          serverName: kdbData.serverName,
          serverPort: kdbData.serverPort,
          serverAlias: kdbData.serverAlias,
          managed: kdbData.serverAlias === "local" ? true : false,
          tls: kdbData.tls,
        },
      };
      if (servers[0].managed) {
        await addLocalConnectionContexts(getServerName(servers[0]));
      }
    } else {
      servers[key] = {
        auth: kdbData.auth,
        serverName: kdbData.serverName,
        serverPort: kdbData.serverPort,
        serverAlias: kdbData.serverAlias,
        managed: kdbData.serverAlias === "local" ? true : false,
        tls: kdbData.tls,
      };
      if (servers[key].managed) {
        await addLocalConnectionContexts(getServerName(servers[key]));
      }
    }

    await updateServers(servers);
    const newServers = getServers();
    if (newServers != undefined) {
      Telemetry.sendEvent("Connection.Created.QProcess");
      ext.serverProvider.refresh(newServers);
    }
    if (kdbData.auth) {
      addAuthConnection(key, kdbData.username!, kdbData.password!);
    }
    window.showInformationMessage(
      `Added kdb connection: ${kdbData.serverAlias}`,
    );
    NewConnectionPannel.close();
  }
}

export async function removeConnection(viewItem: KdbNode | InsightsNode) {
  const connMngService = new ConnectionManagementService();
  await connMngService.removeConnection(viewItem);
}

export async function connect(viewItem: KdbNode | InsightsNode): Promise<void> {
  const connMngService = new ConnectionManagementService();
  commands.executeCommand("kdb-results.focus");
  await commands.executeCommand("setContext", "kdb.insightsConnected", false);
  ExecutionConsole.start();
  // handle cleaning up existing connection
  if (ext.activeConnection !== undefined) {
    DataSourcesPanel.close();
  }

  const isKdbNode = viewItem instanceof KdbNode;
  if (isKdbNode) {
    // check for TLS support
    if (viewItem.details.tls) {
      if (!(await checkOpenSslInstalled())) {
        window
          .showInformationMessage(
            "TLS support requires OpenSSL to be installed.",
            "More Info",
            "Cancel",
          )
          .then(async (result) => {
            if (result === "More Info") {
              await openUrl("https://code.kx.com/q/kb/ssl/");
            }
          });
      }
    }
  }

  await connMngService.connect(viewItem.label);

  if (isKdbNode && viewItem.details.tls) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  }

  refreshDataSourcesPanel();
  ext.serverProvider.reload();
}

export function activeConnection(viewItem: KdbNode | InsightsNode): void {
  const connMngService = new ConnectionManagementService();
  connMngService.setActiveConnection(viewItem);
  refreshDataSourcesPanel();
  ext.serverProvider.reload();
}

export async function disconnect(connLabel?: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  connMngService.disconnect(connLabel ? connLabel : "");

  // commands.executeCommand("setContext", "kdb.insightsConnected", false);
  if (ext.connectedConnectionList.length === 0) {
    const queryConsole = ExecutionConsole.start();
    queryConsole.dispose();
    DataSourcesPanel.close();
    ext.serverProvider.reload();
  }
}

export async function executeQuery(
  query: string,
  context?: string,
  isPython?: boolean,
): Promise<void> {
  const connMngService = new ConnectionManagementService();
  const queryConsole = ExecutionConsole.start();
  if (ext.activeConnection === undefined && ext.connectionNode === undefined) {
    window.showInformationMessage(
      "Please connect to a KDB instance or Insights Instance to execute a query",
    );
    return undefined;
  }

  if (query.length === 0) {
    const isConnected = ext.activeConnection
      ? ext.activeConnection.connected
      : !!ext.activeConnection;
    queryConsole.appendQueryError(
      query,
      "Query is empty",
      isConnected,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
    );
    return undefined;
  }
  const startTime = Date.now();
  const results = await connMngService.executeQuery(query, context, isPython);
  const endTime = Date.now();
  const duration = (endTime - startTime).toString();

  // set context for root nodes
  if (ext.activeConnection instanceof InsightsConnection) {
    writeScratchpadResult(results, query, duration, isPython);
  } else {
    if (ext.resultsViewProvider.isVisible()) {
      writeQueryResultsToView(results, query, undefined, false, duration);
    } else {
      writeQueryResultsToConsole(results, query, undefined, false, duration);
    }
  }
}

export function getQueryContext(lineNum?: number): string {
  let context = ".";
  const editor = window.activeTextEditor;
  const fullText = typeof lineNum !== "number";

  if (editor) {
    const document = editor.document;
    let text;

    if (fullText) {
      text = editor.document.getText();
    } else {
      const line = document.lineAt(lineNum);
      text = editor.document.getText(
        new Range(
          new Position(0, 0),
          new Position(lineNum, line.range.end.character),
        ),
      );
    }

    // matches '\d .foo' or 'system "d .foo"'
    const pattern = /^(system\s*"d|\\d)\s+([^\s"]+)/gm;

    const matches = [...text.matchAll(pattern)];
    if (matches.length) {
      // fullText should use first defined context
      // a selection should use the last defined context
      context = fullText ? matches[0][2] : matches[matches.length - 1][2];
    }
  }

  return context;
}

export function getConextForRerunQuery(query: string): string {
  let context = ".";
  // matches '\d .foo' or 'system "d .foo"'
  const pattern = /^(system\s*"d|\\d)\s+([^\s"]+)/gm;
  const matches = [...query.matchAll(pattern)];
  if (matches.length) {
    // fullText should use first defined context
    // a selection should use the last defined context
    context = query ? matches[0][2] : matches[matches.length - 1][2];
  }
  return context;
}

export function runQuery(type: ExecutionTypes, rerunQuery?: string) {
  const editor = window.activeTextEditor;
  if (!editor) {
    return false;
  }
  let context;
  let query;
  let isPython = false;
  const insightsNode = ext.kdbinsightsNodes.find((n) =>
    ext.connectionNode instanceof InsightsNode
      ? n === ext.connectionNode?.details.alias + " (connected)"
      : false,
  );
  switch (type) {
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection:
      const selection = editor.selection;
      query = selection.isEmpty
        ? editor.document.lineAt(selection.active.line).text
        : editor.document.getText(selection);
      context = getQueryContext(selection.end.line);
      if (type === ExecutionTypes.PythonQuerySelection && insightsNode) {
        isPython = true;
      }
      break;

    case ExecutionTypes.QueryFile:
    case ExecutionTypes.ReRunQuery:
    case ExecutionTypes.PythonQueryFile:
    default:
      query = rerunQuery || editor.document.getText();
      context = getQueryContext();

      if (type === ExecutionTypes.PythonQueryFile && insightsNode) {
        isPython = true;
      }
      break;
  }
  executeQuery(query, context, isPython);
}

export function rerunQuery(rerunQueryElement: QueryHistory) {
  if (
    !rerunQueryElement.isDatasource &&
    typeof rerunQueryElement.query === "string"
  ) {
    const context = getConextForRerunQuery(rerunQueryElement.query);
    executeQuery(
      rerunQueryElement.query,
      context,
      rerunQueryElement.language !== "q",
    );
  } else {
    const dsFile = rerunQueryElement.query as DataSourceFiles;
    runDataSource(dsFile);
  }
}

export async function loadServerObjects(): Promise<ServerObject[]> {
  // check for valid connection
  if (
    ext.activeConnection === undefined ||
    ext.activeConnection.connected === false ||
    ext.activeConnection instanceof InsightsConnection
  ) {
    window.showInformationMessage(
      "Please connect to a KDB instance to view the objects",
    );
    return new Array<ServerObject>();
  }

  const script = readFileSync(
    ext.context.asAbsolutePath(join("resources", "list_mem.q")),
  ).toString();
  const cc = "\n" + script + "(::)";
  const result = await ext.activeConnection?.executeQueryRaw(cc);
  if (result !== undefined) {
    const result2: ServerObject[] = (0, eval)(result); // eval(result);
    const result3: ServerObject[] = result2.filter((item) => {
      return ext.qNamespaceFilters.indexOf(item.name) === -1;
    });
    return result3;
  } else {
    return new Array<ServerObject>();
  }
}

export function writeQueryResultsToConsole(
  result: string | string[],
  query: string,
  dataSourceType?: string,
  isPython?: boolean,
  duration?: string,
): void {
  const queryConsole = ExecutionConsole.start();
  const res = Array.isArray(result)
    ? decodeQUTF(result[0])
    : decodeQUTF(result);
  if (
    (ext.activeConnection || ext.connectionNode) &&
    !res.startsWith(queryConstants.error)
  ) {
    queryConsole.append(
      res,
      query,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
      dataSourceType,
      isPython,
      duration,
    );
  } else {
    if (!checkIfIsDatasource(dataSourceType)) {
      queryConsole.appendQueryError(
        query,
        res.substring(queryConstants.error.length),
        !!ext.activeConnection,
        ext.connectionNode?.label ? ext.connectionNode.label : "",
        isPython,
        undefined,
        duration,
      );
    }
  }
}

export function writeQueryResultsToView(
  result: any,
  query: string,
  dataSourceType?: string,
  isPython?: boolean,
  duration?: string,
): void {
  commands.executeCommand("kdb.resultsPanel.update", result, dataSourceType);
  const connectionType: ServerType =
    ext.connectionNode instanceof KdbNode
      ? ServerType.KDB
      : ServerType.INSIGHTS;
  if (!checkIfIsDatasource(dataSourceType)) {
    addQueryHistory(
      query,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
      connectionType,
      true,
      isPython,
      undefined,
      undefined,
      duration,
    );
  }
}

export function writeScratchpadResult(
  result: ScratchpadResult,
  query: string,
  duration: string,
  isPython?: boolean,
): void {
  const queryConsole = ExecutionConsole.start();

  if (result.error) {
    queryConsole.appendQueryError(
      query,
      result.errorMsg,
      true,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
    );
  } else {
    if (ext.resultsViewProvider.isVisible()) {
      writeQueryResultsToView(
        result.data,
        query,
        "SCRATCHPAD",
        isPython,
        duration,
      );
    } else {
      writeQueryResultsToConsole(
        result.data,
        query,
        undefined,
        isPython,
        duration,
      );
    }
  }
}
