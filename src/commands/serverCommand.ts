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

import { readFileSync } from "fs-extra";
import { join } from "path";
import * as url from "url";
import {
  Position,
  Range,
  Uri,
  ViewColumn,
  commands,
  window,
  workspace,
} from "vscode";
import { ext } from "../extensionVariables";
import { DataSourceFiles } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { InsightDetails, Insights } from "../models/insights";
import { queryConstants } from "../models/queryResult";
import { ScratchpadResult } from "../models/scratchpadResult";
import { Server, ServerDetails, ServerType } from "../models/server";
import { ServerObject } from "../models/serverObject";
import { DataSourcesPanel } from "../panels/datasource";
import {
  InsightsMetaNode,
  InsightsNode,
  KdbNode,
  MetaObjectPayloadNode,
} from "../services/kdbTreeProvider";
import {
  addLocalConnectionContexts,
  checkOpenSslInstalled,
  getInsights,
  getKeyForServerName,
  getServerName,
  getServers,
  kdbOutputLog,
  updateInsights,
  updateServers,
} from "../utils/core";
import { refreshDataSourcesPanel } from "../utils/dataSource";
import { decodeQUTF } from "../utils/decode";
import { ExecutionConsole } from "../utils/executionConsole";
import { openUrl } from "../utils/openUrl";
import { checkIfIsDatasource, addQueryHistory } from "../utils/queryUtils";
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
import { MetaContentProvider } from "../services/metaContentProvider";

export async function addNewConnection(): Promise<void> {
  NewConnectionPannel.close();
  NewConnectionPannel.render(ext.context.extensionUri);
}

export async function editConnection(viewItem: KdbNode | InsightsNode) {
  NewConnectionPannel.close();
  NewConnectionPannel.render(ext.context.extensionUri, viewItem);
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
  if (
    insights != undefined &&
    insights[getKeyForServerName(insightsData.alias)]
  ) {
    await window.showErrorMessage(
      `Insights instance named ${insightsData.alias} already exists.`,
    );
    return;
  } else {
    const key = insightsData.alias;
    let server = insightsData.server || "";
    if (!/^https?:\/\//i.exec(server)) {
      server = "https://" + server;
    }
    if (insights === undefined) {
      insights = {
        key: {
          auth: true,
          alias: insightsData.alias,
          server,
          realm: insightsData.realm,
          insecure: insightsData.insecure,
        },
      };
    } else {
      insights[key] = {
        auth: true,
        alias: insightsData.alias,
        server,
        realm: insightsData.realm,
        insecure: insightsData.insecure,
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

/* istanbul ignore next */
export async function editInsightsConnection(
  insightsData: InsightDetails,
  oldAlias: string,
) {
  const aliasValidation =
    oldAlias === insightsData.alias
      ? undefined
      : validateServerAlias(insightsData.alias, false);
  if (aliasValidation) {
    window.showErrorMessage(aliasValidation);
    return;
  }
  await disconnect(oldAlias);
  if (insightsData.alias === undefined || insightsData.alias === "") {
    const host = new url.URL(insightsData.server!);
    insightsData.alias = host.host;
  }
  let insights: Insights | undefined = getInsights();
  if (insights) {
    const oldInsights = insights[getKeyForServerName(oldAlias)];
    const newAliasExists =
      oldAlias !== insightsData.alias
        ? insights[getKeyForServerName(insightsData.alias)]
        : undefined;
    if (newAliasExists) {
      await window.showErrorMessage(
        `Insights instance named ${insightsData.alias} already exists.`,
      );
      return;
    } else {
      if (!oldInsights) {
        await window.showErrorMessage(
          `Insights instance named ${oldAlias} does not exist.`,
        );
        return;
      } else {
        const oldKey = getKeyForServerName(oldAlias);
        const newKey = insightsData.alias;
        if (insights[oldKey] && oldAlias !== insightsData.alias) {
          const uInsights = Object.keys(insights).filter((insight) => {
            return insight !== oldKey;
          });
          const updatedInsights: Insights = {};
          uInsights.forEach((insight) => {
            updatedInsights[insight] = insights[insight];
          });

          updatedInsights[newKey] = {
            auth: true,
            alias: insightsData.alias,
            server: insightsData.server!,
            realm: insightsData.realm,
          };

          await updateInsights(updatedInsights);
        } else {
          insights[oldKey] = {
            auth: true,
            alias: insightsData.alias,
            server: insightsData.server!,
            realm: insightsData.realm,
          };
          await updateInsights(insights);
        }

        const newInsights = getInsights();
        if (newInsights != undefined) {
          ext.serverProvider.refreshInsights(newInsights);
          Telemetry.sendEvent("Connection.Edited.Insights");
        }
        window.showInformationMessage(
          `Edited Insights connection: ${insightsData.alias}`,
        );
        NewConnectionPannel.close();
      }
    }
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

function removeAuthConnection(serverKey: string) {
  if (ext.secretSettings.storeAuthData.hasOwnProperty(serverKey)) {
    delete (ext.secretSettings.storeAuthData as { [key: string]: any })[
      serverKey
    ];
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
    servers[getKeyForServerName(kdbData.serverAlias || "")]
  ) {
    await window.showErrorMessage(
      `Server name ${kdbData.serverAlias} already exists.`,
    );
  } else {
    const key = kdbData.serverAlias || "";
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

/* istanbul ignore next */
export async function editKdbConnection(
  kdbData: ServerDetails,
  oldAlias: string,
  isLocal?: boolean,
  editAuth?: boolean,
) {
  const aliasValidation =
    oldAlias === kdbData.serverAlias
      ? undefined
      : validateServerAlias(kdbData.serverAlias, isLocal!);
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
  await disconnect(oldAlias);
  let servers: Server | undefined = getServers();

  if (servers) {
    const oldServer = servers[getKeyForServerName(oldAlias)];
    const newAliasExists =
      oldAlias !== kdbData.serverAlias
        ? servers[getKeyForServerName(kdbData.serverAlias)]
        : undefined;
    if (newAliasExists) {
      await window.showErrorMessage(
        `KDB instance named ${kdbData.serverAlias} already exists.`,
      );
      return;
    } else {
      if (!oldServer) {
        await window.showErrorMessage(
          `KDB instance named ${oldAlias} does not exist.`,
        );
        return;
      } else {
        const oldKey = getKeyForServerName(oldAlias);
        const newKey = kdbData.serverAlias;
        const removedAuth =
          editAuth && (kdbData.username === "" || kdbData.password === "");
        if (servers[oldKey] && oldAlias !== kdbData.serverAlias) {
          const uServers = Object.keys(servers).filter((server) => {
            return server !== oldKey;
          });
          const updatedServers: Server = {};
          uServers.forEach((server) => {
            updatedServers[server] = servers[server];
          });

          updatedServers[newKey] = {
            auth: removedAuth ? false : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
            managed: kdbData.serverAlias === "local" ? true : false,
            tls: kdbData.tls,
          };

          await updateServers(updatedServers);
        } else {
          servers[oldKey] = {
            auth: removedAuth ? false : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
            managed: kdbData.serverAlias === "local" ? true : false,
            tls: kdbData.tls,
          };

          await updateServers(servers);
        }
        const newServers = getServers();
        if (newServers != undefined) {
          ext.serverProvider.refresh(newServers);
          Telemetry.sendEvent("Connection.Edited.KDB");
        }
        window.showInformationMessage(
          `Edited KDB connection: ${kdbData.serverAlias}`,
        );
        if (oldKey !== newKey) {
          removeAuthConnection(oldKey);
          if (kdbData.auth) {
            addAuthConnection(newKey, kdbData.username!, kdbData.password!);
          }
        } else {
          if (editAuth && !removedAuth) {
            addAuthConnection(newKey, kdbData.username!, kdbData.password!);
          }
          if (editAuth && removedAuth) {
            removeAuthConnection(newKey);
          }
        }

        NewConnectionPannel.close();
      }
    }
  }
}

export async function removeConnection(viewItem: KdbNode | InsightsNode) {
  const connMngService = new ConnectionManagementService();
  await connMngService.removeConnection(viewItem);
}

export async function connect(connLabel: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  commands.executeCommand("kdb-results.focus");
  ExecutionConsole.start();
  const viewItem = connMngService.retrieveConnection(connLabel);
  if (viewItem === undefined) {
    window.showErrorMessage("Connection not found");
    return;
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

export async function resetScratchPad(): Promise<void> {
  const connMngService = new ConnectionManagementService();
  await connMngService.resetScratchpad();
}

export async function refreshGetMeta(connLabel?: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  if (connLabel) {
    await connMngService.refreshGetMeta(connLabel);
  } else {
    await connMngService.refreshAllGetMetas();
  }
}

export async function disconnect(connLabel: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  connMngService.disconnect(connLabel);

  if (ext.connectedConnectionList.length === 0) {
    const queryConsole = ExecutionConsole.start();
    queryConsole.dispose();
    DataSourcesPanel.close();
    ext.serverProvider.reload();
  }
}

export async function executeQuery(
  query: string,
  connLabel: string,
  executorName: string,
  context: string,
  isPython: boolean,
  isWorkbook: boolean,
): Promise<void> {
  const connMngService = new ConnectionManagementService();
  const queryConsole = ExecutionConsole.start();
  if (connLabel === "") {
    if (ext.activeConnection === undefined) {
      window.showErrorMessage(
        "No active connection found. Connect to one connection.",
      );
      kdbOutputLog(
        "No active connection found. Connect to one connection.",
        "ERROR",
      );
      return undefined;
    } else {
      connLabel = ext.activeConnection.connLabel;
    }
  }
  const isConnected = connMngService.isConnected(connLabel);
  if (!isConnected) {
    window.showInformationMessage("The selected connection is not connected.");
    kdbOutputLog("The selected connection is not connected.", "ERROR");
    return undefined;
  }

  const selectedConn = connMngService.retrieveConnectedConnection(connLabel);
  const isInsights = selectedConn instanceof InsightsConnection;
  if (query.length === 0) {
    queryConsole.appendQueryError(
      query,
      "Query is empty",
      connLabel,
      executorName,
      isConnected,
      isInsights,
      isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
      isPython,
      false,
    );
    return undefined;
  }
  const isStringfy = !ext.isResultsTabVisible;
  const startTime = Date.now();
  const results = await connMngService.executeQuery(
    query,
    connLabel,
    context,
    isStringfy,
    isPython,
  );
  const endTime = Date.now();
  const duration = (endTime - startTime).toString();

  // set context for root nodes
  if (selectedConn instanceof InsightsConnection) {
    writeScratchpadResult(
      results,
      query,
      connLabel,
      executorName,
      isPython,
      isWorkbook,
      duration,
    );
  } else {
    /* istanbul ignore next */
    if (ext.isResultsTabVisible) {
      writeQueryResultsToView(
        results,
        query,
        connLabel,
        executorName,
        isInsights,
        isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
        isPython,
        duration,
      );
    } else {
      writeQueryResultsToConsole(
        results,
        query,
        connLabel,
        executorName,
        isInsights,
        isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
        isPython,
        duration,
      );
    }
  }
}

export function getQueryContext(lineNum?: number): string {
  let context = ".";
  const editor = ext.activeTextEditor;
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

export function runQuery(
  type: ExecutionTypes,
  connLabel: string,
  executorName: string,
  isWorkbook: boolean,
  rerunQuery?: string,
) {
  const editor = ext.activeTextEditor;
  if (!editor) {
    return false;
  }
  let context;
  let query;
  let isPython = false;
  switch (type) {
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection:
      const selection = editor.selection;
      query = selection.isEmpty
        ? editor.document.lineAt(selection.active.line).text
        : editor.document.getText(selection);
      context = getQueryContext(selection.end.line);
      if (type === ExecutionTypes.PythonQuerySelection) {
        isPython = true;
      }
      break;

    case ExecutionTypes.QueryFile:
    case ExecutionTypes.ReRunQuery:
    case ExecutionTypes.PythonQueryFile:
    default:
      query = rerunQuery || editor.document.getText();
      context = getQueryContext();

      if (type === ExecutionTypes.PythonQueryFile) {
        isPython = true;
      }
      break;
  }
  executeQuery(query, connLabel, executorName, context, isPython, isWorkbook);
}

export function rerunQuery(rerunQueryElement: QueryHistory) {
  if (
    !rerunQueryElement.isDatasource &&
    typeof rerunQueryElement.query === "string"
  ) {
    const context = getConextForRerunQuery(rerunQueryElement.query);
    executeQuery(
      rerunQueryElement.query,
      rerunQueryElement.connectionName,
      rerunQueryElement.executorName,
      context,
      rerunQueryElement.language !== "q",
      !!rerunQueryElement.isWorkbook,
    );
  } else {
    const dsFile = rerunQueryElement.query as DataSourceFiles;
    runDataSource(
      dsFile,
      rerunQueryElement.connectionName,
      rerunQueryElement.executorName,
    );
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

export async function openMeta(node: MetaObjectPayloadNode | InsightsMetaNode) {
  const metaContentProvider = new MetaContentProvider();
  workspace.registerTextDocumentContentProvider("meta", metaContentProvider);
  const connMngService = new ConnectionManagementService();
  const doc = connMngService.retrieveMetaContent(node.connLabel, node.label);
  if (doc && doc !== "") {
    const formattedDoc = JSON.stringify(JSON.parse(doc), null, 2);
    const uri = Uri.parse(`meta:${node.connLabel} - ${node.label}.json`);
    metaContentProvider.update(uri, formattedDoc);
    const document = await workspace.openTextDocument(uri);
    await window.showTextDocument(document, {
      preview: false,
      viewColumn: ViewColumn.One,
    });
  } else {
    kdbOutputLog("[META] Meta content not found", "ERROR");
  }
}

export function writeQueryResultsToConsole(
  result: string | string[],
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
): void {
  const queryConsole = ExecutionConsole.start();
  const isNonEmptyArray = Array.isArray(result) && result.length > 0;
  const valueToDecode = isNonEmptyArray ? result[0] : result.toString();
  const res = decodeQUTF(valueToDecode);
  if (!res.startsWith(queryConstants.error)) {
    queryConsole.append(
      res,
      query,
      executorName,
      connLabel,
      isInsights,
      type,
      isPython,
      duration,
    );
  } else {
    if (!checkIfIsDatasource(type)) {
      queryConsole.appendQueryError(
        query,
        res.substring(queryConstants.error.length),
        connLabel,
        executorName,
        true,
        isInsights,
        type,
        isPython,
        false,
        duration,
      );
    }
  }
}

export function writeQueryResultsToView(
  result: any,
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
): void {
  commands.executeCommand("kdb.resultsPanel.update", result, isInsights, type);
  if (!checkIfIsDatasource(type)) {
    addQueryHistory(
      query,
      executorName,
      connLabel,
      isInsights ? ServerType.INSIGHTS : ServerType.KDB,
      true,
      isPython,
      type === "WORKBOOK",
      undefined,
      undefined,
      duration,
    );
  }
}

export function writeScratchpadResult(
  result: ScratchpadResult,
  query: string,
  connLabel: string,
  executorName: string,
  isPython: boolean,
  isWorkbook: boolean,
  duration: string,
): void {
  const queryConsole = ExecutionConsole.start();

  if (result.error) {
    queryConsole.appendQueryError(
      query,
      result.errorMsg,
      connLabel,
      executorName,
      true,
      true,
      isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
      isPython,
      false,
      duration,
    );
  } else {
    if (ext.isResultsTabVisible) {
      writeQueryResultsToView(
        result.data,
        query,
        connLabel,
        executorName,
        true,
        isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
        isPython,
        duration,
      );
    } else {
      writeQueryResultsToConsole(
        result.data,
        query,
        connLabel,
        executorName,
        true,
        isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
        isPython,
        duration,
      );
    }
  }
}
