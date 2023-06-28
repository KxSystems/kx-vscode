import { readFileSync } from "fs-extra";
import { join } from "path";
import * as url from "url";
import {
  commands,
  InputBoxOptions,
  ProgressLocation,
  QuickPickItem,
  QuickPickOptions,
  Range,
  window,
} from "vscode";
import { ext } from "../extensionVariables";
import { Connection } from "../models/connection";
import { ExecutionTypes } from "../models/execution";
import { Insights } from "../models/insights";
import {
  connectionAliasInput,
  connectionHostnameInput,
  connectionPasswordInput,
  connectionPortInput,
  connectionUsernameInput,
  insightsAliasInput,
  insightsUrlInput,
  kdbEndpoint,
  kdbInsightsEndpoint,
  serverEndpointPlaceHolder,
  serverEndpoints,
} from "../models/items/server";
import { queryConstants } from "../models/queryResult";
import { ResourceGroupItem } from "../models/resourceGroupItem";
import { Server } from "../models/server";
import { ServerObject } from "../models/serverObject";
import { SubscriptionItem } from "../models/subscriptionItem";
import {
  createResourceGroup,
  showResourceGroups,
  showSubscriptions,
} from "../services/azureProvider";
import { signIn } from "../services/kdbInsights/codeFlowLogin";
import { InsightsNode, KdbNode } from "../services/kdbTreeProvider";
import {
  addLocalConnectionContexts,
  getHash,
  getInsights,
  getServerName,
  getServers,
  removeLocalConnectionContext,
  updateInsights,
  updateServers,
} from "../utils/core";
import { ExecutionConsole } from "../utils/executionConsole";
import { sanitizeQuery } from "../utils/queryUtils";
import {
  validateServerAlias,
  validateServerName,
  validateServerPort,
  validateServerUsername,
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
        insights_alias = host.host.split(".")[0];
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

export async function addAzureConnection() {
  if (!(await ext.azureAccount.waitForLogin())) {
    await commands.executeCommand("azure-account.askForLogin");
  }

  let subscriptions: SubscriptionItem[] = [];

  window
    .withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Retrieving Azure subscriptions, please wait...",
        cancellable: true,
      },
      async (progress, token) => {
        token.onCancellationRequested(() => {
          ext.outputChannel.appendLine(
            "User cancelled the connection to Azure for subscriptions."
          );
        });

        progress.report({ increment: 50 });
        subscriptions = await showSubscriptions();
        progress.report({ increment: 100 });

        return new Promise<void>((resolve) => {
          resolve();
        });
      }
    )
    .then(async () => {
      const result = await window.showQuickPick(subscriptions);
      if (result != undefined) {
        const resourceGroups: ResourceGroupItem[] = [];
        window
          .withProgress(
            {
              location: ProgressLocation.Notification,
              title:
                "Retrieving resource groups for the subscription, please wait...",
              cancellable: true,
            },
            async (progress, token) => {
              token.onCancellationRequested(() => {
                ext.outputChannel.appendLine(
                  "User cancelled the connection to Azure for resource groups."
                );
              });

              progress.report({ increment: 50 });
              const resourceGroupsResult = await showResourceGroups(result);
              resourceGroups.push({ label: "$(plus) Create Resource Group" });
              resourceGroups.push(...resourceGroupsResult);
              progress.report({ increment: 100 });

              return new Promise<void>((resolve) => {
                resolve();
              });
            }
          )
          .then(async () => {
            const resourceGroup = await window.showQuickPick(resourceGroups);
            if (resourceGroup != undefined) {
              if (resourceGroup.label === "$(plus) Create Resource Group") {
                await createResourceGroup(result);
                return;
              }
              window.showInformationMessage(resourceGroup.label);
            }
          });
      }
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

  window.showInputBox(connectionAlias).then(async (alias) => {
    window.showInputBox(connectionHostname).then(async (hostname) => {
      if (hostname) {
        window.showInputBox(connectionPort).then(async (port) => {
          if (port) {
            window.showInputBox(connectionUsername).then(async (username) => {
              window.showInputBox(connectionPassword).then(async (password) => {
                // store secrets
                let authUsed = false;
                if (username && password) {
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
  const tokens = await signIn(viewItem.details.server);
  ext.outputChannel.appendLine(
    `Connection established successfully to: ${viewItem.details.server}`
  );
  ext.connectionNode = viewItem;
  ext.serverProvider.reload();
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
    ext.connection = new Connection(connection, creds);
  } else {
    ext.connection = new Connection(connection);
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
}

export async function disconnect(): Promise<void> {
  ext.connection?.disconnect();
  await commands.executeCommand("setContext", "kdb.connected", false);
  ext.connectionNode = undefined;
  const queryConsole = ExecutionConsole.start();
  queryConsole.dispose();
  ext.serverProvider.reload();
}

export async function executeQuery(query: string): Promise<void> {
  const queryConsole = ExecutionConsole.start();
  if (ext.connection !== undefined && query.length > 0) {
    query = sanitizeQuery(query);
    const queryRes = await ext.connection.executeQuery(query);
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

export function runQuery(type: ExecutionTypes) {
  const editor = window.activeTextEditor;
  if (editor) {
    let query;
    switch (type) {
      case ExecutionTypes.QuerySelection:
        query = editor?.document.getText(
          new Range(editor.selection.start, editor.selection.end)
        );
        if (query === "") {
          const docLine = editor.selection.active.line;
          query = editor.document.lineAt(docLine).text;
        }
        break;
      case ExecutionTypes.QueryFile:
      default:
        query = editor.document.getText();
    }
    executeQuery(query);
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

function writeQueryResult(result: string, query: string): void {
  const queryConsole = ExecutionConsole.start();
  if (ext.connection && !result.startsWith(queryConstants.error)) {
    queryConsole.append(
      result,
      query,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
    );
  } else {
    queryConsole.appendQueryError(
      query,
      result.substring(queryConstants.error.length),
      !!ext.connection,
      ext.connectionNode?.label ? ext.connectionNode.label : ""
    );
  }
}
