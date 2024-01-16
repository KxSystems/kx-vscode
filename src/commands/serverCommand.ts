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
import jwt_decode from "jwt-decode";
import { join } from "path";
import * as url from "url";
import {
  InputBoxOptions,
  Position,
  ProgressLocation,
  QuickPickItem,
  QuickPickOptions,
  Range,
  commands,
  env,
  window,
} from "vscode";
import { ext } from "../extensionVariables";
import { isCompressed, uncompress } from "../ipc/c";
import { Connection } from "../models/connection";
import { GetDataObjectPayload } from "../models/data";
import { DataSourceFiles, DataSourceTypes } from "../models/dataSource";
import { ExecutionTypes } from "../models/execution";
import { Insights } from "../models/insights";
import {
  connectionAliasInput,
  connectionHostnameInput,
  connectionPasswordInput,
  connectionPortInput,
  connectionUsernameInput,
  connnectionTls,
  insightsAliasInput,
  insightsUrlInput,
  kdbEndpoint,
  kdbInsightsEndpoint,
  serverEndpointPlaceHolder,
  serverEndpoints,
} from "../models/items/server";
import { JwtUser } from "../models/jwt_user";
import { MetaObject, MetaObjectPayload } from "../models/meta";
import { queryConstants } from "../models/queryResult";
import { ScratchpadResult } from "../models/scratchpadResult";
import { Server, ServerType } from "../models/server";
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
import { ExecutionConsole, addQueryHistory } from "../utils/executionConsole";
import { openUrl } from "../utils/openUrl";
import {
  handleScratchpadTableRes,
  handleWSResults,
  sanitizeQuery,
} from "../utils/queryUtils";
import {
  validateServerAlias,
  validateServerName,
  validateServerPort,
  validateServerUsername,
  validateTls,
} from "../validators/kdbValidator";

export async function addNewConnection(): Promise<void> {
  const options: QuickPickOptions = { placeHolder: serverEndpointPlaceHolder };

  const resultType: QuickPickItem | undefined = await window.showQuickPick(
    serverEndpoints,
    options
  );
  if (resultType !== undefined && resultType!.label === kdbEndpoint) {
    addKdbConnection();
  } else if (
    resultType !== undefined &&
    resultType!.label === kdbInsightsEndpoint
  ) {
    await addInsightsConnection();
  }
}

export async function addInsightsConnection() {
  const insightsAlias: InputBoxOptions = {
    prompt: insightsAliasInput.prompt,
    placeHolder: insightsAliasInput.placeholder,
    validateInput: (value: string | undefined) => validateServerAlias(value),
  };
  const insightsUrl: InputBoxOptions = {
    prompt: insightsUrlInput.prompt,
    placeHolder: insightsUrlInput.placeholder,
  };
  window.showInputBox(insightsAlias).then(async (insights_alias) => {
    window.showInputBox(insightsUrl).then(async (insights_url) => {
      if (insights_alias === undefined || insights_alias === "") {
        const host = new url.URL(insights_url!);
        insights_alias = host.host;
      }

      let insights: Insights | undefined = getInsights();
      if (insights != undefined && insights[getHash(insights_url!)]) {
        await window.showErrorMessage(
          `Insights instance named ${insights_url} already exists.`
        );
      } else {
        const key = getHash(insights_url!);
        if (insights === undefined) {
          insights = {
            key: {
              auth: true,
              alias: insights_alias,
              server: insights_url!,
            },
          };
        } else {
          insights[key] = {
            auth: true,
            alias: insights_alias,
            server: insights_url!,
          };
        }

        await updateInsights(insights);
        const newInsights = getInsights();
        if (newInsights != undefined) {
          ext.serverProvider.refreshInsights(newInsights);
        }
      }
    });
  });
}

// Not possible to test secrets
/* istanbul ignore next */
export function addAuthConnection(serverKey: string): void {
  const connectionUsername: InputBoxOptions = {
    prompt: connectionUsernameInput.prompt,
    placeHolder: connectionUsernameInput.placeholder,
    validateInput: (value: string | undefined) => validateServerUsername(value),
  };
  const connectionPassword: InputBoxOptions = {
    prompt: connectionPasswordInput.prompt,
    placeHolder: connectionPasswordInput.placeholder,
    password: true,
  };
  window.showInputBox(connectionUsername).then(async (username) => {
    if (username?.trim()?.length) {
      window.showInputBox(connectionPassword).then(async (password) => {
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
            ext.secretSettings.storeAuthData(
              serverKey,
              `${username}:${password}`
            );
            await updateServers(servers);
            const newServers = getServers();
            if (newServers != undefined) {
              ext.serverProvider.refresh(newServers);
            }
          }
        }
      });
    }
  });
}

export async function enableTLS(serverKey: string): Promise<void> {
  const servers: Server | undefined = getServers();

  // validate if TLS is possible
  if (ext.openSslVersion === null) {
    window
      .showErrorMessage(
        "OpenSSL not found, please ensure this is installed",
        "More Info",
        "Cancel"
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
    "Cancel"
  );
}

export function addKdbConnection(): void {
  const connectionAlias: InputBoxOptions = {
    prompt: connectionAliasInput.prompt,
    placeHolder: connectionAliasInput.placeholder,
    validateInput: (value: string | undefined) => validateServerAlias(value),
  };
  const connectionHostname: InputBoxOptions = {
    prompt: connectionHostnameInput.prompt,
    placeHolder: connectionHostnameInput.placeholder,
    validateInput: (value: string | undefined) => validateServerName(value),
  };
  const connectionPort: InputBoxOptions = {
    prompt: connectionPortInput.prompt,
    placeHolder: connectionPortInput.placeholder,
    validateInput: (value: string | undefined) => validateServerPort(value),
  };

  const connectionTls: InputBoxOptions = {
    prompt: connnectionTls.prompt,
    placeHolder: connnectionTls.placeholder,
    validateInput: (value: string | undefined) => validateTls(value),
  };

  window.showInputBox(connectionAlias).then(async (alias) => {
    window.showInputBox(connectionHostname).then(async (hostname) => {
      if (hostname) {
        window.showInputBox(connectionPort).then(async (port) => {
          if (port) {
            let servers: Server | undefined = getServers();

            if (
              servers != undefined &&
              servers[getHash(`${hostname}:${port}`)]
            ) {
              await window.showErrorMessage(
                `Server ${hostname}:${port} already exists.`
              );
            } else {
              const key =
                alias != undefined
                  ? getHash(`${hostname}${port}${alias}`)
                  : getHash(`${hostname}${port}`);
              if (servers === undefined) {
                servers = {
                  key: {
                    auth: false,
                    serverName: hostname,
                    serverPort: port,
                    serverAlias: alias,
                    managed: alias === "local" ? true : false,
                    tls: false,
                  },
                };
                if (servers[0].managed) {
                  await addLocalConnectionContexts(getServerName(servers[0]));
                }
              } else {
                servers[key] = {
                  auth: false,
                  serverName: hostname,
                  serverPort: port,
                  serverAlias: alias,
                  managed: alias === "local" ? true : false,
                  tls: false,
                };
                if (servers[key].managed) {
                  await addLocalConnectionContexts(getServerName(servers[key]));
                }
              }

              await updateServers(servers);
              const newServers = getServers();
              if (newServers != undefined) {
                ext.serverProvider.refresh(newServers);
              }
            }
          }
        });
      }
    });
  });
}

export async function removeConnection(viewItem: KdbNode): Promise<void> {
  if (viewItem.label.indexOf("connected") !== -1) {
    await disconnect();
  }

  const servers: Server | undefined = getServers();

  const key =
    viewItem.details.serverAlias != ""
      ? getHash(
          `${viewItem.details.serverName}${viewItem.details.serverPort}${viewItem.details.serverAlias}`
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

  await getCurrentToken(viewItem.details.server, viewItem.details.alias);

  ext.outputChannel.appendLine(
    `Connection established successfully to: ${viewItem.details.server}`
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
      ext.kdbinsightsNodes
    );
  }

  ext.connectionNode = viewItem;
  ext.serverProvider.reload();
  refreshDataSourcesPanel();
}

export async function getMeta(): Promise<MetaObjectPayload | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const metaUrl = new url.URL(
      ext.insightsServiceGatewayUrls.meta,
      ext.connectionNode.details.server
    );

    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias
    );

    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights."
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

export async function getDataInsights(
  targetUrl: string,
  body: string
): Promise<GetDataObjectPayload | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const requestUrl = new url.URL(
      targetUrl,
      ext.connectionNode.details.server
    ).toString();

    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias
    );

    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights."
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
            return {
              error: error.response.data,
              arrayBuffer: undefined,
            };
          });
      }
    );
    return results;
  }
  return undefined;
}

export async function importScratchpad(
  variableName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: DataSourceFiles
): Promise<void> {
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
        break;
      case DataSourceTypes.SQL:
        queryParams = { query: params.dataSource.sql.query };
        coreUrl = ext.insightsScratchpadUrls.importSql;
        break;
      case DataSourceTypes.QSQL:
        const assemblyParts = params.dataSource.qsql.selectedTarget.split(" ");
        queryParams = {
          assembly: assemblyParts[0],
          target: assemblyParts[1],
          query: params.dataSource.qsql.query,
        };
        coreUrl = ext.insightsScratchpadUrls.importQsql;
        break;
      default:
        break;
    }

    const scratchpadURL = new url.URL(
      coreUrl!,
      ext.connectionNode.details.server
    );

    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias
    );

    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights."
      );
      window.showErrorMessage("Failed to retrieve access token for insights");
      return undefined;
    }

    const username = jwt_decode<JwtUser>(token.accessToken);
    if (username === undefined || username.preferred_username === "") {
      ext.outputChannel.appendLine(
        "JWT did not contain a valid preferred username"
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
          headers
        );

        ext.outputChannel.append(JSON.stringify(scratchpadResponse.data));
        window.showInformationMessage(
          `Executed successfully, stored in ${variableName}`
        );

        const p = new Promise<void>((resolve) => resolve());
        return p;
      }
    );
  }
}

export async function getScratchpadQuery(
  query: string,
  context?: string,
  isPython?: boolean
): Promise<any | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const isTableView = ext.resultsViewProvider.isVisible();
    const scratchpadURL = new url.URL(
      ext.insightsAuthUrls.scratchpadURL,
      ext.connectionNode.details.server
    );
    const token = await getCurrentToken(
      ext.connectionNode.details.server,
      ext.connectionNode.details.alias
    );
    if (token === undefined) {
      ext.outputChannel.appendLine(
        "Error retrieving access token for insights."
      );
      window.showErrorMessage("Failed to retrieve access token for insights");
      return undefined;
    }
    const username = jwt_decode<JwtUser>(token.accessToken);
    if (username === undefined || username.preferred_username === "") {
      ext.outputChannel.appendLine(
        "JWT did not contain a valid preferred username"
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
                response.data.data.map((x: string) => parseInt(x, 16))
              ).buffer;

              response.data.data = handleWSResults(buffer);
              response.data.data = handleScratchpadTableRes(response.data.data);
            }
            return response.data;
          });
        return spRes;
      }
    );
    return spReponse;
  }
  return undefined;
}

export async function removeInsightsConnection(
  viewItem: InsightsNode
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
  commands.executeCommand("kdb-results.focus");
  await commands.executeCommand("setContext", "kdb.insightsConnected", false);
  const queryConsole = ExecutionConsole.start();
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
          "Cancel"
        )
        .then(async (result) => {
          if (result === "More Info") {
            await openUrl("https://code.kx.com/q/kb/ssl/");
          }
        });
    }
  }

  // check for auth
  const authCredentials = viewItem.details.auth
    ? await ext.secretSettings.getAuthData(viewItem.children[0])
    : undefined;

  const servers: Server | undefined = getServers();
  if (servers === undefined) {
    window.showErrorMessage("Server not found.");
    return;
  }

  const key =
    viewItem.details.serverAlias != ""
      ? getHash(
          `${viewItem.details.serverName}${viewItem.details.serverPort}${viewItem.details.serverAlias}`
        )
      : getHash(`${viewItem.details.serverName}${viewItem.details.serverPort}`);
  const connection = `${servers[key].serverName}:${servers[key].serverPort}`;

  if (authCredentials != undefined) {
    const creds = authCredentials.split(":");
    ext.connection = new Connection(
      connection,
      creds,
      viewItem.details.tls ?? false
    );
  } else {
    ext.connection = new Connection(
      connection,
      undefined,
      viewItem.details.tls ?? false
    );
  }

  if (viewItem.details.tls) {
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  ext.connection.connect((err, conn) => {
    if (err) {
      window.showErrorMessage(err.message);
      return;
    }

    if (conn) {
      ext.outputChannel.appendLine(
        `Connection established successfully to: ${viewItem.details.serverName}`
      );

      commands.executeCommand("setContext", "kdb.connected", [
        `${getServerName(viewItem.details)}` + " (connected)",
      ]);
      ext.connectionNode = viewItem;
      ext.serverProvider.reload();
    }
  });
  refreshDataSourcesPanel();
}

export async function disconnect(): Promise<void> {
  ext.connection?.disconnect();
  await commands.executeCommand("setContext", "kdb.connected", false);
  commands.executeCommand("setContext", "kdb.insightsConnected", false);
  ext.connectionNode = undefined;
  const queryConsole = ExecutionConsole.start();
  queryConsole.dispose();
  DataSourcesPanel.close();
  ext.serverProvider.reload();
}

export async function executeQuery(
  query: string,
  context?: string,
  isPython?: boolean
): Promise<void> {
  const queryConsole = ExecutionConsole.start();

  if (query.length === 0) {
    return undefined;
  }

  const insightsNode = ext.kdbinsightsNodes.find((n) =>
    ext.connectionNode instanceof InsightsNode
      ? n === ext.connectionNode?.details.alias + " (connected)"
      : false
  );

  // set context for root nodes
  if (insightsNode) {
    query = sanitizeQuery(query);
    const queryRes = await getScratchpadQuery(query, context, isPython);
    writeScratchpadResult(queryRes, query, isPython);
  } else if (ext.connection !== undefined && ext.connection.connected) {
    query = sanitizeQuery(query);

    if (ext.resultsViewProvider.isVisible()) {
      const queryRes = await ext.connection.executeQuery(query, context, false);
      writeQueryResultsToView(queryRes, query);
    } else {
      const queryRes = await ext.connection.executeQuery(query, context, true);
      writeQueryResultsToConsole(queryRes, query);
    }
  } else {
    const isConnected = ext.connection
      ? ext.connection.connected
      : !!ext.connection;
    queryConsole.appendQueryError(
      query,
      "Query is empty",
      isConnected,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
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
          new Position(lineNum, line.range.end.character)
        )
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
      : false
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

export async function loadServerObjects(): Promise<ServerObject[]> {
  // check for valid connection
  if (ext.connection === undefined || ext.connection.connected === false) {
    window.showInformationMessage(
      "Please connect to a KDB instance to view the objects"
    );
    return new Array<ServerObject>();
  }

  const script = readFileSync(
    ext.context.asAbsolutePath(join("resources", "list_mem.q"))
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
  isPython?: boolean
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
      isPython
    );
  } else {
    queryConsole.appendQueryError(
      query,
      res.substring(queryConstants.error.length),
      !!ext.connection,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
      isPython
    );
  }
}

export function writeQueryResultsToView(
  result: any,
  query: string,
  dataSourceType?: string,
  isPython?: boolean
): void {
  commands.executeCommand("kdb.resultsPanel.update", result, dataSourceType);
  const connectionType: ServerType =
    ext.connectionNode instanceof KdbNode
      ? ServerType.KDB
      : ServerType.INSIGHTS;
  addQueryHistory(
    query,
    ext.connectionNode?.label ? ext.connectionNode.label : "",
    connectionType,
    true,
    isPython
  );
}

export function writeScratchpadResult(
  result: ScratchpadResult,
  query: string,
  isPython?: boolean
): void {
  const queryConsole = ExecutionConsole.start();

  if (result.error) {
    queryConsole.appendQueryError(
      query,
      result.errorMsg,
      true,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
    );
  } else {
    if (ext.resultsViewProvider.isVisible()) {
      writeQueryResultsToView(result.data, query, "SCRATCHPAD", isPython);
    } else {
      writeQueryResultsToConsole(result.data, query, undefined, isPython);
    }
  }
}
