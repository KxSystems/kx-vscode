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
import requestPromise from "request-promise";
import * as url from "url";
import {
  commands,
  InputBoxOptions,
  Position,
  QuickPickItem,
  QuickPickOptions,
  Range,
  window,
} from "vscode";
import { ext } from "../extensionVariables";
import { isCompressed, uncompress } from "../ipc/c";
import { Connection } from "../models/connection";
import { GetDataObjectPayload } from "../models/data";
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
import { Server } from "../models/server";
import { ServerObject } from "../models/serverObject";
import {
  IToken,
  refreshToken,
  signIn,
} from "../services/kdbInsights/codeFlowLogin";
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
import { ExecutionConsole } from "../utils/executionConsole";
import { openUrl } from "../utils/openUrl";
import { sanitizeQuery } from "../utils/queryUtils";
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
            window.showInputBox(connectionUsername).then(async (username) => {
              window.showInputBox(connectionPassword).then(async (password) => {
                window.showInputBox(connectionTls).then(async (tls) => {
                  let tlsEnabled;
                  if (tls !== undefined && tls === "true") {
                    tlsEnabled = true;
                  } else {
                    tlsEnabled = false;
                  }

                  // validate if TLS is possible
                  if (tlsEnabled && ext.openSslVersion === null) {
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

                  // store secrets
                  let authUsed = false;
                  if (
                    (username != undefined || username != "") &&
                    (password != undefined || password != "")
                  ) {
                    authUsed = true;
                    ext.secretSettings.storeAuthData(
                      alias !== undefined
                        ? getHash(`${hostname}${port}${alias}`)
                        : getHash(`${hostname}${port}`),
                      `${username}:${password}`
                    );
                  }

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
                          auth: authUsed,
                          serverName: hostname,
                          serverPort: port,
                          serverAlias: alias,
                          managed: alias === "local" ? true : false,
                          tls: tlsEnabled,
                        },
                      };
                      if (servers[0].managed) {
                        await addLocalConnectionContexts(
                          getServerName(servers[0])
                        );
                      }
                    } else {
                      servers[key] = {
                        auth: authUsed,
                        serverName: hostname,
                        serverPort: port,
                        serverAlias: alias,
                        managed: alias === "local" ? true : false,
                        tls: tlsEnabled,
                      };
                      if (servers[key].managed) {
                        await addLocalConnectionContexts(
                          getServerName(servers[key])
                        );
                      }
                    }

                    await updateServers(servers);
                    const newServers = getServers();
                    if (newServers != undefined) {
                      ext.serverProvider.refresh(newServers);
                    }
                  }
                });
              });
            });
          }
        });
      }
    });
  });
}

export async function removeConnection(viewItem: KdbNode): Promise<void> {
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

  let token: IToken | undefined;
  const existingToken = await ext.context.secrets.get(viewItem.details.alias);
  if (existingToken !== undefined) {
    const storedToken: IToken = JSON.parse(existingToken);
    if (new Date(storedToken.accessTokenExpirationDate) < new Date()) {
      token = await refreshToken(
        viewItem.details.server,
        storedToken.refreshToken
      );
      if (token === undefined) {
        token = await signIn(viewItem.details.server);
        ext.context.secrets.store(
          viewItem.details.alias,
          JSON.stringify(token)
        );
      } else {
        ext.context.secrets.store(
          viewItem.details.alias,
          JSON.stringify(token)
        );
      }
    } else {
      token = storedToken;
    }
  } else {
    token = await signIn(viewItem.details.server);
    ext.context.secrets.store(viewItem.details.alias, JSON.stringify(token));
  }

  ext.outputChannel.appendLine(
    `Connection established successfully to: ${viewItem.details.server}`
  );

  commands.executeCommand("setContext", "kdb.connected", [
    viewItem.label + " (connected)",
  ]);

  ext.connectionNode = viewItem;
  ext.serverProvider.reload();
  refreshDataSourcesPanel();
}

export async function getMeta(): Promise<MetaObjectPayload | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const metaUrl = new url.URL(
      ext.insightsAuthUrls.metaURL,
      ext.connectionNode.details.server
    );

    // get the access token from the secure store
    const rawToken = await ext.context.secrets.get(
      ext.connectionNode.details.alias
    );
    const token = JSON.parse(rawToken!);

    const options = {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    };

    const metaResponse = await requestPromise.post(metaUrl.toString(), options);
    const meta: MetaObject = JSON.parse(metaResponse);
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

    // get the access token from the secure store
    const rawToken = await ext.context.secrets.get(
      ext.connectionNode.details.alias
    );
    const token = JSON.parse(rawToken!);

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

    return await axios(options)
      .then((response: any) => {
        if (isCompressed(response.data)) {
          response.data = uncompress(response.data);
        }
        return {
          error: "",
          arrayBuffer: response.data.buffer,
        };
      })
      .catch((error: any) => {
        return {
          error: error.response.data,
          arrayBuffer: undefined,
        };
      });
  }
  return undefined;
}

export async function importScratchpad(
  variableName: string,
  params: any
): Promise<void> {
  if (ext.connectionNode instanceof InsightsNode) {
    const scratchpadURL = new url.URL(
      ext.insightsScratchpadUrls.import,
      ext.connectionNode.details.server
    );

    // get the access token from the secure store
    const rawToken = await ext.context.secrets.get(
      ext.connectionNode.details.alias
    );
    const token = JSON.parse(rawToken!);

    const username = jwt_decode<JwtUser>(token.accessToken);
    if (username === undefined || username.preferred_username === "") {
      ext.outputChannel.appendLine(
        "JWT did not contain a valid preferred username"
      );
    }

    const options = {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        username: username.preferred_username!,
      },
      body: {
        output: variableName,
        isTableView: false,
        params: {
          table: "close",
          startTS: "2021-07-26T13:58:00.000000000",
          endTS: "2023-07-26T14:03:00.000000000",
        },
      },
      json: true,
    };

    const scratchpadResponse = await requestPromise.post(
      scratchpadURL.toString(),
      options
    );

    ext.outputChannel.append(scratchpadResponse);
  }
}

export async function getScratchpadQuery(
  query: string,
  context?: string
): Promise<any | undefined> {
  if (ext.connectionNode instanceof InsightsNode) {
    const scratchpadURL = new url.URL(
      ext.insightsAuthUrls.scratchpadURL,
      ext.connectionNode.details.server
    );

    // get the access token from the secure store
    const rawToken = await ext.context.secrets.get(
      ext.connectionNode.details.alias
    );
    const token = JSON.parse(rawToken!);

    const options = {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Username: "test",
      },
      body: { expression: query, language: "q", context: context || "." },
      json: true,
    };

    const scratchpadResponse = await requestPromise.post(
      scratchpadURL.toString(),
      options
    );

    return scratchpadResponse;
  }
  return undefined;
}

export async function removeInsightsConnection(
  viewItem: InsightsNode
): Promise<void> {
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
  // handle cleaning up existing connection
  if (
    ext.connectionNode !== undefined &&
    ext.connectionNode.label === viewItem.label
  ) {
    ext.connectionNode = undefined;
    if (ext.connection !== undefined) {
      ext.connection.disconnect();
      ext.connection = undefined;
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
  ext.connectionNode = undefined;
  const queryConsole = ExecutionConsole.start();
  queryConsole.dispose();
  ext.serverProvider.reload();
}

export async function executeQuery(
  query: string,
  context?: string
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
    const queryRes = await getScratchpadQuery(query, context);
    writeScratchpadResult(queryRes, query);
  } else if (ext.connection !== undefined) {
    query = sanitizeQuery(query);
    const queryRes = await ext.connection.executeQuery(query, context);
    writeQueryResult(queryRes, query);
  } else {
    queryConsole.appendQueryError(
      query,
      "Query is empty",
      !!ext.connection,
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

export function runQuery(type: ExecutionTypes) {
  const editor = window.activeTextEditor;
  if (editor) {
    let context;
    let query;
    switch (type) {
      case ExecutionTypes.QuerySelection:
        query = editor?.document.getText(
          new Range(editor.selection.start, editor.selection.end)
        );

        if (query === "") {
          const docLine = editor.selection.active.line;
          query = editor.document.lineAt(docLine).text;
          context = getQueryContext(docLine);
        } else {
          context = getQueryContext(editor.selection.end.line);
        }
        break;
      case ExecutionTypes.QueryFile:
      default:
        query = editor.document.getText();
        context = getQueryContext();
    }
    executeQuery(query, context);
  }
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

export function writeQueryResult(
  result: string | string[],
  query: string,
  dataSourceType?: string
): void {
  const queryConsole = ExecutionConsole.start();
  const res = Array.isArray(result) ? result[0] : result;
  if (
    (ext.connection || ext.connectionNode) &&
    !res.startsWith(queryConstants.error)
  ) {
    queryConsole.append(
      result,
      query,
      ext.connectionNode?.label ? ext.connectionNode.label : "",
      dataSourceType
    );
  } else {
    queryConsole.appendQueryError(
      query,
      res.substring(queryConstants.error.length),
      !!ext.connection,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
    );
  }
}

function writeScratchpadResult(result: ScratchpadResult, query: string): void {
  const queryConsole = ExecutionConsole.start();

  if (result.error) {
    queryConsole.appendQueryError(
      query,
      result.errorMsg,
      true,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
    );
  } else {
    queryConsole.append(
      result.data,
      query,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
    );
  }
}
