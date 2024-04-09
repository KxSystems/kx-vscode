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
  removeLocalConnectionContext,
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
  sanitizeQuery,
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

export async function removeConnection(viewItem: KdbNode): Promise<void> {
  if (viewItem.label.indexOf("connected") !== -1) {
    await disconnect(viewItem.label);
  }

  const servers: Server | undefined = getServers();

  const key =
    viewItem.details.serverAlias != ""
      ? getHash(
          `${viewItem.details.serverName}${viewItem.details.serverPort}${viewItem.details.serverAlias}`,
        )
      : getHash(`${viewItem.details.serverName}${viewItem.details.serverPort}`);
  if (servers != undefined && servers[key]) {
    const uServers = Object.keys(servers).filter((server) => {
      return server !== key;
    });

    const updatedServers: Server = {};
    uServers.forEach((server) => {
      updatedServers[server] = servers[server];
    });

    removeLocalConnectionContext(getServerName(viewItem.details));

    await updateServers(updatedServers);
    ext.serverProvider.refresh(updatedServers);
  }
}

export async function connectInsights(viewItem: InsightsNode): Promise<void> {
  commands.executeCommand("kdb-results.focus");
  ext.context.secrets.delete(viewItem.details.alias);
  await getCurrentToken(viewItem.details.server, viewItem.details.alias);

  ext.outputChannel.appendLine(
    `Connection established successfully to: ${viewItem.details.server}`,
  );

  commands.executeCommand("setContext", "kdb.connected", [
    viewItem.label + " (connected)",
  ]);

  commands.executeCommand("setContext", "kdb.insightsConnected", true);

  if (ext.kdbinsightsNodes.indexOf(viewItem.label + " (connected)") === -1) {
    ext.kdbinsightsNodes.push(viewItem.label + " (connected)");
    commands.executeCommand(
      "setContext",
      "kdb.insightsNodes",
      ext.kdbinsightsNodes,
    );
    Telemetry.sendEvent("Connection.Connected.Insights");
  }

  ext.activeConnection = undefined;
  ext.connectionNode = viewItem;
  ext.serverProvider.reload();
  refreshDataSourcesPanel();
}

export async function getMeta(): Promise<MetaObjectPayload | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const metaUrl = new url.URL(
      ext.insightsServiceGatewayUrls.meta,
      ext.connectionNode.details.server,
    );

    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias,
    );

    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights.",
      );
      window.showErrorMessage("Failed to retrieve access token for insights");
      return undefined;
    }

    const options = {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    };

    const metaResponse = await axios.post(metaUrl.toString(), {}, options);
    const meta: MetaObject = metaResponse.data;
    return meta.payload;
  }
  return undefined;
}
/* istanbul ignore next */
export async function getDataInsights(
  targetUrl: string,
  body: string,
): Promise<GetDataObjectPayload | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const requestUrl = new url.URL(
      targetUrl,
      ext.connectionNode.details.server,
    ).toString();

    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias,
    );

    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights.",
      );
      window.showErrorMessage("Failed to retrieve access token for insights");
      return undefined;
    }

    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      Accept: "application/octet-stream",
      "Content-Type": "application/json",
    };

    const options: AxiosRequestConfig = {
      method: "post",
      url: requestUrl,
      data: body,
      headers: headers,
      responseType: "arraybuffer",
    };

    const results = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: false,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          ext.outputChannel.appendLine("User cancelled the installation.");
        });

        progress.report({ message: "Query executing..." });

        return await axios(options)
          .then((response: any) => {
            ext.outputChannel.appendLine(`request status: ${response.status}`);
            if (isCompressed(response.data)) {
              response.data = uncompress(response.data);
            }
            return {
              error: "",
              arrayBuffer: response.data.buffer
                ? response.data.buffer
                : response.data,
            };
          })
          .catch((error: any) => {
            ext.outputChannel.appendLine(
              `request status: ${error.response.status}`,
            );
            return {
              error: { buffer: error.response.data },
              arrayBuffer: undefined,
            };
          });
      },
    );
    return results;
  }
  return undefined;
}

export async function importScratchpad(
  variableName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: DataSourceFiles,
): Promise<void> {
  let dsTypeString = "";
  if (ext.connectionNode instanceof InsightsNode) {
    let queryParams, coreUrl: string;
    switch (params.dataSource.selectedType) {
      case DataSourceTypes.API:
        queryParams = {
          table: params.dataSource.api.table,
          startTS: params.dataSource.api.startTS,
          endTS: params.dataSource.api.endTS,
        };
        coreUrl = ext.insightsScratchpadUrls.import;
        dsTypeString = "API";
        break;
      case DataSourceTypes.SQL:
        queryParams = { query: params.dataSource.sql.query };
        coreUrl = ext.insightsScratchpadUrls.importSql;
        dsTypeString = "SQL";
        break;
      case DataSourceTypes.QSQL:
        const assemblyParts = params.dataSource.qsql.selectedTarget.split(" ");
        queryParams = {
          assembly: assemblyParts[0],
          target: assemblyParts[1],
          query: params.dataSource.qsql.query,
        };
        coreUrl = ext.insightsScratchpadUrls.importQsql;
        dsTypeString = "QSQL";
        break;
      default:
        break;
    }

    const scratchpadURL = new url.URL(
      coreUrl!,
      ext.connectionNode.details.server,
    );

    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias,
    );

    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights.",
      );
      window.showErrorMessage("Failed to retrieve access token for insights");
      return undefined;
    }

    const username = jwtDecode<JwtUser>(token.accessToken);
    if (username === undefined || username.preferred_username === "") {
      ext.outputChannel.appendLine(
        "JWT did not contain a valid preferred username",
      );
    }
    const headers = {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        username: username.preferred_username!,

        json: true,
      },
    };
    const body = {
      output: variableName,
      isTableView: false,
      params: queryParams,
    };
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: false,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          ext.outputChannel.appendLine("User cancelled the installation.");
        });

        progress.report({ message: "Query executing..." });

        const scratchpadResponse = await axios.post(
          scratchpadURL.toString(),
          body,
          headers,
        );

        ext.outputChannel.append(JSON.stringify(scratchpadResponse.data));
        window.showInformationMessage(
          `Executed successfully, stored in ${variableName}`,
        );
        Telemetry.sendEvent(
          "Datasource." + dsTypeString + ".Scratchpad.Populated",
        );

        const p = new Promise<void>((resolve) => resolve());
        return p;
      },
    );
  }
}

export async function getScratchpadQuery(
  query: string,
  context?: string,
  isPython?: boolean,
): Promise<any | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const isTableView = ext.resultsViewProvider.isVisible();
    const scratchpadURL = new url.URL(
      ext.insightsAuthUrls.scratchpadURL,
      ext.connectionNode.details.server,
    );
    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias,
    );
    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights.",
      );
      window.showErrorMessage("Failed to retrieve access token for insights");
      return undefined;
    }
    const username = jwtDecode<JwtUser>(token.accessToken);
    if (username === undefined || username.preferred_username === "") {
      ext.outputChannel.appendLine(
        "JWT did not contain a valid preferred username",
      );
    }
    const body = {
      expression: query,
      isTableView,
      language: !isPython ? "q" : "python",
      context: context || ".",
      sampleFn: "first",
      sampleSize: 10000,
    };
    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      Username: username.preferred_username,
      "Content-Type": "application/json",
    };

    const spReponse = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: false,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          ext.outputChannel.appendLine("User cancelled the installation.");
        });

        progress.report({ message: "Query is executing..." });
        const spRes = await axios
          .post(scratchpadURL.toString(), body, { headers })
          .then((response: any) => {
            if (isTableView && !response.data.error) {
              const buffer = new Uint8Array(
                response.data.data.map((x: string) => parseInt(x, 16)),
              ).buffer;

              response.data.data = handleWSResults(buffer);
              response.data.data = handleScratchpadTableRes(response.data.data);
            }
            return response.data;
          });
        return spRes;
      },
    );
    return spReponse;
  }
  return undefined;
}

export async function removeInsightsConnection(
  viewItem: InsightsNode,
): Promise<void> {
  if (viewItem.label.indexOf("connected") !== -1) {
    await disconnect();
  }

  const insights: Insights | undefined = getInsights();

  const key = getHash(viewItem.details.server);
  if (insights != undefined && insights[key]) {
    const uInsights = Object.keys(insights).filter((insight) => {
      return insight !== key;
    });

    const updatedInsights: Insights = {};
    uInsights.forEach((insight) => {
      updatedInsights[insight] = insights[insight];
    });

    await updateInsights(updatedInsights);
    ext.serverProvider.refreshInsights(updatedInsights);
  }
}

export async function connect(viewItem: KdbNode): Promise<void> {
  const connMngService = new ConnectionManagementService();
  commands.executeCommand("kdb-results.focus");
  await commands.executeCommand("setContext", "kdb.insightsConnected", false);
  ExecutionConsole.start();
  // handle cleaning up existing connection
  if (
    ext.connectionNode !== undefined &&
    ext.connectionNode.label === viewItem.label
  ) {
    ext.connectionNode = undefined;
    if (ext.connection !== undefined) {
      ext.connection.disconnect();
      ext.connection = undefined;
      DataSourcesPanel.close();
    }
  }

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

  await connMngService.connect(viewItem.label);

  if (viewItem.details.tls) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  }

  refreshDataSourcesPanel();
  ext.serverProvider.reload();
}

export async function disconnect(connLabel?: string): Promise<void> {
  const insightsNode = ext.kdbinsightsNodes.find((n) =>
    ext.connectionNode instanceof InsightsNode
      ? n === ext.connectionNode?.details.alias + " (connected)"
      : false,
  );
  if (insightsNode) {
    commands.executeCommand("setContext", "kdb.insightsConnected", false);
    ext.connectionNode = undefined;
    const queryConsole = ExecutionConsole.start();
    queryConsole.dispose();
    DataSourcesPanel.close();
    ext.serverProvider.reload();
  } else {
    const connMngService = new ConnectionManagementService();
    await connMngService.disconnect(connLabel ? connLabel : "");
  }
}

export async function executeQuery(
  query: string,
  context?: string,
  isPython?: boolean,
): Promise<void> {
  const connMngService = new ConnectionManagementService();
  const queryConsole = ExecutionConsole.start();
  if (ext.connection === undefined && ext.connectionNode === undefined) {
    window.showInformationMessage(
      "Please connect to a KDB instance or Insights Instance to execute a query",
    );
    return undefined;
  }

  if (query.length === 0) {
    return undefined;
  }

  const insightsNode = ext.kdbinsightsNodes.find((n) =>
    ext.connectionNode instanceof InsightsNode
      ? n === ext.connectionNode?.details.alias + " (connected)"
      : false,
  );

  // set context for root nodes
  if (insightsNode) {
    query = sanitizeQuery(query);
    const queryRes = await getScratchpadQuery(query, context, isPython);
    writeScratchpadResult(queryRes, query, isPython);
  } else if (ext.connection !== undefined && ext.connection.connected) {
    query = sanitizeQuery(query);

    if (ext.resultsViewProvider.isVisible()) {
      const startTime = Date.now();
      const queryRes = await ext.connection.executeQuery(query, context, true);
      const endTime = Date.now();
      writeQueryResultsToView(
        queryRes,
        query,
        undefined,
        false,
        (endTime - startTime).toString(),
      );
    } else {
      const startTime = Date.now();
      const queryRes = await connMngService.executeQuery(query, context, true);
      const endTime = Date.now();
      writeQueryResultsToConsole(
        queryRes,
        query,
        undefined,
        false,
        (endTime - startTime).toString(),
      );
    }
  } else {
    const isConnected = ext.connection
      ? ext.connection.connected
      : !!ext.connection;
    queryConsole.appendQueryError(
      query,
      "Query is empty",
      isConnected,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
    );
    return undefined;
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
  if (ext.connection === undefined || ext.connection.connected === false) {
    window.showInformationMessage(
      "Please connect to a KDB instance to view the objects",
    );
    return new Array<ServerObject>();
  }

  const script = readFileSync(
    ext.context.asAbsolutePath(join("resources", "list_mem.q")),
  ).toString();
  const cc = "\n" + script + "(::)";
  const result = await ext.connection?.executeQueryRaw(cc);
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
    (ext.connection || ext.connectionNode) &&
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
        !!ext.connection,
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
      writeQueryResultsToView(result.data, query, "SCRATCHPAD", isPython);
    } else {
      writeQueryResultsToConsole(result.data, query, undefined, isPython);
    }
  }
}
