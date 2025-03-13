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
  CancellationToken,
  Position,
  ProgressLocation,
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
import { queryConstants } from "../models/queryResult";
import { ScratchpadResult } from "../models/scratchpadResult";
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
  offerReconnectionAfterEdit,
  updateInsights,
  updateServers,
} from "../utils/core";
import { refreshDataSourcesPanel } from "../utils/dataSource";
import { decodeQUTF } from "../utils/decode";
import { ExecutionConsole } from "../utils/executionConsole";
import { openUrl } from "../utils/openUrl";
import {
  checkIfIsDatasource,
  addQueryHistory,
  formatScratchpadStacktrace,
  resultToBase64,
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
import { MetaContentProvider } from "../services/metaContentProvider";
import { handleLabelsConnMap, removeConnFromLabels } from "../utils/connLabel";
import {
  ExportedConnections,
  InsightDetails,
  Insights,
  Server,
  ServerDetails,
  ServerType,
} from "../models/connectionsModels";
import * as fs from "fs";
import { ChartEditorProvider } from "../services/chartEditorProvider";
import {
  addWorkspaceFile,
  openWith,
  setUriContent,
  workspaceHas,
} from "../utils/workspace";
import { Plot } from "../models/plot";

export async function addNewConnection(): Promise<void> {
  NewConnectionPannel.close();
  NewConnectionPannel.render(ext.context.extensionUri);
}

export async function editConnection(viewItem: KdbNode | InsightsNode) {
  NewConnectionPannel.close();
  NewConnectionPannel.render(ext.context.extensionUri, viewItem);
}

export function isConnected(connLabel: string): boolean {
  const connMngService = new ConnectionManagementService();
  return connMngService.isConnected(connLabel);
}

export async function addInsightsConnection(
  insightsData: InsightDetails,
  labels?: string[],
) {
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
      ext.latestLblsChanged.length = 0;
      if (labels && labels.length > 0) {
        ext.latestLblsChanged.push(...labels);
        await handleLabelsConnMap(labels, insightsData.alias);
      }
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
  labels?: string[],
) {
  const aliasValidation =
    oldAlias === insightsData.alias
      ? undefined
      : validateServerAlias(insightsData.alias, false);
  if (aliasValidation) {
    window.showErrorMessage(aliasValidation);
    return;
  }
  const isConnectedConn = isConnected(oldAlias);
  await disconnect(oldAlias);
  if (insightsData.alias === undefined || insightsData.alias === "") {
    const host = new url.URL(insightsData.server);
    insightsData.alias = host.host;
  }
  const insights: Insights | undefined = getInsights();
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
        removeConnFromLabels(oldAlias);
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
            server: insightsData.server,
            realm: insightsData.realm,
            insecure: insightsData.insecure,
          };

          await updateInsights(updatedInsights);
        } else {
          insights[oldKey] = {
            auth: true,
            alias: insightsData.alias,
            server: insightsData.server,
            realm: insightsData.realm,
            insecure: insightsData.insecure,
          };
          await updateInsights(insights);
        }

        const newInsights = getInsights();
        if (newInsights != undefined) {
          ext.latestLblsChanged.length = 0;
          if (labels && labels.length > 0) {
            ext.latestLblsChanged.push(...labels);
            await handleLabelsConnMap(labels, insightsData.alias);
          } else {
            removeConnFromLabels(insightsData.alias);
          }
          ext.serverProvider.refreshInsights(newInsights);
          Telemetry.sendEvent("Connection.Edited.Insights");
          if (isConnectedConn) {
            offerReconnectionAfterEdit(insightsData.alias);
          }
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

// Not possible to test secrets
/* istanbul ignore next */
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
  labels?: string[],
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
          managed: kdbData.serverAlias === "local",
          tls: kdbData.tls,
        },
      };
      if (servers.key.managed) {
        await addLocalConnectionContexts(getServerName(servers[0]));
      }
    } else {
      servers[key] = {
        auth: kdbData.auth,
        serverName: kdbData.serverName,
        serverPort: kdbData.serverPort,
        serverAlias: kdbData.serverAlias,
        managed: kdbData.serverAlias === "local",
        tls: kdbData.tls,
      };
      if (servers[key].managed) {
        await addLocalConnectionContexts(getServerName(servers[key]));
      }
    }

    await updateServers(servers);
    const newServers = getServers();
    if (newServers != undefined) {
      ext.latestLblsChanged.length = 0;
      if (labels && labels.length > 0) {
        ext.latestLblsChanged.push(...labels);
        await handleLabelsConnMap(labels, kdbData.serverAlias);
      }
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
  labels?: string[],
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
  const isConnectedConn = isConnected(oldAlias);
  await disconnect(oldAlias);
  const servers: Server | undefined = getServers();

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
        removeConnFromLabels(oldKey);
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
            managed: kdbData.serverAlias === "local",
            tls: kdbData.tls,
          };

          await updateServers(updatedServers);
        } else {
          servers[oldKey] = {
            auth: removedAuth ? false : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
            managed: kdbData.serverAlias === "local",
            tls: kdbData.tls,
          };

          await updateServers(servers);
        }
        const newServers = getServers();
        if (newServers != undefined) {
          ext.latestLblsChanged.length = 0;
          if (labels && labels.length > 0) {
            ext.latestLblsChanged.push(...labels);
            await handleLabelsConnMap(labels, kdbData.serverAlias);
          } else {
            removeConnFromLabels(kdbData.serverAlias);
          }
          ext.serverProvider.refresh(newServers);
          Telemetry.sendEvent("Connection.Edited.KDB");
          const connLabelToReconn = `${kdbData.serverName}:${kdbData.serverPort} [${kdbData.serverAlias}]`;
          if (isConnectedConn) {
            offerReconnectionAfterEdit(connLabelToReconn);
          }
        }
        window.showInformationMessage(
          `Edited KDB connection: ${kdbData.serverAlias}`,
        );
        if (oldKey !== newKey) {
          removeConnFromLabels(oldKey);
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

// test fs readFileSync unit tests are flaky, no correct way to test them
/* istanbul ignore next */
export async function importConnections() {
  const options = {
    canSelectMany: false,
    openLabel: "Select JSON File",
    filters: {
      "JSON Files": ["json"],
      "All Files": ["*"],
    },
  };

  const fileUri = await window.showOpenDialog(options);
  if (!fileUri || fileUri.length === 0) {
    kdbOutputLog("[IMPORT CONNECTION]No file selected", "ERROR");
    return;
  }
  const filePath = fileUri[0].fsPath;
  const fileContent = fs.readFileSync(filePath, "utf8");

  let importedConnections: ExportedConnections;
  try {
    importedConnections = JSON.parse(fileContent);
  } catch (e) {
    kdbOutputLog("[IMPORT CONNECTION]Invalid JSON format", "ERROR");
    return;
  }

  if (!isValidExportedConnections(importedConnections)) {
    kdbOutputLog(
      "[IMPORT CONNECTION]JSON does not match the required format",
      "ERROR",
    );
    return;
  }
  if (
    importedConnections.connections.KDB.length === 0 &&
    importedConnections.connections.Insights.length === 0
  ) {
    kdbOutputLog(
      "[IMPORT CONNECTION]There is no KDB or Insights connections to import in this JSON file",
      "ERROR",
    );
    return;
  }
  await addImportedConnections(importedConnections);
}

export async function addImportedConnections(
  importedConnections: ExportedConnections,
) {
  const connMangService = new ConnectionManagementService();
  const existingAliases = connMangService.retrieveListOfConnectionsNames();
  const localAlreadyExists = existingAliases.has("local");

  const hasDuplicates =
    importedConnections.connections.Insights.some((connection) =>
      existingAliases.has(
        connMangService.checkConnAlias(connection.alias, true),
      ),
    ) ||
    importedConnections.connections.KDB.some((connection) =>
      existingAliases.has(
        connMangService.checkConnAlias(
          connection.serverAlias,
          false,
          localAlreadyExists,
        ),
      ),
    );

  let res: "Duplicate" | "Overwrite" | "Cancel" | undefined = "Duplicate";
  if (hasDuplicates) {
    res = await window.showInformationMessage(
      "You are importing connections with the same name. Would you like to duplicate, overwrite or cancel the import?",
      "Duplicate",
      "Overwrite",
      "Cancel",
    );
    if (!res || res === "Cancel") {
      return;
    }
  }

  let counter = 1;
  const insights: InsightDetails[] = [];
  for (const connection of importedConnections.connections.Insights) {
    let alias = connMangService.checkConnAlias(connection.alias, true);

    if (res === "Overwrite") {
      insights.push(connection);
    } else {
      while (existingAliases.has(alias)) {
        alias = `${connection.alias}-${counter}`;
        counter++;
      }
      connection.alias = alias;
      await addInsightsConnection(connection);
    }
    existingAliases.add(alias);
    counter = 1;
  }

  const servers: ServerDetails[] = [];
  for (const connection of importedConnections.connections.KDB) {
    let alias = connMangService.checkConnAlias(
      connection.serverAlias,
      false,
      localAlreadyExists,
    );

    if (res === "Overwrite") {
      servers.push(connection);
    } else {
      while (existingAliases.has(alias)) {
        alias = `${connection.serverAlias}-${counter}`;
        counter++;
      }
      connection.serverAlias = alias;
      const isManaged = alias === "local";
      await addKdbConnection(connection, isManaged);
    }
    existingAliases.add(alias);
    counter = 1;
  }

  if (insights.length > 0) {
    const config = insights.reduce((config, connection) => {
      config[connection.alias] = connection;
      return config;
    }, getInsights() || {});
    await updateInsights(config);
    ext.serverProvider.refreshInsights(config);
  }

  if (servers.length > 0) {
    const config = servers.reduce((config, connection) => {
      config[connection.serverAlias] = connection;
      return config;
    }, getServers() || {});
    await updateServers(config);
    ext.serverProvider.refresh(config);
  }

  kdbOutputLog("[IMPORT CONNECTION]Connections imported successfully", "INFO");
  window.showInformationMessage("Connections imported successfully");
}

export async function removeConnection(viewItem: KdbNode | InsightsNode) {
  const connMngService = new ConnectionManagementService();
  removeConnFromLabels(
    viewItem instanceof KdbNode
      ? viewItem.details.serverAlias
      : viewItem.details.alias,
  );
  await connMngService.removeConnection(viewItem);
}

export async function connect(connLabel: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
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

export async function resetScratchpad(connName?: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  await connMngService.resetScratchpad(connName);
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
  isFromConnTree?: boolean,
): Promise<void> {
  await window.withProgress(
    {
      cancellable: true,
      location: ProgressLocation.Window,
      title: `Executing query (${executorName})`,
    },
    async (_progress, token) => {
      await _executeQuery(
        query,
        connLabel,
        executorName,
        context,
        isPython,
        isWorkbook,
        isFromConnTree,
        token,
      );
    },
  );
}

async function _executeQuery(
  query: string,
  connLabel: string,
  executorName: string,
  context: string,
  isPython: boolean,
  isWorkbook: boolean,
  isFromConnTree?: boolean,
  token?: CancellationToken,
): Promise<void> {
  const connMngService = new ConnectionManagementService();
  const queryConsole = ExecutionConsole.start();
  if (connLabel === "") {
    if (ext.activeConnection === undefined) {
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
  const connVersion = isInsights ? (selectedConn.insightsVersion ?? 0) : 0;
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
      undefined,
      isFromConnTree,
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

  /* istanbul ignore next */
  if (token?.isCancellationRequested) {
    return undefined;
  }

  // set context for root nodes
  if (selectedConn instanceof InsightsConnection) {
    await writeScratchpadResult(
      results,
      query,
      connLabel,
      executorName,
      isPython,
      isWorkbook,
      duration,
      connVersion,
    );
  } else {
    /* istanbul ignore next */
    if (ext.isResultsTabVisible) {
      const data = resultToBase64(results);
      if (data) {
        const active = ext.activeTextEditor;
        if (active) {
          const plot = <Plot>{
            charts: [{ data }],
          };
          const uri = await addWorkspaceFile(
            active.document.uri,
            "plot",
            ".plot",
          );
          if (!workspaceHas(uri)) {
            await workspace.openTextDocument(uri);
            await openWith(
              uri,
              ChartEditorProvider.viewType,
              ViewColumn.Beside,
            );
          }
          await setUriContent(uri, JSON.stringify(plot));
        }
      } else {
        await writeQueryResultsToView(
          results,
          query,
          connLabel,
          executorName,
          isInsights,
          isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
          isPython,
          duration,
          isFromConnTree,
          connVersion,
        );
      }
    } else {
      await writeQueryResultsToConsole(
        results,
        query,
        connLabel,
        executorName,
        isInsights,
        isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
        isPython,
        duration,
        isFromConnTree,
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
      !!rerunQueryElement.isFromConnTree,
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

export async function exportConnections(connLabel?: string) {
  const connMngService = new ConnectionManagementService();

  const exportAuth = await window.showQuickPick(["Yes", "No"], {
    placeHolder: "Do you want to export username and password?",
  });

  if (!exportAuth) {
    kdbOutputLog(
      "[EXPORT CONNECTIONS] Export operation was cancelled by the user",
      "INFO",
    );
    return;
  }

  const includeAuth = exportAuth === "Yes";
  if (includeAuth) {
    await connMngService.retrieveUserPass();
  }
  const doc = await connMngService.exportConnection(connLabel, includeAuth);
  if (doc && doc !== "") {
    const formattedDoc = JSON.stringify(JSON.parse(doc), null, 2);
    const uri = await window.showSaveDialog({
      saveLabel: "Save Exported Connections",
      filters: {
        "JSON Files": ["json"],
        "All Files": ["*"],
      },
    });
    if (uri) {
      fs.writeFile(uri.fsPath, formattedDoc, (err) => {
        if (err) {
          kdbOutputLog(
            `[EXPORT CONNECTIONS] Error saving file: ${err.message}`,
            "ERROR",
          );
          window.showErrorMessage(`Error saving file: ${err.message}`);
        } else {
          workspace.openTextDocument(uri).then((document) => {
            window.showTextDocument(document, { preview: false });
          });
        }
      });
    } else {
      kdbOutputLog(
        "[EXPORT CONNECTIONS] Save operation was cancelled by the user",
        "INFO",
      );
    }
  } else {
    kdbOutputLog(
      "[EXPORT CONNECTIONS] No connections found to be exported",
      "ERROR",
    );
  }
}

export async function writeQueryResultsToConsole(
  result: string | string[],
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
): Promise<void> {
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
      isFromConnTree,
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
        isFromConnTree,
      );
    }
  }
}

export async function writeQueryResultsToView(
  result: any,
  query: string,
  connLabel: string,
  executorName: string,
  isInsights: boolean,
  type?: string,
  isPython?: boolean,
  duration?: string,
  isFromConnTree?: boolean,
  connVersion?: number,
): Promise<void> {
  await commands.executeCommand(
    "kdb.resultsPanel.update",
    result,
    isInsights,
    connVersion,
    isPython,
  );
  let isSuccess = true;

  if (!checkIfIsDatasource(type)) {
    if (typeof result === "string") {
      const res = decodeQUTF(result);
      if (res.startsWith(queryConstants.error)) {
        isSuccess = false;
      }
    }
    addQueryHistory(
      query,
      executorName,
      connLabel,
      isInsights ? ServerType.INSIGHTS : ServerType.KDB,
      isSuccess,
      isPython,
      type === "WORKBOOK",
      undefined,
      undefined,
      duration,
      isFromConnTree,
    );
  }
}

export async function writeScratchpadResult(
  result: ScratchpadResult,
  query: string,
  connLabel: string,
  executorName: string,
  isPython: boolean,
  isWorkbook: boolean,
  duration: string,
  connVersion: number,
): Promise<void> {
  let errorMsg;

  if (result.error) {
    errorMsg = "Error: " + result.errorMsg;

    if (result.stacktrace) {
      errorMsg =
        errorMsg + "\n" + formatScratchpadStacktrace(result.stacktrace);
    }
  }

  if (ext.isResultsTabVisible) {
    await writeQueryResultsToView(
      errorMsg ?? result,
      query,
      connLabel,
      executorName,
      true,
      isWorkbook ? "WORKBOOK" : "SCRATCHPAD",
      isPython,
      duration,
      false,
      connVersion,
    );
  } else {
    await writeQueryResultsToConsole(
      errorMsg ?? result.data,
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

function isValidExportedConnections(data: any): data is ExportedConnections {
  return (
    data &&
    data.connections &&
    Array.isArray(data.connections.Insights) &&
    Array.isArray(data.connections.KDB)
  );
}
