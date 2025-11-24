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

import * as fs from "fs";
import * as url from "url";
import {
  CancellationToken,
  Position,
  Range,
  Uri,
  ViewColumn,
  commands,
  window,
  workspace,
  env,
  ProgressLocation,
} from "vscode";

import { ext } from "../extensionVariables";
import {
  getPartialDatasourceFile,
  populateScratchpad,
  runDataSource,
} from "./dataSourceCommand";
import { InsightsConnection } from "../classes/insightsConnection";
import {
  ExportedConnections,
  InsightDetails,
  Insights,
  Server,
  ServerDetails,
  ServerType,
} from "../models/connectionsModels";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { Plot } from "../models/plot";
import { QueryHistory } from "../models/queryHistory";
import { queryConstants } from "../models/queryResult";
import { ScratchpadResult } from "../models/scratchpadResult";
import { DataSourcesPanel } from "../panels/datasource";
import { NewConnectionPannel } from "../panels/newConnection";
import { ChartEditorProvider } from "../services/chartEditorProvider";
import { ConnectionManagementService } from "../services/connectionManagerService";
import {
  InsightsMetaNode,
  InsightsNode,
  KdbNode,
  MetaObjectPayloadNode,
} from "../services/kdbTreeProvider";
import { MetaContentProvider } from "../services/metaContentProvider";
import { inputVariable } from "../services/notebookProviders";
import { handleLabelsConnMap, removeConnFromLabels } from "../utils/connLabel";
import {
  checkOpenSslInstalled,
  getInsights,
  getKeyForServerName,
  getServers,
  offerReconnectionAfterEdit,
  updateInsights,
  updateServers,
} from "../utils/core";
import { refreshDataSourcesPanel } from "../utils/dataSource";
import { decodeQUTF } from "../utils/decode";
import { ExecutionConsole } from "../utils/executionConsole";
import { MessageKind, Runner, notify } from "../utils/notifications";
import {
  checkIfIsDatasource,
  addQueryHistory,
  formatScratchpadStacktrace,
  resultToBase64,
  needsScratchpad,
} from "../utils/queryUtils";
import { openUrl } from "../utils/uriUtils";
import {
  addWorkspaceFile,
  openWith,
  setUriContent,
  workspaceHas,
} from "../utils/workspace";
import {
  validateServerAlias,
  validateServerName,
  validateServerPort,
  validateServerUsername,
} from "../validators/kdbValidator";

const logger = "serverCommand";

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
  const aliasValidation = validateServerAlias(insightsData.alias);
  if (aliasValidation) {
    notify(aliasValidation, MessageKind.ERROR, { logger });
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
    notify(
      `Insights instance named ${insightsData.alias} already exists.`,
      MessageKind.ERROR,
      { logger },
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
      notify("Created Insights connection.", MessageKind.DEBUG, {
        logger,
        telemetry: "Connection.Created.Insights",
      });
    }

    notify(
      `Added Insights connection: ${insightsData.alias}`,
      MessageKind.INFO,
      { logger },
    );

    NewConnectionPannel.close();
  }
}

export async function editInsightsConnection(
  insightsData: InsightDetails,
  oldAlias: string,
  labels?: string[],
) {
  /* c8 ignore start */
  const aliasValidation =
    oldAlias === insightsData.alias
      ? undefined
      : validateServerAlias(insightsData.alias);
  if (aliasValidation) {
    notify(aliasValidation, MessageKind.ERROR, { logger });
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
      notify(
        `Insights instance named ${insightsData.alias} already exists.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
    } else {
      if (!oldInsights) {
        notify(
          `Insights instance named ${oldAlias} does not exist.`,
          MessageKind.ERROR,
          { logger },
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
          notify("Edited Insights connection.", MessageKind.DEBUG, {
            logger,
            telemetry: "Connection.Edited.Insights",
          });
          if (isConnectedConn) {
            offerReconnectionAfterEdit(insightsData.alias);
          }
        }

        notify(
          `Edited Insights connection: ${insightsData.alias}`,
          MessageKind.INFO,
          { logger },
        );

        NewConnectionPannel.close();
      }
    }
  }
  /* c8 ignore stop */
}

export async function addAuthConnection(
  serverKey: string,
  username: string,
  password: string,
): Promise<void> {
  /* c8 ignore start */
  const validUsername = validateServerUsername(username);
  if (validUsername) {
    notify(validUsername, MessageKind.ERROR, { logger });
    return;
  }
  if (password?.trim()?.length) {
    const servers: Server | undefined = getServers();
    // store secrets
    if (
      (username != undefined || username != "") &&
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
  /* c8 ignore stop */
}

function removeAuthConnection(serverKey: string) {
  /* c8 ignore start */
  if (
    Object.prototype.hasOwnProperty.call(
      ext.secretSettings.storeAuthData,
      serverKey,
    )
  ) {
    delete (ext.secretSettings.storeAuthData as { [key: string]: any })[
      serverKey
    ];
  }
  /* c8 ignore stop */
}

export function updateAuthDataKey(oldServerKey: string, newServerKey: string) {
  /* c8 ignore start */
  const storeAuthData = ext.secretSettings.storeAuthData as {
    [key: string]: any;
  };

  if (Object.prototype.hasOwnProperty.call(storeAuthData, newServerKey)) {
    notify(
      `Auth data already exists for key: ${newServerKey}`,
      MessageKind.ERROR,
      { logger },
    );
    return;
  }

  storeAuthData[newServerKey] = storeAuthData[oldServerKey];
  delete storeAuthData[oldServerKey];

  return;
  /* c8 ignore stop */
}

export function handleEditAuthData(
  oldServerKey: string,
  newServerKey: string,
  editAuth: boolean,
  isAuth?: boolean,
  username?: string,
  password?: string,
) {
  /* c8 ignore start */
  if (editAuth) {
    removeAuthConnection(oldServerKey);
    if (isAuth && username !== "" && password !== "") {
      addAuthConnection(newServerKey, username!, password!);
      return;
    }
  } else if (oldServerKey !== newServerKey) {
    updateAuthDataKey(oldServerKey, newServerKey);
  }
  /* c8 ignore stop */
}

export async function enableTLS(serverKey: string): Promise<void> {
  const servers: Server | undefined = getServers();

  // validate if TLS is possible
  if (ext.openSslVersion === null) {
    notify(
      "OpenSSL not found, please ensure this is installed",
      MessageKind.ERROR,
      { logger },
      "More Info",
      "Cancel",
    ).then(async (result) => {
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
  notify(
    "Server not found, please ensure this is a correct server",
    MessageKind.ERROR,
    { logger },
    "Cancel",
  );
}

export async function addKdbConnection(
  kdbData: ServerDetails,
  labels?: string[],
): Promise<void> {
  const aliasValidation = validateServerAlias(kdbData.serverAlias);
  const hostnameValidation = validateServerName(kdbData.serverName);
  const portValidation = validateServerPort(kdbData.serverPort);
  if (aliasValidation) {
    notify(aliasValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (hostnameValidation) {
    notify(hostnameValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (portValidation) {
    notify(portValidation, MessageKind.ERROR, { logger });
    return;
  }
  let servers: Server | undefined = getServers();

  if (
    servers != undefined &&
    servers[getKeyForServerName(kdbData.serverAlias || "")]
  ) {
    notify(
      `Server name ${kdbData.serverAlias} already exists.`,
      MessageKind.ERROR,
      { logger },
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
          tls: kdbData.tls,
        },
      };
    } else {
      servers[key] = {
        auth: kdbData.auth,
        serverName: kdbData.serverName,
        serverPort: kdbData.serverPort,
        serverAlias: kdbData.serverAlias,
        tls: kdbData.tls,
      };
    }

    await updateServers(servers);
    const newServers = getServers();
    if (newServers != undefined) {
      ext.latestLblsChanged.length = 0;
      if (labels && labels.length > 0) {
        ext.latestLblsChanged.push(...labels);
        await handleLabelsConnMap(labels, kdbData.serverAlias);
      }
      notify("Created kdb connection.", MessageKind.DEBUG, {
        logger,
        telemetry: "Connection.Created.QProcess",
      });
      ext.serverProvider.refresh(newServers);
    }
    if (kdbData.auth) {
      addAuthConnection(key, kdbData.username!, kdbData.password!);
    }

    notify(`Added kdb connection: ${kdbData.serverAlias}`, MessageKind.INFO, {
      logger,
    });

    NewConnectionPannel.close();
  }
}

export async function editKdbConnection(
  kdbData: ServerDetails,
  oldAlias: string,
  editAuth?: boolean,
  labels?: string[],
) {
  /* c8 ignore start */
  const aliasValidation =
    oldAlias === kdbData.serverAlias
      ? undefined
      : validateServerAlias(kdbData.serverAlias);
  const hostnameValidation = validateServerName(kdbData.serverName);
  const portValidation = validateServerPort(kdbData.serverPort);
  if (aliasValidation) {
    notify(aliasValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (hostnameValidation) {
    notify(hostnameValidation, MessageKind.ERROR, { logger });
    return;
  }
  if (portValidation) {
    notify(portValidation, MessageKind.ERROR, { logger });
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
      notify(
        `KDB instance named ${kdbData.serverAlias} already exists.`,
        MessageKind.ERROR,
        { logger },
      );
      return;
    } else {
      if (!oldServer) {
        notify(
          `KDB instance named ${oldAlias} does not exist.`,
          MessageKind.ERROR,
          { logger },
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
            auth:
              editAuth === false
                ? oldServer.auth
                : removedAuth
                  ? false
                  : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
            tls: kdbData.tls,
          };

          await updateServers(updatedServers);
        } else {
          servers[oldKey] = {
            auth:
              editAuth === false
                ? oldServer.auth
                : removedAuth
                  ? false
                  : kdbData.auth,
            serverName: kdbData.serverName,
            serverPort: kdbData.serverPort,
            serverAlias: kdbData.serverAlias,
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
          notify("Edited kdb connection.", MessageKind.DEBUG, {
            logger,
            telemetry: "Connection.Edited.KDB",
          });
          const connLabelToReconn = `${kdbData.serverName}:${kdbData.serverPort} [${kdbData.serverAlias}]`;
          if (isConnectedConn) {
            offerReconnectionAfterEdit(connLabelToReconn);
          }
        }

        notify(
          `Edited KDB connection: ${kdbData.serverAlias}`,
          MessageKind.INFO,
          { logger },
        );
        handleEditAuthData(
          oldKey,
          newKey,
          editAuth ?? false,
          kdbData.auth,
          kdbData.username,
          kdbData.password,
        );

        NewConnectionPannel.close();
      }
    }
  }
  /* c8 ignore stop */
}

export async function importConnections() {
  /* c8 ignore start */
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
    notify("No file selected.", MessageKind.ERROR, { logger });
    return;
  }
  const filePath = fileUri[0].fsPath;
  const fileContent = fs.readFileSync(filePath, "utf8");

  let importedConnections: ExportedConnections;
  try {
    importedConnections = JSON.parse(fileContent);
  } catch {
    notify("Invalid JSON format.", MessageKind.ERROR, { logger });
    return;
  }

  if (!isValidExportedConnections(importedConnections)) {
    notify("JSON does not match the required format.", MessageKind.ERROR, {
      logger,
    });
    return;
  }
  if (
    importedConnections.connections.KDB.length === 0 &&
    importedConnections.connections.Insights.length === 0
  ) {
    notify(
      "There is no KDB or Insights connections to import in this JSON file.",
      MessageKind.ERROR,
      { logger },
    );
    return;
  }
  await addImportedConnections(importedConnections);
  /* c8 ignore stop */
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
    res = await notify(
      "You are importing connections with the same name. Would you like to duplicate, overwrite or cancel the import?",
      MessageKind.INFO,
      {},
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
      await addKdbConnection(connection);
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

  notify("Connections imported successfully.", MessageKind.INFO, {
    logger,
  });
}

export async function removeConnection(viewItem: KdbNode | InsightsNode) {
  notify(
    `You are going to remove ${viewItem.label}, would you like to proceed?`,
    MessageKind.WARNING,
    {},
    "Proceed",
    "Cancel",
  ).then(async (result) => {
    if (result === "Proceed") {
      const connMngService = new ConnectionManagementService();
      removeConnFromLabels(
        viewItem instanceof KdbNode
          ? viewItem.details.serverAlias
          : viewItem.details.alias,
      );
      await connMngService.removeConnection(viewItem);
    }
  });
}

export async function connect(connLabel: string): Promise<void> {
  const connMngService = new ConnectionManagementService();
  ExecutionConsole.start();
  const viewItem = connMngService.retrieveConnection(connLabel);
  if (viewItem === undefined) {
    notify("Connection not found.", MessageKind.ERROR, { logger });
    return;
  }

  const isKdbNode = viewItem instanceof KdbNode;
  if (isKdbNode) {
    // check for TLS support
    if (viewItem.details.tls) {
      if (!(await checkOpenSslInstalled())) {
        notify(
          "TLS support requires OpenSSL to be installed.",
          MessageKind.INFO,
          { logger },
          "More Info",
          "Cancel",
        ).then(async (result) => {
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
  token?: CancellationToken,
): Promise<any> {
  const connMngService = new ConnectionManagementService();
  const queryConsole = ExecutionConsole.start();
  if (connLabel === "") {
    if (ext.activeConnection === undefined) {
      return undefined;
    } else {
      connLabel = ext.activeConnection.connLabel;
    }
  }
  const isConnected = connMngService.isConnected(connLabel);
  if (!isConnected) {
    notify(`Connection ${connLabel} is not connected.`, MessageKind.ERROR, {
      logger,
    });
    return undefined;
  }

  const selectedConn = connMngService.retrieveConnectedConnection(connLabel);
  const isInsights = selectedConn instanceof InsightsConnection;
  const connVersion = isInsights ? (selectedConn.insightsVersion ?? 0) : 0;
  const telemetryLangType = isPython ? ".Python" : ".q";
  const telemetryBaseMsg = isWorkbook ? "Workbook" : "Scratchpad";
  notify("Query execution.", MessageKind.DEBUG, {
    logger,
    telemetry: telemetryBaseMsg + ".Execute" + telemetryLangType,
  });
  if (query.length === 0) {
    notify("Empty query.", MessageKind.DEBUG, {
      logger,
      telemetry: telemetryBaseMsg + ".Execute" + telemetryLangType + ".Error",
    });
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
  const isNotebook = executorName.endsWith(".kxnb");
  const isStringfy = isNotebook ? false : !ext.isResultsTabVisible;
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

  if (token?.isCancellationRequested) {
    return undefined;
  }

  // set context for root nodes
  if (selectedConn instanceof InsightsConnection) {
    const res = await writeScratchpadResult(
      results,
      query,
      connLabel,
      executorName,
      isPython,
      isWorkbook,
      duration,
      connVersion,
    );
    if (isNotebook) {
      return res;
    }
  } else if (isNotebook) {
    return results;
  } else {
    /* c8 ignore start */
    if (ext.isResultsTabVisible) {
      const data = resultToBase64(results);
      if (data) {
        notify("GG Plot displayed", MessageKind.DEBUG, {
          logger,
          telemetry: "GGPLOT.Display" + (isPython ? ".Python" : ".q"),
        });
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
    /* c8 ignore stop */
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

export async function runQuery(
  type: ExecutionTypes,
  connLabel: string,
  executorName: string,
  isWorkbook: boolean,
  rerunQuery?: string,
  target?: string,
  isSql?: boolean,
  isInsights?: boolean,
) {
  const editor = ext.activeTextEditor;
  if (!editor) {
    return false;
  }

  let context;
  let query;
  let isPython = false;
  let variable: string | undefined;

  switch (type) {
    case ExecutionTypes.QuerySelection:
    case ExecutionTypes.PythonQuerySelection: {
      const selection = editor.selection;
      query = selection.isEmpty
        ? editor.document.lineAt(selection.active.line).text
        : editor.document.getText(selection);
      context = getQueryContext(selection.end.line);
      if (type === ExecutionTypes.PythonQuerySelection) {
        isPython = true;
      }
      break;
    }

    case ExecutionTypes.QueryFile:
    case ExecutionTypes.ReRunQuery:
    case ExecutionTypes.PythonQueryFile:
    default: {
      query = rerunQuery || editor.document.getText();
      context = getQueryContext();

      if (type === ExecutionTypes.PythonQueryFile) {
        isPython = true;
      }
      break;
    }
  }

  if (type === ExecutionTypes.PopulateScratchpad) {
    if (executorName.endsWith(".py")) {
      isPython = true;
    }
    variable = await inputVariable();
  }

  const runner = Runner.create((_, token) => {
    return target || isSql
      ? variable
        ? populateScratchpad(
            getPartialDatasourceFile(query, target, isSql, isPython),
            connLabel,
            variable,
          )
        : runDataSource(
            getPartialDatasourceFile(query, target, isSql, isPython),
            connLabel,
            executorName,
          )
      : executeQuery(
          query,
          connLabel,
          executorName,
          context,
          isPython,
          isWorkbook,
          false,
          token,
        );
  });

  if (isInsights) {
    runner.location = ProgressLocation.Notification;
  }
  runner.title = `Executing ${executorName} on ${connLabel || "active connection"}.`;

  return !isInsights || ((target || isSql) && !variable)
    ? runner.execute()
    : needsScratchpad(connLabel, runner.execute());
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

export function copyQuery(queryHistoryElement: QueryHistory) {
  let query;
  if (queryHistoryElement.isDatasource) {
    const ds = queryHistoryElement.query as DataSourceFiles;
    if (ds.dataSource.selectedType === DataSourceTypes.QSQL)
      query = ds.dataSource.source ?? ds.dataSource.qsql.query;
    if (ds.dataSource.selectedType === DataSourceTypes.SQL)
      query = ds.dataSource.source ?? ds.dataSource.sql.query;
  } else if (typeof queryHistoryElement.query === "string") {
    query = queryHistoryElement.query;
  }
  if (query) {
    notify("Query copied to clipboard.", MessageKind.INFO, { logger });
    return env.clipboard.writeText(query);
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
    notify("Meta content not found.", MessageKind.ERROR, {
      logger,
    });
  }
}

export async function exportConnections(connLabel?: string) {
  const connMngService = new ConnectionManagementService();

  const exportAuth = await window.showQuickPick(["Yes", "No"], {
    placeHolder: "Do you want to export username and password?",
  });

  if (!exportAuth) {
    notify("Export operation was cancelled by the user.", MessageKind.DEBUG, {
      logger,
    });
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
          notify(`Error saving file: ${err.message}`, MessageKind.ERROR, {
            logger,
          });
        } else {
          workspace.openTextDocument(uri).then((document) => {
            window.showTextDocument(document, { preview: false });
          });
        }
      });
    } else {
      notify("Save operation was cancelled by the user.", MessageKind.DEBUG, {
        logger,
      });
    }
  } else {
    notify("No connections found to be exported.", MessageKind.ERROR, {
      logger,
    });
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
  const telemetryLangType = isPython ? ".Python" : ".q";
  const telemetryBaseMsg = type === "WORKBOOK" ? "Workbook" : "Scratchpad";

  if (!checkIfIsDatasource(type)) {
    if (typeof result === "string") {
      const res = decodeQUTF(result);
      if (res.startsWith(queryConstants.error)) {
        notify("Telemetry", MessageKind.DEBUG, {
          logger,
          telemetry:
            telemetryBaseMsg + ".Execute" + telemetryLangType + ".Error",
        });
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
): Promise<any> {
  const telemetryLangType = isPython ? ".Python" : ".q";
  const telemetryBaseMsg = isWorkbook ? "Workbook" : "Scratchpad";
  let errorMsg;

  if (result.error) {
    errorMsg = "Error: " + result.errorMsg;

    notify("Scratchpad query returned error", MessageKind.DEBUG, {
      logger,
      telemetry: telemetryBaseMsg + ".Execute" + telemetryLangType + ".Error",
    });

    if (result.stacktrace) {
      errorMsg =
        errorMsg +
        "\n" +
        (Array.isArray(result.stacktrace)
          ? formatScratchpadStacktrace(result.stacktrace)
          : `${result.stacktrace}`);
    }
  }

  if (executorName.endsWith(".kxnb")) {
    return errorMsg ?? result;
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
